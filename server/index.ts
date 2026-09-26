import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { Worker } from "node:worker_threads";
import { AGENT_TOOL_DEFINITIONS, executeAgentTool } from "../src/agentTools";
import { BoundedRateLimiter, clientIp } from "./safety";

const PORT = Number(process.env.PORT ?? "8080");
const STATIC_ROOT = resolve(process.env.STATIC_ROOT ?? "/app/dist");
const TRUST_CF_CONNECTING_IP = process.env.TRUST_CF_CONNECTING_IP === "true";
const SERVER_INFO = { name: "yw1-iv-calculator", version: "0.1.0" };
const MODERN_VERSION = "2026-07-28";
const LEGACY_VERSION = "2025-11-25";
const INSTRUCTIONS =
  "Yo-kai Watch 1 IV calculator. Use search_yokai to resolve species IDs, calculate_stats for forward calculation, and reverse_iv for observed-stat reverse calculation. IV_B_1 must total 10.";

const generalRate = new BoundedRateLimiter();
const reverseRate = new BoundedRateLimiter();
const MAX_REVERSE_WORKERS = 1;
const REVERSE_TIMEOUT_MS = 15_000;
let activeReverseWorkers = 0;

function runReverseIvInWorker(args) {
  if (activeReverseWorkers >= MAX_REVERSE_WORKERS) {
    return Promise.reject(new Error("reverse_iv server is busy; retry shortly"));
  }

  let worker;
  try {
    worker = new Worker(
      new URL("../dist-worker/reverseWorker.js", import.meta.url),
      {
        type: "module",
        resourceLimits: {
          maxOldGenerationSizeMb: 96,
          maxYoungGenerationSizeMb: 16,
          stackSizeMb: 4,
        },
      },
    );
  } catch (error) {
    return Promise.reject(error);
  }

  activeReverseWorkers += 1;
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      activeReverseWorkers -= 1;
      clearTimeout(timer);
      void worker.terminate();
      callback(value);
    };

    const timer = setTimeout(() => {
      finish(rejectPromise, new Error("reverse_iv exceeded the 15 second execution limit"));
    }, REVERSE_TIMEOUT_MS);

    worker.once("message", (message) => {
      if (message?.type === "success") {
        finish(resolvePromise, message.result);
        return;
      }
      finish(
        rejectPromise,
        new Error(message?.error ?? "reverse_iv worker returned an invalid response"),
      );
    });
    worker.once("error", (error) => finish(rejectPromise, error));
    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        finish(rejectPromise, new Error("reverse_iv worker exited with code " + code));
      }
    });

    worker.postMessage(args);
  });
}

function jsonHeaders(extra = {}) {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, GET, HEAD, OPTIONS",
    "access-control-allow-headers":
      "Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id",
    "access-control-expose-headers": "MCP-Protocol-Version",
    ...extra,
  };
}

function writeJson(res, status, value, extra = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    ...jsonHeaders(extra),
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function writeEmpty(res, status, extra = {}) {
  res.writeHead(status, jsonHeaders(extra));
  res.end();
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new RangeError("Request body exceeds 1 MB");
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) throw new TypeError("Request body is required");
  return JSON.parse(body);
}

function rpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

function modernMeta() {
  return { "io.modelcontextprotocol/serverInfo": SERVER_INFO };
}

function modernResult(result) {
  return {
    resultType: "complete",
    ...result,
    _meta: { ...(result._meta ?? {}), ...modernMeta() },
  };
}

function toolCatalog() {
  return [...AGENT_TOOL_DEFINITIONS]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((definition) => ({
      name: definition.name,
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      annotations: definition.annotations,
    }));
}

function validateModernHeaders(req, message) {
  const headerVersion = req.headers["mcp-protocol-version"];
  const headerMethod = req.headers["mcp-method"];
  const headerName = req.headers["mcp-name"];

  if (headerVersion !== MODERN_VERSION) {
    throw new TypeError("MCP-Protocol-Version must be " + MODERN_VERSION);
  }
  if (headerMethod !== message.method) {
    throw new TypeError("Mcp-Method header must match the JSON-RPC method");
  }
  if (message.method === "tools/call") {
    const expectedName = message.params?.name;
    if (typeof expectedName !== "string" || headerName !== expectedName) {
      throw new TypeError("Mcp-Name header must match params.name for tools/call");
    }
  }
}

function isModernRequest(req, message) {
  return (
    req.headers["mcp-protocol-version"] === MODERN_VERSION ||
    message?.method === "server/discover" ||
    message?.params?._meta?.["io.modelcontextprotocol/protocolVersion"] === MODERN_VERSION
  );
}

async function handleMcp(req, res) {
  if (req.method === "OPTIONS") {
    writeEmpty(res, 204);
    return;
  }
  if (req.method !== "POST") {
    writeJson(res, 405, rpcError(null, -32600, "MCP endpoint accepts POST requests"));
    return;
  }

  const ip = clientIp(req, TRUST_CF_CONNECTING_IP);
  if (!generalRate.take(ip, 60, 60_000)) {
    writeJson(res, 429, rpcError(null, -32000, "Rate limit exceeded"));
    return;
  }

  let message;
  try {
    message = await readJsonBody(req);
  } catch (error) {
    writeJson(
      res,
      error instanceof RangeError ? 413 : 400,
      rpcError(null, -32700, error instanceof Error ? error.message : "Invalid JSON"),
    );
    return;
  }

  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    writeJson(res, 400, rpcError(message?.id, -32600, "Invalid JSON-RPC request"));
    return;
  }

  if (message.id === undefined) {
    writeEmpty(res, 202);
    return;
  }

  const modern = isModernRequest(req, message);
  if (modern) {
    try {
      validateModernHeaders(req, message);
    } catch (error) {
      writeJson(
        res,
        400,
        rpcError(
          message.id,
          -32602,
          error instanceof Error ? error.message : "Invalid MCP headers",
        ),
      );
      return;
    }
  }

  const protocolHeaders = modern
    ? { "MCP-Protocol-Version": MODERN_VERSION }
    : { "MCP-Protocol-Version": LEGACY_VERSION };

  switch (message.method) {
    case "server/discover": {
      if (!modern) {
        writeJson(
          res,
          400,
          rpcError(message.id, -32602, "server/discover requires MCP " + MODERN_VERSION),
          protocolHeaders,
        );
        return;
      }
      writeJson(
        res,
        200,
        {
          jsonrpc: "2.0",
          id: message.id,
          result: modernResult({
            supportedVersions: [MODERN_VERSION],
            capabilities: { tools: {} },
            instructions: INSTRUCTIONS,
            ttlMs: 3_600_000,
            cacheScope: "public",
          }),
        },
        protocolHeaders,
      );
      return;
    }

    case "initialize": {
      writeJson(
        res,
        200,
        {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: LEGACY_VERSION,
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
            instructions: INSTRUCTIONS,
          },
        },
        { "MCP-Protocol-Version": LEGACY_VERSION },
      );
      return;
    }

    case "ping": {
      writeJson(
        res,
        200,
        {
          jsonrpc: "2.0",
          id: message.id,
          result: modern ? modernResult({}) : {},
        },
        protocolHeaders,
      );
      return;
    }

    case "tools/list": {
      const result = { tools: toolCatalog() };
      writeJson(
        res,
        200,
        {
          jsonrpc: "2.0",
          id: message.id,
          result: modern
            ? modernResult({ ...result, ttlMs: 3_600_000, cacheScope: "public" })
            : result,
        },
        protocolHeaders,
      );
      return;
    }

    case "tools/call": {
      const name = message.params?.name;
      const args = message.params?.arguments ?? {};
      if (
        typeof name !== "string" ||
        !AGENT_TOOL_DEFINITIONS.some((tool) => tool.name === name)
      ) {
        writeJson(
          res,
          400,
          rpcError(message.id, -32602, "Unknown or missing tool name"),
          protocolHeaders,
        );
        return;
      }

      if (name === "reverse_iv" && !reverseRate.take(ip, 10, 60_000)) {
        writeJson(
          res,
          429,
          rpcError(message.id, -32000, "reverse_iv rate limit exceeded"),
          protocolHeaders,
        );
        return;
      }

      let toolResult;
      try {
        toolResult =
          name === "reverse_iv"
            ? await runReverseIvInWorker(args)
            : executeAgentTool(name, args);
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : "Tool execution failed";
        const result = {
          content: [{ type: "text", text: messageText }],
          structuredContent: { error: messageText },
          isError: true,
        };
        writeJson(
          res,
          200,
          {
            jsonrpc: "2.0",
            id: message.id,
            result: modern ? modernResult(result) : result,
          },
          protocolHeaders,
        );
        return;
      }

      const result = {
        content: [{ type: "text", text: JSON.stringify(toolResult) }],
        structuredContent: toolResult,
        isError: false,
      };
      writeJson(
        res,
        200,
        {
          jsonrpc: "2.0",
          id: message.id,
          result: modern ? modernResult(result) : result,
        },
        protocolHeaders,
      );
      return;
    }

    default:
      writeJson(
        res,
        404,
        rpcError(message.id, -32601, "Method not found: " + message.method),
        protocolHeaders,
      );
  }
}

function contentType(pathname) {
  switch (extname(pathname).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

async function serveStatic(req, res, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const rootWithSep = STATIC_ROOT.endsWith(sep) ? STATIC_ROOT : STATIC_ROOT + sep;
  let filePath = resolve(STATIC_ROOT, relative);

  if (filePath !== STATIC_ROOT && !filePath.startsWith(rootWithSep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = resolve(filePath, "index.html");
    }
    const body = await readFile(filePath);
    const cacheControl = pathname.startsWith("/assets/")
      ? "public, max-age=604800, immutable"
      : pathname === "/index.html" || pathname === "/"
        ? "no-cache"
        : "public, max-age=3600";

    res.writeHead(200, {
      "content-type": contentType(filePath),
      "content-length": body.length,
      "cache-control": cacheControl,
    });
    if (req.method === "HEAD") {
      res.end();
    } else {
      res.end(body);
    }
    return;
  } catch {
    if (!extname(pathname)) {
      const body = await readFile(resolve(STATIC_ROOT, "index.html"));
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": body.length,
        "cache-control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }
    res.writeHead(404);
    res.end("Not Found");
  }
}

function publicOrigin(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0].trim()
      : req.socket.encrypted
        ? "https"
        : "http";
  const forwardedHost = req.headers["x-forwarded-host"];
  const host =
    typeof forwardedHost === "string"
      ? forwardedHost.split(",")[0].trim()
      : req.headers.host ?? "yw1-iv.alec-ofc.com";
  return protocol + "://" + host;
}

async function handleHttpRequest(req, res) {
  let pathname;
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    pathname = decodeURIComponent(url.pathname);
  } catch (error) {
    res.writeHead(400, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end("Bad Request");
    return;
  }

  if (pathname === "/healthz") {
    const body = "ok\n";
    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store",
    });
    res.end(body);
    return;
  }

  if (pathname === "/mcp") {
    await handleMcp(req, res);
    return;
  }

  if (pathname === "/.well-known/mcp.json") {
    const origin = publicOrigin(req);
    writeJson(res, 200, {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      description: "Yo-kai Watch 1 IV calculator tools",
      endpoints: { streamable_http: origin + "/mcp" },
      protocolVersions: [MODERN_VERSION, LEGACY_VERSION],
      capabilities: { tools: true, resources: false, prompts: false },
      authentication: { type: "none" },
      tools: AGENT_TOOL_DEFINITIONS.map((tool) => tool.name),
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method Not Allowed");
    return;
  }

  await serveStatic(req, res, pathname);
}

const httpServer = createServer((req, res) => {
  void handleHttpRequest(req, res).catch((error) => {
    console.error("Unhandled request error", error);
    if (!res.headersSent) {
      res.writeHead(500, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
    }
    res.end("Internal Server Error");
  });
});

const ratePruneTimer = setInterval(() => {
  generalRate.prune();
  reverseRate.prune();
}, 60_000);
ratePruneTimer.unref();

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("yw1-iv-calculator listening on :" + PORT);
});

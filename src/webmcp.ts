import {
  AGENT_TOOL_DEFINITIONS,
  buildReverseIvToolResult,
  executeAgentTool,
  normalizeReverseIvInput,
  type CalculateStatsToolResult,
  type ReverseIvToolResult,
} from "./agentTools";
import type { WorkerResponse } from "./workers/reverseSearch.worker";

interface WebMcpModelContext {
  registerTool(
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: {
        readOnlyHint?: boolean;
        consequentialHint?: boolean;
        untrustedContentHint?: boolean;
        debugging?: boolean;
      };
      execute: (
        input: Record<string, unknown>,
        context?: { signal?: AbortSignal },
      ) => unknown | Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ): void | Promise<void>;
}

export interface WebMcpUiActions {
  showForward(result: CalculateStatsToolResult): void;
  showReverse(result: ReverseIvToolResult): void;
}

export function registerWebMcpTools(actions: WebMcpUiActions): () => void {
  const modelContext = (
    document as Document & { modelContext?: WebMcpModelContext }
  ).modelContext;
  if (!modelContext?.registerTool) {
    return () => {};
  }

  const controller = new AbortController();

  for (const definition of AGENT_TOOL_DEFINITIONS) {
    const registration = modelContext.registerTool(
      {
        name: definition.name,
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
        annotations: {
          readOnlyHint: true,
          consequentialHint: false,
          untrustedContentHint: false,
          debugging: false,
        },
        execute: async (
          input: Record<string, unknown>,
          context?: { signal?: AbortSignal },
        ) => {
          if (definition.name === "reverse_iv") {
            const normalized = normalizeReverseIvInput(input);
            const worker = new Worker(
              new URL("./workers/reverseSearch.worker.ts", import.meta.url),
              { type: "module" },
            );

            const response = await new Promise<WorkerResponse>((resolve, reject) => {
              const cleanup = () => {
                context?.signal?.removeEventListener("abort", onAbort);
                worker.terminate();
              };
              const onAbort = () => {
                cleanup();
                reject(new DOMException("reverse_iv was aborted", "AbortError"));
              };

              worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                cleanup();
                resolve(event.data);
              };
              worker.onerror = (event) => {
                cleanup();
                reject(new Error(event.message || "reverse_iv worker failed"));
              };
              context?.signal?.addEventListener("abort", onAbort, { once: true });
              worker.postMessage({ type: "search", payload: normalized });
            });

            if (response.type === "error") {
              throw new Error(response.error);
            }

            const result = buildReverseIvToolResult(normalized, response.payload);
            actions.showReverse(result);
            return JSON.stringify(result);
          }

          const result = executeAgentTool(definition.name, input);
          if (definition.name === "calculate_stats") {
            actions.showForward(result as CalculateStatsToolResult);
          }
          return JSON.stringify(result);
        },
      },
      { signal: controller.signal },
    );

    void Promise.resolve(registration).catch((error) => {
      console.warn("WebMCP tool registration failed for " + definition.name, error);
    });
  }

  return () => controller.abort();
}

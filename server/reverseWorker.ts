import { parentPort } from "node:worker_threads";
import { reverseIvTool } from "../src/agentTools";

if (!parentPort) {
  throw new Error("reverse worker requires a parent port");
}

parentPort.on("message", (args: unknown) => {
  try {
    parentPort.postMessage({ type: "success", result: reverseIvTool(args) });
  } catch (error) {
    parentPort.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "reverse_iv worker failed",
    });
  }
});

import {
  AGENT_TOOL_DEFINITIONS,
  executeAgentTool,
  type CalculateStatsToolResult,
  type ReverseIvToolResult,
} from "./agentTools";

export interface WebMcpUiActions {
  showForward(result: CalculateStatsToolResult): void;
  showReverse(result: ReverseIvToolResult): void;
}

export function registerWebMcpTools(actions: WebMcpUiActions): () => void {
  const modelContext = document.modelContext;
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
        execute: async (input) => {
          const result = executeAgentTool(definition.name, input);

          if (definition.name === "calculate_stats") {
            actions.showForward(result as CalculateStatsToolResult);
          } else if (definition.name === "reverse_iv") {
            actions.showReverse(result as ReverseIvToolResult);
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

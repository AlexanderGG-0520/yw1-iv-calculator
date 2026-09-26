import {
  AGENT_TOOL_DEFINITIONS,
  executeAgentTool,
  type CalculateStatsToolResult,
  type ReverseIvToolResult,
} from "./agentTools";

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
      execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
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
        execute: async (input: Record<string, unknown>) => {
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

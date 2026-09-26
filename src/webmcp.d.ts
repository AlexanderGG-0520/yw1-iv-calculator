export {};

declare global {
  interface Document {
    modelContext?: {
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
    };
  }
}

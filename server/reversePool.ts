import { Worker } from "node:worker_threads";

const DEFAULT_MAX_WORKERS = 1;
const DEFAULT_TIMEOUT_MS = 15_000;

function abortError(): Error {
  const error = new Error("reverse_iv request was aborted");
  error.name = "AbortError";
  return error;
}

export interface ReverseWorkerLike {
  once(event: "message", listener: (message: unknown) => void): this;
  once(event: "error", listener: (error: Error) => void): this;
  once(event: "exit", listener: (code: number) => void): this;
  off(event: "message", listener: (message: unknown) => void): this;
  off(event: "error", listener: (error: Error) => void): this;
  off(event: "exit", listener: (code: number) => void): this;
  postMessage(value: unknown): void;
  terminate(): Promise<number> | number;
}

type WorkerFactory = () => ReverseWorkerLike;

export class ReverseWorkerPool {
  private activeWorkers = 0;

  constructor(
    private readonly createWorker: WorkerFactory = () =>
      new Worker(new URL("../dist-worker/reverseWorker.js", import.meta.url), {
        type: "module",
        resourceLimits: {
          maxOldGenerationSizeMb: 96,
          maxYoungGenerationSizeMb: 16,
          stackSizeMb: 4,
        },
      }),
    private readonly maxWorkers = DEFAULT_MAX_WORKERS,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  get active(): number {
    return this.activeWorkers;
  }

  run(args: unknown, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) {
      return Promise.reject(abortError());
    }
    if (this.activeWorkers >= this.maxWorkers) {
      return Promise.reject(new Error("reverse_iv server is busy; retry shortly"));
    }

    let worker: ReverseWorkerLike;
    try {
      worker = this.createWorker();
    } catch (error) {
      return Promise.reject(error);
    }

    this.activeWorkers += 1;

    return new Promise((resolvePromise, rejectPromise) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        signal?.removeEventListener("abort", onAbort);
        worker.off("message", onMessage);
        worker.off("error", onError);
        worker.off("exit", onExit);
      };

      const finish = (kind: "resolve" | "reject", value: unknown) => {
        if (settled) return;
        settled = true;
        this.activeWorkers -= 1;
        cleanup();
        try {
          void Promise.resolve(worker.terminate()).catch(() => undefined);
        } catch {
          // Slot release and promise settlement must not depend on terminate().
        }

        if (kind === "resolve") {
          resolvePromise(value);
        } else {
          rejectPromise(value);
        }
      };

      const onMessage = (message: unknown) => {
        const response = message as
          | { type?: string; result?: unknown; error?: string }
          | null
          | undefined;
        if (response?.type === "success") {
          finish("resolve", response.result);
          return;
        }
        finish(
          "reject",
          new Error(response?.error ?? "reverse_iv worker returned an invalid response"),
        );
      };
      const onError = (error: Error) => finish("reject", error);
      const onExit = (code: number) => {
        if (!settled && code !== 0) {
          finish("reject", new Error("reverse_iv worker exited with code " + code));
        }
      };
      const onAbort = () => finish("reject", abortError());

      worker.once("message", onMessage);
      worker.once("error", onError);
      worker.once("exit", onExit);
      signal?.addEventListener("abort", onAbort, { once: true });

      if (signal?.aborted) {
        onAbort();
        return;
      }

      timer = setTimeout(() => {
        finish(
          "reject",
          new Error("reverse_iv exceeded the 15 second execution limit"),
        );
      }, this.timeoutMs);

      try {
        worker.postMessage(args);
      } catch (error) {
        finish("reject", error);
      }
    });
  }
}

export function requestDisconnectSignal(
  req: {
    once(event: "aborted", listener: () => void): unknown;
    off(event: "aborted", listener: () => void): unknown;
  },
  res: {
    writableEnded: boolean;
    once(event: "close", listener: () => void): unknown;
    off(event: "close", listener: () => void): unknown;
  },
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();

  const abort = () => controller.abort();
  const onResponseClose = () => {
    if (!res.writableEnded) {
      abort();
    }
  };

  req.once("aborted", abort);
  res.once("close", onResponseClose);

  return {
    signal: controller.signal,
    cleanup: () => {
      req.off("aborted", abort);
      res.off("close", onResponseClose);
    },
  };
}


export async function runReverseForRequest(
  pool: ReverseWorkerPool,
  args: unknown,
  req: Parameters<typeof requestDisconnectSignal>[0],
  res: Parameters<typeof requestDisconnectSignal>[1],
): Promise<unknown> {
  const disconnect = requestDisconnectSignal(req, res);
  try {
    return await pool.run(args, disconnect.signal);
  } finally {
    disconnect.cleanup();
  }
}

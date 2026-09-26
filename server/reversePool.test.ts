// @vitest-environment node

import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  requestDisconnectSignal,
  ReverseWorkerPool,
  runReverseForRequest,
  type ReverseWorkerLike,
} from "./reversePool";

class FakeWorker extends EventEmitter {
  terminated = false;
  posted: unknown[] = [];

  postMessage(value: unknown): void {
    this.posted.push(value);
  }

  terminate(): Promise<number> {
    this.terminated = true;
    return Promise.resolve(0);
  }
}

function fakeRequestResponse() {
  const req = new EventEmitter();
  const res = new EventEmitter() as EventEmitter & {
    writableEnded: boolean;
  };
  res.writableEnded = false;
  return { req, res };
}

describe("reverse worker pool cancellation", () => {
  it("releases the only slot immediately when the MCP response disconnects, then accepts the next reverse", async () => {
    const workers: FakeWorker[] = [];
    const pool = new ReverseWorkerPool(
      () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker as unknown as ReverseWorkerLike;
      },
      1,
      15_000,
    );

    const firstHttp = fakeRequestResponse();
    const first = runReverseForRequest(
      pool,
      { request: 1 },
      firstHttp.req as never,
      firstHttp.res as never,
    );
    expect(pool.active).toBe(1);
    expect(workers[0].posted).toEqual([{ request: 1 }]);

    firstHttp.res.emit("close");

    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    expect(pool.active).toBe(0);
    expect(workers[0].terminated).toBe(true);
    expect(firstHttp.req.listenerCount("aborted")).toBe(0);
    expect(firstHttp.res.listenerCount("close")).toBe(0);

    const secondHttp = fakeRequestResponse();
    const second = runReverseForRequest(
      pool,
      { request: 2 },
      secondHttp.req as never,
      secondHttp.res as never,
    );
    expect(pool.active).toBe(1);
    expect(workers[1].posted).toEqual([{ request: 2 }]);

    workers[1].emit("message", { type: "success", result: "ok" });

    await expect(second).resolves.toBe("ok");
    expect(pool.active).toBe(0);
    expect(workers[1].terminated).toBe(true);
    expect(secondHttp.req.listenerCount("aborted")).toBe(0);
    expect(secondHttp.res.listenerCount("close")).toBe(0);
  });

  it("also aborts when the request itself is aborted", async () => {
    const worker = new FakeWorker();
    const pool = new ReverseWorkerPool(
      () => worker as unknown as ReverseWorkerLike,
      1,
      15_000,
    );
    const http = fakeRequestResponse();

    const pending = runReverseForRequest(
      pool,
      { request: 1 },
      http.req as never,
      http.res as never,
    );

    http.req.emit("aborted");

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(pool.active).toBe(0);
    expect(worker.terminated).toBe(true);
  });

  it("does not abort on the normal close event after the response has ended", () => {
    const { req, res } = fakeRequestResponse();
    res.writableEnded = true;

    const disconnect = requestDisconnectSignal(
      req as never,
      res as never,
    );

    res.emit("close");
    expect(disconnect.signal.aborted).toBe(false);
    disconnect.cleanup();
    expect(req.listenerCount("aborted")).toBe(0);
    expect(res.listenerCount("close")).toBe(0);
  });
});

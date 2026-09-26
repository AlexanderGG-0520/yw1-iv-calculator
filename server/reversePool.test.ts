// @vitest-environment node

import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  requestDisconnectSignal,
  ReverseWorkerPool,
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

describe("reverse worker pool cancellation", () => {
  it("releases the only worker slot immediately after abort so the next reverse can run", async () => {
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

    const controller = new AbortController();
    const first = pool.run({ request: 1 }, controller.signal);
    expect(pool.active).toBe(1);

    controller.abort();

    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    expect(pool.active).toBe(0);
    expect(workers[0].terminated).toBe(true);

    const second = pool.run({ request: 2 });
    expect(pool.active).toBe(1);
    expect(workers[1].posted).toEqual([{ request: 2 }]);

    workers[1].emit("message", { type: "success", result: "ok" });

    await expect(second).resolves.toBe("ok");
    expect(pool.active).toBe(0);
    expect(workers[1].terminated).toBe(true);
  });

  it("turns an unfinished response close into an AbortSignal and cleans listeners", () => {
    const req = new EventEmitter();
    const res = new EventEmitter() as EventEmitter & { writableEnded: boolean };
    res.writableEnded = false;

    const disconnect = requestDisconnectSignal(
      req as never,
      res as never,
    );

    expect(disconnect.signal.aborted).toBe(false);
    res.emit("close");
    expect(disconnect.signal.aborted).toBe(true);

    disconnect.cleanup();
    expect(req.listenerCount("aborted")).toBe(0);
    expect(res.listenerCount("close")).toBe(0);
  });

  it("does not abort on the normal close event after the response has ended", () => {
    const req = new EventEmitter();
    const res = new EventEmitter() as EventEmitter & { writableEnded: boolean };
    res.writableEnded = true;

    const disconnect = requestDisconnectSignal(
      req as never,
      res as never,
    );

    res.emit("close");
    expect(disconnect.signal.aborted).toBe(false);
    disconnect.cleanup();
  });
});

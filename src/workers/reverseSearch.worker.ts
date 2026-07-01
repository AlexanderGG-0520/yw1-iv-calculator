import { reverseSearch } from "../engine/reverseSearch";
import type { SearchInput, SearchResponse } from "../engine/types";

export interface WorkerRequest {
  type: "search";
  payload: SearchInput;
}

export type WorkerResponse =
  | { type: "success"; payload: SearchResponse }
  | { type: "error"; error: string };

const worker = self as DedicatedWorkerGlobalScope;

worker.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== "search") {
    return;
  }

  try {
    const payload = reverseSearch(event.data.payload);
    worker.postMessage({ type: "success", payload } satisfies WorkerResponse);
  } catch (error) {
    worker.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown reverse-search error",
    } satisfies WorkerResponse);
  }
};

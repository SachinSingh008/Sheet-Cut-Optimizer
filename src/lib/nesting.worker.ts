import { optimize, type OptimizationConfig, type OptimizationResult } from "./nesting";
import { type Part } from "./mock-data";

export type WorkerIncomingMessage = {
  type: "START";
  id: number;
  parts: Part[];
  config: OptimizationConfig;
};

export type WorkerOutgoingMessage =
  | { type: "PROGRESS"; id: number; progress: number; message: string }
  | { type: "SUCCESS"; id: number; result: OptimizationResult }
  | { type: "ERROR"; id: number; error: string };

self.onmessage = (e: MessageEvent<WorkerIncomingMessage>) => {
  const { type, id, parts, config } = e.data;
  if (type === "START") {
    try {
      const result = optimize(parts, config, (progress, message) => {
        self.postMessage({
          type: "PROGRESS",
          id,
          progress: Math.min(Math.max(Math.round(progress), 0), 100),
          message: message || "Optimizing...",
        } satisfies WorkerOutgoingMessage);
      });
      self.postMessage({
        type: "SUCCESS",
        id,
        result,
      } satisfies WorkerOutgoingMessage);
    } catch (err: any) {
      self.postMessage({
        type: "ERROR",
        id,
        error: err?.message || "Optimization failed in worker thread",
      } satisfies WorkerOutgoingMessage);
    }
  }
};

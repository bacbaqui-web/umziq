import { buildSelectionSourceAlphaFingerprint } from "@/engines/canvas/helpers/canvasSelectionAlphaFingerprintHelpers";
import type {
  SelectionAlphaBrowserAdapter,
  SelectionSourceAlphaProvider,
  SelectionSourceAlphaProviderEvent,
  SelectionSourceAlphaResult,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

const DEFAULT_MAX_RETAINED_ENTRIES = 2;
const MAX_FAILURE_MEMOS = 8;

type CreateSelectionSourceAlphaProviderOptions = {
  adapter: SelectionAlphaBrowserAdapter;
  maxRetainedEntries?: number;
  observe?: (event: SelectionSourceAlphaProviderEvent) => void;
};

export function createSelectionSourceAlphaProvider({
  adapter,
  maxRetainedEntries = DEFAULT_MAX_RETAINED_ENTRIES,
  observe,
}: CreateSelectionSourceAlphaProviderOptions): SelectionSourceAlphaProvider {
  const canvasTokens = new WeakMap<HTMLCanvasElement, number>();
  const entries = new Map<string, SelectionSourceAlphaResult>();
  const failures = new Map<string, SelectionSourceAlphaResult>();
  const retained = new Set<string>();
  const entryLimit = Math.max(1, Math.floor(maxRetainedEntries));
  let nextCanvasToken = 1;
  let disposed = false;
  const getCanvasToken = (canvas: HTMLCanvasElement) => {
    const cached = canvasTokens.get(canvas);
    if (cached !== undefined) return cached;
    const token = nextCanvasToken++;
    canvasTokens.set(canvas, token);
    return token;
  };
  const notify = (
    type: SelectionSourceAlphaProviderEvent["type"],
    visualFingerprint: string
  ) => observe?.({ type, visualFingerprint });
  const removeEntry = (fingerprint: string) => {
    if (entries.delete(fingerprint)) {
      notify("release", fingerprint);
    }
  };
  const clear = () => {
    entries.clear();
    failures.clear();
    retained.clear();
  };
  return {
    get: (descriptor) => {
      const visualFingerprint =
        buildSelectionSourceAlphaFingerprint(
          descriptor,
          getCanvasToken
        );
      if (disposed) {
        return {
          status: "unavailable",
          visualFingerprint,
          reason: "disposed",
        };
      }
      const cached =
        entries.get(visualFingerprint) ??
        failures.get(visualFingerprint);
      if (cached) {
        notify("reuse", visualFingerprint);
        return cached;
      }
      notify("build", visualFingerprint);
      const result = adapter.build(
        descriptor,
        visualFingerprint
      );
      if (result.status === "unavailable") {
        if (failures.size >= MAX_FAILURE_MEMOS) {
          const oldest = failures.keys().next().value;
          if (oldest) failures.delete(oldest);
        }
        failures.set(visualFingerprint, result);
        notify("failure", visualFingerprint);
        return result;
      }
      while (entries.size >= entryLimit) {
        const target =
          Array.from(entries.keys()).find(
            (fingerprint) => !retained.has(fingerprint)
          ) ?? entries.keys().next().value;
        if (!target) break;
        retained.delete(target);
        removeEntry(target);
      }
      entries.set(visualFingerprint, result);
      return result;
    },
    retain: (fingerprints) => {
      retained.clear();
      fingerprints.slice(-entryLimit).forEach((fingerprint) => {
        if (entries.has(fingerprint)) retained.add(fingerprint);
      });
      Array.from(entries.keys()).forEach((fingerprint) => {
        if (!retained.has(fingerprint)) removeEntry(fingerprint);
      });
    },
    release: (fingerprint) => {
      if (!retained.has(fingerprint)) removeEntry(fingerprint);
    },
    clear,
    dispose: () => {
      if (disposed) return;
      clear();
      disposed = true;
    },
  };
}

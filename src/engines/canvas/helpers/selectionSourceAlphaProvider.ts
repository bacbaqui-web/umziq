import { buildSelectionSourceAlphaFingerprint } from "@/engines/canvas/helpers/canvasSelectionAlphaFingerprintHelpers";
import type {
  SelectionAlphaBrowserAdapter,
  SelectionSourceAlphaDescriptor,
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

function normalizeEntryLimit(value: number | undefined) {
  if (!Number.isFinite(value) || value === undefined) {
    return DEFAULT_MAX_RETAINED_ENTRIES;
  }
  return Math.max(1, Math.floor(value));
}

export function createSelectionSourceAlphaProvider({
  adapter,
  maxRetainedEntries,
  observe,
}: CreateSelectionSourceAlphaProviderOptions): SelectionSourceAlphaProvider {
  const canvasTokens = new WeakMap<HTMLCanvasElement, number>();
  const entries = new Map<string, SelectionSourceAlphaResult>();
  const failures = new Map<string, SelectionSourceAlphaResult>();
  const retained = new Set<string>();
  const entryLimit = normalizeEntryLimit(maxRetainedEntries);
  let nextCanvasToken = 1;
  let disposed = false;

  const getCanvasToken = (canvas: HTMLCanvasElement) => {
    const existing = canvasTokens.get(canvas);
    if (existing !== undefined) return existing;
    const token = nextCanvasToken;
    nextCanvasToken += 1;
    canvasTokens.set(canvas, token);
    return token;
  };

  const getFingerprint = (descriptor: SelectionSourceAlphaDescriptor) =>
    buildSelectionSourceAlphaFingerprint(descriptor, getCanvasToken);

  const notify = (
    type: SelectionSourceAlphaProviderEvent["type"],
    visualFingerprint: string
  ) => observe?.({ type, visualFingerprint });

  const removeEntry = (visualFingerprint: string) => {
    if (!entries.delete(visualFingerprint)) return;
    notify("release", visualFingerprint);
  };

  const enforceEntryLimit = (incomingFingerprint: string) => {
    while (
      !entries.has(incomingFingerprint) &&
      entries.size >= entryLimit
    ) {
      const unretained = Array.from(entries.keys()).find(
        (fingerprint) => !retained.has(fingerprint)
      );
      const oldest = entries.keys().next().value as string | undefined;
      const target = unretained ?? oldest;
      if (!target) break;
      retained.delete(target);
      removeEntry(target);
    }
  };

  const rememberFailure = (
    visualFingerprint: string,
    result: SelectionSourceAlphaResult
  ) => {
    if (failures.size >= MAX_FAILURE_MEMOS) {
      const oldest = failures.keys().next().value as string | undefined;
      if (oldest) failures.delete(oldest);
    }
    failures.set(visualFingerprint, result);
  };

  const clear = () => {
    entries.clear();
    failures.clear();
    retained.clear();
  };

  return {
    get: (descriptor) => {
      const visualFingerprint = getFingerprint(descriptor);
      if (disposed) {
        return {
          status: "unavailable",
          visualFingerprint,
          reason: "disposed",
        };
      }

      const cached = entries.get(visualFingerprint) ?? failures.get(visualFingerprint);
      if (cached) {
        notify("reuse", visualFingerprint);
        return cached;
      }

      notify("build", visualFingerprint);
      const result = adapter.build(descriptor, visualFingerprint);
      if (result.status === "unavailable") {
        rememberFailure(visualFingerprint, result);
        notify("failure", visualFingerprint);
        return result;
      }

      enforceEntryLimit(visualFingerprint);
      entries.set(visualFingerprint, result);
      return result;
    },
    retain: (visualFingerprints) => {
      retained.clear();
      visualFingerprints.slice(-entryLimit).forEach((fingerprint) => {
        if (entries.has(fingerprint)) retained.add(fingerprint);
      });
      Array.from(entries.keys()).forEach((fingerprint) => {
        if (!retained.has(fingerprint)) removeEntry(fingerprint);
      });
    },
    release: (visualFingerprint) => {
      if (retained.has(visualFingerprint)) return;
      removeEntry(visualFingerprint);
    },
    clear,
    dispose: () => {
      if (disposed) return;
      clear();
      disposed = true;
    },
  };
}

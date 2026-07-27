import {
  buildCompositionPreviewCacheKey,
  isCompositionPreviewSurfaceContentEqual,
} from "@/engines/canvas/helpers/compositionCacheKeyHelpers";
import type {
  CompositionPreviewCacheEntry,
  CompositionPreviewCacheRuntimeOptions,
  CompositionPreviewCacheRuntime,
  CompositionPreviewCacheSnapshot,
} from "@/engines/canvas/models/compositionCacheModel";
import type { PreviewRenderSurface } from "@/render";

function clearSurface(surface: PreviewRenderSurface): void {
  surface.canvas.width = 0;
  surface.canvas.height = 0;
}

export function createCompositionPreviewCacheRuntime(
  options: CompositionPreviewCacheRuntimeOptions = {}
): CompositionPreviewCacheRuntime {
  let entries = new Map<string, CompositionPreviewCacheEntry>();
  let frameActiveKeys = new Set<string>();
  let disposed = false;

  const ensureActive = () => {
    if (!disposed) return;
    entries = new Map();
    frameActiveKeys = new Set();
    disposed = false;
  };

  const deleteEntry = (key: string) => {
    const entry = entries.get(key);
    if (!entry) return;
    if (options.releaseSurface) {
      options.releaseSurface(entry.surface);
    } else {
      clearSurface(entry.surface);
    }
    entries.delete(key);
  };

  return {
    beginFrame: () => {
      ensureActive();
      frameActiveKeys = new Set();
    },
    getSurface: (input) => {
      ensureActive();
      const key = buildCompositionPreviewCacheKey(input);
      const entry = entries.get(key);
      if (!entry) return null;
      if (
        !isCompositionPreviewSurfaceContentEqual(
          entry.node,
          input.node
        )
      ) {
        deleteEntry(key);
        return null;
      }
      frameActiveKeys.add(key);
      return entry.surface;
    },
    storeSurface: (input, surface) => {
      ensureActive();
      const key = buildCompositionPreviewCacheKey(input);
      const existing = entries.get(key);
      if (existing && existing.surface !== surface) {
        if (options.releaseSurface) {
          options.releaseSurface(existing.surface);
        } else {
          clearSurface(existing.surface);
        }
      }
      entries.set(key, {
        key,
        node: input.node,
        surface,
      });
      frameActiveKeys.add(key);
    },
    endFrame: () => {
      ensureActive();
      entries.forEach((_, key) => {
        if (!frameActiveKeys.has(key)) deleteEntry(key);
      });
      frameActiveKeys = new Set();
    },
    dispose: () => {
      entries.forEach((entry) => {
        if (options.releaseSurface) {
          options.releaseSurface(entry.surface);
        } else {
          clearSurface(entry.surface);
        }
      });
      entries = new Map();
      frameActiveKeys = new Set();
      disposed = true;
    },
    getSnapshot: (): CompositionPreviewCacheSnapshot => ({
      size: entries.size,
      disposed,
      keys: [...entries.keys()],
    }),
  };
}

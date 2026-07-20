import { buildPreviewSurfaceCacheKey } from "@/engines/canvas/helpers/surfaceCacheKeyHelpers";
import type {
  PreviewSurfaceCacheKeyInput,
  PreviewSurfaceCacheRuntime,
  PreviewSurfaceCacheSnapshot,
} from "@/engines/canvas/models/surfaceCacheModel";
import type { RuntimeMetricRecordPort } from "@/engines/playback-render";
import type {
  PreviewRenderSurface,
} from "@/engines/playback-render";

type PooledSurface = {
  readonly key: string;
  readonly surface: PreviewRenderSurface;
  readonly lastUsedAt: number;
};

function normalizeScale(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getPixelSize(value: number, scale: number): number {
  return Math.max(1, Math.ceil(value * scale));
}

function prepareSurface(
  surface: PreviewRenderSurface,
  input: PreviewSurfaceCacheKeyInput
): PreviewRenderSurface {
  const scale = normalizeScale(input.previewScale);
  const pixelWidth = getPixelSize(input.logicalWidth, scale);
  const pixelHeight = getPixelSize(input.logicalHeight, scale);
  if (surface.canvas.width !== pixelWidth) surface.canvas.width = pixelWidth;
  if (surface.canvas.height !== pixelHeight) surface.canvas.height = pixelHeight;
  surface.context.setTransform(1, 0, 0, 1, 0, 0);
  surface.context.clearRect(0, 0, pixelWidth, pixelHeight);
  surface.context.setTransform(scale, 0, 0, scale, 0, 0);
  return surface;
}

function clearSurface(surface: PreviewRenderSurface): void {
  surface.canvas.width = 0;
  surface.canvas.height = 0;
}

function countPool(poolByKey: ReadonlyMap<string, readonly PooledSurface[]>) {
  let count = 0;
  poolByKey.forEach((surfaces) => {
    count += surfaces.length;
  });
  return count;
}

export function createPreviewSurfaceCacheRuntime({
  maxPoolSize = 8,
  metrics,
}: {
  readonly maxPoolSize?: number;
  readonly metrics?: RuntimeMetricRecordPort;
} = {}): PreviewSurfaceCacheRuntime {
  let poolByKey = new Map<string, PooledSurface[]>();
  let activeSurfaceKey = new WeakMap<PreviewRenderSurface, string>();
  let activeSurfaces = new Set<PreviewRenderSurface>();
  let activeCount = 0;
  let disposed = false;
  let tick = 0;

  const ensureActive = () => {
    if (!disposed) return;
    poolByKey = new Map();
    activeSurfaceKey = new WeakMap();
    activeSurfaces = new Set();
    activeCount = 0;
    disposed = false;
  };

  const recordPoolSize = () => {
    metrics?.increment("surfacePoolSize", countPool(poolByKey));
  };

  const recordActiveCount = () => {
    metrics?.increment("surfaceActive", activeCount);
  };

  const disposePooledSurface = (surface: PreviewRenderSurface) => {
    clearSurface(surface);
    metrics?.increment("surfaceDispose");
  };

  const trimPool = () => {
    let poolSize = countPool(poolByKey);
    if (poolSize <= maxPoolSize) return;
    const pooled = [...poolByKey.values()].flat().sort(
      (left, right) => left.lastUsedAt - right.lastUsedAt
    );

    while (poolSize > maxPoolSize) {
      const next = pooled.shift();
      if (!next) return;
      const bucket = poolByKey.get(next.key) ?? [];
      poolByKey.set(
        next.key,
        bucket.filter((entry) => entry.surface !== next.surface)
      );
      disposePooledSurface(next.surface);
      poolSize -= 1;
    }
  };

  return {
    acquireSurface: (input) => {
      ensureActive();
      const key = buildPreviewSurfaceCacheKey(input);
      const bucket = poolByKey.get(key) ?? [];
      const pooled = bucket.pop() ?? null;
      poolByKey.set(key, bucket);
      tick += 1;

      if (pooled) {
        activeSurfaceKey.set(pooled.surface, key);
        activeSurfaces.add(pooled.surface);
        activeCount += 1;
        metrics?.increment("surfaceReuse");
        recordActiveCount();
        recordPoolSize();
        return prepareSurface(pooled.surface, input);
      }

      const surface = input.createSurface(
        input.logicalWidth,
        input.logicalHeight,
        input.previewScale
      );
      if (!surface) return null;
      activeSurfaceKey.set(surface, key);
      activeSurfaces.add(surface);
      activeCount += 1;
      metrics?.increment("surfaceCreate");
      recordActiveCount();
      recordPoolSize();
      return surface;
    },
    releaseSurface: (surface) => {
      ensureActive();
      const key = activeSurfaceKey.get(surface);
      if (!key) return;
      activeSurfaceKey.delete(surface);
      activeSurfaces.delete(surface);
      activeCount = Math.max(0, activeCount - 1);
      tick += 1;
      const bucket = poolByKey.get(key) ?? [];
      bucket.push({
        key,
        surface,
        lastUsedAt: tick,
      });
      poolByKey.set(key, bucket);
      trimPool();
      recordActiveCount();
      recordPoolSize();
    },
    disposeSurface: (surface) => {
      const key = activeSurfaceKey.get(surface);
      if (key) {
        activeSurfaceKey.delete(surface);
        activeSurfaces.delete(surface);
        activeCount = Math.max(0, activeCount - 1);
      }
      poolByKey.forEach((bucket, bucketKey) => {
        poolByKey.set(
          bucketKey,
          bucket.filter((entry) => entry.surface !== surface)
        );
      });
      disposePooledSurface(surface);
      recordActiveCount();
      recordPoolSize();
    },
    dispose: () => {
      activeSurfaces.forEach((surface) => disposePooledSurface(surface));
      poolByKey.forEach((bucket) => {
        bucket.forEach((entry) => disposePooledSurface(entry.surface));
      });
      poolByKey = new Map();
      activeSurfaceKey = new WeakMap();
      activeSurfaces = new Set();
      activeCount = 0;
      disposed = true;
      recordActiveCount();
      recordPoolSize();
    },
    getSnapshot: (): PreviewSurfaceCacheSnapshot => ({
      activeCount,
      poolSize: countPool(poolByKey),
      disposed,
      keys: [...poolByKey.keys()].filter(
        (key) => (poolByKey.get(key)?.length ?? 0) > 0
      ),
    }),
  };
}

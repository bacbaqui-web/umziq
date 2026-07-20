import type { Composition, Layer } from "@/models";
import type { RenderItem } from "@/engines/project";
import { getPreviewMemorySourceKey } from "@/engines/canvas/helpers/previewMemoryHelpers";
import { buildPreviewCacheKey } from "@/engines/canvas/helpers/previewCacheKeyHelpers";
import { RESOLVED_PREVIEW_QUALITIES } from "@/engines/canvas/constants/previewQualityConstants";
import type { PreviewBuildSource } from "@/engines/canvas/models/previewBuildModel";
import type { PreviewMemorySource } from "@/engines/canvas/models/previewMemoryModel";

type MutablePreviewBuildSource = {
  sourceId: string;
  sourceIds: Set<string>;
  sourceIdentity?: Layer["sourceIdentity"];
  sourceFingerprint: string | null;
  sourceCanvas: HTMLCanvasElement;
  logicalSize: { width: number; height: number };
};

export function collectPreviewBuildSources(
  renderItemsByCompId: Readonly<Record<string, readonly RenderItem[]>>,
  layerMap: ReadonlyMap<string, Layer>
): PreviewBuildSource[] {
  const sourceByStableKey = new Map<string, MutablePreviewBuildSource>();

  Object.values(renderItemsByCompId).forEach((renderItems) => {
    renderItems.forEach((renderItem) => {
      renderItem.drawables.forEach((drawable) => {
        const sourceCanvas = drawable.canvas;
        if (!sourceCanvas) return;
        const sourceId = drawable.sourceLayerId ?? renderItem.sourceId;
        const layer = layerMap.get(sourceId);
        const identitySource = {
          sourceId,
          sourceIdentity: layer?.sourceIdentity,
        };
        const stableKey = getPreviewMemorySourceKey(identitySource);
        const existing = sourceByStableKey.get(stableKey);

        if (existing) {
          existing.sourceIds.add(sourceId);
          return;
        }

        sourceByStableKey.set(stableKey, {
          sourceId,
          sourceIds: new Set([sourceId]),
          sourceIdentity: layer?.sourceIdentity,
          sourceFingerprint: layer?.sourceFingerprint ?? null,
          sourceCanvas,
          logicalSize: {
            width: sourceCanvas.width,
            height: sourceCanvas.height,
          },
        });
      });
    });
  });

  return Array.from(sourceByStableKey.values(), (source) => ({
    ...source,
    sourceIds: Array.from(source.sourceIds).sort(),
    logicalSize: { ...source.logicalSize },
  }));
}

function collectLayerMap(
  compositions: readonly Composition[]
): ReadonlyMap<string, Layer> {
  const layers = new Map<string, Layer>();
  const visit = (composition: Composition) => {
    composition.layers.forEach((layer) => layers.set(layer.id, layer));
    composition.children?.forEach(visit);
  };
  compositions.forEach(visit);
  return layers;
}

export function collectProjectPreviewBuildSources(
  renderItemsByCompId: Readonly<Record<string, readonly RenderItem[]>>,
  compositions: readonly Composition[]
): PreviewBuildSource[] {
  return collectPreviewBuildSources(
    renderItemsByCompId,
    collectLayerMap(compositions)
  );
}

export function toPreviewMemorySources(
  sources: readonly PreviewBuildSource[]
): PreviewMemorySource[] {
  return sources.map((source) => ({
    sourceId: source.sourceId,
    sourceIdentity: source.sourceIdentity,
    sourcePixelSize: {
      width: source.sourceCanvas.width,
      height: source.sourceCanvas.height,
    },
  }));
}

export function getPreviewBuildSourceSetKey(
  sources: readonly PreviewBuildSource[]
): string {
  return JSON.stringify(
    sources
      .map((source) => [
        getPreviewMemorySourceKey(source),
        source.sourceFingerprint,
        source.sourceCanvas.width,
        source.sourceCanvas.height,
        source.logicalSize.width,
        source.logicalSize.height,
        [...source.sourceIds].sort(),
      ])
      .sort(([keyA], [keyB]) => {
        const left = String(keyA);
        const right = String(keyB);
        return left < right ? -1 : left > right ? 1 : 0;
      })
  );
}

export function getPreviewLifecycleRetainedCacheKeys(
  sources: readonly PreviewBuildSource[]
): readonly string[] {
  return sources.flatMap((source) =>
    RESOLVED_PREVIEW_QUALITIES.map((quality) =>
      buildPreviewCacheKey({
        sourceId: source.sourceId,
        sourceIdentity: source.sourceIdentity,
        sourceFingerprint: source.sourceFingerprint,
        quality,
        logicalSize: source.logicalSize,
      })
    )
  );
}

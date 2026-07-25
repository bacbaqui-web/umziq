import type {
  LayerDocumentResultCacheKeyInput,
  LayerDocumentSourceResourceCacheKeyInput,
  LayerDocumentTransformDraftSnapshot,
} from "@/engines/playback-render/models/layerDocumentRuntimeModel";
import type { SourceRegistryKind } from "@/models";

function normalizeNumber(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Object.is(value, -0) ? 0 : value;
}

export function buildLayerDocumentSourceResourceCacheKey(
  input: LayerDocumentSourceResourceCacheKeyInput
): string {
  const expectedPolicy = layerDocumentSourceVisualKeyPolicy(
    input.sourceKind
  );
  if (input.visualKeyPolicy !== expectedPolicy) {
    throw new Error(
      `Source kind ${input.sourceKind} requires ${expectedPolicy}`
    );
  }
  if (input.visualKeyPolicy === "static-source-visual-revision") {
    return JSON.stringify([
      "layer-document-static-source-resource-v1",
      input.sourceKind,
      input.sourceId,
      input.sourceVersion,
      input.sourceFingerprint,
    ]);
  }
  return JSON.stringify([
    "layer-document-timed-source-resource-v1",
    input.sourceKind,
    input.sourceId,
    input.sourceVersion,
    input.sourceFingerprint,
    normalizeNumber(input.localFrame),
    input.quality,
  ]);
}

export function layerDocumentSourceVisualKeyPolicy(
  sourceKind: SourceRegistryKind
): LayerDocumentSourceResourceCacheKeyInput["visualKeyPolicy"] {
  return sourceKind === "psd-node"
    ? "static-source-visual-revision"
    : "timed-frame-quality-sample";
}

export function buildLayerDocumentDraftIdentity(
  input: Omit<LayerDocumentTransformDraftSnapshot, "identity">
): string {
  const patch = input.patch;
  return JSON.stringify([
    "layer-document-draft-v1",
    input.layerDocumentId,
    normalizeNumber(input.globalFrame),
    normalizeNumber(input.localFrame),
    patch.position
      ? [
          normalizeNumber(patch.position.x),
          normalizeNumber(patch.position.y),
        ]
      : null,
    patch.scale
      ? [
          normalizeNumber(patch.scale.x),
          normalizeNumber(patch.scale.y),
        ]
      : null,
    normalizeNumber(patch.rotation ?? Number.NaN),
    normalizeNumber(patch.opacity ?? Number.NaN),
    patch.anchor
      ? [
          normalizeNumber(patch.anchor.x),
          normalizeNumber(patch.anchor.y),
        ]
      : null,
    patch.transformOffset
      ? [
          normalizeNumber(patch.transformOffset.x),
          normalizeNumber(patch.transformOffset.y),
        ]
      : null,
  ]);
}

export function buildLayerDocumentResultCacheKey(
  input: LayerDocumentResultCacheKeyInput
): string {
  return JSON.stringify([
    "layer-document-result-v2",
    input.layerDocumentId,
    input.revision,
    normalizeNumber(input.globalFrame),
    normalizeNumber(input.localFrame),
    input.quality,
    input.sourceResourceCacheKey,
    input.draftIdentity,
  ]);
}

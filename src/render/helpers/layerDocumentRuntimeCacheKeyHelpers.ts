import type {
  LayerDocumentResultCacheKeyInput,
  LayerDocumentSourceResourceCacheKeyInput,
  LayerDocumentTransformDraftSnapshot,
  LayerDocumentVisualResultCacheKeyInput,
} from "@/render/models/layerDocumentRuntimeModel";
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
    input.sourceSamplingQuality,
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

export function buildLayerDocumentEvaluationIdentity(
  input: LayerDocumentResultCacheKeyInput
): string {
  return JSON.stringify([
    "layer-document-result-v2",
    input.layerDocumentId,
    input.revision,
    normalizeNumber(input.globalFrame),
    normalizeNumber(input.localFrame),
    input.sourceResourceCacheKey,
    input.draftIdentity,
  ]);
}

/**
 * Compatibility name used by Source transaction invalidation descriptors.
 * Runtime display reuse must use buildLayerDocumentVisualResultCacheKey.
 */
export function buildLayerDocumentResultCacheKey(
  input: LayerDocumentResultCacheKeyInput
): string {
  return buildLayerDocumentEvaluationIdentity(input);
}

/**
 * Displayed-result identity deliberately excludes evaluation frame/revision.
 * Static sources can therefore reuse the same visual result across frame-only
 * evaluation changes, while every value that changes painted output remains
 * part of the key.
 */
export function buildLayerDocumentVisualResultCacheKey(
  input: LayerDocumentVisualResultCacheKeyInput
): string {
  return JSON.stringify([
    "layer-document-visual-result-v1",
    input.layerDocumentId,
    input.sourceType,
    input.sourceResourceCacheKey,
    input.order,
    input.evaluatedTransform,
    normalizeNumber(input.opacity),
    input.effects,
    input.modifiers,
    input.contentIdentity,
  ]);
}

export function buildLayerDocumentCompositionVisualResultCacheKey(
  ownVisualResultCacheKey: string,
  children: readonly {
    readonly layerResultCacheKey?: string;
    readonly order: number;
  }[]
): string {
  return JSON.stringify([
    "layer-document-composition-visual-result-v1",
    ownVisualResultCacheKey,
    children.map((child) => [
      child.order,
      child.layerResultCacheKey ?? null,
    ]),
  ]);
}

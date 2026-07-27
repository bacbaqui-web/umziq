import {
  buildLayerDocumentCanvasPreviewReadModel,
} from "@/engines/canvas/helpers/layerDocumentCanvasRendererHelpers";
import {
  buildLayerDocumentCanvasDirectSelectionCandidates,
  buildLayerDocumentCanvasMotionPath,
  buildLayerDocumentCanvasSelectionReadModel,
  resolveLayerDocumentCanvasGlowCandidate,
} from "@/engines/canvas/helpers/layerDocumentCanvasSelectionHelpers";
import type {
  LayerDocumentCanvasReadInput,
  LayerDocumentCanvasReadResult,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";
import type {
  ResolvedPreviewQuality,
} from "@/engines/canvas/models/previewQualityModel";
import type {
  LayerDocumentSourceSamplingQuality,
} from "@/render";

export function mapCanvasPreviewQualityToSourceSamplingQuality(
  previewQuality: ResolvedPreviewQuality
): LayerDocumentSourceSamplingQuality {
  return previewQuality;
}

/**
 * LayerDocument-native Canvas input adapter. It consumes the existing
 * Render scene/targets and produces the identity-neutral view data
 * used by the existing Preview overlay/gizmo/renderer components.
 */
export function buildLayerDocumentCanvasReadModel(
  input: LayerDocumentCanvasReadInput
): LayerDocumentCanvasReadResult {
  if (!input.runtime.ok) {
    return { ok: false, reason: "runtime-unavailable" };
  }
  const runtime = input.runtime.model;
  if (
    runtime.scene.compositionId !==
    input.activeScene.layerDocumentId
  ) {
    return {
      ok: false,
      reason: "scene-identity-mismatch",
    };
  }
  const selectedInput = input.selectedLayerDocumentId
    ? runtime.inputs.find(
        (candidate) =>
          candidate.layerDocumentId ===
          input.selectedLayerDocumentId
      ) ?? null
    : null;
  const selectedTarget = input.selectedLayerDocumentId
    ? runtime.targets.find(
        (candidate) =>
          candidate.layerDocumentId ===
          input.selectedLayerDocumentId
      ) ?? null
    : null;
  const directSelectionCandidates =
    buildLayerDocumentCanvasDirectSelectionCandidates({
      runtime,
      viewport: input.viewport,
      renderAssets: input.renderAssets,
    });
  const motionPath =
    buildLayerDocumentCanvasMotionPath({
      input: selectedInput,
      target: selectedTarget,
    });
  return {
    ok: true,
    model: {
      activeScene: input.activeScene,
      viewport: input.viewport,
      previewWorkspaceScene: {
        identity:
          input.activeScene.layerDocumentId,
        width: input.activeScene.width,
        height: input.activeScene.height,
      },
      selectedLayerDocumentId:
        input.selectedLayerDocumentId,
      selectedInput,
      selectedTarget,
      renderer:
        buildLayerDocumentCanvasPreviewReadModel({
          runtime,
          renderAssets: input.renderAssets,
          previousPreviewScene:
            input.previousPreviewScene,
          runtimeMetrics: input.runtimeMetrics,
        }),
      selection:
        buildLayerDocumentCanvasSelectionReadModel({
          runtime,
          selectedInput,
          selectedTarget,
          viewport: input.viewport,
        }),
      motionPath,
      motionPathCurrentPoint:
        motionPath.find((point) => point.isCurrent) ??
        null,
      directSelectionCandidates,
      selectedGlowCandidate:
        resolveLayerDocumentCanvasGlowCandidate(
          directSelectionCandidates,
          input.selectedLayerDocumentId
        ),
      hoverSuppressedDuringTransform:
        Boolean(selectedInput?.draftApplied),
      sourceResourceCacheKey:
        selectedInput?.sourceResourceCacheKey ?? null,
      layerResultCacheKey:
        selectedInput?.layerResultCacheKey ?? null,
    },
  };
}

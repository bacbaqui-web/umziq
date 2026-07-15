import {
  evaluateCompositionOpacity,
  evaluateCompositionPosition,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerOpacity,
  evaluateLayerPosition,
  evaluateLayerRotation,
  evaluateLayerScale,
} from "@/editor/preview/previewEngine";
import type { AnimatableProperty, Composition, Layer, Position, Scale } from "@/editor/types/types";
import type { TransformTargetSelection } from "@/editor/types/transformActionTypes";

type UseEditorPropertyModelOptions = {
  selectedTransformTarget: TransformTargetSelection;
  selectedLayer: Layer | null;
  selectedTimelineComp: Composition | null;
  playheadFrame: number;
  selectedTransformLocalFrame: number;
  positionDraft: Position | null;
  scaleDraft: Scale | null;
  rotationDraft: number | null;
  opacityDraft: number | null;
};

export function useEditorPropertyModel({
  selectedTransformTarget,
  selectedLayer,
  selectedTimelineComp,
  playheadFrame,
  selectedTransformLocalFrame,
  positionDraft,
  scaleDraft,
  rotationDraft,
  opacityDraft,
}: UseEditorPropertyModelOptions) {
  const evaluatedSelectedPosition = selectedTransformTarget?.kind === "layer"
    ? evaluateLayerPosition(selectedTransformTarget.layer, playheadFrame)
    : selectedTransformTarget?.kind === "composition"
      ? evaluateCompositionPosition(selectedTransformTarget.composition, selectedTransformLocalFrame)
      : { x: 0, y: 0 };
  const evaluatedSelectedScale = selectedTransformTarget?.kind === "layer"
    ? evaluateLayerScale(selectedTransformTarget.layer, selectedTransformLocalFrame)
    : selectedTransformTarget?.kind === "composition"
      ? evaluateCompositionScale(selectedTransformTarget.composition, selectedTransformLocalFrame)
      : { x: 100, y: 100 };
  const evaluatedSelectedRotation = selectedTransformTarget?.kind === "layer"
    ? evaluateLayerRotation(selectedTransformTarget.layer, selectedTransformLocalFrame)
    : selectedTransformTarget?.kind === "composition"
      ? evaluateCompositionRotation(selectedTransformTarget.composition, selectedTransformLocalFrame)
      : 0;
  const evaluatedSelectedOpacity = selectedTransformTarget?.kind === "layer"
    ? evaluateLayerOpacity(selectedTransformTarget.layer, playheadFrame)
    : selectedTransformTarget?.kind === "composition"
      ? evaluateCompositionOpacity(selectedTransformTarget.composition, selectedTransformLocalFrame)
      : 100;
  const resolvedPositionDraft = positionDraft ?? evaluatedSelectedPosition;
  const resolvedScaleDraft = scaleDraft ?? evaluatedSelectedScale;
  const resolvedRotationDraft = rotationDraft ?? evaluatedSelectedRotation;
  const resolvedOpacityDraft = opacityDraft ?? evaluatedSelectedOpacity;
  const propertyValueDrafts: Record<AnimatableProperty, string[]> = {
    position:
      selectedLayer || selectedTimelineComp
        ? [String(resolvedPositionDraft.x), String(resolvedPositionDraft.y)]
        : ["0", "0"],
    scale: [String(Math.round(resolvedScaleDraft.x)), String(Math.round(resolvedScaleDraft.y))],
    rotation: [String(Math.round(resolvedRotationDraft * 100) / 100)],
    opacity: [String(Math.round(resolvedOpacityDraft))],
  };

  return {
    evaluatedSelectedPosition,
    evaluatedSelectedScale,
    evaluatedSelectedRotation,
    evaluatedSelectedOpacity,
    resolvedPositionDraft,
    resolvedScaleDraft,
    resolvedRotationDraft,
    resolvedOpacityDraft,
    propertyValueDrafts,
  };
}

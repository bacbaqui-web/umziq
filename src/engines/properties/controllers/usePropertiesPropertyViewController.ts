import type { AnimatableProperty, PropertyTrackState } from "@/models";
import { ANIMATABLE_PROPERTIES } from "@/engines/animation";
import {
  buildPropertiesInfoViewModel,
  buildPropertiesKeyframeViewModel,
  buildPropertiesPropertyRows,
} from "@/engines/properties/helpers/propertiesViewModelHelpers";
import type {
  PropertiesNumericInputId,
  PropertiesReadModel,
  PropertiesResolvedValues,
} from "@/engines/properties/models/propertiesEngineModel";
import type {
  PropertiesAnimationReadPort,
  PropertiesDraftControllerPort,
  PropertiesDraftStatePort,
  PropertiesPlaybackReadPort,
  PropertiesProjectReadPort,
  PropertiesSelectionReadPort,
} from "@/engines/properties/models/propertiesInternalModel";

type Options = {
  masterCompId: string;
  selection: PropertiesSelectionReadPort;
  playback: PropertiesPlaybackReadPort;
  project: PropertiesProjectReadPort;
  draftState: PropertiesDraftStatePort;
  draft: PropertiesDraftControllerPort;
  animation: PropertiesAnimationReadPort;
  formatTime: (frame: number, frameRate: number) => string;
};

export function usePropertiesPropertyViewController(options: Options) {
  const target = options.selection.selectedTransformTarget;
  const evaluatedPosition = target?.kind === "layer"
    ? options.animation.evaluateLayerPosition(target.layer, options.playback.currentFrame)
    : target?.kind === "composition"
      ? options.animation.evaluateCompositionPosition(target.composition, options.playback.localFrame)
      : { x: 0, y: 0 };
  const evaluatedScale = target?.kind === "layer"
    ? options.animation.evaluateLayerScale(target.layer, options.playback.localFrame)
    : target?.kind === "composition"
      ? options.animation.evaluateCompositionScale(target.composition, options.playback.localFrame)
      : { x: 100, y: 100 };
  const evaluatedRotation = target?.kind === "layer"
    ? options.animation.evaluateLayerRotation(target.layer, options.playback.localFrame)
    : target?.kind === "composition"
      ? options.animation.evaluateCompositionRotation(target.composition, options.playback.localFrame)
      : 0;
  const evaluatedOpacity = target?.kind === "layer"
    ? options.animation.evaluateLayerOpacity(target.layer, options.playback.currentFrame)
    : target?.kind === "composition"
      ? options.animation.evaluateCompositionOpacity(target.composition, options.playback.localFrame)
      : 100;
  const values: PropertiesResolvedValues = {
    position: options.draftState.positionDraft ?? evaluatedPosition,
    scale: options.draftState.scaleDraft ?? evaluatedScale,
    rotation: options.draftState.rotationDraft ?? evaluatedRotation,
    opacity: options.draftState.opacityDraft ?? evaluatedOpacity,
  };
  const isMasterTarget = target?.kind === "composition"
    && target.composition.id === options.masterCompId;
  const hasTransformTarget = !!target;
  const editableProperties: PropertyTrackState = {
    position: hasTransformTarget && !isMasterTarget,
    scale: hasTransformTarget,
    rotation: hasTransformTarget,
    opacity: hasTransformTarget,
  };
  const numericDrafts = Object.fromEntries(
    ANIMATABLE_PROPERTIES.flatMap((property) => {
      const inputIds: PropertiesNumericInputId[] = property === "position" || property === "scale"
        ? [`${property}.x`, `${property}.y`] as PropertiesNumericInputId[]
        : [`${property}.value`] as PropertiesNumericInputId[];
      return inputIds.flatMap((inputId) => {
        const value = options.draft.getNumericDraft(inputId);
        return value === undefined ? [] : [[inputId, value]];
      });
    })
  ) as Partial<Record<PropertiesNumericInputId, string>>;
  const keyframeTarget = options.selection.selectedPropertyTarget;
  const hasKeyframeAtCurrentFrame = (property: AnimatableProperty) => (
    !!keyframeTarget
    && options.animation.hasKeyframeAtFrame(
      keyframeTarget,
      property,
      options.playback.localFrame
    )
  );
  const frameRate = options.project.selectedMeta?.frameRate ?? options.project.defaultFrameRate;
  const readModel: PropertiesReadModel = {
    hasSelectedComposition: !!options.selection.selectedComposition,
    info: options.selection.selectedComposition
      ? buildPropertiesInfoViewModel(
        options.selection.selectedComposition,
        options.project.selectedMeta
      )
      : null,
    targetName: options.selection.selectedPropertyTarget?.name ?? null,
    currentTimeText: options.formatTime(options.playback.currentFrame, frameRate),
    currentValues: values,
    rows: buildPropertiesPropertyRows({
      properties: ANIMATABLE_PROPERTIES,
      propertyState: options.selection.selectedPropertyState,
      values,
      editableProperties,
      scaleLinked: options.selection.selectedScaleLinked,
      numericDrafts,
      hasKeyframeAtCurrentFrame,
      selectedKeyframe: options.selection.selectedKeyframe,
    }),
    keyframe: buildPropertiesKeyframeViewModel({
      selectedLayer: options.selection.selectedLayer,
      selectedTimelineComposition: options.selection.selectedTimelineComposition,
      positionTrackEnabled: options.selection.selectedPropertyState.position,
      selectedKeyframe: options.selection.selectedKeyframe,
      frameRate,
      formatTime: options.formatTime,
    }),
    importError: options.project.importError,
    importNotice: options.project.importNotice,
  };

  return { readModel, values, editableProperties };
}

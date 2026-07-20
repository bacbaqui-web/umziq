import {
  evaluateCompositionBasePosition,
  evaluateCompositionOpacity,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerBasePosition,
  evaluateLayerOpacity,
  evaluateLayerRotation,
  evaluateLayerScale,
  getTargetKeyframes,
  hasKeyframeAtFrame,
} from "@/engines/animation";
import type { AnimatableProperty } from "@/models";
import type {
  PropertiesAnimationCommandPort,
  PropertiesDraftStatePort,
  PropertiesPlaybackReadPort,
  PropertiesProjectReadPort,
  PropertiesSelectionReadPort,
  PropertiesTransformDraftCommandPort,
  PropertiesTransformDraftReadPort,
} from "@/engines/properties/models/propertiesInternalModel";
import type { PropertiesEngineViewProps } from "@/engines/properties/models/propertiesEngineModel";
import { buildPropertiesDraftScope } from "@/engines/properties/helpers/propertiesViewModelHelpers";
import { usePropertiesDraftController } from "@/engines/properties/controllers/usePropertiesDraftController";
import { usePropertiesPropertyViewController } from "@/engines/properties/controllers/usePropertiesPropertyViewController";
import { usePropertiesNumericInputController } from "@/engines/properties/controllers/usePropertiesNumericInputController";
import { usePropertiesTrackController } from "@/engines/properties/controllers/usePropertiesTrackController";
import { usePropertiesKeyframeController } from "@/engines/properties/controllers/usePropertiesKeyframeController";
import { usePropertiesModifierInputController } from "@/engines/properties/controllers/usePropertiesModifierInputController";
import { buildPropertiesModifierViewModel } from "@/engines/properties/helpers/propertiesModifierHelpers";

type UsePropertiesEngineOptions = {
  masterCompId: string;
  selection: PropertiesSelectionReadPort;
  playback: PropertiesPlaybackReadPort;
  project: PropertiesProjectReadPort;
  draftState: PropertiesDraftStatePort;
  animationCommands: PropertiesAnimationCommandPort;
  transformDraftCommands: PropertiesTransformDraftCommandPort;
  transformDraft: PropertiesTransformDraftReadPort;
  formatTime: (frame: number, frameRate: number) => string;
};

export function usePropertiesEngine(options: UsePropertiesEngineOptions) {
  const scope = buildPropertiesDraftScope(
    options.selection.selectedPropertyTarget,
    options.playback.currentFrame,
    options.playback.localFrame
  );
  const draftController = usePropertiesDraftController({
    scope,
    state: options.draftState,
  });
  const propertyViewController = usePropertiesPropertyViewController({
    masterCompId: options.masterCompId,
    selection: options.selection,
    playback: options.playback,
    project: options.project,
    draftState: options.draftState,
    draft: draftController,
    transformDraft: options.transformDraft,
    animation: {
      evaluateLayerPosition: evaluateLayerBasePosition,
      evaluateLayerScale,
      evaluateLayerRotation,
      evaluateLayerOpacity,
      evaluateCompositionPosition: evaluateCompositionBasePosition,
      evaluateCompositionScale,
      evaluateCompositionRotation,
      evaluateCompositionOpacity,
      hasKeyframeAtFrame: (target, property: AnimatableProperty, frame) =>
        hasKeyframeAtFrame(getTargetKeyframes(target, property), frame),
    },
    formatTime: options.formatTime,
  });
  const numericInputController = usePropertiesNumericInputController({
    editableProperties: propertyViewController.editableProperties,
    anchorEditable: propertyViewController.anchorEditable,
    propertyState: options.selection.selectedPropertyState,
    scaleLinked: options.selection.selectedScaleLinked,
    values: propertyViewController.values,
    draft: draftController,
    animation: options.animationCommands,
    transformDraft: options.transformDraftCommands,
  });
  const trackController = usePropertiesTrackController({
    propertyState: options.selection.selectedPropertyState,
    scaleLinked: options.selection.selectedScaleLinked,
    animation: options.animationCommands,
  });
  const keyframeController = usePropertiesKeyframeController(options.animationCommands);
  const modifierViewModel = buildPropertiesModifierViewModel({
    target: options.selection.selectedTransformTarget,
    masterCompId: options.masterCompId,
    draft: draftController,
  });
  const modifierInputController = usePropertiesModifierInputController({
    target: options.selection.selectedTransformTarget,
    masterCompId: options.masterCompId,
    draft: draftController,
    animation: options.animationCommands,
  });

  const viewProps: PropertiesEngineViewProps = {
    readModel: {
      ...propertyViewController.readModel,
      modifiers: modifierViewModel.modifiers,
      modifierLibrary: modifierViewModel.library,
    },
    commands: {
      ...numericInputController,
      ...trackController,
      ...keyframeController,
      ...modifierInputController,
      toggleModifier: options.animationCommands.toggleModifier,
    },
  };

  return { viewProps, resolvedValues: propertyViewController.values };
}

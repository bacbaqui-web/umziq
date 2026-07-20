import type { Composition, Layer, Position, PropertyTrackState, Scale } from "@/models";
import type {
  AnimationHistoryPort,
  AnimationProjectPort,
  AnimationSessionPort,
  MasterAnimationPort,
} from "@/engines/animation/models/animationCommandModel";
import type {
  SelectedKeyframe,
  TransformTargetSelection,
} from "@/engines/animation/models/animationSessionModel";
import { useTransformValueController } from "@/engines/animation/controllers/useTransformValueController";
import { usePropertyTrackController } from "@/engines/animation/controllers/usePropertyTrackController";
import { useKeyframeController } from "@/engines/animation/controllers/useKeyframeController";
import { useModifierController } from "@/engines/animation/controllers/useModifierController";
import { useTransformInputAdapter } from "@/engines/animation/adapters/useTransformInputAdapter";

export type UseAnimationEngineOptions = {
  masterCompId: string;
  selectedComp: Composition;
  selectedLayer: Layer | null;
  selectedTimelineComp: Composition | null;
  selectedTransformTarget: TransformTargetSelection;
  selectedScaleTarget: Layer | Composition | null;
  selectedScaleLinked: boolean;
  selectedPropertyState: PropertyTrackState;
  selectedTransformLocalFrame: number;
  playheadFrame: number;
  resolvedPositionDraft: Position;
  resolvedScaleDraft: Scale;
  resolvedRotationDraft: number;
  resolvedOpacityDraft: number;
  selectedKeyframe: SelectedKeyframe;
  project: AnimationProjectPort;
  master: MasterAnimationPort;
  session: AnimationSessionPort;
  history: AnimationHistoryPort;
};

export function useAnimationEngine(options: UseAnimationEngineOptions) {
  const transformCommands = useTransformValueController({
    masterCompId: options.masterCompId,
    selectedTarget: options.selectedTransformTarget,
    localFrame: options.selectedTransformLocalFrame,
    playheadFrame: options.playheadFrame,
    project: options.project,
    master: options.master,
    session: options.session,
  });

  const propertyTrackCommands = usePropertyTrackController({
    masterCompId: options.masterCompId,
    selectedComp: options.selectedComp,
    selectedLayer: options.selectedLayer,
    selectedTimelineComp: options.selectedTimelineComp,
    selectedScaleTarget: options.selectedScaleTarget,
    selectedKeyframe: options.selectedKeyframe,
    localFrame: options.selectedTransformLocalFrame,
    values: {
      position: options.resolvedPositionDraft,
      scale: options.resolvedScaleDraft,
      rotation: options.resolvedRotationDraft,
      opacity: options.resolvedOpacityDraft,
    },
    project: options.project,
    master: options.master,
    session: options.session,
    history: options.history,
  });

  const keyframeCommands = useKeyframeController({
    masterCompId: options.masterCompId,
    selectedLayer: options.selectedLayer,
    selectedKeyframe: options.selectedKeyframe,
    localFrame: options.selectedTransformLocalFrame,
    resolvedPosition: options.resolvedPositionDraft,
    project: options.project,
    master: options.master,
    session: options.session,
    history: options.history,
  });

  const inputCommands = useTransformInputAdapter({
    selectedScaleLinked: options.selectedScaleLinked,
    selectedPropertyState: options.selectedPropertyState,
    resolvedScale: options.resolvedScaleDraft,
    session: options.session,
    applyScale: transformCommands.applyScale,
    applyRotation: transformCommands.applyRotation,
    applyOpacity: transformCommands.applyOpacity,
  });
  const modifierCommands = useModifierController({
    masterCompId: options.masterCompId,
    selectedTarget: options.selectedTransformTarget,
    project: options.project,
    history: options.history,
  });

  return {
    ...transformCommands,
    ...propertyTrackCommands,
    ...keyframeCommands,
    ...inputCommands,
    ...modifierCommands,
    applyPositionValue: transformCommands.applyPosition,
    applyScaleValue: transformCommands.applyScale,
    applyRotationValue: transformCommands.applyRotation,
    applyOpacityValue: transformCommands.applyOpacity,
    history: options.history,
  };
}

export type AnimationCommands = ReturnType<typeof useAnimationEngine>;

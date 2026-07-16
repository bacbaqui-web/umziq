import type { Dispatch, SetStateAction } from "react";
import type {
  AnimatableProperty,
  Composition,
  CompositionMeta,
  Layer,
  Position,
  PropertyTrackState,
  Scale,
} from "@/models";
import type {
  SelectedKeyframe,
  TransformEditMode,
  TransformTargetSelection,
} from "@/engines/animation";
import type { PropertiesNumericInputId } from "@/engines/properties/models/propertiesEngineModel";

export type PropertiesSelectionReadPort = {
  selectedComposition: Composition | null;
  selectedLayer: Layer | null;
  selectedTimelineComposition: Composition | null;
  selectedPropertyTarget: Composition | Layer | null;
  selectedTransformTarget: TransformTargetSelection;
  selectedScaleTarget: Composition | Layer | null;
  selectedScaleLinked: boolean;
  selectedPropertyState: PropertyTrackState;
  selectedKeyframe: SelectedKeyframe;
};

export type PropertiesPlaybackReadPort = {
  currentFrame: number;
  localFrame: number;
};

export type PropertiesProjectReadPort = {
  selectedMeta: CompositionMeta | null;
  defaultFrameRate: number;
  importError: string | null;
  importNotice: string | null;
};

export type PropertiesDraftStatePort = {
  positionDraft: Position | null;
  scaleDraft: Scale | null;
  rotationDraft: number | null;
  opacityDraft: number | null;
  numericDrafts: Record<string, string>;
  numericDraftScope: string | null;
  focusedNumericInputId: string | null;
  setPositionDraft: Dispatch<SetStateAction<Position | null>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
  setNumericDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setNumericDraftScope: Dispatch<SetStateAction<string | null>>;
  setFocusedNumericInputId: Dispatch<SetStateAction<string | null>>;
};

export type PropertiesAnimationReadPort = {
  evaluateLayerPosition: (layer: Layer, frame: number) => Position;
  evaluateLayerScale: (layer: Layer, frame: number) => Scale;
  evaluateLayerRotation: (layer: Layer, frame: number) => number;
  evaluateLayerOpacity: (layer: Layer, frame: number) => number;
  evaluateCompositionPosition: (composition: Composition, frame: number) => Position;
  evaluateCompositionScale: (composition: Composition, frame: number) => Scale;
  evaluateCompositionRotation: (composition: Composition, frame: number) => number;
  evaluateCompositionOpacity: (composition: Composition, frame: number) => number;
  hasKeyframeAtFrame: (
    target: Layer | Composition,
    property: AnimatableProperty,
    frame: number
  ) => boolean;
};

export type PropertiesAnimationCommandPort = {
  applyPosition: (value: Position, mode: TransformEditMode) => void;
  applyScale: (value: Scale, mode: TransformEditMode) => void;
  applyRotation: (value: number, mode: TransformEditMode) => void;
  applyOpacity: (value: number, mode: TransformEditMode) => void;
  setScaleLinked: (linked: boolean) => void;
  setPropertyTrackEnabled: (property: AnimatableProperty, enabled: boolean) => void;
  savePositionKeyframe: () => void;
  removeSelectedKeyframe: () => void;
  beginHistory: () => void;
  markHistoryDirty: () => void;
  commitHistory: () => void;
  cancelHistory: () => void;
};

export type PropertiesDraftControllerPort = {
  scope: string;
  focusedInputId: PropertiesNumericInputId | null;
  getNumericDraft: (inputId: PropertiesNumericInputId) => string | undefined;
  hasNumericDraft: (inputId: PropertiesNumericInputId) => boolean;
  focusNumericDraft: (inputId: PropertiesNumericInputId) => void;
  setNumericDraft: (inputId: PropertiesNumericInputId, value: string) => void;
  clearNumericDraft: (inputId: PropertiesNumericInputId) => void;
  clearNumericFocus: () => void;
  setPositionDraft: (value: Position) => void;
  setScaleDraft: (value: Scale) => void;
  setRotationDraft: (value: number) => void;
  setOpacityDraft: (value: number) => void;
};

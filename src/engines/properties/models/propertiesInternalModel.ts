import type { Dispatch, SetStateAction } from "react";
import type {
  AnimatableProperty,
  Composition,
  CompositionMeta,
  Layer,
  ModifierNumberField,
  ModifierType,
  Position,
  PropertyTrackState,
  Scale,
} from "@/models";
import type {
  SelectedKeyframe,
  ApplyAnchorCommand,
  TransformEditMode,
  TransformTargetSelection,
} from "@/engines/animation";
import type {
  PropertiesDraftInputId,
} from "@/engines/properties/models/propertiesEngineModel";

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
  evaluateLayerPosition: (layer: Layer, frame: number, frameRate?: number) => Position;
  evaluateLayerScale: (layer: Layer, frame: number) => Scale;
  evaluateLayerRotation: (layer: Layer, frame: number) => number;
  evaluateLayerOpacity: (layer: Layer, frame: number) => number;
  evaluateCompositionPosition: (composition: Composition, frame: number, frameRate?: number) => Position;
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
  applyAnchor: (command: ApplyAnchorCommand) => void;
  setScaleLinked: (linked: boolean) => void;
  setPropertyTrackEnabled: (property: AnimatableProperty, enabled: boolean) => void;
  savePositionKeyframe: () => void;
  removeSelectedKeyframe: () => void;
  toggleModifier: (type: ModifierType) => void;
  updateModifierNumber: (
    type: ModifierType,
    field: ModifierNumberField,
    value: number
  ) => void;
  beginHistory: () => void;
  markHistoryDirty: () => void;
  commitHistory: () => void;
  cancelHistory: () => void;
};

export type PropertiesTransformDraftCommandPort = {
  updateAnchor: (anchor: Position) => ApplyAnchorCommand | null;
  reset: () => void;
};

export type PropertiesTransformDraftReadPort = {
  anchor: Position | null;
};

export type PropertiesDraftControllerPort = {
  scope: string;
  focusedInputId: PropertiesDraftInputId | null;
  getNumericDraft: (inputId: PropertiesDraftInputId) => string | undefined;
  hasNumericDraft: (inputId: PropertiesDraftInputId) => boolean;
  focusNumericDraft: (inputId: PropertiesDraftInputId) => void;
  setNumericDraft: (inputId: PropertiesDraftInputId, value: string) => void;
  clearNumericDraft: (inputId: PropertiesDraftInputId) => void;
  clearNumericFocus: () => void;
  setPositionDraft: (value: Position) => void;
  setScaleDraft: (value: Scale) => void;
  setRotationDraft: (value: number) => void;
  setOpacityDraft: (value: number) => void;
};

import type {
  AnimatableProperty,
  Composition,
  CompositionMeta,
  Layer,
  Position,
  PropertyTrackState,
  Scale,
} from "@/editor/types/types";
import type { SelectedKeyframe } from "@/editor/types/editorViewTypes";

export type PropertiesPanelProps = {
  selectedComp: Composition | null;
  selectedMeta: CompositionMeta | null;
  selectedPropertyTarget: Composition | Layer | null;
  selectedPropertyState: PropertyTrackState;
  selectedLayer: Layer | null;
  selectedTimelineComp: Composition | null;
  selectedScaleTarget: Composition | Layer | null;
  selectedScaleLinked: boolean;
  selectedKeyframe: SelectedKeyframe;
  playheadFrame: number;
  defaultFrameRate: number;
  propertyLabels: Record<AnimatableProperty, string>;
  animatableProperties: AnimatableProperty[];
  propertyValueDrafts: Record<AnimatableProperty, string[]>;
  evaluatedSelectedLayerPosition: Position;
  evaluatedSelectedScale: Scale;
  evaluatedSelectedRotation: number;
  positionDraft: Position | null;
  scaleDraft: Scale | null;
  rotationDraft: number | null;
  importError: string | null;
  importNotice: string | null;
  formatCompactTime: (frame: number, frameRate: number) => string;
  onTogglePropertyTrack: (property: AnimatableProperty, enabled: boolean) => void;
  onSetPositionDraft: (position: Position) => void;
  onApplyPositionValue: (position: Position, shouldCreateKeyframe: boolean) => void;
  onSetScaleDraft: (scale: Scale) => void;
  onApplyScaleValue: (scale: Scale, shouldCreateKeyframe: boolean) => void;
  onSetRotationDraft: (rotation: number) => void;
  onApplyRotationValue: (rotation: number) => void;
  onSetOpacityDraft: (opacity: number) => void;
  onApplyOpacityValue: (opacity: number, shouldCreateKeyframe: boolean) => void;
  onBeginTransformHistoryCapture: () => void;
  onMarkTransformHistoryCaptureDirty: () => void;
  onCommitTransformHistoryCapture: () => void;
  onSetScaleLinkState: (linked: boolean) => void;
  onSavePositionKeyframe: () => void;
  onDeleteSelectedKeyframe: () => void;
};

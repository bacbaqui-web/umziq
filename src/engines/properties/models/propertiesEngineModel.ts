import type {
  AccelerationCurve,
  AnimatableProperty,
  LayerDocumentType,
  ModifierNumberField,
  ModifierType,
  Position,
  Scale,
} from "@/models";

export type PropertiesNumericInputId =
  | "position.x"
  | "position.y"
  | "scale.x"
  | "scale.y"
  | "rotation.value"
  | "opacity.value"
  | "anchor.x"
  | "anchor.y";

export type PropertiesNumericProperty = AnimatableProperty | "anchor";

export type PropertiesModifierInputId =
  | "modifier.wiggle.frequency"
  | "modifier.wiggle.amount"
  | "modifier.swing.frequency"
  | "modifier.swing.amount"
  | "modifier.oscillate.angle"
  | "modifier.oscillate.frequency"
  | "modifier.oscillate.amount";

export type PropertiesDraftInputId =
  | PropertiesNumericInputId
  | PropertiesModifierInputId;

export type PropertiesAudioInputId =
  | "audio.name"
  | "audio.gain"
  | "audio.startFrame"
  | "audio.durationFrames"
  | "audio.sourceOffsetFrames"
  | "audio.fadeInFrames"
  | "audio.fadeOutFrames";

export type PropertiesAudioFieldViewModel = {
  id: PropertiesAudioInputId;
  label: string;
  value: string;
  suffix?: string;
  numeric: boolean;
  step?: number;
};

export type PropertiesAudioSectionViewModel = {
  layerDocumentId: string;
  fields: PropertiesAudioFieldViewModel[];
  muted: boolean;
};

export type PropertiesPropertyIcon = "position" | "scale" | "rotation" | "opacity";

export type PropertiesVisualTokens = {
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentMuted: string;
  label: string;
};

export type PropertiesNumericInputViewModel = {
  id: PropertiesNumericInputId;
  axisLabel: string;
  value: string;
  readOnly: boolean;
  width: number;
  title?: string;
};

export type PropertiesPropertyRowViewModel = {
  property: AnimatableProperty;
  label: string;
  icon: PropertiesPropertyIcon;
  enabled: boolean;
  visible: boolean;
  editable: boolean;
  trackEditable: boolean;
  trackBadge: "On" | "Off";
  hasKeyframeAtCurrentFrame: boolean;
  isSelectedKeyframe: boolean;
  scaleLinked: boolean | null;
  inputs: PropertiesNumericInputViewModel[];
  tokens: PropertiesVisualTokens;
};

export type PropertiesSourceHeaderViewModel = {
  itemId: string;
  sourceId: string;
  sourceName: string;
  itemAlias: string | null;
  displayName: string;
  type: LayerDocumentType;
  typeLabel: string;
  entityKind: "layer" | "composition";
  availabilityLabel: string;
};

export type PropertiesSourceDetailFieldViewModel = {
  label: string;
  value: string;
};

export type PropertiesSourceDetailViewModel = {
  title: string;
  description: string;
  fields: PropertiesSourceDetailFieldViewModel[];
};

export type PropertiesCapabilityStatus =
  | "editable"
  | "read-only"
  | "unsupported";

export type PropertiesCapabilityViewModel = {
  key: "transform" | "animation" | "content";
  label: string;
  status: PropertiesCapabilityStatus;
  statusLabel: string;
  description: string;
};

export type PropertiesTransformOriginViewModel = {
  label: string;
  visible: boolean;
  editable: boolean;
  inputs: PropertiesNumericInputViewModel[];
  tokens: PropertiesVisualTokens;
};

export type PropertiesInfoViewModel = {
  name: string;
  sourceFileName: string;
  canvasSize: string;
  duration: string;
};

export type PropertiesResolvedValues = {
  position: Position;
  scale: Scale;
  rotation: number;
  opacity: number;
  anchor: Position;
};

export type PropertiesKeyframeViewModel = {
  visible: boolean;
  showPositionSave: boolean;
  canSavePosition: boolean;
  selectedText: string;
  canDeleteSelected: boolean;
};

export type PropertiesModifierFieldViewModel = {
  id: PropertiesModifierInputId;
  field: ModifierNumberField;
  label: string;
  prefix?: string;
  suffix?: string;
  value: string;
};

export type PropertiesModifierViewModel = {
  type: ModifierType;
  label: string;
  fields: PropertiesModifierFieldViewModel[];
  audioLayerDocumentId?: string | null;
  audioOptions?: readonly { id: string; label: string }[];
  accelerationProperties?: readonly AnimatableProperty[];
  accelerationCurve?: AccelerationCurve;
};

export type PropertiesModifierLibraryItemViewModel = {
  type: ModifierType;
  label: string;
  active: boolean;
};

export type PropertiesModifierLibraryViewModel = {
  visible: boolean;
  items: PropertiesModifierLibraryItemViewModel[];
};

export type PropertiesReadModel = {
  hasSelectedComposition: boolean;
  info: PropertiesInfoViewModel | null;
  targetName: string | null;
  targetEntityKind: "layer" | "composition" | null;
  sourceHeader: PropertiesSourceHeaderViewModel | null;
  sourceDetail: PropertiesSourceDetailViewModel | null;
  capabilities: PropertiesCapabilityViewModel[];
  transformSectionVisible: boolean;
  currentTimeText: string;
  currentValues: PropertiesResolvedValues;
  rows: PropertiesPropertyRowViewModel[];
  transformOrigin: PropertiesTransformOriginViewModel;
  keyframe: PropertiesKeyframeViewModel;
  modifiers: PropertiesModifierViewModel[];
  modifierLibrary: PropertiesModifierLibraryViewModel;
  audioSection: PropertiesAudioSectionViewModel | null;
  importError: string | null;
  importNotice: string | null;
};

export type PropertiesCommand = {
  togglePropertyTrack: (property: AnimatableProperty, enabled: boolean) => void;
  focusNumericInput: (inputId: PropertiesNumericInputId) => void;
  changeNumericInput: (inputId: PropertiesNumericInputId, value: string) => void;
  blurNumericInput: (inputId: PropertiesNumericInputId) => void;
  keyDownNumericInput: (
    inputId: PropertiesNumericInputId,
    key: string
  ) => "blur" | null;
  toggleScaleLink: () => void;
  savePositionKeyframe: () => void;
  deleteSelectedKeyframe: () => void;
  toggleModifier: (type: ModifierType) => void;
  setMouthBasicAudioLayer: (audioLayerDocumentId: string) => void;
  toggleAccelerationProperty: (property: AnimatableProperty) => void;
  setAccelerationCurve: (curve: AccelerationCurve) => void;
  focusModifierInput: (inputId: PropertiesModifierInputId) => void;
  changeModifierInput: (inputId: PropertiesModifierInputId, value: string) => void;
  blurModifierInput: (inputId: PropertiesModifierInputId) => void;
  keyDownModifierInput: (
    inputId: PropertiesModifierInputId,
    key: string
  ) => "blur" | null;
  focusAudioInput: (inputId: PropertiesAudioInputId) => void;
  changeAudioInput: (inputId: PropertiesAudioInputId, value: string) => void;
  blurAudioInput: (inputId: PropertiesAudioInputId) => void;
  keyDownAudioInput: (inputId: PropertiesAudioInputId, key: string) => "blur" | null;
  toggleAudioMuted: () => void;
};

export type PropertiesEngineViewProps = {
  readModel: PropertiesReadModel;
  commands: PropertiesCommand;
};

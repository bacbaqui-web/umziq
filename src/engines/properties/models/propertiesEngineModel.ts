import type {
  AnimatableProperty,
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
  | "modifier.wiggle.amount";

export type PropertiesDraftInputId =
  | PropertiesNumericInputId
  | PropertiesModifierInputId;

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
  trackBadge: "On" | "Off";
  hasKeyframeAtCurrentFrame: boolean;
  isSelectedKeyframe: boolean;
  scaleLinked: boolean | null;
  inputs: PropertiesNumericInputViewModel[];
  tokens: PropertiesVisualTokens;
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
  value: string;
};

export type PropertiesModifierViewModel = {
  type: ModifierType;
  label: string;
  fields: PropertiesModifierFieldViewModel[];
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
  currentTimeText: string;
  currentValues: PropertiesResolvedValues;
  rows: PropertiesPropertyRowViewModel[];
  transformOrigin: PropertiesTransformOriginViewModel;
  keyframe: PropertiesKeyframeViewModel;
  modifiers: PropertiesModifierViewModel[];
  modifierLibrary: PropertiesModifierLibraryViewModel;
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
  focusModifierInput: (inputId: PropertiesModifierInputId) => void;
  changeModifierInput: (inputId: PropertiesModifierInputId, value: string) => void;
  blurModifierInput: (inputId: PropertiesModifierInputId) => void;
  keyDownModifierInput: (
    inputId: PropertiesModifierInputId,
    key: string
  ) => "blur" | null;
};

export type PropertiesEngineViewProps = {
  readModel: PropertiesReadModel;
  commands: PropertiesCommand;
};

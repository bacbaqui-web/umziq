import type { AnimatableProperty, Position, Scale } from "@/models";

export type PropertiesNumericInputId =
  | "position.x"
  | "position.y"
  | "scale.x"
  | "scale.y"
  | "rotation.value"
  | "opacity.value";

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
};

export type PropertiesKeyframeViewModel = {
  visible: boolean;
  showPositionSave: boolean;
  canSavePosition: boolean;
  selectedText: string;
  canDeleteSelected: boolean;
};

export type PropertiesReadModel = {
  hasSelectedComposition: boolean;
  info: PropertiesInfoViewModel | null;
  targetName: string | null;
  currentTimeText: string;
  currentValues: PropertiesResolvedValues;
  rows: PropertiesPropertyRowViewModel[];
  keyframe: PropertiesKeyframeViewModel;
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
};

export type PropertiesEngineViewProps = {
  readModel: PropertiesReadModel;
  commands: PropertiesCommand;
};

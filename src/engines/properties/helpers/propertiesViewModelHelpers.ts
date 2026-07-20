import type {
  AnimatableProperty,
  Composition,
  CompositionMeta,
  Layer,
  PropertyTrackState,
} from "@/models";
import type { SelectedKeyframe } from "@/engines/animation";
import { PROPERTY_LABELS } from "@/engines/properties/constants/propertiesConstants";
import type {
  PropertiesInfoViewModel,
  PropertiesKeyframeViewModel,
  PropertiesNumericInputId,
  PropertiesPropertyRowViewModel,
  PropertiesResolvedValues,
  PropertiesTransformOriginViewModel,
  PropertiesVisualTokens,
} from "@/engines/properties/models/propertiesEngineModel";
import {
  formatPropertiesNumericValue,
  getPropertiesNumericInputDescriptor,
} from "@/engines/properties/helpers/propertiesNumericHelpers";

const PROPERTY_VISUAL_TOKENS: Record<AnimatableProperty, PropertiesVisualTokens> = {
  position: {
    accent: "#6ba9df",
    accentSoft: "rgba(107, 169, 223, 0.14)",
    accentBorder: "rgba(107, 169, 223, 0.32)",
    accentMuted: "rgba(107, 169, 223, 0.62)",
    label: "#c9def2",
  },
  scale: {
    accent: "#7eca9d",
    accentSoft: "rgba(126, 202, 157, 0.14)",
    accentBorder: "rgba(126, 202, 157, 0.32)",
    accentMuted: "rgba(126, 202, 157, 0.62)",
    label: "#d4ecdd",
  },
  rotation: {
    accent: "#e3a56a",
    accentSoft: "rgba(227, 165, 106, 0.14)",
    accentBorder: "rgba(227, 165, 106, 0.32)",
    accentMuted: "rgba(227, 165, 106, 0.62)",
    label: "#f1dbc6",
  },
  opacity: {
    accent: "#bc92dd",
    accentSoft: "rgba(188, 146, 221, 0.14)",
    accentBorder: "rgba(188, 146, 221, 0.32)",
    accentMuted: "rgba(188, 146, 221, 0.62)",
    label: "#eadbf8",
  },
};

const PROPERTY_INPUT_IDS: Record<AnimatableProperty, PropertiesNumericInputId[]> = {
  position: ["position.x", "position.y"],
  scale: ["scale.x", "scale.y"],
  rotation: ["rotation.value"],
  opacity: ["opacity.value"],
};

export function getPropertiesVisualTokens(property: AnimatableProperty) {
  return PROPERTY_VISUAL_TOKENS[property];
}

export function buildPropertiesInfoViewModel(
  composition: Composition,
  meta: CompositionMeta | null
): PropertiesInfoViewModel {
  return {
    name: composition.name,
    sourceFileName: meta?.sourceFileName ?? "-",
    canvasSize: meta ? `${meta.width} x ${meta.height}` : "-",
    duration: meta
      ? `${(meta.durationFrames / meta.frameRate).toFixed(1)}s`
      : "-",
  };
}

export function buildPropertiesDraftScope(
  target: Composition | Layer | null,
  currentFrame: number,
  localFrame: number
) {
  return `${target?.id ?? "none"}:${currentFrame}:${localFrame}`;
}

export function getPropertiesInputCurrentValue(
  inputId: PropertiesNumericInputId,
  values: PropertiesResolvedValues
) {
  const { property, axis } = getPropertiesNumericInputDescriptor(inputId);
  if (property === "position" && axis !== "value") return values.position[axis];
  if (property === "scale" && axis !== "value") return values.scale[axis];
  if (property === "anchor" && axis !== "value") return values.anchor[axis];
  if (property === "rotation") return values.rotation;
  return values.opacity;
}

export function buildPropertiesTransformOriginViewModel(options: {
  values: PropertiesResolvedValues;
  editable: boolean;
  numericDrafts: Partial<Record<PropertiesNumericInputId, string>>;
}): PropertiesTransformOriginViewModel {
  const inputs = (["anchor.x", "anchor.y"] as const).map((inputId) => {
    const { axis } = getPropertiesNumericInputDescriptor(inputId);
    return {
      id: inputId,
      axisLabel: axis.toUpperCase(),
      value: options.numericDrafts[inputId]
        ?? formatPropertiesNumericValue(
          "anchor",
          getPropertiesInputCurrentValue(inputId, options.values)
        ),
      readOnly: !options.editable,
      width: 42,
      title: options.editable
        ? undefined
        : "현재 선택 대상의 기준은 편집할 수 없습니다.",
    };
  });

  return {
    label: "기준",
    visible: true,
    editable: options.editable,
    inputs,
    tokens: getPropertiesVisualTokens("position"),
  };
}

export function buildPropertiesPropertyRows(options: {
  properties: readonly AnimatableProperty[];
  propertyState: PropertyTrackState;
  values: PropertiesResolvedValues;
  editableProperties: Record<AnimatableProperty, boolean>;
  scaleLinked: boolean;
  numericDrafts: Partial<Record<PropertiesNumericInputId, string>>;
  hasKeyframeAtCurrentFrame: (property: AnimatableProperty) => boolean;
  selectedKeyframe: SelectedKeyframe;
}): PropertiesPropertyRowViewModel[] {
  return options.properties.map((property) => {
    const editable = options.editableProperties[property];
    const inputs = PROPERTY_INPUT_IDS[property].map((inputId) => {
      const { axis } = getPropertiesNumericInputDescriptor(inputId);
      const axisLabel = property === "position" || property === "scale"
        ? axis.toUpperCase()
        : property === "rotation"
          ? "deg"
          : "%";
      const value = options.numericDrafts[inputId]
        ?? formatPropertiesNumericValue(
          property,
          getPropertiesInputCurrentValue(inputId, options.values)
        );

      return {
        id: inputId,
        axisLabel,
        value,
        readOnly: !editable,
        width: property === "rotation" ? 48 : 42,
        title: editable ? undefined : "이 프로퍼티 값 편집은 아직 준비 중입니다.",
      };
    });
    const hasKeyframe = options.hasKeyframeAtCurrentFrame(property);

    return {
      property,
      label: PROPERTY_LABELS[property],
      icon: property,
      enabled: options.propertyState[property],
      visible: true,
      editable,
      trackBadge: options.propertyState[property] ? "On" : "Off",
      hasKeyframeAtCurrentFrame: hasKeyframe,
      isSelectedKeyframe: !!options.selectedKeyframe
        && options.selectedKeyframe.property === property,
      scaleLinked: property === "scale" ? options.scaleLinked : null,
      inputs,
      tokens: getPropertiesVisualTokens(property),
    };
  });
}

export function buildPropertiesKeyframeViewModel(options: {
  selectedLayer: Layer | null;
  selectedTimelineComposition: Composition | null;
  positionTrackEnabled: boolean;
  selectedKeyframe: SelectedKeyframe;
  frameRate: number;
  formatTime: (frame: number, frameRate: number) => string;
}): PropertiesKeyframeViewModel {
  const visible = !!options.selectedLayer || !!options.selectedTimelineComposition;
  return {
    visible,
    showPositionSave: !!options.selectedLayer,
    canSavePosition: !!options.selectedLayer && options.positionTrackEnabled,
    selectedText: options.selectedKeyframe
      ? `${PROPERTY_LABELS[options.selectedKeyframe.property]} · ${options.formatTime(
        options.selectedKeyframe.frame,
        options.frameRate
      )}`
      : "없음",
    canDeleteSelected: !!options.selectedKeyframe,
  };
}

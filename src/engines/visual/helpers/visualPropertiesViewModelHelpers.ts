import { ANIMATABLE_PROPERTIES } from "@/animation";
import type {
  AnimatableProperty,
  LayerTransform,
} from "@/models";
import {
  buildPropertiesPropertyRows,
  buildPropertiesTransformOriginViewModel,
  type PropertiesSelectedKeyframe,
} from "@/engines/visual/helpers/propertiesViewModelHelpers";
import type {
  LayerDocumentPropertiesDescriptor,
} from "@/engines/visual/models/layerDocumentPropertiesModel";
import type {
  PropertiesKeyframeViewModel,
  PropertiesNumericInputId,
  PropertiesPropertyRowViewModel,
  PropertiesResolvedValues,
  PropertiesTransformOriginViewModel,
} from "@/engines/visual/models/propertiesEngineModel";

const EMPTY_VALUES: PropertiesResolvedValues = {
  position: { x: 0, y: 0 },
  scale: { x: 100, y: 100 },
  rotation: 0,
  opacity: 100,
  anchor: { x: 0, y: 0 },
};

export type VisualPropertiesProjection = {
  values: PropertiesResolvedValues;
  rows: PropertiesPropertyRowViewModel[];
  transformOrigin: PropertiesTransformOriginViewModel;
  keyframe: PropertiesKeyframeViewModel;
};

export function buildVisualPropertiesProjection(options: {
  descriptor: LayerDocumentPropertiesDescriptor | null;
  transform: LayerTransform | null;
  localFrame: number | null;
  selectedKeyframe: PropertiesSelectedKeyframe;
  drafts: Partial<Record<PropertiesNumericInputId, string>>;
  frameRate: number;
  formatTime: (frame: number, frameRate: number) => string;
}): VisualPropertiesProjection {
  const descriptor = options.descriptor;
  const transform = options.transform;
  const values = transform
    ? {
        position: transform.position,
        scale: transform.scale,
        rotation: transform.rotation,
        opacity: transform.opacity,
        anchor: transform.anchor,
      }
    : EMPTY_VALUES;
  const editable = Object.fromEntries(
    ANIMATABLE_PROPERTIES.map((property) => [
      property,
      descriptor?.capabilities.transformInputs[property].status === "editable",
    ])
  ) as Record<AnimatableProperty, boolean>;
  return {
    values,
    rows: buildPropertiesPropertyRows({
      properties: ANIMATABLE_PROPERTIES,
      propertyState: descriptor?.animation.enabledProperties ?? {
        position: false,
        scale: false,
        rotation: false,
        opacity: false,
      },
      values,
      editableProperties: editable,
      trackEditableProperties: editable,
      scaleLinked: transform?.scaleLinked ?? true,
      numericDrafts: options.drafts,
      hasKeyframeAtCurrentFrame: (property) => {
        if (!descriptor || options.localFrame === null) return false;
        const keyframes = descriptor.animation[
          `${property}Keyframes` as keyof typeof descriptor.animation
        ];
        return Array.isArray(keyframes) && keyframes.some(
          (keyframe) => keyframe.frame === options.localFrame
        );
      },
      selectedKeyframe: options.selectedKeyframe,
    }),
    transformOrigin: buildPropertiesTransformOriginViewModel({
      values,
      editable: descriptor?.capabilities.transformInputs.anchor.status === "editable",
      numericDrafts: options.drafts,
    }),
    keyframe: {
      visible: Boolean(descriptor && descriptor.type !== "audio"),
      showPositionSave: Boolean(
        descriptor?.capabilities.transformInputs.position.status === "editable"
      ),
      canSavePosition: Boolean(
        descriptor?.animation.enabledProperties.position && editable.position
      ),
      selectedText: options.selectedKeyframe
        ? `${options.selectedKeyframe.property} · ${options.formatTime(options.selectedKeyframe.frame, options.frameRate)}`
        : "없음",
      canDeleteSelected: Boolean(options.selectedKeyframe),
    },
  };
}

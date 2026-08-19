import type {
  AnimatableProperty,
  LayerAnimation,
  LayerTransform,
} from "@/models";
import { upsertKeyframeValue } from "@/models/keyframeTrackMutation";
import type { PreviewSceneTransformPatch } from "@/render";
import {
  applyLinkedScaleInput,
  applyPositionInput,
  clampPropertiesNumericValue,
  getPropertiesNumericInputDescriptor,
  parsePropertiesNumericDraft,
} from "@/engines/visual/helpers/propertiesNumericHelpers";
import type {
  LayerDocumentPropertiesDescriptor,
} from "@/engines/visual/models/layerDocumentPropertiesModel";
import type {
  PropertiesNumericInputId,
} from "@/engines/visual/models/propertiesEngineModel";
import { getCompensatedTransformOffset } from "@/shared/geometry/transformOffsetHelpers";

export function clonePropertiesTransform(
  transform: LayerTransform
): LayerTransform {
  return {
    ...transform,
    position: { ...transform.position },
    transformOffset: { ...transform.transformOffset },
    anchor: { ...transform.anchor },
    scale: { ...transform.scale },
  };
}

export function readPropertiesNumericValue(
  transform: LayerTransform,
  inputId: PropertiesNumericInputId
) {
  const { property, axis } = getPropertiesNumericInputDescriptor(inputId);
  if (property === "position" && axis !== "value") {
    return transform.position[axis];
  }
  if (property === "scale" && axis !== "value") {
    return transform.scale[axis];
  }
  if (property === "anchor" && axis !== "value") {
    return transform.anchor[axis];
  }
  return property === "rotation" ? transform.rotation : transform.opacity;
}

export function buildPropertiesTransformPatch(
  transform: LayerTransform,
  inputId: PropertiesNumericInputId,
  rawValue: string
): PreviewSceneTransformPatch | null {
  const parsed = parsePropertiesNumericDraft(rawValue);
  if (parsed.kind !== "number") return null;
  const { property, axis } = getPropertiesNumericInputDescriptor(inputId);
  const value = clampPropertiesNumericValue(property, parsed.value);
  if (property === "position" && axis !== "value") {
    return { position: applyPositionInput(transform.position, axis, value) };
  }
  if (property === "scale" && axis !== "value") {
    return {
      scale: applyLinkedScaleInput(
        transform.scale,
        axis,
        value,
        transform.scaleLinked
      ),
    };
  }
  if (property === "anchor" && axis !== "value") {
    const anchor = applyPositionInput(transform.anchor, axis, value);
    return {
      anchor,
      transformOffset: getCompensatedTransformOffset(
        transform.transformOffset,
        transform.anchor,
        anchor,
        transform.scale,
        transform.rotation
      ),
    };
  }
  if (property === "rotation") return { rotation: value };
  return { opacity: value };
}

export function hasPropertiesTransformPatchChanged(
  transform: LayerTransform,
  patch: PreviewSceneTransformPatch
) {
  return (
    (patch.position !== undefined && (
      patch.position.x !== transform.position.x ||
      patch.position.y !== transform.position.y
    )) ||
    (patch.scale !== undefined && (
      patch.scale.x !== transform.scale.x ||
      patch.scale.y !== transform.scale.y
    )) ||
    (patch.anchor !== undefined && (
      patch.anchor.x !== transform.anchor.x ||
      patch.anchor.y !== transform.anchor.y
    )) ||
    (patch.transformOffset !== undefined && (
      patch.transformOffset.x !== transform.transformOffset.x ||
      patch.transformOffset.y !== transform.transformOffset.y
    )) ||
    (patch.rotation !== undefined && patch.rotation !== transform.rotation) ||
    (patch.opacity !== undefined && patch.opacity !== transform.opacity)
  );
}

export function isPropertiesNumericInputEditable(
  descriptor: LayerDocumentPropertiesDescriptor,
  inputId: PropertiesNumericInputId
) {
  const { property } = getPropertiesNumericInputDescriptor(inputId);
  return descriptor.capabilities.transformInputs[property].status === "editable";
}

export function buildPropertiesAnimationWithTrack(
  animation: LayerAnimation,
  transform: LayerTransform,
  property: AnimatableProperty,
  enabled: boolean,
  localFrame: number
): LayerAnimation {
  const next: LayerAnimation = {
    ...animation,
    positionKeyframes: [...animation.positionKeyframes],
    scaleKeyframes: [...animation.scaleKeyframes],
    rotationKeyframes: [...animation.rotationKeyframes],
    opacityKeyframes: [...animation.opacityKeyframes],
    enabledProperties: {
      ...animation.enabledProperties,
      [property]: enabled,
    },
  };
  if (!enabled) return next;
  if (property === "position") {
    next.positionKeyframes = upsertKeyframeValue(
      next.positionKeyframes,
      localFrame,
      transform.position
    );
  } else if (property === "scale") {
    next.scaleKeyframes = upsertKeyframeValue(
      next.scaleKeyframes,
      localFrame,
      transform.scale
    );
  } else if (property === "rotation") {
    next.rotationKeyframes = upsertKeyframeValue(
      next.rotationKeyframes,
      localFrame,
      transform.rotation
    );
  } else {
    next.opacityKeyframes = upsertKeyframeValue(
      next.opacityKeyframes,
      localFrame,
      transform.opacity
    );
  }
  return next;
}

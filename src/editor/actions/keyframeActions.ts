import type {
  Composition,
  OpacityKeyframe,
  Position,
  PositionKeyframe,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
} from "@/editor/types/types";
import type { SelectedKeyframe } from "@/editor/types/editorViewTypes";
import {
  moveKeyframeValue,
  removeKeyframeValue,
  upsertKeyframeValue,
} from "@/editor/actions/keyframeTrackHelpers";
import {
  type SupportedKeyframeList,
  withCompositionKeyframes,
  withLayerKeyframes,
} from "@/editor/actions/keyframeTargetHelpers";

function movePropertyKeyframes<T extends SupportedKeyframeList>(
  keyframes: T,
  fromFrame: number,
  toFrame: number
) {
  return moveKeyframeValue(keyframes as T[number][], fromFrame, toFrame) as T;
}

function removePropertyKeyframes<T extends SupportedKeyframeList>(keyframes: T, frame: number) {
  return removeKeyframeValue(keyframes as T[number][], frame) as T;
}

export function upsertPositionKeyframe(
  keyframes: PositionKeyframe[],
  frame: number,
  value: Position
) {
  return upsertKeyframeValue(keyframes, frame, value);
}

export function upsertOpacityKeyframe(
  keyframes: OpacityKeyframe[],
  frame: number,
  value: number
) {
  return upsertKeyframeValue(keyframes, frame, value);
}

export function upsertScaleKeyframe(
  keyframes: ScaleKeyframe[],
  frame: number,
  value: Scale
) {
  return upsertKeyframeValue(keyframes, frame, value);
}

export function upsertRotationKeyframe(
  keyframes: RotationKeyframe[],
  frame: number,
  value: number
) {
  return upsertKeyframeValue(keyframes, frame, value);
}

export function moveLayerKeyframeRecursively(
  comp: Composition,
  targetKind: "layer" | "composition",
  targetId: string,
  fromFrame: number,
  toFrame: number,
  property: "position" | "opacity" | "scale" | "rotation"
): Composition {
  if (targetKind === "layer") {
    return withLayerKeyframes(comp, targetId, property, (keyframes) =>
      movePropertyKeyframes(keyframes as SupportedKeyframeList, fromFrame, toFrame)
    );
  }

  return withCompositionKeyframes(comp, targetId, property, (keyframes) =>
    movePropertyKeyframes(keyframes as SupportedKeyframeList, fromFrame, toFrame)
  );
}

export function removeSelectedKeyframeFromComps(
  comps: Composition[],
  selectedKeyframe: NonNullable<SelectedKeyframe>
) {
  if (selectedKeyframe.targetKind === "layer") {
    return comps.map((comp) =>
      withLayerKeyframes(comp, selectedKeyframe.targetId, selectedKeyframe.property, (keyframes) =>
        removePropertyKeyframes(keyframes as SupportedKeyframeList, selectedKeyframe.frame)
      )
    );
  }

  return comps.map((comp) =>
    withCompositionKeyframes(
      comp,
      selectedKeyframe.targetId,
      selectedKeyframe.property,
      (keyframes) =>
        removePropertyKeyframes(keyframes as SupportedKeyframeList, selectedKeyframe.frame)
    )
  );
}

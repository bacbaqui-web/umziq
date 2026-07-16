import type { AnimatableProperty } from "@/models";
import type {
  SelectedKeyframe,
  TransformTargetSelection,
} from "@/engines/animation/models/animationSessionModel";

export function createSelectedPropertyKeyframe(
  targetKind: "layer" | "composition",
  targetId: string,
  property: AnimatableProperty,
  frame: number
): NonNullable<SelectedKeyframe> {
  return { targetKind, targetId, property, frame };
}

export function createSelectedKeyframeForTarget(
  selection: NonNullable<TransformTargetSelection>,
  property: AnimatableProperty,
  frame: number
): NonNullable<SelectedKeyframe> {
  return createSelectedPropertyKeyframe(
    selection.kind,
    selection.kind === "layer" ? selection.layer.id : selection.composition.id,
    property,
    frame
  );
}

export function matchesSelectedPropertyKeyframe(
  selectedKeyframe: SelectedKeyframe,
  targetKind: "layer" | "composition",
  targetId: string,
  property: AnimatableProperty,
  frame?: number
) {
  return (
    selectedKeyframe?.targetKind === targetKind &&
    selectedKeyframe.targetId === targetId &&
    selectedKeyframe.property === property &&
    (frame === undefined || selectedKeyframe.frame === frame)
  );
}

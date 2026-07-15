import type { Dispatch, SetStateAction } from "react";
import type { AnimatableProperty, Scale } from "@/editor/types/types";
import type { SelectedKeyframe } from "@/editor/types/editorViewTypes";

export function createSelectedPropertyKeyframe(
  targetKind: "layer" | "composition",
  targetId: string,
  property: AnimatableProperty,
  frame: number
): NonNullable<SelectedKeyframe> {
  return {
    targetKind,
    targetId,
    property,
    frame,
  };
}

export function matchesSelectedPropertyKeyframe(
  selectedKeyframe: SelectedKeyframe,
  targetKind: "layer" | "composition",
  targetId: string,
  property: AnimatableProperty
) {
  return (
    selectedKeyframe?.targetKind === targetKind &&
    selectedKeyframe.targetId === targetId &&
    selectedKeyframe.property === property
  );
}

export function clearTransformDraftState(
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>,
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>,
  setRotationDraft: Dispatch<SetStateAction<number | null>>,
  setOpacityDraft: Dispatch<SetStateAction<number | null>>
) {
  setSelectedKeyframe(null);
  setScaleDraft(null);
  setRotationDraft(null);
  setOpacityDraft(null);
}

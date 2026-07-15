import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";
import { moveLayerKeyframeRecursively } from "@/editor/actions/editorActions";
import type { Composition, TimelineItem } from "@/editor/types/types";
import type { SelectedKeyframe, TimelineSelection } from "@/editor/types/editorViewTypes";
import type {
  TimelineInteraction,
  TimelineKeyframeProperty,
} from "@/features/timeline/types/timelineInteractionTypes";

type UseTimelineKeyframeInteractionsOptions = {
  timelinePxPerFrame: number;
  selectedComp: Composition;
  selectedTimelineItems: TimelineItem[];
  draggingKeyframe: SelectedKeyframe;
  timelineInteractionRef: MutableRefObject<TimelineInteraction | null>;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setCurrentFrame: Dispatch<SetStateAction<number>>;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setDraggingKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  beginCompositionHistoryCapture: (compId: string) => void;
  markCompositionHistoryCaptureDirty: (compId: string) => void;
  commitCompositionHistoryCapture: (compId: string) => void;
  applySelectionForComposition: (
    compId: string,
    nextSelection: TimelineSelection
  ) => void;
};

export function useTimelineKeyframeInteractions({
  timelinePxPerFrame,
  selectedComp,
  selectedTimelineItems,
  draggingKeyframe,
  timelineInteractionRef,
  setComps,
  setCurrentFrame,
  setSelectedKeyframe,
  setDraggingKeyframe,
  beginCompositionHistoryCapture,
  markCompositionHistoryCaptureDirty,
  commitCompositionHistoryCapture,
  applySelectionForComposition,
}: UseTimelineKeyframeInteractionsOptions) {
  const handleSelectKeyframe = useCallback(
    (
      targetKind: "layer" | "composition",
      targetId: string,
      frame: number,
      property: TimelineKeyframeProperty
    ) => {
      const ownerItem = selectedTimelineItems.find((item) => item.sourceId === targetId);
      const nextFrame = ownerItem ? ownerItem.startFrame + frame : frame;

      applySelectionForComposition(selectedComp.id, {
        sourceId: targetId,
        kind: targetKind === "layer" ? "layer" : "subComp",
      });
      setCurrentFrame(nextFrame);
      setSelectedKeyframe({ targetKind, targetId, frame, property });
    },
    [
      applySelectionForComposition,
      selectedComp.id,
      selectedTimelineItems,
      setCurrentFrame,
      setSelectedKeyframe,
    ]
  );

  const handleBeginMoveKeyframe = useCallback(
    (
      event: ReactMouseEvent,
      targetKind: "layer" | "composition",
      targetId: string,
      frame: number,
      property: TimelineKeyframeProperty
    ) => {
      beginCompositionHistoryCapture(selectedComp.id);
      timelineInteractionRef.current = {
        type: "move-keyframe",
        targetKind,
        targetId,
        originalFrame: frame,
        frame,
        property,
        startClientX: event.clientX,
      };
      setDraggingKeyframe({
        targetKind,
        targetId,
        originFrame: frame,
        frame,
        property,
      });
    },
    [beginCompositionHistoryCapture, selectedComp.id, setDraggingKeyframe, timelineInteractionRef]
  );

  useEffect(() => {
    const stopMoveKeyframe = (
      interaction: Extract<TimelineInteraction, { type: "move-keyframe" }>
    ) => {
      flushSync(() => {
        if (interaction.frame !== interaction.originalFrame) {
          setComps((prev) =>
            prev.map((comp) =>
              moveLayerKeyframeRecursively(
                comp,
                interaction.targetKind,
                interaction.targetId,
                interaction.originalFrame,
                interaction.frame,
                interaction.property
              )
            )
          );
        }

        setSelectedKeyframe({
          targetKind: interaction.targetKind,
          targetId: interaction.targetId,
          frame: interaction.frame,
          property: interaction.property,
        });
        setDraggingKeyframe(null);
        timelineInteractionRef.current = null;
      });

      commitCompositionHistoryCapture(selectedComp.id);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const interaction = timelineInteractionRef.current;

      if (interaction?.type !== "move-keyframe") {
        return;
      }

      const deltaFrames = Math.round(
        (event.clientX - interaction.startClientX) / timelinePxPerFrame
      );
      const ownerItem = selectedTimelineItems.find((item) => item.sourceId === interaction.targetId);

      if (!ownerItem) {
        return;
      }

      const nextLocalFrame = Math.max(0, interaction.frame + deltaFrames);

      if (nextLocalFrame === interaction.frame) {
        return;
      }

      markCompositionHistoryCaptureDirty(selectedComp.id);
      setSelectedKeyframe({
        targetKind: interaction.targetKind,
        targetId: interaction.targetId,
        originFrame: interaction.originalFrame,
        frame: nextLocalFrame,
        property: interaction.property,
      });
      setDraggingKeyframe({
        targetKind: interaction.targetKind,
        targetId: interaction.targetId,
        originFrame: interaction.originalFrame,
        frame: nextLocalFrame,
        property: interaction.property,
      });
      timelineInteractionRef.current = {
        ...interaction,
        frame: nextLocalFrame,
        startClientX: event.clientX,
      };
    };

    const handleMouseUp = () => {
      const interaction = timelineInteractionRef.current;

      if (interaction?.type === "move-keyframe") {
        stopMoveKeyframe(interaction);
      }
    };

    const handleWindowBlur = () => {
      const interaction = timelineInteractionRef.current;

      if (interaction?.type === "move-keyframe") {
        stopMoveKeyframe(interaction);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [
    commitCompositionHistoryCapture,
    markCompositionHistoryCaptureDirty,
    selectedComp.id,
    selectedTimelineItems,
    setComps,
    setDraggingKeyframe,
    setSelectedKeyframe,
    timelineInteractionRef,
    timelinePxPerFrame,
  ]);

  useEffect(() => {
    if (!draggingKeyframe) {
      return;
    }

    const previousBodyCursor = document.body.style.cursor;
    const previousDocumentCursor = document.documentElement.style.cursor;

    document.body.style.cursor = "none";
    document.documentElement.style.cursor = "none";

    return () => {
      document.body.style.cursor = previousBodyCursor;
      document.documentElement.style.cursor = previousDocumentCursor;
    };
  }, [draggingKeyframe]);

  return {
    handleSelectKeyframe,
    handleBeginMoveKeyframe,
  };
}

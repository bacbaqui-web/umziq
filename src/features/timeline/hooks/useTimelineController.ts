import { useRef, type Dispatch, type SetStateAction } from "react";
import type {
  Composition,
  CompositionMeta,
  Position,
  RenderItem,
  Scale,
  TimelineItem,
} from "@/editor/types/types";
import type { SelectedKeyframe, TimelineSelection } from "@/editor/types/editorViewTypes";
import type { TimelineInteraction } from "@/features/timeline/types/timelineInteractionTypes";
import { useTimelineItemInteractions } from "@/features/timeline/hooks/useTimelineItemInteractions";
import { useTimelineKeyframeInteractions } from "@/features/timeline/hooks/useTimelineKeyframeInteractions";
import { useTimelinePlayback } from "@/features/timeline/hooks/useTimelinePlayback";

type UseTimelineControllerOptions = {
  masterCompId: string;
  timelinePxPerFrame: number;
  selectedComp: Composition;
  selectedMeta: CompositionMeta | null;
  playbackRangeStartFrame: number;
  playbackRangeEndFrame: number;
  comps: Composition[];
  currentFrame: number;
  hoveredFrame: number | null;
  draggedTimelineItemId: string | null;
  draggingKeyframe: SelectedKeyframe;
  selectedTimelineTarget: TimelineSelection;
  selectedTimelineItems: TimelineItem[];
  renderItemsByCompId: Record<string, RenderItem[]>;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setTimelineItemsByCompId: Dispatch<
    SetStateAction<Record<string, TimelineItem[]>>
  >;
  setRenderItemsByCompId: Dispatch<
    SetStateAction<Record<string, RenderItem[]>>
  >;
  setCurrentFrame: Dispatch<SetStateAction<number>>;
  setSelectedCompId: Dispatch<SetStateAction<string>>;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setDraggingKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setDraggedTimelineItemId: Dispatch<SetStateAction<string | null>>;
  setIsScrubbingTimeline: Dispatch<SetStateAction<boolean>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  isPlaying: boolean;
  pushCompositionHistorySnapshot: (compId: string) => void;
  beginCompositionHistoryCapture: (compId: string) => void;
  markCompositionHistoryCaptureDirty: (compId: string) => void;
  commitCompositionHistoryCapture: (compId: string) => void;
  setPositionDraft: Dispatch<SetStateAction<Position | null>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
  applySelectionForComposition: (
    compId: string,
    nextSelection: TimelineSelection
  ) => void;
};

export function useTimelineController({
  masterCompId,
  timelinePxPerFrame,
  selectedComp,
  selectedMeta,
  playbackRangeStartFrame,
  playbackRangeEndFrame,
  comps,
  currentFrame,
  hoveredFrame,
  draggedTimelineItemId,
  draggingKeyframe,
  selectedTimelineTarget,
  selectedTimelineItems,
  renderItemsByCompId,
  setComps,
  setTimelineItemsByCompId,
  setRenderItemsByCompId,
  setCurrentFrame,
  setSelectedCompId,
  setSelectedKeyframe,
  setDraggingKeyframe,
  setDraggedTimelineItemId,
  setIsScrubbingTimeline,
  setIsPlaying,
  isPlaying,
  pushCompositionHistorySnapshot,
  beginCompositionHistoryCapture,
  markCompositionHistoryCaptureDirty,
  commitCompositionHistoryCapture,
  setPositionDraft,
  setScaleDraft,
  setRotationDraft,
  setOpacityDraft,
  applySelectionForComposition,
}: UseTimelineControllerOptions) {
  const timelineInteractionRef = useRef<TimelineInteraction | null>(null);

  const playback = useTimelinePlayback({
    timelinePxPerFrame,
    selectedMeta,
    playbackRangeStartFrame,
    playbackRangeEndFrame,
    currentFrame,
    hoveredFrame,
    setCurrentFrame,
    setIsScrubbingTimeline,
    setIsPlaying,
    setPositionDraft,
    setScaleDraft,
    setRotationDraft,
    setOpacityDraft,
  });

  const selectedTimelineTargetItem =
    selectedTimelineTarget
      ? selectedTimelineItems.find(
          (item) =>
            (selectedTimelineTarget.itemId
              ? item.id === selectedTimelineTarget.itemId
              : item.sourceId === selectedTimelineTarget.sourceId) &&
            item.kind === selectedTimelineTarget.kind
        ) ?? null
      : null;
  const selectedTransformLocalFrame =
    selectedTimelineTargetItem &&
    playback.playheadFrame >= selectedTimelineTargetItem.startFrame &&
    playback.playheadFrame <
      selectedTimelineTargetItem.startFrame + selectedTimelineTargetItem.durationFrames
      ? playback.playheadFrame - selectedTimelineTargetItem.startFrame
      : playback.playheadFrame;
  const draggingKeyframeDisplayFrame =
    draggingKeyframe && selectedTimelineItems.length > 0
      ? (() => {
          const ownerItem = selectedTimelineItems.find(
            (item) => item.sourceId === draggingKeyframe.targetId
          );
          return ownerItem ? ownerItem.startFrame + draggingKeyframe.frame : draggingKeyframe.frame;
        })()
      : null;

  const itemInteractions = useTimelineItemInteractions({
    masterCompId,
    timelinePxPerFrame: playback.timelinePxPerFrame,
    selectedComp,
    selectedMeta,
    currentFrame,
    comps,
    draggedTimelineItemId,
    selectedTimelineTarget,
    selectedTimelineItems,
    renderItemsByCompId,
    timelineInteractionRef,
    setComps,
    setTimelineItemsByCompId,
    setRenderItemsByCompId,
    setSelectedCompId,
    setDraggedTimelineItemId,
    pushCompositionHistorySnapshot,
    beginCompositionHistoryCapture,
    markCompositionHistoryCaptureDirty,
    commitCompositionHistoryCapture,
    applySelectionForComposition,
  });

  const keyframeInteractions = useTimelineKeyframeInteractions({
    timelinePxPerFrame: playback.timelinePxPerFrame,
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
  });

  return {
    timelineRulerRef: playback.timelineRulerRef,
    playheadFrame: playback.playheadFrame,
    selectedTimelineTargetItem,
    selectedTransformLocalFrame,
    timelineFrames: playback.timelineFrames,
    timelinePxPerFrame: playback.timelinePxPerFrame,
    timelineContentWidth: playback.timelineContentWidth,
    timelinePlayheadLeft: playback.timelinePlayheadLeft,
    hoveredPlayheadLeft: playback.hoveredPlayheadLeft,
    draggingKeyframeDisplayFrame,
    getFrameFromPointer: playback.getFrameFromPointer,
    updateFrameFromPointer: playback.updateFrameFromPointer,
    handleSetScrubbing: playback.handleSetScrubbing,
    handleResetToStart: playback.handleResetToStart,
    handlePlay: playback.handlePlay,
    handlePause: playback.handlePause,
    handleStepBackward: playback.handleStepBackward,
    handleStepForward: playback.handleStepForward,
    isPlaying,
    handleTimelineReorder: itemInteractions.handleTimelineReorder,
    beginMoveTimelineItem: itemInteractions.beginMoveTimelineItem,
    beginResizeTimelineItemStart: itemInteractions.beginResizeTimelineItemStart,
    beginResizeTimelineItemEnd: itemInteractions.beginResizeTimelineItemEnd,
    handleSelectTimelineItem: itemInteractions.handleSelectTimelineItem,
    handleDuplicateSelectedTimelineItem: itemInteractions.duplicateSelectedTimelineItem,
    handleRenameTimelineItem: itemInteractions.renameTimelineItem,
    handleSplitSelectedTimelineItem: itemInteractions.splitSelectedTimelineItemAtPlayhead,
    handleSelectKeyframe: keyframeInteractions.handleSelectKeyframe,
    handleBeginMoveKeyframe: keyframeInteractions.handleBeginMoveKeyframe,
  };
}

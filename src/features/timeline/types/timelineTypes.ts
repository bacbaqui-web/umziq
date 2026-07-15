import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import type {
  AnimatableProperty,
  Composition,
  CompositionMeta,
  Layer,
  TimelineItem,
} from "@/editor/types/types";
import type {
  TimelineCompositionSwitcherItem,
  TimelineCompositionSwitcherModel,
} from "@/features/timeline/timelineSelectionPath";
import type {
  SelectedKeyframe,
  TimelineRow,
  TimelineSelection,
} from "@/editor/types/editorViewTypes";

export type TimelinePanelProps = {
  selectedComp: Composition | null;
  selectedMeta: CompositionMeta | null;
  selectionBreadcrumbPath: string | null;
  compositionSwitcherParentName: TimelineCompositionSwitcherModel["parentName"];
  compositionSwitcherParentIsCurrent: TimelineCompositionSwitcherModel["parentIsCurrent"];
  compositionSwitcherItems: TimelineCompositionSwitcherItem[];
  timelineNameColWidth: number;
  timelinePxPerFrame: number;
  timelineContentWidth: number;
  timelineFrames: Array<{ frame: number; label: string }>;
  displayedTimelineRows: TimelineRow[];
  selectedTimelineTarget: TimelineSelection;
  selectedKeyframe: SelectedKeyframe;
  draggingKeyframe: SelectedKeyframe;
  draggingKeyframeDisplayFrame: number | null;
  draggedTimelineItemId: string | null;
  timelinePlayheadLeft: number;
  playbackRangeStartFrame: number;
  playbackRangeEndFrame: number;
  hoveredPlayheadLeft: number | null;
  hoveredFrame: number | null;
  isScrubbingTimeline: boolean;
  propertyLabels: Record<AnimatableProperty, string>;
  allLayersById: Map<string, Layer>;
  allCompositionsById: Map<string, Composition>;
  timelineRulerRef: RefObject<HTMLDivElement | null>;
  formatCompactTime: (frame: number, frameRate: number) => string;
  formatTimelineTime: (frame: number, frameRate: number) => string;
  onSetHoveredFrame: (frame: number | null) => void;
  onGetFrameFromPointer: (clientX: number) => number | null;
  onRulerMouseDown: (clientX: number) => void;
  onSetScrubbing: (scrubbing: boolean) => void;
  onResetToStart: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onTogglePlayback: () => void;
  onDuplicateSelectedTimelineItem: () => void;
  onSplitSelectedTimelineItem: () => void;
  onSwitchComposition: (compId: string) => void;
  onPlay: () => void;
  onPause: () => void;
  isPlaying: boolean;
  onSelectTimelineItem: (item: TimelineItem) => void;
  onAcknowledgeTimelineSourceStatus: (item: TimelineItem) => void;
  onResolveTimelineSourceDelete: (
    item: TimelineItem,
    decision: "delete" | "keep"
  ) => void;
  onRenameTimelineItem: (itemId: string, name: string) => void;
  onTimelineReorder: (targetItemId: string) => void;
  onBeginMoveTimelineItem: (event: ReactMouseEvent, item: TimelineItem) => void;
  onBeginResizeTimelineItemStart: (event: ReactMouseEvent, item: TimelineItem) => void;
  onBeginResizeTimelineItemEnd: (event: ReactMouseEvent, item: TimelineItem) => void;
  onUpdateCompositionDuration: (durationFrames: number) => void;
  onUpdateCompositionPlaybackRange: (startFrame: number, endFrame: number) => void;
  onBeginPlaybackRangeEdit: () => void;
  onMarkPlaybackRangeEditDirty: () => void;
  onCommitPlaybackRangeEdit: () => void;
  onSetDraggedTimelineItemId: (itemId: string | null) => void;
  onSelectKeyframe: (
    targetKind: "layer" | "composition",
    targetId: string,
    frame: number,
    property: "position" | "opacity" | "scale" | "rotation"
  ) => void;
  onBeginMoveKeyframe: (
    event: ReactMouseEvent,
    targetKind: "layer" | "composition",
    targetId: string,
    frame: number,
    property: "position" | "opacity" | "scale" | "rotation"
  ) => void;
  canDuplicateSelectedTimelineItem: boolean;
  canSplitSelectedTimelineItem: boolean;
};

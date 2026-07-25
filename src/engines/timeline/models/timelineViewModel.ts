import type {
  AnimatableProperty,
} from "@/models";

/**
 * Identity-neutral contract consumed by the existing Timeline React UI.
 * LayerDocument adapters produce this visual entity without making it a
 * persisted project representation.
 */
export type TimelineViewItem = {
  id: string;
  name: string;
  entityKind: "layer" | "composition";
  visible: boolean;
  startFrame: number;
  durationFrames: number;
  sourceOffsetFrames: number;
};

export type TimelineBreadcrumbSegment = {
  id: string;
  name: string;
  isCurrent: boolean;
  entityKind: "composition" | null;
};

export type TimelineSelectionLabel = {
  label: string;
  entityKind: "layer" | "composition";
};

export type TimelineCompositionSwitcherItem = {
  id: string;
  name: string;
  depth: number;
  isCurrent: boolean;
  isAncestor: boolean;
};

export type TimelineCompositionSwitcherViewModel = {
  items: TimelineCompositionSwitcherItem[];
  isOpen: boolean;
};

export type TimelinePropertyVisualTokens = {
  accent: string;
  accentMuted: string;
  label: string;
};

export type TimelineSourceStatusViewModel = {
  status:
    | "normal"
    | "updated"
    | "new"
    | "deletePending"
    | "missing";
  isDeletePending: boolean;
  badge: { label: string; color: string; background: string } | null;
};

export type TimelineItemRowViewModel = {
  type: "item";
  item: TimelineViewItem;
  rowIndex: number;
  connectToProperties: boolean;
  selected: boolean;
  source: TimelineSourceStatusViewModel;
  rowBackground: string;
  trackLeft: number;
  trackWidth: number;
  trackBackground: string;
  trackOpacity: number;
  isEditingName: boolean;
  draftName: string;
  showDeleteDecision: boolean;
};

export type TimelineKeyframePointViewModel = {
  frame: number;
  left: number;
  title: string;
  selected: boolean;
  dragging: boolean;
};

export type TimelinePropertyRowViewModel = {
  type: "property";
  item: TimelineViewItem;
  property: AnimatableProperty;
  targetKind: "layer" | "composition";
  rowIndex: number;
  label: string;
  colors: TimelinePropertyVisualTokens;
  selectedTimelineItem: boolean;
  trackLeft: number;
  trackWidth: number;
  keyframes: TimelineKeyframePointViewModel[];
  dragging: boolean;
  draggingDisplayLeft: number | null;
  draggingReadoutLeft: number | null;
  draggingReadoutText: string | null;
};

export type TimelineTrackRowViewModel = TimelineItemRowViewModel | TimelinePropertyRowViewModel;

export type TimelineTrackOverlayViewModel = {
  totalTrackGridRows: number;
  frameGridMinorStep: number;
  frameGridMajorStep: number;
  playheadLeft: number;
  selectedBlocks: Array<{ key: string; startRow: number; span: number }>;
  groupGaps: Array<{ key: string; row: number }>;
};

export type TimelineDurationViewModel = {
  valueFrames: number;
  frameRate: number;
  seconds: number;
  frames: number;
  title: string;
  accent: "range" | "timeline";
};

export type TimelineRulerFrameViewModel = {
  frame: number;
  label: string;
  tickTop: number;
  tickHeight: number;
  tickColor: string;
};

export type TimelineRulerReadoutViewModel = {
  mode: "hover" | "scrub" | "resize";
  frame: number;
  left: number;
  text: string;
} | null;

export type TimelineRulerViewModel = {
  contentWidth: number;
  pxPerFrame: number;
  frames: TimelineRulerFrameViewModel[];
  playheadLeft: number;
  hoveredPlayheadLeft: number | null;
  hoveredFrame: number | null;
  isScrubbing: boolean;
  playbackRangeStartFrame: number;
  playbackRangeEndFrame: number;
  playbackRangeLeft: number;
  playbackRangeWidth: number;
  playbackRangeRight: number;
  activeResizeHandle: "start" | "end" | null;
  activeReadout: TimelineRulerReadoutViewModel;
  indicator: {
    left: number;
    width: number;
    background: string;
    zIndex: number;
    boxShadow?: string;
  };
  hideCursor: boolean;
  showInteractionShield: boolean;
  rangeDuration: TimelineDurationViewModel;
  timelineDuration: TimelineDurationViewModel;
};

export type TimelineHeaderViewModel = {
  visible: boolean;
  compositionName: string | null;
  breadcrumbSegments: TimelineBreadcrumbSegment[];
  selectionLabel: TimelineSelectionLabel | null;
  switcher: TimelineCompositionSwitcherViewModel;
  isPlaying: boolean;
  currentFrame: number;
  currentFrameText: string;
  canDuplicateSelectedItem: boolean;
  canSplitSelectedItem: boolean;
};

export type TimelineReadModel = {
  available: boolean;
  nameColumnWidth: number;
  header: TimelineHeaderViewModel;
  ruler: TimelineRulerViewModel;
  rows: TimelineTrackRowViewModel[];
  overlay: TimelineTrackOverlayViewModel;
};

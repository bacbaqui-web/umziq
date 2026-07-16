import type {
  AnimatableProperty,
  Composition,
  CompositionMeta,
  Layer,
  SourceSyncStatus,
  TimelineItem,
  TimelineSelection,
} from "@/models";

export type { TimelineSelection } from "@/models";

export type TimelineRow =
  | { type: "item"; item: TimelineItem }
  | { type: "property"; item: TimelineItem; property: AnimatableProperty };

export type TimelineKeyframeSelection = {
  targetKind: "layer" | "composition";
  targetId: string;
  frame: number;
  originFrame?: number;
  property: AnimatableProperty;
} | null;

export type TimelineCompositionSwitcherItem = {
  id: string;
  name: string;
  isActive: boolean;
};

export type TimelineCompositionSwitcherViewModel = {
  parentName: string | null;
  parentIsCurrent: boolean;
  items: TimelineCompositionSwitcherItem[];
  isOpen: boolean;
};

export type TimelinePropertyVisualTokens = {
  accent: string;
  accentMuted: string;
  label: string;
};

export type TimelineSourceStatusViewModel = {
  status: SourceSyncStatus;
  isDeletePending: boolean;
  badge: { label: string; color: string; background: string } | null;
};

export type TimelineItemRowViewModel = {
  type: "item";
  item: TimelineItem;
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
  item: TimelineItem;
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
  breadcrumbPath: string | null;
  breadcrumbDisplayText: string;
  switcher: TimelineCompositionSwitcherViewModel;
  isPlaying: boolean;
  currentFrame: number;
  currentFrameText: string;
  canDuplicateSelectedItem: boolean;
  canSplitSelectedItem: boolean;
};

export type TimelineReadModel = {
  available: boolean;
  selectedComposition: Composition | null;
  selectedMeta: CompositionMeta | null;
  nameColumnWidth: number;
  header: TimelineHeaderViewModel;
  ruler: TimelineRulerViewModel;
  rows: TimelineTrackRowViewModel[];
  overlay: TimelineTrackOverlayViewModel;
};

export type TimelineProjectReadPort = {
  selectedComposition: Composition;
  selectedMeta: CompositionMeta | null;
  compositions: Composition[];
  selectedTimelineItems: TimelineItem[];
  allLayersById: Map<string, Layer>;
  allCompositionsById: Map<string, Composition>;
};

export type TimelineSelectionReadPort = {
  selectedTimelineTarget: TimelineSelection;
  selectedKeyframe: TimelineKeyframeSelection;
  draggingKeyframe: TimelineKeyframeSelection;
  draggedTimelineItemId: string | null;
};

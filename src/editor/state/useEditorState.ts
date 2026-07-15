import { useRef, useState } from "react";
import type { StoredPsdSource } from "@/editor/types/psdSourceTypes";
import { createPropertyTrackState } from "@/editor/types/types";
import type {
  Composition,
  CompositionMeta,
  OpacityKeyframe,
  Position,
  RenderItem,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
  TimelineItem,
} from "@/editor/types/types";
import type {
  ScaleHandleDirection,
  SelectedKeyframe,
  TimelineSelection,
} from "@/editor/types/editorViewTypes";

type UseEditorStateOptions = {
  masterDefaultWidth: number;
  masterDefaultHeight: number;
  previewMinWorkspaceWidth: number;
  previewMinWorkspaceHeight: number;
};

type ProjectHistorySnapshot = {
  compId: string;
  comps: Composition[];
  masterEnabledProperties: ReturnType<typeof createPropertyTrackState>;
  masterScale: Scale;
  masterScaleKeyframes: ScaleKeyframe[];
  masterScaleLinked: boolean;
  masterRotation: number;
  masterRotationKeyframes: RotationKeyframe[];
  masterOpacity: number;
  masterOpacityKeyframes: OpacityKeyframe[];
  selectedLayerId: string | null;
  selectedTimelineTarget: TimelineSelection;
  lastSelectedItem: NonNullable<TimelineSelection> | null;
  meta: CompositionMeta | null;
  playbackRange: { startFrame: number; endFrame: number } | null;
  timelineItems: TimelineItem[];
  renderItems: RenderItem[];
  currentFrame: number;
};

type CompositionHistoryState = {
  past: ProjectHistorySnapshot[];
  future: ProjectHistorySnapshot[];
  pending: ProjectHistorySnapshot | null;
  pendingDirty: boolean;
};

const PROJECT_HISTORY_LIMIT = 100;

function clonePlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneRenderItemsByCompId(
  value: Record<string, RenderItem[]>
): Record<string, RenderItem[]> {
  return Object.fromEntries(
    Object.entries(value).map(([compId, items]) => [
      compId,
      items.map((item) => ({
        ...item,
        drawables: item.drawables.map((drawable) => ({
          ...drawable,
        })),
      })),
    ])
  );
}

function isSameTimelineSelection(a: TimelineSelection, b: TimelineSelection) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.itemId === b.itemId &&
    a.sourceId === b.sourceId &&
    a.kind === b.kind
  );
}

export function useEditorState({
  masterDefaultWidth,
  masterDefaultHeight,
  previewMinWorkspaceWidth,
  previewMinWorkspaceHeight,
}: UseEditorStateOptions) {
  const compositionHistoryRef = useRef<Record<string, CompositionHistoryState>>({});
  const psdSourceEntriesRef = useRef<Record<string, StoredPsdSource>>({});
  const [comps, setComps] = useState<Composition[]>([]);
  const [masterEnabledProperties, setMasterEnabledProperties] = useState(
    createPropertyTrackState()
  );
  const [masterScale, setMasterScale] = useState<Scale>({ x: 100, y: 100 });
  const [masterScaleKeyframes, setMasterScaleKeyframes] = useState<ScaleKeyframe[]>([]);
  const [masterScaleLinked, setMasterScaleLinked] = useState(true);
  const [masterRotation, setMasterRotation] = useState(0);
  const [masterRotationKeyframes, setMasterRotationKeyframes] = useState<
    RotationKeyframe[]
  >([]);
  const [masterOpacity, setMasterOpacity] = useState(100);
  const [masterOpacityKeyframes, setMasterOpacityKeyframes] = useState<
    OpacityKeyframe[]
  >([]);
  const [masterAnchor] = useState<Position>({
    x: masterDefaultWidth / 2,
    y: masterDefaultHeight / 2,
  });
  const [selectedCompId, setSelectedCompId] = useState<string>("master-composition");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedTimelineTarget, setSelectedTimelineTarget] =
    useState<TimelineSelection>(null);
  const [lastSelectedItemByCompId, setLastSelectedItemByCompId] = useState<
    Record<string, NonNullable<TimelineSelection>>
  >({});
  const [selectedKeyframe, setSelectedKeyframe] = useState<SelectedKeyframe>(null);
  const [positionDraft, setPositionDraft] = useState<Position | null>(null);
  const [scaleDraft, setScaleDraft] = useState<Scale | null>(null);
  const [rotationDraft, setRotationDraft] = useState<number | null>(null);
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null);
  const [metaByCompId, setMetaByCompId] = useState<Record<string, CompositionMeta>>({});
  const [playbackRangeByCompId, setPlaybackRangeByCompId] = useState<
    Record<string, { startFrame: number; endFrame: number }>
  >({});
  const [timelineItemsByCompId, setTimelineItemsByCompId] = useState<
    Record<string, TimelineItem[]>
  >({});
  const [renderItemsByCompId, setRenderItemsByCompId] = useState<
    Record<string, RenderItem[]>
  >({});
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [draggedTimelineItemId, setDraggedTimelineItemId] = useState<string | null>(null);
  const [nextImportIndex, setNextImportIndex] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isScrubbingTimeline, setIsScrubbingTimeline] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDraggingAnchor, setIsDraggingAnchor] = useState(false);
  const [isDraggingPosition, setIsDraggingPosition] = useState(false);
  const [isDraggingOpacity, setIsDraggingOpacity] = useState(false);
  const [isDraggingRotation, setIsDraggingRotation] = useState(false);
  const [isDraggingMotionPathKeyframe, setIsDraggingMotionPathKeyframe] =
    useState(false);
  const [isPreviewPanning, setIsPreviewPanning] = useState(false);
  const [isPreviewPanModifierActive, setIsPreviewPanModifierActive] =
    useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState<Position>({ x: 0, y: 0 });
  const [previewWorkspaceSize, setPreviewWorkspaceSize] = useState({
    width: previewMinWorkspaceWidth,
    height: previewMinWorkspaceHeight,
  });
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [timelinePanelHeight, setTimelinePanelHeight] = useState(280);
  const [activePanelResize, setActivePanelResize] = useState<
    "left" | "right" | "bottom" | null
  >(null);
  const [showShortformFrameOverlay, setShowShortformFrameOverlay] = useState(true);
  const [showSafeZoneGuides, setShowSafeZoneGuides] = useState(false);
  const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);
  const [draggingKeyframe, setDraggingKeyframe] = useState<SelectedKeyframe>(null);
  const [rotationHandleReadout, setRotationHandleReadout] = useState<string | null>(
    null
  );
  const [opacityHandleReadout, setOpacityHandleReadout] = useState<string | null>(
    null
  );
  const [scaleHandleReadout, setScaleHandleReadout] = useState<{
    handle: ScaleHandleDirection;
    text: string;
  } | null>(null);
  const [positionHandleReadout, setPositionHandleReadout] = useState<string | null>(
    null
  );
  const [motionPathKeyframeReadout, setMotionPathKeyframeReadout] = useState<
    string | null
  >(null);
  const [draggingMotionPathFrame, setDraggingMotionPathFrame] = useState<
    number | null
  >(null);

  const getCompositionHistoryState = (compId: string): CompositionHistoryState => {
    const existingState = compositionHistoryRef.current[compId];

    if (existingState) {
      return existingState;
    }

    const nextState: CompositionHistoryState = {
      past: [],
      future: [],
      pending: null,
      pendingDirty: false,
    };
    compositionHistoryRef.current[compId] = nextState;
    return nextState;
  };

  const captureProjectSnapshot = (compId: string): ProjectHistorySnapshot => ({
    compId,
    comps: clonePlainData(comps),
    masterEnabledProperties: clonePlainData(masterEnabledProperties),
    masterScale: clonePlainData(masterScale),
    masterScaleKeyframes: clonePlainData(masterScaleKeyframes),
    masterScaleLinked,
    masterRotation,
    masterRotationKeyframes: clonePlainData(masterRotationKeyframes),
    masterOpacity,
    masterOpacityKeyframes: clonePlainData(masterOpacityKeyframes),
    selectedLayerId,
    selectedTimelineTarget: clonePlainData(selectedTimelineTarget),
    lastSelectedItem: clonePlainData(lastSelectedItemByCompId[compId] ?? null),
    meta: clonePlainData(metaByCompId[compId] ?? null),
    playbackRange: clonePlainData(playbackRangeByCompId[compId] ?? null),
    timelineItems: clonePlainData(timelineItemsByCompId[compId] ?? []),
    renderItems: cloneRenderItemsByCompId({ [compId]: renderItemsByCompId[compId] ?? [] })[compId] ?? [],
    currentFrame,
  });

  const restoreProjectSnapshot = (snapshot: ProjectHistorySnapshot) => {
    setComps(snapshot.comps);
    setMasterEnabledProperties(snapshot.masterEnabledProperties);
    setMasterScale(snapshot.masterScale);
    setMasterScaleKeyframes(snapshot.masterScaleKeyframes);
    setMasterScaleLinked(snapshot.masterScaleLinked);
    setMasterRotation(snapshot.masterRotation);
    setMasterRotationKeyframes(snapshot.masterRotationKeyframes);
    setMasterOpacity(snapshot.masterOpacity);
    setMasterOpacityKeyframes(snapshot.masterOpacityKeyframes);
    setSelectedCompId(snapshot.compId);
    setSelectedLayerId(snapshot.selectedLayerId);
    setSelectedTimelineTarget(snapshot.selectedTimelineTarget);
    setLastSelectedItemByCompId((prev) => {
      if (snapshot.lastSelectedItem) {
        return {
          ...prev,
          [snapshot.compId]: snapshot.lastSelectedItem,
        };
      }

      if (!(snapshot.compId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[snapshot.compId];
      return next;
    });
    setSelectedKeyframe(null);
    setPositionDraft(null);
    setScaleDraft(null);
    setRotationDraft(null);
    setOpacityDraft(null);
    setMetaByCompId((prev) => {
      if (!snapshot.meta) {
        return prev;
      }

      return {
        ...prev,
        [snapshot.compId]: snapshot.meta,
      };
    });
    setPlaybackRangeByCompId((prev) => {
      if (!snapshot.playbackRange) {
        if (!(snapshot.compId in prev)) {
          return prev;
        }

        const next = { ...prev };
        delete next[snapshot.compId];
        return next;
      }

      return {
        ...prev,
        [snapshot.compId]: snapshot.playbackRange,
      };
    });
    setTimelineItemsByCompId((prev) => ({
      ...prev,
      [snapshot.compId]: snapshot.timelineItems,
    }));
    setRenderItemsByCompId((prev) => ({
      ...prev,
      [snapshot.compId]: snapshot.renderItems,
    }));
    setImportError(null);
    setImportNotice(null);
    setDraggedTimelineItemId(null);
    setCurrentFrame(snapshot.currentFrame);
    setIsScrubbingTimeline(false);
    setIsPlaying(false);
    setHoveredFrame(null);
    setDraggingKeyframe(null);
    setRotationHandleReadout(null);
    setOpacityHandleReadout(null);
    setScaleHandleReadout(null);
    setPositionHandleReadout(null);
    setMotionPathKeyframeReadout(null);
    setDraggingMotionPathFrame(null);
  };

  const pushPastProjectSnapshot = (compId: string, snapshot: ProjectHistorySnapshot) => {
    const historyState = getCompositionHistoryState(compId);
    historyState.past = [
      ...historyState.past.slice(-(PROJECT_HISTORY_LIMIT - 1)),
      snapshot,
    ];
  };

  const pushCompositionHistorySnapshot = (compId: string) => {
    const historyState = getCompositionHistoryState(compId);
    pushPastProjectSnapshot(compId, captureProjectSnapshot(compId));
    historyState.future = [];
    historyState.pending = null;
    historyState.pendingDirty = false;
  };

  const beginCompositionHistoryCapture = (compId: string) => {
    const historyState = getCompositionHistoryState(compId);

    if (historyState.pending) {
      if (historyState.pendingDirty) {
        pushPastProjectSnapshot(compId, historyState.pending);
        historyState.future = [];
      }

      historyState.pending = captureProjectSnapshot(compId);
      historyState.pendingDirty = false;
      return;
    }

    historyState.pending = captureProjectSnapshot(compId);
    historyState.pendingDirty = false;
  };

  const markCompositionHistoryCaptureDirty = (compId: string) => {
    const historyState = getCompositionHistoryState(compId);

    if (!historyState.pending) {
      historyState.pending = captureProjectSnapshot(compId);
    }

    historyState.pendingDirty = true;
  };

  const commitCompositionHistoryCapture = (compId: string) => {
    const historyState = getCompositionHistoryState(compId);

    if (!historyState.pending) {
      return;
    }

    if (historyState.pendingDirty) {
      pushPastProjectSnapshot(compId, historyState.pending);
      historyState.future = [];
    }

    historyState.pending = null;
    historyState.pendingDirty = false;
  };

  const cancelCompositionHistoryCapture = (compId: string) => {
    const historyState = getCompositionHistoryState(compId);
    historyState.pending = null;
    historyState.pendingDirty = false;
  };

  const clearCompositionHistory = (compId: string) => {
    delete compositionHistoryRef.current[compId];
  };

  const clearAllCompositionHistories = () => {
    compositionHistoryRef.current = {};
  };

  const undoCompositionHistory = (compId: string) => {
    const historyState = getCompositionHistoryState(compId);
    const previousSnapshot = historyState.past.at(-1);

    if (!previousSnapshot) {
      return;
    }

    const currentSnapshot = captureProjectSnapshot(compId);
    historyState.past = historyState.past.slice(0, -1);
    historyState.future = [
      currentSnapshot,
      ...historyState.future,
    ].slice(0, PROJECT_HISTORY_LIMIT);
    historyState.pending = null;
    historyState.pendingDirty = false;
    restoreProjectSnapshot(previousSnapshot);
  };

  const redoCompositionHistory = (compId: string) => {
    const historyState = getCompositionHistoryState(compId);
    const nextSnapshot = historyState.future[0];

    if (!nextSnapshot) {
      return;
    }

    const currentSnapshot = captureProjectSnapshot(compId);
    pushPastProjectSnapshot(compId, currentSnapshot);
    historyState.future = historyState.future.slice(1);
    historyState.pending = null;
    historyState.pendingDirty = false;
    restoreProjectSnapshot(nextSnapshot);
  };

  const rememberSelectedItem = (
    compId: string,
    nextSelection: NonNullable<TimelineSelection>
  ) => {
    setLastSelectedItemByCompId((prev) => {
      const previousSelection = prev[compId];

      if (isSameTimelineSelection(previousSelection ?? null, nextSelection)) {
        return prev;
      }

      return {
        ...prev,
        [compId]: nextSelection,
      };
    });
  };

  const applySelectionForComposition = (
    compId: string,
    nextSelection: TimelineSelection
  ) => {
    setSelectedTimelineTarget(nextSelection);
    setSelectedLayerId(nextSelection?.kind === "layer" ? nextSelection.sourceId : null);
    setSelectedKeyframe(null);
    setPositionDraft(null);
    setScaleDraft(null);
    setRotationDraft(null);
    setOpacityDraft(null);

    if (nextSelection) {
      rememberSelectedItem(compId, nextSelection);
    }
  };

  return {
    psdSourceEntriesRef,
    comps,
    setComps,
    masterEnabledProperties,
    setMasterEnabledProperties,
    masterScale,
    setMasterScale,
    masterScaleKeyframes,
    setMasterScaleKeyframes,
    masterScaleLinked,
    setMasterScaleLinked,
    masterRotation,
    setMasterRotation,
    masterRotationKeyframes,
    setMasterRotationKeyframes,
    masterOpacity,
    setMasterOpacity,
    masterOpacityKeyframes,
    setMasterOpacityKeyframes,
    masterAnchor,
    selectedCompId,
    setSelectedCompId,
    selectedLayerId,
    setSelectedLayerId,
    selectedTimelineTarget,
    setSelectedTimelineTarget,
    lastSelectedItemByCompId,
    setLastSelectedItemByCompId,
    selectedKeyframe,
    setSelectedKeyframe,
    positionDraft,
    setPositionDraft,
    scaleDraft,
    setScaleDraft,
    rotationDraft,
    setRotationDraft,
    opacityDraft,
    setOpacityDraft,
    metaByCompId,
    setMetaByCompId,
    playbackRangeByCompId,
    setPlaybackRangeByCompId,
    timelineItemsByCompId,
    setTimelineItemsByCompId,
    renderItemsByCompId,
    setRenderItemsByCompId,
    importError,
    setImportError,
    importNotice,
    setImportNotice,
    draggedTimelineItemId,
    setDraggedTimelineItemId,
    nextImportIndex,
    setNextImportIndex,
    currentFrame,
    setCurrentFrame,
    isScrubbingTimeline,
    setIsScrubbingTimeline,
    isPlaying,
    setIsPlaying,
    isDraggingAnchor,
    setIsDraggingAnchor,
    isDraggingPosition,
    setIsDraggingPosition,
    isDraggingOpacity,
    setIsDraggingOpacity,
    isDraggingRotation,
    setIsDraggingRotation,
    isDraggingMotionPathKeyframe,
    setIsDraggingMotionPathKeyframe,
    isPreviewPanning,
    setIsPreviewPanning,
    isPreviewPanModifierActive,
    setIsPreviewPanModifierActive,
    previewZoom,
    setPreviewZoom,
    previewPan,
    setPreviewPan,
    previewWorkspaceSize,
    setPreviewWorkspaceSize,
    leftPanelWidth,
    setLeftPanelWidth,
    rightPanelWidth,
    setRightPanelWidth,
    timelinePanelHeight,
    setTimelinePanelHeight,
    activePanelResize,
    setActivePanelResize,
    showShortformFrameOverlay,
    setShowShortformFrameOverlay,
    showSafeZoneGuides,
    setShowSafeZoneGuides,
    hoveredFrame,
    setHoveredFrame,
    draggingKeyframe,
    setDraggingKeyframe,
    rotationHandleReadout,
    setRotationHandleReadout,
    opacityHandleReadout,
    setOpacityHandleReadout,
    scaleHandleReadout,
    setScaleHandleReadout,
    positionHandleReadout,
    setPositionHandleReadout,
    motionPathKeyframeReadout,
    setMotionPathKeyframeReadout,
    draggingMotionPathFrame,
    setDraggingMotionPathFrame,
    pushCompositionHistorySnapshot,
    beginCompositionHistoryCapture,
    markCompositionHistoryCaptureDirty,
    commitCompositionHistoryCapture,
    cancelCompositionHistoryCapture,
    clearCompositionHistory,
    clearAllCompositionHistories,
    undoCompositionHistory,
    redoCompositionHistory,
    applySelectionForComposition,
  };
}

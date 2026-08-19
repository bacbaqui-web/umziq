import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  useTimelinePlaybackUIController,
} from "@/engines/timeline/controllers/useTimelinePlaybackUIController";
import {
  useLayerDocumentTimelineUiState,
} from "@/engines/timeline/state/useLayerDocumentTimelineUiState";
import {
  useLayerDocumentTimelinePointerRuntime,
} from "@/engines/timeline/state/useLayerDocumentTimelinePointerRuntime";
import type {
  LayerDocumentTimelineTimingDraftRuntime,
} from "@/engines/timeline/state/layerDocumentTimelineTimingDraftRuntime";
import {
  buildLayerDocumentTimelineUiReadModel,
} from "@/engines/timeline/helpers/layerDocumentTimelineViewModelHelpers";
import type {
  LayerDocumentTimelinePlaybackPort,
  LayerDocumentTimelineNexusPort,
  LayerDocumentTimelineRuntimeUiState,
  LayerDocumentTimelineSourceStatusPort,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";
import type {
  TimelineEngineViewProps,
} from "@/engines/timeline/models/timelineEngineTypes";
import {
  createLayerDocumentTimelineInteractionController,
} from "@/engines/timeline/controllers/layerDocumentTimelineInteractionController";
import {
  createLayerDocumentTimelineNavigationController,
} from "@/engines/timeline/controllers/layerDocumentTimelineNavigationController";

const EMPTY_PLAYBACK_SNAPSHOT = {
  currentFrame: 0,
  range: {
    startFrame: 0,
    endFrame: 1,
  },
  isPlaying: false,
  loop: false,
} as const;

export type UseLayerDocumentTimelineEngineOptions = {
  nexus: LayerDocumentTimelineNexusPort;
  playback: LayerDocumentTimelinePlaybackPort;
  nameColumnWidth: number;
  defaultPxPerFrame: number;
  allocateLayerDocumentId: () => string;
  sourceStatus: LayerDocumentTimelineSourceStatusPort;
  formatTime: (
    frame: number,
    frameRate: number
  ) => string;
  resetRevision?: number;
  readAudioWaveform?: (sourceId: string, bins: number) => readonly number[];
  timingDraftRuntime:
    LayerDocumentTimelineTimingDraftRuntime;
};

export function useLayerDocumentTimelineEngine(
  options: UseLayerDocumentTimelineEngineOptions
) {
  const switcherRef =
    useRef<HTMLDivElement | null>(null);
  const switcherTriggerRef =
    useRef<HTMLButtonElement | null>(null);
  const scrollContainerRef =
    useRef<HTMLDivElement | null>(null);
  const {
    hoveredFrame,
    setHoveredFrame,
    isScrubbing,
    setIsScrubbing,
    isSwitcherOpen,
    setIsSwitcherOpen,
    nameColumnWidth,
    setNameColumnWidth,
    draggedLayerDocumentId,
    setDraggedLayerDocumentId,
    editingLayerDocumentId,
    setEditingLayerDocumentId,
    draftName,
    setDraftName,
    deleteDecisionLayerDocumentId,
    setDeleteDecisionLayerDocumentId,
    expandedLayerDocumentIds,
    setExpandedLayerDocumentIds,
    keyframeDrag,
    setKeyframeDrag,
  } = useLayerDocumentTimelineUiState(
    options.nameColumnWidth
  );
  const timeline =
    options.nexus.timeline.readViewProps();
  const project = options.nexus.project.read();
  const expandedProjectIdRef = useRef(project.metadata.projectId);
  const scope = timeline.scope;
  const metadata = useMemo(
    () =>
      scope.ok
        ? {
            durationFrames:
              scope.model.activeGroup.data
                .durationFrames,
            frameRate:
              scope.model.activeGroup.data
                .frameRate,
          }
        : null,
    [scope]
  );
  const playback = useSyncExternalStore(
    options.playback.subscribe,
    options.playback.read,
    () => EMPTY_PLAYBACK_SNAPSHOT
  );
  const timingDraft = useSyncExternalStore(
    options.timingDraftRuntime.subscribe,
    options.timingDraftRuntime.read,
    options.timingDraftRuntime.read
  );
  const playbackPort = options.playback;
  const playbackUiCommands = useMemo(
    () => ({
      play: playbackPort.commands.play,
      pause: playbackPort.commands.pause,
      togglePlayback:
        playbackPort.commands.togglePlayback,
      seek: (frame: number) => {
        playbackPort.commands.seek(frame);
      },
      stepBackward: () => {
        playbackPort.commands.stepBackward();
      },
      stepForward: () => {
        playbackPort.commands.stepForward();
      },
      reset: () => {
        playbackPort.commands.reset();
      },
      setPlaybackRange: (
        startFrame: number,
        endFrame: number
      ) => {
        playbackPort.commands.setRange(
          startFrame,
          endFrame
        );
      },
    }),
    [playbackPort]
  );
  const updateTimelineDuration = useCallback(
    (durationFrames: number) => {
      if (!scope.ok) return;
      options.nexus.timeline.dispatchIntent({
        kind: "set-group-duration",
        layerDocumentId:
          scope.model.activeGroupLayerDocumentId,
        durationFrames,
      });
    },
    [options.nexus.timeline, scope]
  );
  const playbackUi =
    useTimelinePlaybackUIController({
      defaultPxPerFrame:
        options.defaultPxPerFrame,
      selectedMeta: metadata,
      playback: {
        currentFrame: playback.currentFrame,
        playheadFrame: playback.currentFrame,
        isPlaying: playback.isPlaying,
        playbackRange: playback.range,
      },
      playbackCommands: playbackUiCommands,
      hoveredFrame,
      isScrubbing,
      setHoveredFrame,
      setIsScrubbing,
      duration: {
        updateDuration:
          updateTimelineDuration,
        beginRangeEdit: () => {},
        markRangeEditDirty: () => {},
        commitRangeEdit: () => {},
      },
      formatTime: options.formatTime,
    });

  const runtime: LayerDocumentTimelineRuntimeUiState =
    useMemo(
      () => ({
        isCompositionSwitcherOpen:
          isSwitcherOpen,
        draggedLayerDocumentId,
        editingLayerDocumentId,
        draftName,
        deleteDecisionLayerDocumentId,
        expandedLayerDocumentIds,
        timingDraft,
        keyframeDrag,
      }),
      [
        deleteDecisionLayerDocumentId,
        draftName,
        draggedLayerDocumentId,
        editingLayerDocumentId,
        expandedLayerDocumentIds,
        isSwitcherOpen,
        keyframeDrag,
        timingDraft,
      ]
    );

  const pointer = useLayerDocumentTimelinePointerRuntime({
    nexus: options.nexus,
    project,
    timelineDurationFrames: metadata?.durationFrames ?? null,
    pxPerFrame: playbackUi.pxPerFrame,
    timingDraftRuntime: options.timingDraftRuntime,
    setKeyframeDrag,
  });
  const cancelPointer = pointer.cancel;
  useEffect(() => {
    if (options.resetRevision === undefined) return;
    cancelPointer();
    // One nexus effect atomically clears the Timeline-only interaction session.
    setHoveredFrame(null);
    setIsScrubbing(false);
    setIsSwitcherOpen(false);
    setDraggedLayerDocumentId(null);
    setEditingLayerDocumentId(null);
    setDraftName("");
    setDeleteDecisionLayerDocumentId(null);
    options.timingDraftRuntime.clear();
    setKeyframeDrag(null);
  }, [
    cancelPointer,
    options.resetRevision,
    options.timingDraftRuntime,
    setDeleteDecisionLayerDocumentId,
    setDraftName,
    setDraggedLayerDocumentId,
    setEditingLayerDocumentId,
    setHoveredFrame,
    setIsScrubbing,
    setIsSwitcherOpen,
    setKeyframeDrag,
  ]);
  useEffect(() => {
    if (expandedProjectIdRef.current === project.metadata.projectId) return;
    expandedProjectIdRef.current = project.metadata.projectId;
    options.timingDraftRuntime.clear();
    // Project 교체에서만 핀을 정리하고 Layer 선택 변경에서는 유지한다.
    setExpandedLayerDocumentIds(new Set());
  }, [
    options.timingDraftRuntime,
    project.metadata.projectId,
    setExpandedLayerDocumentIds,
  ]);

  const baseInteractions = useMemo(
    () =>
      createLayerDocumentTimelineInteractionController({
        nexus: options.nexus,
        playback: playbackPort,
        sourceStatus: options.sourceStatus,
        allocateLayerDocumentId:
          options.allocateLayerDocumentId,
        ui: {
          read: () => ({
            draggedLayerDocumentId,
            editingLayerDocumentId,
            draftName,
          }),
          setDraggedLayerDocumentId,
          beginRename: (
            layerDocumentId,
            initialName
          ) => {
            setEditingLayerDocumentId(
              layerDocumentId
            );
            setDraftName(initialName);
          },
          setDraftName,
          clearRename: () => {
            setEditingLayerDocumentId(null);
            setDraftName("");
          },
          setDeleteDecisionLayerDocumentId,
        },
        pointer: {
          beginTiming: pointer.beginTiming,
          consumeTimingClick:
            pointer.consumeTimingClick,
          beginKeyframeMove:
            pointer.beginKeyframeMove,
        },
      }),
    [
      pointer,
      draftName,
      draggedLayerDocumentId,
      editingLayerDocumentId,
      options,
      playbackPort,
      setDeleteDecisionLayerDocumentId,
      setDraftName,
      setDraggedLayerDocumentId,
      setEditingLayerDocumentId,
    ]
  );
  const interactions = useMemo(
    () => ({
      ...baseInteractions,
      toggleTimelineItemExpanded: (layerDocumentId: string) => {
        setExpandedLayerDocumentIds((current) => {
          const next = new Set(current);
          if (next.has(layerDocumentId)) next.delete(layerDocumentId);
          else next.add(layerDocumentId);
          return next;
        });
      },
    }),
    [baseInteractions, setExpandedLayerDocumentIds]
  );
  const restoreSwitcherTriggerFocus =
    useCallback(() => {
      window.requestAnimationFrame(() =>
        switcherTriggerRef.current?.focus()
      );
    }, []);
  const navigation = useCallback(
    () =>
      createLayerDocumentTimelineNavigationController({
        nexus: options.nexus,
        ui: {
          readIsOpen: () => isSwitcherOpen,
          setIsOpen: setIsSwitcherOpen,
          restoreTriggerFocus:
            restoreSwitcherTriggerFocus,
        },
      }),
    [
      isSwitcherOpen,
      options.nexus,
      restoreSwitcherTriggerFocus,
      setIsSwitcherOpen,
    ]
  );

  const commands = useMemo(
    () => ({
      ...playbackUi.commands,
      toggleCompositionSwitcher: () =>
        navigation()
          .toggleCompositionSwitcher(),
      selectComposition: (
        layerDocumentId: string
      ) =>
        navigation().selectComposition(
          layerDocumentId
        ),
      setNameColumnWidth: (width: number) =>
        setNameColumnWidth(
          Math.max(96, Math.min(420, Math.round(width)))
        ),
    }),
    [
      navigation,
      playbackUi.commands,
      setNameColumnWidth,
    ]
  );
  useEffect(() => {
    if (!isSwitcherOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !switcherRef.current?.contains(target)
      ) {
        navigation()
          .closeForOutsidePointer();
      }
    };
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      navigation().closeForEscape();
    };
    window.addEventListener(
      "pointerdown",
      close
    );
    window.addEventListener(
      "keydown",
      handleKeyDown
    );
    return () => {
      window.removeEventListener(
        "pointerdown",
        close
      );
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isSwitcherOpen, navigation]);

  const readModel = useMemo(
    () =>
      buildLayerDocumentTimelineUiReadModel({
        project,
        timeline,
        runtime,
        playback,
        ruler: playbackUi.ruler,
        nameColumnWidth,
        formatTime: options.formatTime,
        readAudioWaveform: options.readAudioWaveform,
      }),
    [
      options.formatTime,
      nameColumnWidth,
      options.readAudioWaveform,
      playbackUi.ruler,
      project,
      runtime,
      timeline,
      playback,
    ]
  );
  const viewProps: TimelineEngineViewProps =
    useMemo(
      () => ({
        readModel,
        commands,
        interactions,
        rulerRef: playbackUi.rulerRef,
        switcherRef,
        switcherTriggerRef,
        scrollContainerRef,
      }),
      [
        commands,
        interactions,
        playbackUi.rulerRef,
        readModel,
      ]
    );
  return {
    viewProps,
    readModel,
    commands,
    interactions,
    playback: playbackPort,
    runtime,
  };
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  AnimatableProperty,
  LayerDocumentTransformProperty,
} from "@/models";
import {
  useTimelinePlaybackUIController,
} from "@/engines/timeline/controllers/useTimelinePlaybackUIController";
import {
  useTimelinePointerDragSessionRuntime,
} from "@/engines/timeline/state/useTimelinePointerDragSessionRuntime";
import {
  buildLayerDocumentTimelineUiReadModel,
} from "@/engines/timeline/helpers/layerDocumentTimelineViewModelHelpers";
import {
  resolveTimelineDragDelta,
} from "@/engines/timeline/helpers/timelineInteractionHelpers";
import {
  layerDocumentTimelineTimingChanged,
  resolveLayerDocumentTimelineTimingDraft,
  type LayerDocumentTimelineTimingOperation,
} from "@/engines/timeline/helpers/layerDocumentTimelineInteractionHelpers";
import type {
  LayerDocumentTimelineKeyframeDrag,
  LayerDocumentTimelinePlaybackPort,
  LayerDocumentTimelineOwnerPort,
  LayerDocumentTimelineRuntimeUiState,
  LayerDocumentTimelineSourceStatusPort,
  LayerDocumentTimelineTimingDraft,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";
import type {
  TimelineEngineViewProps,
  TimelinePointerDragStart,
} from "@/engines/timeline/models/timelineEngineTypes";
import {
  createLayerDocumentTimelineInteractionController,
} from "@/engines/timeline/controllers/layerDocumentTimelineInteractionController";
import {
  createLayerDocumentTimelineNavigationController,
} from "@/engines/timeline/controllers/layerDocumentTimelineNavigationController";

type NativePointerSession =
  | {
      readonly type: "move-item" | "resize-start" | "resize-end";
      readonly operation:
        LayerDocumentTimelineTimingOperation;
      readonly layerDocumentId: string;
      readonly startClientX: number;
      readonly timelineDurationFrames: number;
      readonly sourceDurationFrames: number | null;
      readonly initial: LayerDocumentTimelineTimingDraft;
      readonly draft:
        LayerDocumentTimelineTimingDraft | null;
    }
  | {
      readonly type: "move-keyframe";
      readonly layerDocumentId: string;
      readonly property:
        LayerDocumentTransformProperty;
      readonly originLocalFrame: number;
      readonly localFrame: number;
      readonly startClientX: number;
    };

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
  owner: LayerDocumentTimelineOwnerPort;
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
  const [hoveredFrame, setHoveredFrame] =
    useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] =
    useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] =
    useState(false);
  const [
    draggedLayerDocumentId,
    setDraggedLayerDocumentId,
  ] = useState<string | null>(null);
  const [
    editingLayerDocumentId,
    setEditingLayerDocumentId,
  ] = useState<string | null>(null);
  const [draftName, setDraftName] =
    useState("");
  const [
    deleteDecisionLayerDocumentId,
    setDeleteDecisionLayerDocumentId,
  ] = useState<string | null>(null);
  const [timingDraft, setTimingDraft] =
    useState<LayerDocumentTimelineTimingDraft | null>(
      null
    );
  const [keyframeDrag, setKeyframeDrag] =
    useState<LayerDocumentTimelineKeyframeDrag | null>(
      null
    );
  const timeline =
    options.owner.timeline.readViewProps();
  const project = options.owner.project.read();
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
      options.owner.timeline.dispatchIntent({
        kind: "set-group-duration",
        layerDocumentId:
          scope.model.activeGroupLayerDocumentId,
        durationFrames,
      });
    },
    [options.owner.timeline, scope]
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
        timingDraft,
        keyframeDrag,
      }),
      [
        deleteDecisionLayerDocumentId,
        draftName,
        draggedLayerDocumentId,
        editingLayerDocumentId,
        isSwitcherOpen,
        keyframeDrag,
        timingDraft,
      ]
    );

  const movePointer = useCallback(
    (
      session: NativePointerSession,
      clientX: number
    ): NativePointerSession => {
      if (session.type === "move-keyframe") {
        const localFrame = Math.max(
          0,
          session.originLocalFrame +
            resolveTimelineDragDelta(
              clientX,
              session.startClientX,
              playbackUi.pxPerFrame
            )
        );
        setKeyframeDrag({
          layerDocumentId:
            session.layerDocumentId,
          property: session.property,
          originLocalFrame:
            session.originLocalFrame,
          localFrame,
        });
        return { ...session, localFrame };
      }
      const draft =
        resolveLayerDocumentTimelineTimingDraft(
          session,
          resolveTimelineDragDelta(
            clientX,
            session.startClientX,
            playbackUi.pxPerFrame
          )
        );
      const changed =
        layerDocumentTimelineTimingChanged(
        session.initial,
        draft
      );
      setTimingDraft(changed ? draft : null);
      return {
        ...session,
        draft: changed ? draft : null,
      };
    },
    [playbackUi.pxPerFrame]
  );
  const endPointer = useCallback(
    (session: NativePointerSession) => {
      if (session.type === "move-keyframe") {
        if (
          session.localFrame !==
          session.originLocalFrame
        ) {
          options.owner.timeline.dispatchIntent({
            kind: "move-keyframe",
            layerDocumentId:
              session.layerDocumentId,
            property: session.property,
            fromLocalFrame:
              session.originLocalFrame,
            toLocalFrame:
              session.localFrame,
          });
        }
        setKeyframeDrag(null);
        return;
      }
      if (session.draft) {
        options.owner.timeline.dispatchIntent({
          kind: "set-timing",
          ...session.draft,
        });
      }
      setTimingDraft(null);
    },
    [options.owner.timeline]
  );
  const pointer = useTimelinePointerDragSessionRuntime({
    scrollContainerRef,
    move: movePointer,
    commit: endPointer,
    cancel: (session) => {
      if (session.type === "move-keyframe") {
        setKeyframeDrag(null);
      } else {
        setTimingDraft(null);
      }
    },
  });
  const cancelPointer = pointer.cancel;
  useEffect(() => {
    if (options.resetRevision === undefined) return;
    cancelPointer();
    // One owner effect atomically clears the Timeline-only interaction session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoveredFrame(null);
    setIsScrubbing(false);
    setIsSwitcherOpen(false);
    setDraggedLayerDocumentId(null);
    setEditingLayerDocumentId(null);
    setDraftName("");
    setDeleteDecisionLayerDocumentId(null);
    setTimingDraft(null);
    setKeyframeDrag(null);
  }, [cancelPointer, options.resetRevision]);

  const itemById = useCallback(
    (layerDocumentId: string) =>
      project.payload.layerDocumentsById[
        layerDocumentId
      ] ?? null,
    [project]
  );
  const beginTiming = useCallback(
    (
      start: TimelinePointerDragStart,
      layerDocumentId: string,
      operation:
        LayerDocumentTimelineTimingOperation
    ) => {
      const layer = itemById(layerDocumentId);
      if (!layer || !metadata) return;
      const initial = {
        layerDocumentId,
        startFrame:
          layer.common.placement.startFrame,
        durationFrames:
          layer.common.placement.durationFrames,
        sourceOffsetFrames:
          layer.common.placement
            .sourceOffsetFrames,
      };
      const sourceId = layer.common.source?.sourceId;
      const source = sourceId
        ? project.payload.sourceRegistry.sourcesById[sourceId]
        : null;
      pointer.begin({
        type:
          operation === "move"
            ? "move-item"
            : operation === "trim-start"
              ? "resize-start"
              : "resize-end",
        operation,
        layerDocumentId,
        startClientX: start.clientX,
        timelineDurationFrames:
          metadata.durationFrames,
        sourceDurationFrames:
          layer.type === "audio" && source?.kind === "audio"
            ? source.data.durationFrames
            : null,
        initial,
        draft: null,
      }, start);
    },
    [itemById, metadata, pointer, project]
  );
  const beginKeyframePointer = useCallback(
    (
      start: TimelinePointerDragStart,
      layerDocumentId: string,
      localFrame: number,
      property: AnimatableProperty
    ) => {
      setKeyframeDrag({
        layerDocumentId,
        property,
        originLocalFrame: localFrame,
        localFrame,
      });
      pointer.begin({
        type: "move-keyframe",
        layerDocumentId,
        property,
        originLocalFrame: localFrame,
        localFrame,
        startClientX: start.clientX,
      }, start);
    },
    [pointer]
  );
  const interactions = useMemo(
    () =>
      createLayerDocumentTimelineInteractionController({
        owner: options.owner,
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
          beginTiming,
          beginKeyframeMove:
            beginKeyframePointer,
        },
      }),
    [
      beginKeyframePointer,
      beginTiming,
      draftName,
      draggedLayerDocumentId,
      editingLayerDocumentId,
      options,
      playbackPort,
    ]
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
        owner: options.owner,
        ui: {
          readIsOpen: () => isSwitcherOpen,
          setIsOpen: setIsSwitcherOpen,
          restoreTriggerFocus:
            restoreSwitcherTriggerFocus,
        },
      }),
    [
      isSwitcherOpen,
      options.owner,
      restoreSwitcherTriggerFocus,
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
    }),
    [navigation, playbackUi.commands]
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
        nameColumnWidth:
          options.nameColumnWidth,
        formatTime: options.formatTime,
        readAudioWaveform: options.readAudioWaveform,
      }),
    [
      options.formatTime,
      options.nameColumnWidth,
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

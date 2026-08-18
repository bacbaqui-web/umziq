import type {
  AnimatableProperty,
} from "@/models";
import {
  layerDocumentLocalFrameToGlobalFrame,
  normalizeKnownLayerModifier,
} from "@/models";
import type {
  LayerDocumentTimelineTimingOperation,
} from "@/engines/timeline/helpers/layerDocumentTimelineInteractionHelpers";
import type {
  LayerDocumentTimelinePlaybackPort,
  LayerDocumentTimelineOwnerPort,
  LayerDocumentTimelineSourceStatusPort,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";
import type {
  TimelineInteractionCommands,
  TimelinePointerDragStart,
} from "@/engines/timeline/models/timelineEngineTypes";

export interface LayerDocumentTimelineInteractionUiPort {
  readonly read: () => {
    readonly draggedLayerDocumentId:
      string | null;
    readonly editingLayerDocumentId:
      string | null;
    readonly draftName: string;
  };
  readonly setDraggedLayerDocumentId: (
    layerDocumentId: string | null
  ) => void;
  readonly beginRename: (
    layerDocumentId: string,
    initialName: string
  ) => void;
  readonly setDraftName: (name: string) => void;
  readonly clearRename: () => void;
  readonly setDeleteDecisionLayerDocumentId: (
    layerDocumentId: string | null
  ) => void;
}

export interface LayerDocumentTimelinePointerCommandPort {
  readonly beginTiming: (
    start: TimelinePointerDragStart,
    layerDocumentId: string,
    operation:
      LayerDocumentTimelineTimingOperation
  ) => void;
  readonly beginKeyframeMove: (
    start: TimelinePointerDragStart,
    layerDocumentId: string,
    localFrame: number,
    property: AnimatableProperty
  ) => void;
}

/**
 * Public interaction controller shared by the native React hook and
 * deterministic command harnesses. Every lookup starts from LayerDocument ID.
 */
export function createLayerDocumentTimelineInteractionController(
  options: {
    owner: LayerDocumentTimelineOwnerPort;
    playback: LayerDocumentTimelinePlaybackPort;
    sourceStatus:
      LayerDocumentTimelineSourceStatusPort<unknown>;
    allocateLayerDocumentId: () => string;
    ui: LayerDocumentTimelineInteractionUiPort;
    pointer:
      LayerDocumentTimelinePointerCommandPort;
  }
): Omit<TimelineInteractionCommands, "toggleTimelineItemExpanded"> {
  const itemById = (layerDocumentId: string) =>
    options.owner.project.read().payload
      .layerDocumentsById[layerDocumentId] ?? null;
  const selectTimelineItem = (
    layerDocumentId: string
  ) => {
    const selectedLayerDocumentId =
      options.owner.timeline
        .readViewProps()
        .selectedLayerDocumentId;
    options.owner.timeline
      .readViewProps()
      .commands.selectLayer(
        selectedLayerDocumentId === layerDocumentId
          ? null
          : layerDocumentId
      );
  };
  const selectKeyframe = (
    layerDocumentId: string,
    localFrame: number,
    property: AnimatableProperty
  ) => {
    const layer = itemById(layerDocumentId);
    if (!layer) return;
    options.owner.timeline
      .readViewProps()
      .commands.selectLayer(layerDocumentId);
    const globalFrame =
      layerDocumentLocalFrameToGlobalFrame(
        localFrame,
        layer.common.placement
      );
    options.playback.commands.seek(globalFrame);
    options.owner.timeline
      .selectTransformKeyframe({
        layerDocumentId,
        property,
        localFrame,
        globalFrame,
      });
  };
  const duplicateTimelineItem = (
    layerDocumentId: string
  ) => {
    options.owner.timeline.dispatchIntent({
      kind: "duplicate-layer",
      layerDocumentId,
      newLayerDocumentId:
        options.allocateLayerDocumentId(),
    });
  };
  const commitRename = () => {
    const ui = options.ui.read();
    if (!ui.editingLayerDocumentId) return;
    options.owner.timeline.dispatchIntent({
      kind: "set-alias",
      layerDocumentId:
        ui.editingLayerDocumentId,
      alias: ui.draftName.trim() || null,
    });
    options.ui.clearRename();
  };
  const cancelRename = () =>
    options.ui.clearRename();
  const deleteLayer = (
    layerDocumentId: string
  ) => {
    options.owner.timeline.dispatchIntent({
      kind: "delete-layer",
      layerDocumentId,
    });
  };
  return {
    duplicateSelectedTimelineItem: () => {
      const selected =
        options.owner.timeline
          .readViewProps()
          .selectedLayerDocumentId;
      if (selected) {
        duplicateTimelineItem(selected);
      }
    },
    duplicateTimelineItem,
    splitSelectedTimelineItem: () => {
      const selected =
        options.owner.timeline
          .readViewProps()
          .selectedLayerDocumentId;
      if (!selected) return;
      options.owner.timeline.dispatchIntent({
        kind: "split-layer",
        layerDocumentId: selected,
        newLayerDocumentId:
          options.allocateLayerDocumentId(),
        splitGlobalFrame:
          options.playback.read().currentFrame,
      });
    },
    selectTimelineItem,
    activateTimelineItem: (
      layerDocumentId,
      status
    ) => {
      if (
        status === "updated" ||
        status === "new"
      ) {
        options.sourceStatus.acknowledge(
          layerDocumentId
        );
      }
      selectTimelineItem(layerDocumentId);
      options.ui
        .setDeleteDecisionLayerDocumentId(
          status === "deletePending"
            ? layerDocumentId
            : null
        );
    },
    resolveTimelineSourceDelete: (
      layerDocumentId,
      decision
    ) => {
      options.sourceStatus.resolve(
        layerDocumentId,
        decision
      );
      options.ui
        .setDeleteDecisionLayerDocumentId(null);
    },
    deleteTimelineItem: deleteLayer,
    reorderTimelineItem: (
      targetLayerDocumentId
    ) => {
      const dragged =
        options.ui.read()
          .draggedLayerDocumentId;
      const target =
        itemById(targetLayerDocumentId);
      const targetParentLayerDocumentId =
        target?.common.placement
          .parentLayerDocumentId ?? null;
      if (
        !dragged ||
        !target ||
        !targetParentLayerDocumentId
      ) return;
      const targetOrder = Object.values(
        options.owner.project.read()
          .payload.layerDocumentsById
      )
        .filter(
          (layer) =>
            layer.common.placement
              .parentLayerDocumentId ===
            targetParentLayerDocumentId
        )
        .sort(
          (left, right) =>
            left.common.placement.order -
              right.common.placement.order ||
            left.layerDocumentId.localeCompare(
              right.layerDocumentId
            )
        )
        .findIndex(
          (layer) =>
            layer.layerDocumentId ===
            targetLayerDocumentId
        );
      if (targetOrder < 0) return;
      options.owner.timeline.dispatchIntent({
        kind: "move-layer",
        layerDocumentId: dragged,
        newParentLayerDocumentId:
          targetParentLayerDocumentId,
        newOrder: targetOrder,
      });
      options.ui.setDraggedLayerDocumentId(null);
    },
    setDraggedTimelineItemId:
      options.ui.setDraggedLayerDocumentId,
    beginMoveTimelineItem: (
      clientX,
      layerDocumentId
    ) =>
      options.pointer.beginTiming(
        clientX,
        layerDocumentId,
        "move"
      ),
    beginResizeTimelineItemStart: (
      clientX,
      layerDocumentId
    ) =>
      options.pointer.beginTiming(
        clientX,
        layerDocumentId,
        "trim-start"
      ),
    beginResizeTimelineItemEnd: (
      clientX,
      layerDocumentId
    ) =>
      options.pointer.beginTiming(
        clientX,
        layerDocumentId,
        "trim-end"
      ),
    beginRenameTimelineItem: (
      layerDocumentId
    ) => {
      const layer = itemById(layerDocumentId);
      if (!layer) return;
      options.ui.beginRename(
        layerDocumentId,
        layer.common.placement.alias ??
          layer.name
      );
    },
    changeTimelineItemName:
      options.ui.setDraftName,
    commitTimelineItemName: commitRename,
    cancelTimelineItemName: cancelRename,
    handleTimelineItemNameKey: (key) => {
      if (key === "Enter") commitRename();
      if (key === "Escape") cancelRename();
    },
    selectKeyframe,
    beginMoveKeyframe: (
      clientX,
      layerDocumentId,
      localFrame,
      property
    ) => {
      selectKeyframe(
        layerDocumentId,
        localFrame,
        property
      );
      options.pointer.beginKeyframeMove(
        clientX,
        layerDocumentId,
        localFrame,
        property
      );
    },
    deleteKeyframe: (
      layerDocumentId,
      localFrame,
      property
    ) => {
      options.owner.timeline.dispatchIntent({
        kind: "remove-keyframe",
        layerDocumentId,
        property,
        localFrame,
      });
      options.owner.timeline
        .selectTransformKeyframe(null);
    },
    setMouthBasicClip: (layerDocumentId, clip) => {
      const layer = itemById(layerDocumentId);
      if (!layer) return;
      const modifiers = layer.common.modifiers.map((modifier) =>
        modifier.type === "mouth-basic"
          ? normalizeKnownLayerModifier({
              ...modifier,
              startFrame: Math.floor(clip.startFrame),
              durationFrames: Math.max(1, Math.floor(clip.durationFrames)),
              transitionFrames: [...new Set(clip.transitionFrames
                .map((frame) => Math.floor(frame))
                .filter((frame) => frame >= 0 && frame < clip.durationFrames))]
                .sort((left, right) => left - right),
            })
          : modifier
      );
      options.owner.timeline.dispatchIntent({ kind: "set-modifiers", layerDocumentId, modifiers });
    },
    setAccelerationClip: (layerDocumentId, clip) => {
      const layer = itemById(layerDocumentId);
      if (!layer) return;
      const modifiers = layer.common.modifiers.map((modifier) =>
        modifier.type === "acceleration"
          ? normalizeKnownLayerModifier({
              ...modifier,
              startFrame: Math.floor(clip.startFrame),
              durationFrames: Math.max(1, Math.floor(clip.durationFrames)),
              curve: clip.curve ?? modifier.curve,
            })
          : modifier
      );
      options.owner.timeline.dispatchIntent({ kind: "set-modifiers", layerDocumentId, modifiers });
    },
    deleteCanonicalTimelineItem: deleteLayer,
    setCanonicalTimelineItemVisibility: (
      layerDocumentId,
      visible
    ) => {
      options.owner.timeline.dispatchIntent({
        kind: "set-visibility",
        layerDocumentId,
        visible,
      });
    },
    setCanonicalTimelineItemAlias: (
      layerDocumentId,
      alias
    ) => {
      options.owner.timeline.dispatchIntent({
        kind: "set-alias",
        layerDocumentId,
        alias,
      });
    },
  };
}

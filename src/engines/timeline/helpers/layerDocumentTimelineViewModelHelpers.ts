import type {
  AnimatableProperty,
  LayerDocument,
  LayerDocumentProject,
  LayerDocumentTransformProperty,
} from "@/models";
import {
  projectVisibleLayerDocumentKeyframeFrame,
} from "@/models";
import type {
  LayerDocumentTimelineConsumerViewProps,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";
import {
  buildTimelineTrackRowLayout,
  isTimelineGroupEndRow,
} from "@/engines/timeline/helpers/timelineLayoutHelpers";
import {
  buildTimelineSourceStatusViewModel,
} from "@/engines/timeline/helpers/timelineSourceStatusHelpers";
import type {
  LayerDocumentTimelineRuntimeUiState,
  LayerDocumentTimelinePlaybackReadModel,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";
import type {
  TimelineHeaderViewModel,
  TimelinePropertyVisualTokens,
  TimelineReadModel,
  TimelineRulerViewModel,
  TimelineTrackOverlayViewModel,
  TimelineTrackRowViewModel,
  TimelineSourceStatusViewModel,
  TimelineViewItem,
} from "@/engines/timeline/models/timelineViewModel";

const PROPERTIES: readonly LayerDocumentTransformProperty[] = [
  "position",
  "scale",
  "rotation",
  "opacity",
];
const LABELS: Record<
  LayerDocumentTransformProperty,
  string
> = {
  position: "위치",
  scale: "스케일",
  rotation: "회전",
  opacity: "불투명도",
};
const COLORS: Record<
  LayerDocumentTransformProperty,
  TimelinePropertyVisualTokens
> = {
  position: {
    accent: "#6ba9df",
    accentMuted: "rgba(107, 169, 223, 0.62)",
    label: "#c9def2",
  },
  scale: {
    accent: "#7eca9d",
    accentMuted: "rgba(126, 202, 157, 0.62)",
    label: "#d4ecdd",
  },
  rotation: {
    accent: "#e3a56a",
    accentMuted: "rgba(227, 165, 106, 0.62)",
    label: "#f1dbc6",
  },
  opacity: {
    accent: "#bc92dd",
    accentMuted: "rgba(188, 146, 221, 0.62)",
    label: "#eadbf8",
  },
};

export function resolveLayerDocumentTimelineEffectiveSourceStatus(
  project: LayerDocumentProject,
  layer: LayerDocument,
  acknowledged:
    LayerDocumentTimelineConsumerViewProps[
      "acknowledgedSourceStatuses"
    ],
  resolutionStatus:
    | "unresolved"
    | "resolving"
    | "available"
    | "missing"
    | "error"
): TimelineSourceStatusViewModel["status"] {
  const sourceId = layer.common.source?.sourceId;
  if (!sourceId) return "normal";
  const source =
    project.payload.sourceRegistry.sourcesById[sourceId];
  if (!source || resolutionStatus !== "available") {
    return "missing";
  }
  if (
    acknowledged.some(
      (identity) =>
        identity.sourceId === source.sourceId &&
        identity.version === source.version &&
        identity.status ===
          source.refresh.status
    )
  ) {
    return "normal";
  }
  return source.refresh.status;
}

function keyframeFrames(
  layer: LayerDocument,
  property: LayerDocumentTransformProperty
): readonly { readonly frame: number }[] {
  switch (property) {
    case "position":
      return layer.common.animation.positionKeyframes;
    case "scale":
      return layer.common.animation.scaleKeyframes;
    case "rotation":
      return layer.common.animation.rotationKeyframes;
    case "opacity":
      return layer.common.animation.opacityKeyframes;
  }
}

function viewItem(
  layer: LayerDocument,
  timing: {
    startFrame: number;
    durationFrames: number;
    sourceOffsetFrames: number;
  }
): TimelineViewItem {
  return {
    id: layer.layerDocumentId,
    name:
      layer.common.placement.alias ?? layer.name,
    entityKind:
      layer.type === "group"
        ? "composition"
        : "layer",
    visible: layer.common.placement.visible,
    ...timing,
  };
}

type NativeDisplayRow =
  | {
      readonly type: "item";
      readonly item: TimelineViewItem;
      readonly layer: LayerDocument;
      readonly status: TimelineSourceStatusViewModel["status"];
    }
  | {
      readonly type: "property";
      readonly item: TimelineViewItem;
      readonly layer: LayerDocument;
      readonly property:
        LayerDocumentTransformProperty;
    };

function displayRows(options: {
  project: LayerDocumentProject;
  timeline: LayerDocumentTimelineConsumerViewProps;
  runtime: LayerDocumentTimelineRuntimeUiState;
}): NativeDisplayRow[] {
  return options.timeline.rows.flatMap((row) => {
    const layer =
      options.project.payload.layerDocumentsById[
        row.layerDocumentId
      ];
    if (!layer) return [];
    const timingDraft =
      options.runtime.timingDraft
        ?.layerDocumentId === layer.layerDocumentId
        ? options.runtime.timingDraft
        : null;
    const item = viewItem(
      layer,
      timingDraft ?? layer.common.placement
    );
    const rows: NativeDisplayRow[] = [{
      type: "item",
      item,
      layer,
      status:
        resolveLayerDocumentTimelineEffectiveSourceStatus(
          options.project,
          layer,
          options.timeline
            .acknowledgedSourceStatuses,
          row.source?.resolutionStatus ?? "missing"
        ),
    }];
    const selected =
      options.timeline.selectedLayerDocumentId ===
      layer.layerDocumentId;
    if (!selected) return rows;
    PROPERTIES.forEach((property) => {
      if (
        layer.common.animation.enabledProperties[
          property
        ]
      ) {
        rows.push({
          type: "property",
          item,
          layer,
          property,
        });
      }
    });
    return rows;
  });
}

function buildHeader(options: {
  project: LayerDocumentProject;
  timeline: LayerDocumentTimelineConsumerViewProps;
  runtime: LayerDocumentTimelineRuntimeUiState;
  playback: LayerDocumentTimelinePlaybackReadModel;
  frameRate: number;
  formatTime: (
    frame: number,
    frameRate: number
  ) => string;
}): TimelineHeaderViewModel {
  if (!options.timeline.scope.ok) {
    return {
      visible: false,
      compositionName: null,
      breadcrumbSegments: [],
      selectionLabel: null,
      switcher: { items: [], isOpen: false },
      isPlaying: options.playback.isPlaying,
      currentFrame: options.playback.currentFrame,
      currentFrameText: "",
      canDuplicateSelectedItem: false,
      canSplitSelectedItem: false,
    };
  }
  const scope = options.timeline.scope.model;
  const selectedId =
    options.timeline.selectedLayerDocumentId;
  const selected = selectedId
    ? options.project.payload.layerDocumentsById[
        selectedId
      ] ?? null
    : null;
  const currentFrame = options.playback.currentFrame;
  const canSplit = Boolean(
    selected &&
    selected.common.placement.parentLayerDocumentId ===
      scope.activeGroupLayerDocumentId &&
    currentFrame >
      selected.common.placement.startFrame &&
    currentFrame <
      selected.common.placement.startFrame +
        selected.common.placement.durationFrames
  );
  const childGroups = options.timeline.rows
    .map((row) =>
      options.project.payload.layerDocumentsById[
        row.layerDocumentId
      ]
    )
    .filter(
      (layer): layer is Extract<
        LayerDocument,
        { type: "group" }
      > => layer?.type === "group"
    );
  return {
    visible: true,
    compositionName:
      scope.activeGroup.common.placement.alias ??
      scope.activeGroup.name,
    breadcrumbSegments: scope.breadcrumb.map(
      (segment) => ({
        id: segment.layerDocumentId,
        name:
          segment.role === "project-root"
            ? "프로젝트"
            : segment.label,
        isCurrent:
          segment.layerDocumentId ===
          scope.activeGroupLayerDocumentId,
        entityKind: "composition",
      })
    ),
    selectionLabel: selected
      ? {
          label:
            selected.common.placement.alias ??
            selected.name,
          entityKind:
            selected.type === "group"
              ? "composition"
              : "layer",
        }
      : null,
    switcher: {
      isOpen:
        options.runtime
          .isCompositionSwitcherOpen,
      items: childGroups.map((group) => ({
        id: group.layerDocumentId,
        name:
          group.common.placement.alias ??
          group.name,
        depth: 0,
        isCurrent: false,
        isAncestor: false,
      })),
    },
    isPlaying: options.playback.isPlaying,
    currentFrame,
    currentFrameText: options.formatTime(
      currentFrame,
      options.frameRate
    ),
    canDuplicateSelectedItem: Boolean(
      selected &&
      selected.common.placement.parentLayerDocumentId ===
        scope.activeGroupLayerDocumentId
    ),
    canSplitSelectedItem: canSplit,
  };
}

export function buildLayerDocumentTimelineUiReadModel(
  options: {
    project: LayerDocumentProject;
    timeline: LayerDocumentTimelineConsumerViewProps;
    runtime: LayerDocumentTimelineRuntimeUiState;
    playback: LayerDocumentTimelinePlaybackReadModel;
    ruler: TimelineRulerViewModel;
    nameColumnWidth: number;
    formatTime: (
      frame: number,
      frameRate: number
    ) => string;
  }
): TimelineReadModel {
  const scope = options.timeline.scope;
  const frameRate = scope.ok
    ? scope.model.activeGroup.data.frameRate
    : 1;
  const nativeRows = displayRows(options);
  const layout =
    buildTimelineTrackRowLayout(nativeRows);
  const rows: TimelineTrackRowViewModel[] = [];
  nativeRows.forEach((row, index) => {
    const rowIndex =
      layout.gridRowByDisplayedIndex.get(index);
    if (rowIndex === undefined) return;
    if (row.type === "item") {
      const source =
        buildTimelineSourceStatusViewModel(
          row.status
        );
      const next = nativeRows[index + 1];
      rows.push({
        type: "item",
        item: row.item,
        rowIndex,
        connectToProperties:
          next?.type === "property" &&
          next.item.id === row.item.id,
        selected:
          options.timeline
            .selectedLayerDocumentId ===
          row.item.id,
        source,
        rowBackground:
          options.runtime
            .draggedLayerDocumentId ===
          row.item.id
            ? "#4b3f2b"
            : source.isDeletePending
              ? "rgba(133, 46, 52, 0.58)"
              : row.item.entityKind ===
                  "composition"
                ? "#21334a"
                : "#2a2a2a",
        trackLeft:
          row.item.startFrame *
          options.ruler.pxPerFrame,
        trackWidth:
          row.item.durationFrames *
          options.ruler.pxPerFrame,
        trackBackground:
          row.item.entityKind === "composition"
            ? "linear-gradient(90deg, #3a6ea5 0%, #4f83bc 100%)"
            : "linear-gradient(90deg, #4a4a4a 0%, #636363 100%)",
        trackOpacity: row.item.visible
          ? 0.92
          : 0.42,
        isEditingName:
          options.runtime
            .editingLayerDocumentId ===
          row.item.id,
        draftName:
          options.runtime
            .editingLayerDocumentId ===
          row.item.id
            ? options.runtime.draftName
            : row.item.name,
        showDeleteDecision:
          options.runtime
            .deleteDecisionLayerDocumentId ===
            row.item.id &&
          source.isDeletePending,
      });
      return;
    }
    const placement = {
      startFrame: row.item.startFrame,
      durationFrames: row.item.durationFrames,
      sourceOffsetFrames:
        row.item.sourceOffsetFrames,
    };
    const drag =
      options.runtime.keyframeDrag
        ?.layerDocumentId === row.item.id &&
      options.runtime.keyframeDrag.property ===
        row.property
        ? options.runtime.keyframeDrag
        : null;
    const keyframes = keyframeFrames(
      row.layer,
      row.property
    ).flatMap((keyframe) => {
      if (
        drag &&
        keyframe.frame === drag.originLocalFrame
      ) {
        return [];
      }
      const globalFrame =
        projectVisibleLayerDocumentKeyframeFrame(
          keyframe.frame,
          placement
        );
      if (globalFrame === null) return [];
      return [{
        frame: keyframe.frame,
        left:
          globalFrame *
            options.ruler.pxPerFrame -
          7,
        title: options.formatTime(
          keyframe.frame,
          frameRate
        ),
        selected:
          options.timeline
            .selectedTransformKeyframe
            ?.layerDocumentId === row.item.id &&
          options.timeline
            .selectedTransformKeyframe
            .property === row.property &&
          options.timeline
            .selectedTransformKeyframe
            .localFrame === keyframe.frame,
        dragging: false,
      }];
    });
    const dragGlobalFrame = drag
      ? projectVisibleLayerDocumentKeyframeFrame(
          drag.localFrame,
          placement
        )
      : null;
    const dragLeft =
      dragGlobalFrame === null
        ? null
        : dragGlobalFrame *
          options.ruler.pxPerFrame;
    rows.push({
      type: "property",
      item: row.item,
      property:
        row.property as AnimatableProperty,
      targetKind:
        row.item.entityKind === "composition"
          ? "composition"
          : "layer",
      rowIndex,
      label: LABELS[row.property],
      colors: COLORS[row.property],
      selectedTimelineItem: true,
      trackLeft:
        row.item.startFrame *
        options.ruler.pxPerFrame,
      trackWidth:
        row.item.durationFrames *
        options.ruler.pxPerFrame,
      keyframes,
      dragging: Boolean(drag),
      draggingDisplayLeft:
        dragLeft === null ? null : dragLeft - 7,
      draggingReadoutLeft:
        dragLeft === null ? null : dragLeft + 10,
      draggingReadoutText: drag
        ? options.formatTime(
            drag.localFrame,
            frameRate
          )
        : null,
    });
  });

  const selectedBlocks:
    TimelineTrackOverlayViewModel["selectedBlocks"] =
      [];
  const groupGaps:
    TimelineTrackOverlayViewModel["groupGaps"] = [];
  nativeRows.forEach((row, index) => {
    if (
      row.type === "item" &&
      row.item.id ===
        options.timeline.selectedLayerDocumentId
    ) {
      let propertyCount = 0;
      while (
        nativeRows[index + propertyCount + 1]
          ?.type === "property" &&
        nativeRows[index + propertyCount + 1]
          ?.item.id === row.item.id
      ) {
        propertyCount += 1;
      }
      const start =
        layout.gridRowByDisplayedIndex.get(index);
      const end =
        layout.gridRowByDisplayedIndex.get(
          index + propertyCount
        );
      if (
        start !== undefined &&
        end !== undefined
      ) {
        selectedBlocks.push({
          key: `selected-block-${row.item.id}`,
          startRow: start,
          span: end - start + 1,
        });
      }
    }
    if (
      isTimelineGroupEndRow(nativeRows, index) &&
      index < nativeRows.length - 1
    ) {
      const gridRow =
        layout.gridRowByDisplayedIndex.get(index);
      if (gridRow !== undefined) {
        groupGaps.push({
          key: `group-gap-${row.item.id}-${index}`,
          row: gridRow + 1,
        });
      }
    }
  });
  return {
    available: scope.ok,
    nameColumnWidth: options.nameColumnWidth,
    header: buildHeader({
      project: options.project,
      timeline: options.timeline,
      runtime: options.runtime,
      playback: options.playback,
      frameRate,
      formatTime: options.formatTime,
    }),
    ruler: options.ruler,
    rows,
    overlay: {
      totalTrackGridRows:
        layout.totalTrackGridRows,
      frameGridMinorStep: Math.max(
        options.ruler.pxPerFrame,
        1
      ),
      frameGridMajorStep: Math.max(
        options.ruler.pxPerFrame * 10,
        10
      ),
      playheadLeft:
        Math.round(
          options.ruler.playheadLeft
        ) - 1,
      selectedBlocks,
      groupGaps,
    },
  };
}

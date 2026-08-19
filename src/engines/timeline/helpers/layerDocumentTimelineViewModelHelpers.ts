import type {
  LayerDocument,
  LayerDocumentProject,
  LayerDocumentTransformProperty,
} from "@/models";
import { getLayerModifierDefinition } from "@/models";
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
  TimelineReadModel,
  TimelineRulerViewModel,
  TimelineTrackOverlayViewModel,
  TimelineTrackRowViewModel,
  TimelineSourceStatusViewModel,
  TimelineViewItem,
} from "@/engines/timeline/models/timelineViewModel";
import {
  buildTimelineHeaderViewModel,
} from "@/engines/timeline/helpers/timelineHeaderViewModelHelpers";
import {
  buildTimelineKeyframeRowViewModel,
} from "@/engines/timeline/helpers/timelineKeyframeRowViewModelHelpers";

const PROPERTIES: readonly LayerDocumentTransformProperty[] = [
  "position",
  "scale",
  "rotation",
  "opacity",
];

export function projectLayerDocumentAudioWaveform(
  peaks: readonly number[],
  sourceDurationFrames: number | null,
  sourceOffsetFrames: number,
  durationFrames: number
) {
  if (!sourceDurationFrames || !peaks.length) return peaks;
  const start = Math.floor(sourceOffsetFrames / sourceDurationFrames * peaks.length);
  const end = Math.ceil((sourceOffsetFrames + durationFrames) / sourceDurationFrames * peaks.length);
  return peaks.slice(Math.max(0, start), Math.max(start + 1, end));
}

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

function viewItem(
  layer: LayerDocument,
  timing: {
    startFrame: number;
    durationFrames: number;
    sourceOffsetFrames: number;
  },
  project: LayerDocumentProject
): TimelineViewItem {
  const sourceId = layer.common.source?.sourceId;
  const source = sourceId
    ? project.payload.sourceRegistry.sourcesById[sourceId]
    : null;
  return {
    id: layer.layerDocumentId,
    name:
      layer.common.placement.alias ?? layer.name,
    entityKind:
      layer.type === "group"
        ? "composition"
        : "layer",
    iconKind:
      layer.type === "group"
        ? "composition"
        : layer.type === "drawing"
          ? "drawing"
          : "layer",
    mediaKind: layer.type === "audio" ? "audio" : "visual",
    audioProvenance:
      layer.type === "audio" && source?.kind === "audio"
        ? source.data.provenance
        : null,
    muted: layer.type === "audio" ? layer.data.muted : false,
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
    }
  | {
      readonly type: "formula";
      readonly item: TimelineViewItem;
      readonly layer: LayerDocument;
      readonly modifier: Extract<LayerDocument["common"]["modifiers"][number], { type: "mouth-basic" | "acceleration" }>;
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
      timingDraft ?? layer.common.placement,
      options.project
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
    const expanded = options.runtime.expandedLayerDocumentIds.has(layer.layerDocumentId);
    if (layer.type === "audio" || (!selected && !expanded)) return rows;
    if (selected || expanded) {
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
    }
    layer.common.modifiers.forEach((modifier) => {
      if (
        modifier.type !== "unknown" &&
        getLayerModifierDefinition(modifier.type).timeline.kind === "formula" &&
        (modifier.type === "mouth-basic" || modifier.type === "acceleration")
      ) {
        rows.push({ type: "formula", item, layer, modifier });
      }
    });
    return rows;
  });
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
    readAudioWaveform?: (sourceId: string, bins: number) => readonly number[];
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
      const itemSourceId = row.layer.common.source?.sourceId;
      const itemSource = itemSourceId
        ? options.project.payload.sourceRegistry.sourcesById[itemSourceId]
        : null;
      const sourceDurationFrames = row.layer.type === "group"
        ? row.layer.data.durationFrames
        : row.layer.type === "audio" && itemSource?.kind === "audio"
          ? itemSource.data.durationFrames ?? row.item.durationFrames
          : row.item.durationFrames;
      const trackLeft = options.ruler.timelineOriginLeft + row.item.startFrame * options.ruler.pxPerFrame;
      const trackWidth = row.item.durationFrames * options.ruler.pxPerFrame;
      const sourceTrackLeft = options.ruler.timelineOriginLeft + (
        row.item.startFrame - row.item.sourceOffsetFrames
      ) * options.ruler.pxPerFrame;
      const sourceTrackWidth = sourceDurationFrames * options.ruler.pxPerFrame;
      const visibleTrackLeft = Math.max(0, options.ruler.timelineOriginLeft - trackLeft);
      const visibleTrackRight = Math.min(
        trackWidth,
        options.ruler.contentWidth - trackLeft
      );
      rows.push({
        type: "item",
        item: row.item,
        rowIndex,
        connectToProperties:
          (next?.type === "property" || next?.type === "formula") &&
          next.item.id === row.item.id,
        selected:
          options.timeline
            .selectedLayerDocumentId ===
          row.item.id,
        expanded: options.runtime.expandedLayerDocumentIds.has(row.item.id),
        rowHeight:
          row.item.mediaKind === "audio" &&
          options.runtime.expandedLayerDocumentIds.has(row.item.id)
            ? 48
            : 24,
        source,
        rowBackground:
          options.runtime
            .draggedLayerDocumentId ===
          row.item.id
            ? "#4b3f2b"
            : source.isDeletePending
              ? "rgba(133, 46, 52, 0.58)"
              : row.item.mediaKind === "audio"
                ? row.item.muted
                  ? "rgba(31, 75, 52, 0.38)"
                  : "rgba(31, 75, 52, 0.9)"
                : row.item.entityKind ===
                  "composition"
                ? "#21334a"
                : "#2a2a2a",
        trackLeft,
        trackWidth,
        sourceTrackLeft,
        sourceTrackWidth,
        visibleTrackLeft,
        visibleTrackWidth: Math.max(0, visibleTrackRight - visibleTrackLeft),
        trackBackground:
          row.item.mediaKind === "audio"
            ? "linear-gradient(90deg, #287047 0%, #3b9663 100%)"
            : row.item.entityKind === "composition"
            ? "linear-gradient(90deg, #3a6ea5 0%, #4f83bc 100%)"
            : "linear-gradient(90deg, #4a4a4a 0%, #636363 100%)",
        trackOpacity: row.item.visible && !row.item.muted
          ? 0.92
          : 0.42,
        waveform: (() => {
          if (row.layer.type !== "audio" || !options.readAudioWaveform) return [];
          const sourceId = row.layer.common.source?.sourceId;
          if (!sourceId) return [];
          const peaks = options.readAudioWaveform(sourceId, 128);
          const source = options.project.payload.sourceRegistry.sourcesById[sourceId];
          const sourceFrames = source?.kind === "audio" ? source.data.durationFrames : null;
          return projectLayerDocumentAudioWaveform(
            peaks,
            sourceFrames,
            row.item.sourceOffsetFrames,
            row.item.durationFrames
          );
        })(),
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
    if (row.type === "formula") {
      const clipGlobalStart = row.item.startFrame + row.modifier.startFrame - row.item.sourceOffsetFrames;
      const transitionFrames = row.modifier.type === "mouth-basic" ? row.modifier.transitionFrames : [];
      rows.push({
        type: "formula",
        formulaType: row.modifier.type,
        item: row.item,
        rowIndex,
        label: getLayerModifierDefinition(row.modifier.type).label,
        modifierId: row.modifier.modifierId,
        startFrame: row.modifier.startFrame,
        durationFrames: row.modifier.durationFrames,
        transitionFrames,
        inverted: row.modifier.type === "mouth-basic" && row.modifier.inverted === true,
        pxPerFrame: options.ruler.pxPerFrame,
        timelineOriginLeft: options.ruler.timelineOriginLeft,
        trackLeft: options.ruler.timelineOriginLeft + clipGlobalStart * options.ruler.pxPerFrame,
        trackWidth: row.modifier.durationFrames * options.ruler.pxPerFrame,
        transitionLefts: transitionFrames.map(
          (frame) => options.ruler.timelineOriginLeft + (clipGlobalStart + frame) * options.ruler.pxPerFrame
        ),
        accelerationCurve: row.modifier.type === "acceleration" ? row.modifier.curve : undefined,
        accelerationProperties: row.modifier.type === "acceleration" ? row.modifier.properties : undefined,
      });
      return;
    }
    rows.push(buildTimelineKeyframeRowViewModel({
      item: row.item,
      layer: row.layer,
      property: row.property,
      rowIndex,
      runtime: options.runtime,
      timeline: options.timeline,
      ruler: options.ruler,
      frameRate,
      formatTime: options.formatTime,
    }));
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
        (nativeRows[index + propertyCount + 1]
          ?.type === "property" || nativeRows[index + propertyCount + 1]?.type === "formula") &&
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
    header: buildTimelineHeaderViewModel({
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
      timelineOriginLeft: options.ruler.timelineOriginLeft,
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

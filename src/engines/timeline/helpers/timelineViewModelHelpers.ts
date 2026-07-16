import type { AnimatableProperty, Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import type {
  TimelineDurationViewModel,
  TimelineHeaderViewModel,
  TimelineKeyframeSelection,
  TimelinePropertyVisualTokens,
  TimelineRow,
  TimelineSelection,
  TimelineTrackOverlayViewModel,
  TimelineTrackRowViewModel,
} from "@/engines/timeline/models/timelineViewModel";
import { buildTimelineTrackRowLayout, isTimelineGroupEndRow, splitTimelineDuration } from "@/engines/timeline/helpers/timelineLayoutHelpers";
import { buildTimelineSourceStatusViewModel, resolveTimelineSourceStatus } from "@/engines/timeline/helpers/timelineSourceStatusHelpers";

const LABELS: Record<AnimatableProperty, string> = {
  position: "위치",
  scale: "스케일",
  rotation: "회전",
  opacity: "불투명도",
};
const COLORS: Record<AnimatableProperty, TimelinePropertyVisualTokens> = {
  position: { accent: "#6ba9df", accentMuted: "rgba(107, 169, 223, 0.62)", label: "#c9def2" },
  scale: { accent: "#7eca9d", accentMuted: "rgba(126, 202, 157, 0.62)", label: "#d4ecdd" },
  rotation: { accent: "#e3a56a", accentMuted: "rgba(227, 165, 106, 0.62)", label: "#f1dbc6" },
  opacity: { accent: "#bc92dd", accentMuted: "rgba(188, 146, 221, 0.62)", label: "#eadbf8" },
};

export function buildTimelineRows(options: {
  items: TimelineItem[];
  selection: TimelineSelection;
  properties: readonly AnimatableProperty[];
  allLayersById: Map<string, Layer>;
  allCompositionsById: Map<string, Composition>;
}): TimelineRow[] {
  return options.items.flatMap((item) => {
    const rows: TimelineRow[] = [{ type: "item", item }];
    const selected = (options.selection?.itemId
      ? options.selection.itemId === item.id
      : options.selection?.sourceId === item.sourceId)
      && options.selection?.kind === item.kind;
    if (!selected) return rows;
    const propertyState = item.kind === "layer"
      ? options.allLayersById.get(item.sourceId)?.enabledProperties
      : options.allCompositionsById.get(item.sourceId)?.enabledProperties;
    if (!propertyState) return rows;
    return [
      ...rows,
      ...options.properties
        .filter((property) => propertyState[property])
        .map((property) => ({ type: "property" as const, item, property })),
    ];
  });
}

export function isTimelineItemSelected(selection: TimelineSelection, item: { id: string; sourceId: string; kind: string }) {
  return (
    (selection?.itemId ? selection.itemId === item.id : selection?.sourceId === item.sourceId)
    && selection?.kind === item.kind
  );
}

export function buildTimelineDurationViewModel(
  valueFrames: number,
  frameRate: number,
  accent: "range" | "timeline"
): TimelineDurationViewModel {
  return {
    valueFrames: Math.max(valueFrames, 1),
    frameRate,
    ...splitTimelineDuration(valueFrames, frameRate),
    accent,
    title: accent === "range"
      ? "클릭해서 playback range 길이 편집"
      : "클릭해서 전체 타임라인 길이 편집",
  };
}

export function buildTimelineHeaderViewModel(options: {
  selectedComp: Composition | null;
  selectedMeta: CompositionMeta | null;
  breadcrumbPath: string | null;
  switcher: TimelineHeaderViewModel["switcher"];
  isPlaying: boolean;
  currentFrame: number;
  currentFrameText: string;
  canDuplicate: boolean;
  canSplit: boolean;
}): TimelineHeaderViewModel {
  return {
    visible: !!options.selectedMeta,
    compositionName: options.selectedComp?.name ?? null,
    breadcrumbPath: options.breadcrumbPath,
    breadcrumbDisplayText: options.breadcrumbPath ?? "No selection",
    switcher: options.switcher,
    isPlaying: options.isPlaying,
    currentFrame: options.currentFrame,
    currentFrameText: options.currentFrameText,
    canDuplicateSelectedItem: options.canDuplicate,
    canSplitSelectedItem: options.canSplit,
  };
}

export function buildTimelineTrackViewModels(options: {
  rows: TimelineRow[];
  selectedTimelineTarget: TimelineSelection;
  selectedKeyframe: TimelineKeyframeSelection;
  draggingKeyframe: TimelineKeyframeSelection;
  draggingKeyframeDisplayFrame: number | null;
  draggedTimelineItemId: string | null;
  pxPerFrame: number;
  allLayersById: Map<string, Layer>;
  allCompositionsById: Map<string, Composition>;
  keyframesByRow: Map<string, Array<{ frame: number }>>;
  frameRate: number;
  formatTime: (frame: number, frameRate: number) => string;
  editingItemId: string | null;
  draftName: string;
  deleteDecisionItemId: string | null;
}) {
  const layout = buildTimelineTrackRowLayout(options.rows);
  const viewRows: TimelineTrackRowViewModel[] = [];
  options.rows.forEach((row, index) => {
    const rowIndex = layout.gridRowByDisplayedIndex.get(index);
    if (rowIndex === undefined) return;
    if (row.type === "item") {
      const next = options.rows[index + 1];
      const selected = isTimelineItemSelected(options.selectedTimelineTarget, row.item);
      const source = buildTimelineSourceStatusViewModel(
        resolveTimelineSourceStatus(row.item, options.allLayersById, options.allCompositionsById)
      );
      const base = row.item.kind === "subComp" ? "#21334a" : "#2a2a2a";
      viewRows.push({
        type: "item",
        item: row.item,
        rowIndex,
        connectToProperties: next?.type === "property" && next.item.id === row.item.id,
        selected,
        source,
        rowBackground: options.draggedTimelineItemId === row.item.id
          ? "#4b3f2b"
          : source.isDeletePending
            ? "rgba(133, 46, 52, 0.58)"
            : base,
        trackLeft: row.item.startFrame * options.pxPerFrame,
        trackWidth: row.item.durationFrames * options.pxPerFrame,
        trackBackground: row.item.kind === "subComp"
          ? "linear-gradient(90deg, #3a6ea5 0%, #4f83bc 100%)"
          : "linear-gradient(90deg, #4a4a4a 0%, #636363 100%)",
        trackOpacity: row.item.visible ? 0.92 : 0.42,
        isEditingName: options.editingItemId === row.item.id,
        draftName: options.editingItemId === row.item.id ? options.draftName : row.item.name,
        showDeleteDecision: options.deleteDecisionItemId === row.item.id && source.isDeletePending,
      });
      return;
    }
    const colors = COLORS[row.property];
    const draggingThis = options.draggingKeyframe?.targetId === row.item.sourceId
      && options.draggingKeyframe.property === row.property;
    const original = draggingThis
      ? options.draggingKeyframe?.originFrame ?? options.draggingKeyframe?.frame ?? null
      : null;
    const keyframes = (options.keyframesByRow.get(`${row.item.id}:${row.property}`) ?? [])
      .filter((keyframe) => keyframe.frame !== original)
      .map((keyframe) => ({
        frame: keyframe.frame,
        left: (row.item.startFrame + keyframe.frame) * options.pxPerFrame - 7,
        title: options.formatTime(keyframe.frame, options.frameRate),
        selected: options.selectedKeyframe?.targetId === row.item.sourceId
          && options.selectedKeyframe.frame === keyframe.frame
          && options.selectedKeyframe.property === row.property,
        dragging: options.draggingKeyframe?.targetId === row.item.sourceId
          && options.draggingKeyframe.frame === keyframe.frame
          && options.draggingKeyframe.property === row.property,
      }));
    const dragLeft = draggingThis && options.draggingKeyframeDisplayFrame !== null
      ? options.draggingKeyframeDisplayFrame * options.pxPerFrame
      : null;
    viewRows.push({
      type: "property",
      item: row.item,
      property: row.property,
      targetKind: row.item.kind === "layer" ? "layer" : "composition",
      rowIndex,
      label: LABELS[row.property],
      colors,
      selectedTimelineItem: isTimelineItemSelected(options.selectedTimelineTarget, row.item),
      trackLeft: row.item.startFrame * options.pxPerFrame,
      trackWidth: row.item.durationFrames * options.pxPerFrame,
      keyframes,
      dragging: draggingThis,
      draggingDisplayLeft: dragLeft === null ? null : dragLeft - 7,
      draggingReadoutLeft: dragLeft === null ? null : dragLeft + 10,
      draggingReadoutText: draggingThis && options.draggingKeyframe
        ? options.formatTime(options.draggingKeyframe.frame, options.frameRate)
        : null,
    });
  });

  const selectedBlocks: TimelineTrackOverlayViewModel["selectedBlocks"] = [];
  const groupGaps: TimelineTrackOverlayViewModel["groupGaps"] = [];
  options.rows.forEach((row, index) => {
    if (row.type === "item" && isTimelineItemSelected(options.selectedTimelineTarget, row.item)) {
      let propertyCount = 0;
      while (options.rows[index + propertyCount + 1]?.type === "property"
        && options.rows[index + propertyCount + 1]?.item.id === row.item.id) propertyCount += 1;
      const start = layout.gridRowByDisplayedIndex.get(index);
      const end = layout.gridRowByDisplayedIndex.get(index + propertyCount);
      if (start !== undefined && end !== undefined) {
        selectedBlocks.push({ key: `selected-block-${row.item.id}`, startRow: start, span: end - start + 1 });
      }
    }
    if (isTimelineGroupEndRow(options.rows, index) && index < options.rows.length - 1) {
      const rowGrid = layout.gridRowByDisplayedIndex.get(index);
      if (rowGrid !== undefined) groupGaps.push({ key: `group-gap-${row.item.id}-${index}`, row: rowGrid + 1 });
    }
  });

  return {
    rows: viewRows,
    overlay: {
      totalTrackGridRows: layout.totalTrackGridRows,
      frameGridMinorStep: Math.max(options.pxPerFrame, 1),
      frameGridMajorStep: Math.max(options.pxPerFrame * 10, 10),
      playheadLeft: 0,
      selectedBlocks,
      groupGaps,
    } satisfies TimelineTrackOverlayViewModel,
  };
}

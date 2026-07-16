import { useRef, type Dispatch, type SetStateAction } from "react";
import type { SelectedKeyframe } from "@/engines/animation";
import type { PlaybackCommands, PlaybackReadModel } from "@/engines/playback-render";
import type { ProjectCommands, RenderItem } from "@/engines/project";
import type { AnimatableProperty, Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import { useTimelineDuplicateController } from "@/engines/timeline/controllers/useTimelineDuplicateController";
import { useTimelineDurationController } from "@/engines/timeline/controllers/useTimelineDurationController";
import { useTimelineItemController } from "@/engines/timeline/controllers/useTimelineItemController";
import { useTimelineKeyframeController } from "@/engines/timeline/controllers/useTimelineKeyframeController";
import { useTimelineNavigationController } from "@/engines/timeline/controllers/useTimelineNavigationController";
import { useTimelinePlaybackUIController } from "@/engines/timeline/controllers/useTimelinePlaybackUIController";
import { useTimelinePointerController } from "@/engines/timeline/controllers/useTimelinePointerController";
import { useTimelineRenameController } from "@/engines/timeline/controllers/useTimelineRenameController";
import { useTimelineReorderController } from "@/engines/timeline/controllers/useTimelineReorderController";
import { useTimelineResizeController } from "@/engines/timeline/controllers/useTimelineResizeController";
import { useTimelineSplitController } from "@/engines/timeline/controllers/useTimelineSplitController";
import { useTimelineViewController } from "@/engines/timeline/controllers/useTimelineViewController";
import type { TimelineSelection } from "@/engines/timeline/models/timelineViewModel";

export type UseTimelineEngineOptions = {
  masterCompId: string;
  nameColumnWidth: number;
  defaultPxPerFrame: number;
  project: {
    selectedComposition: Composition;
    selectedMeta: CompositionMeta | null;
    compositions: Composition[];
    selectedTimelineItems: TimelineItem[];
    renderItemsByCompId: Record<string, RenderItem[]>;
    allLayersById: Map<string, Layer>;
    allCompositionsById: Map<string, Composition>;
    commands: ProjectCommands;
  };
  selection: {
    selectedTimelineTarget: TimelineSelection;
    selectedKeyframe: SelectedKeyframe;
    draggingKeyframe: SelectedKeyframe;
    draggedTimelineItemId: string | null;
    applyForComposition: (compId: string, selection: TimelineSelection) => void;
    selectComposition: (compId: string) => void;
    setSelectedCompId: Dispatch<SetStateAction<string>>;
    setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
    setDraggingKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
    setDraggedTimelineItemId: Dispatch<SetStateAction<string | null>>;
  };
  playback: PlaybackReadModel;
  playbackCommands: PlaybackCommands;
  state: { hoveredFrame: number | null; isScrubbing: boolean; setHoveredFrame: (frame: number | null) => void; setIsScrubbing: Dispatch<SetStateAction<boolean>> };
  history: { push: (compId: string) => void; begin: (compId: string) => void; markDirty: (compId: string) => void; commit: (compId: string) => void };
  sourceStatus: { acknowledge: (item: TimelineItem) => void; resolveDelete: (item: TimelineItem, decision: "delete" | "keep") => void };
  movePropertyKeyframe: (target: { kind: "layer" | "composition"; id: string }, property: AnimatableProperty, fromFrame: number, toFrame: number) => void;
  removePropertyKeyframe: (target: { kind: "layer" | "composition"; id: string }, property: AnimatableProperty, frame: number) => void;
  formatTime: (frame: number, frameRate: number) => string;
};

export function useTimelineEngine(options: UseTimelineEngineOptions) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const compId = options.project.selectedComposition.id;
  const duration = useTimelineDurationController({
    compId,
    selectedMeta: options.project.selectedMeta,
    projectCommands: options.project.commands,
    playbackCommands: options.playbackCommands,
    pushHistory: options.history.push,
  });
  const playbackUI = useTimelinePlaybackUIController({
    defaultPxPerFrame: options.defaultPxPerFrame, selectedMeta: options.project.selectedMeta,
    playback: options.playback, playbackCommands: options.playbackCommands,
    hoveredFrame: options.state.hoveredFrame, isScrubbing: options.state.isScrubbing,
    setHoveredFrame: options.state.setHoveredFrame, setIsScrubbing: options.state.setIsScrubbing,
    duration: { updateDuration: duration.update, beginRangeEdit: () => options.history.begin(compId), markRangeEditDirty: () => options.history.markDirty(compId), commitRangeEdit: () => options.history.commit(compId) },
    formatTime: options.formatTime,
  });
  const navigation = useTimelineNavigationController({ selectedComposition: options.project.selectedComposition, selectedTimelineTarget: options.selection.selectedTimelineTarget, allLayersById: options.project.allLayersById, allCompositionsById: options.project.allCompositionsById, selectComposition: options.selection.selectComposition });
  const item = useTimelineItemController({ compId, selectedMeta: options.project.selectedMeta, pxPerFrame: playbackUI.pxPerFrame, projectCommands: options.project.commands, history: options.history, applySelection: options.selection.applyForComposition, acknowledgeSourceStatus: options.sourceStatus.acknowledge, resolveSourceDelete: options.sourceStatus.resolveDelete });
  const resize = useTimelineResizeController({ compId, selectedMeta: options.project.selectedMeta, selectedItems: options.project.selectedTimelineItems, pxPerFrame: playbackUI.pxPerFrame, projectCommands: options.project.commands, history: options.history });
  const reorder = useTimelineReorderController({ masterCompId: options.masterCompId, selectedComp: options.project.selectedComposition, compositions: options.project.compositions, selectedItems: options.project.selectedTimelineItems, renderItemsByCompId: options.project.renderItemsByCompId, draggedItemId: options.selection.draggedTimelineItemId, projectCommands: options.project.commands, historyPush: options.history.push, setSelectedCompId: options.selection.setSelectedCompId, setDraggedItemId: options.selection.setDraggedTimelineItemId });
  const rename = useTimelineRenameController({ compId, items: options.project.selectedTimelineItems, projectCommands: options.project.commands, historyPush: options.history.push });
  const duplicate = useTimelineDuplicateController({ compId, items: options.project.selectedTimelineItems, selection: options.selection.selectedTimelineTarget, projectCommands: options.project.commands, historyPush: options.history.push, applySelection: options.selection.applyForComposition });
  const split = useTimelineSplitController({ compId, currentFrame: options.playback.currentFrame, items: options.project.selectedTimelineItems, selection: options.selection.selectedTimelineTarget, projectCommands: options.project.commands, historyPush: options.history.push, applySelection: options.selection.applyForComposition });
  const keyframe = useTimelineKeyframeController({ compId, items: options.project.selectedTimelineItems, pxPerFrame: playbackUI.pxPerFrame, setSelectedKeyframe: options.selection.setSelectedKeyframe, setDraggingKeyframe: options.selection.setDraggingKeyframe, applySelection: options.selection.applyForComposition, seekFrame: (frame) => options.playbackCommands.seek(frame, { clearTransformDrafts: false }), moveKeyframe: options.movePropertyKeyframe, removeKeyframe: options.removePropertyKeyframe, history: options.history });
  const pointer = useTimelinePointerController({
    scrollContainerRef,
    move: (session, clientX) => {
      if (session.type === "move-item") item.moveItem(session, clientX);
      else if (session.type === "resize-start" || session.type === "resize-end") resize.resizeItem(session, clientX);
      else if (session.type === "move-keyframe") return keyframe.move(session, clientX);
    },
    end: (session) => {
      if (session.type === "move-item") item.endMove(session);
      else if (session.type === "resize-start" || session.type === "resize-end") resize.endResize(session);
      else if (session.type === "move-keyframe") keyframe.endMove(session);
    },
  });
  const view = useTimelineViewController({
    nameColumnWidth: options.nameColumnWidth,
    project: { selectedComposition: options.project.selectedComposition, selectedMeta: options.project.selectedMeta, compositions: options.project.compositions, selectedTimelineItems: options.project.selectedTimelineItems, allLayersById: options.project.allLayersById, allCompositionsById: options.project.allCompositionsById },
    selection: options.selection, ruler: playbackUI.ruler,
    switcher: navigation.switcher, breadcrumbPath: navigation.breadcrumbPath,
    currentFrame: options.playback.currentFrame, playheadFrame: playbackUI.playheadFrame,
    isPlaying: options.playback.isPlaying, formatTime: options.formatTime,
    interactionView: { editingItemId: rename.editingItemId, draftName: rename.draftName, deleteDecisionItemId: item.deleteDecisionItemId },
  });
  const commands = { ...playbackUI.commands, toggleCompositionSwitcher: navigation.toggleCompositionSwitcher, selectComposition: navigation.selectComposition };
  const interactions = {
    duplicateSelectedTimelineItem: duplicate.duplicate,
    splitSelectedTimelineItem: split.split,
    selectTimelineItem: item.selectItem,
    activateTimelineItem: item.activateItem,
    resolveTimelineSourceDelete: item.resolveDelete,
    reorderTimelineItem: reorder.reorder,
    setDraggedTimelineItemId: reorder.setDraggedItemId,
    beginMoveTimelineItem: (clientX: number, target: TimelineItem) => pointer.begin(item.createMoveSession(target, clientX)),
    beginResizeTimelineItemStart: (clientX: number, target: TimelineItem) => pointer.begin(resize.createResizeSession(target, clientX, "start")),
    beginResizeTimelineItemEnd: (clientX: number, target: TimelineItem) => pointer.begin(resize.createResizeSession(target, clientX, "end")),
    beginRenameTimelineItem: rename.begin,
    changeTimelineItemName: rename.setDraftName,
    commitTimelineItemName: rename.commit,
    cancelTimelineItemName: rename.cancel,
    handleTimelineItemNameKey: rename.handleKey,
    selectKeyframe: keyframe.select,
    beginMoveKeyframe: (clientX: number, kind: "layer" | "composition", id: string, frame: number, property: AnimatableProperty) => pointer.begin(keyframe.createMoveSession(kind, id, frame, property, clientX)),
    deleteKeyframe: keyframe.remove,
  };
  return { viewProps: { readModel: view.readModel, commands, interactions, rulerRef: playbackUI.rulerRef, switcherRef: navigation.switcherRef, scrollContainerRef }, readModel: view.readModel, commands, interactions, playheadFrame: playbackUI.playheadFrame, selectedTimelineTargetItem: view.selectedTimelineTargetItem, selectedTransformLocalFrame: view.selectedTransformLocalFrame };
}

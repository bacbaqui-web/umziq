import { useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
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
  const playbackRange = useMemo(() => ({
    startFrame: options.playback.playbackRange.startFrame,
    endFrame: options.playback.playbackRange.endFrame,
  }), [options.playback.playbackRange.endFrame, options.playback.playbackRange.startFrame]);
  const playback = useMemo<PlaybackReadModel>(() => ({
    currentFrame: options.playback.currentFrame,
    playheadFrame: options.playback.playheadFrame,
    isPlaying: options.playback.isPlaying,
    rendererMode: options.playback.rendererMode,
    playbackRange,
  }), [options.playback.currentFrame, options.playback.isPlaying, options.playback.playheadFrame, options.playback.rendererMode, playbackRange]);
  const playbackCommands = useMemo<PlaybackCommands>(() => ({
    play: options.playbackCommands.play,
    pause: options.playbackCommands.pause,
    togglePlayback: options.playbackCommands.togglePlayback,
    seek: options.playbackCommands.seek,
    stepBackward: options.playbackCommands.stepBackward,
    stepForward: options.playbackCommands.stepForward,
    reset: options.playbackCommands.reset,
    setRendererMode: options.playbackCommands.setRendererMode,
    setPlaybackRange: options.playbackCommands.setPlaybackRange,
    setPlaybackIn: options.playbackCommands.setPlaybackIn,
    setPlaybackOut: options.playbackCommands.setPlaybackOut,
    normalizeForDuration: options.playbackCommands.normalizeForDuration,
  }), [
    options.playbackCommands.normalizeForDuration,
    options.playbackCommands.pause,
    options.playbackCommands.play,
    options.playbackCommands.reset,
    options.playbackCommands.seek,
    options.playbackCommands.setPlaybackIn,
    options.playbackCommands.setPlaybackOut,
    options.playbackCommands.setPlaybackRange,
    options.playbackCommands.setRendererMode,
    options.playbackCommands.stepBackward,
    options.playbackCommands.stepForward,
    options.playbackCommands.togglePlayback,
  ]);
  const history = useMemo(() => ({
    push: options.history.push,
    begin: options.history.begin,
    markDirty: options.history.markDirty,
    commit: options.history.commit,
  }), [options.history.begin, options.history.commit, options.history.markDirty, options.history.push]);
  const { push: pushHistory, begin: beginHistory, markDirty: markHistoryDirty, commit: commitHistory } = history;
  const selectionRead = useMemo(() => ({
    selectedTimelineTarget: options.selection.selectedTimelineTarget,
    selectedKeyframe: options.selection.selectedKeyframe,
    draggingKeyframe: options.selection.draggingKeyframe,
    draggedTimelineItemId: options.selection.draggedTimelineItemId,
  }), [options.selection.draggedTimelineItemId, options.selection.draggingKeyframe, options.selection.selectedKeyframe, options.selection.selectedTimelineTarget]);
  const durationOptions = useMemo(() => ({
    compId,
    selectedMeta: options.project.selectedMeta,
    projectCommands: options.project.commands,
    playbackCommands,
    pushHistory,
  }), [compId, options.project.commands, options.project.selectedMeta, playbackCommands, pushHistory]);
  const duration = useTimelineDurationController(durationOptions);
  const { update: updateDuration } = duration;
  const beginRangeEdit = useCallback(() => beginHistory(compId), [beginHistory, compId]);
  const markRangeEditDirty = useCallback(() => markHistoryDirty(compId), [compId, markHistoryDirty]);
  const commitRangeEdit = useCallback(() => commitHistory(compId), [commitHistory, compId]);
  const playbackUIOptions = useMemo(() => ({
    defaultPxPerFrame: options.defaultPxPerFrame, selectedMeta: options.project.selectedMeta,
    playback, playbackCommands,
    hoveredFrame: options.state.hoveredFrame, isScrubbing: options.state.isScrubbing,
    setHoveredFrame: options.state.setHoveredFrame, setIsScrubbing: options.state.setIsScrubbing,
    duration: { updateDuration, beginRangeEdit, markRangeEditDirty, commitRangeEdit },
    formatTime: options.formatTime,
  }), [beginRangeEdit, commitRangeEdit, markRangeEditDirty, options.defaultPxPerFrame, options.formatTime, options.project.selectedMeta, options.state.hoveredFrame, options.state.isScrubbing, options.state.setHoveredFrame, options.state.setIsScrubbing, playback, playbackCommands, updateDuration]);
  const playbackUI = useTimelinePlaybackUIController(playbackUIOptions);
  const { pxPerFrame, ruler, rulerRef, playheadFrame, commands: playbackUICommands } = playbackUI;
  const navigationOptions = useMemo(() => ({ selectedComposition: options.project.selectedComposition, selectedTimelineTarget: options.selection.selectedTimelineTarget, allLayersById: options.project.allLayersById, allCompositionsById: options.project.allCompositionsById, selectComposition: options.selection.selectComposition }), [options.project.allCompositionsById, options.project.allLayersById, options.project.selectedComposition, options.selection.selectComposition, options.selection.selectedTimelineTarget]);
  const navigation = useTimelineNavigationController(navigationOptions);
  const { switcher, breadcrumbPath, toggleCompositionSwitcher, selectComposition, switcherRef } = navigation;
  const itemOptions = useMemo(() => ({ compId, selectedMeta: options.project.selectedMeta, pxPerFrame, projectCommands: options.project.commands, history, applySelection: options.selection.applyForComposition, acknowledgeSourceStatus: options.sourceStatus.acknowledge, resolveSourceDelete: options.sourceStatus.resolveDelete }), [compId, history, options.project.commands, options.project.selectedMeta, options.selection.applyForComposition, options.sourceStatus.acknowledge, options.sourceStatus.resolveDelete, pxPerFrame]);
  const item = useTimelineItemController(itemOptions);
  const { deleteDecisionItemId, createMoveSession, moveItem, endMove, selectItem, activateItem, resolveDelete } = item;
  const resizeOptions = useMemo(() => ({ compId, selectedMeta: options.project.selectedMeta, selectedItems: options.project.selectedTimelineItems, pxPerFrame, projectCommands: options.project.commands, history }), [compId, history, options.project.commands, options.project.selectedMeta, options.project.selectedTimelineItems, pxPerFrame]);
  const resize = useTimelineResizeController(resizeOptions);
  const { createResizeSession, resizeItem, endResize } = resize;
  const reorderOptions = useMemo(() => ({ masterCompId: options.masterCompId, selectedComp: options.project.selectedComposition, compositions: options.project.compositions, selectedItems: options.project.selectedTimelineItems, renderItemsByCompId: options.project.renderItemsByCompId, draggedItemId: options.selection.draggedTimelineItemId, projectCommands: options.project.commands, historyPush: pushHistory, setSelectedCompId: options.selection.setSelectedCompId, setDraggedItemId: options.selection.setDraggedTimelineItemId }), [options.masterCompId, options.project.commands, options.project.compositions, options.project.renderItemsByCompId, options.project.selectedComposition, options.project.selectedTimelineItems, options.selection.draggedTimelineItemId, options.selection.setDraggedTimelineItemId, options.selection.setSelectedCompId, pushHistory]);
  const reorder = useTimelineReorderController(reorderOptions);
  const { reorder: reorderTimelineItem } = reorder;
  const renameOptions = useMemo(() => ({ compId, items: options.project.selectedTimelineItems, projectCommands: options.project.commands, historyPush: pushHistory }), [compId, options.project.commands, options.project.selectedTimelineItems, pushHistory]);
  const rename = useTimelineRenameController(renameOptions);
  const { editingItemId, draftName, begin: beginRename, setDraftName, commit: commitRename, cancel: cancelRename, handleKey: handleRenameKey } = rename;
  const duplicateOptions = useMemo(() => ({ compId, items: options.project.selectedTimelineItems, selection: options.selection.selectedTimelineTarget, projectCommands: options.project.commands, historyPush: pushHistory, applySelection: options.selection.applyForComposition }), [compId, options.project.commands, options.project.selectedTimelineItems, options.selection.applyForComposition, options.selection.selectedTimelineTarget, pushHistory]);
  const duplicate = useTimelineDuplicateController(duplicateOptions);
  const { duplicate: duplicateSelectedTimelineItem } = duplicate;
  const splitOptions = useMemo(() => ({ compId, currentFrame: playback.currentFrame, items: options.project.selectedTimelineItems, selection: options.selection.selectedTimelineTarget, projectCommands: options.project.commands, historyPush: pushHistory, applySelection: options.selection.applyForComposition }), [compId, options.project.commands, options.project.selectedTimelineItems, options.selection.applyForComposition, options.selection.selectedTimelineTarget, playback.currentFrame, pushHistory]);
  const split = useTimelineSplitController(splitOptions);
  const { split: splitSelectedTimelineItem } = split;
  const seekFrame = useCallback((frame: number) => playbackCommands.seek(frame, { clearTransformDrafts: false }), [playbackCommands]);
  const keyframeOptions = useMemo(() => ({ compId, items: options.project.selectedTimelineItems, pxPerFrame, setSelectedKeyframe: options.selection.setSelectedKeyframe, setDraggingKeyframe: options.selection.setDraggingKeyframe, applySelection: options.selection.applyForComposition, seekFrame, moveKeyframe: options.movePropertyKeyframe, removeKeyframe: options.removePropertyKeyframe, history }), [compId, history, options.movePropertyKeyframe, options.project.selectedTimelineItems, options.removePropertyKeyframe, options.selection.applyForComposition, options.selection.setDraggingKeyframe, options.selection.setSelectedKeyframe, pxPerFrame, seekFrame]);
  const keyframe = useTimelineKeyframeController(keyframeOptions);
  const { select: selectKeyframe, createMoveSession: createKeyframeMoveSession, move: moveKeyframeSession, endMove: endKeyframeMove, remove: deleteKeyframe } = keyframe;
  const movePointer = useCallback((session: Parameters<Parameters<typeof useTimelinePointerController>[0]["move"]>[0], clientX: number) => {
    if (session.type === "move-item") moveItem(session, clientX);
    else if (session.type === "resize-start" || session.type === "resize-end") resizeItem(session, clientX);
    else if (session.type === "move-keyframe") return moveKeyframeSession(session, clientX);
  }, [moveItem, moveKeyframeSession, resizeItem]);
  const endPointer = useCallback((session: Parameters<Parameters<typeof useTimelinePointerController>[0]["end"]>[0]) => {
    if (session.type === "move-item") endMove(session);
    else if (session.type === "resize-start" || session.type === "resize-end") endResize(session);
    else if (session.type === "move-keyframe") endKeyframeMove(session);
  }, [endKeyframeMove, endMove, endResize]);
  const pointerOptions = useMemo(() => ({
    scrollContainerRef,
    move: movePointer,
    end: endPointer,
  }), [endPointer, movePointer]);
  const pointer = useTimelinePointerController(pointerOptions);
  const { begin: beginPointer } = pointer;
  const viewOptions = useMemo(() => ({
    nameColumnWidth: options.nameColumnWidth,
    project: { selectedComposition: options.project.selectedComposition, selectedMeta: options.project.selectedMeta, compositions: options.project.compositions, selectedTimelineItems: options.project.selectedTimelineItems, allLayersById: options.project.allLayersById, allCompositionsById: options.project.allCompositionsById },
    selection: selectionRead, ruler,
    switcher, breadcrumbPath,
    currentFrame: playback.currentFrame, playheadFrame,
    isPlaying: playback.isPlaying, formatTime: options.formatTime,
    interactionView: { editingItemId, draftName, deleteDecisionItemId },
  }), [breadcrumbPath, deleteDecisionItemId, draftName, editingItemId, options.formatTime, options.nameColumnWidth, options.project.allCompositionsById, options.project.allLayersById, options.project.compositions, options.project.selectedComposition, options.project.selectedMeta, options.project.selectedTimelineItems, playback.currentFrame, playback.isPlaying, playheadFrame, ruler, selectionRead, switcher]);
  const view = useTimelineViewController(viewOptions);
  const { readModel, selectedTimelineTargetItem, selectedTransformLocalFrame } = view;
  const commands = useMemo(() => ({ ...playbackUICommands, toggleCompositionSwitcher, selectComposition }), [playbackUICommands, selectComposition, toggleCompositionSwitcher]);
  const beginMoveTimelineItem = useCallback((clientX: number, target: TimelineItem) => beginPointer(createMoveSession(target, clientX)), [beginPointer, createMoveSession]);
  const beginResizeTimelineItemStart = useCallback((clientX: number, target: TimelineItem) => beginPointer(createResizeSession(target, clientX, "start")), [beginPointer, createResizeSession]);
  const beginResizeTimelineItemEnd = useCallback((clientX: number, target: TimelineItem) => beginPointer(createResizeSession(target, clientX, "end")), [beginPointer, createResizeSession]);
  const beginMoveKeyframe = useCallback((clientX: number, kind: "layer" | "composition", id: string, frame: number, property: AnimatableProperty) => beginPointer(createKeyframeMoveSession(kind, id, frame, property, clientX)), [beginPointer, createKeyframeMoveSession]);
  const interactions = useMemo(() => ({
    duplicateSelectedTimelineItem,
    splitSelectedTimelineItem,
    selectTimelineItem: selectItem,
    activateTimelineItem: activateItem,
    resolveTimelineSourceDelete: resolveDelete,
    reorderTimelineItem,
    setDraggedTimelineItemId: options.selection.setDraggedTimelineItemId,
    beginMoveTimelineItem,
    beginResizeTimelineItemStart,
    beginResizeTimelineItemEnd,
    beginRenameTimelineItem: beginRename,
    changeTimelineItemName: setDraftName,
    commitTimelineItemName: commitRename,
    cancelTimelineItemName: cancelRename,
    handleTimelineItemNameKey: handleRenameKey,
    selectKeyframe,
    beginMoveKeyframe,
    deleteKeyframe,
  }), [activateItem, beginMoveKeyframe, beginMoveTimelineItem, beginRename, beginResizeTimelineItemEnd, beginResizeTimelineItemStart, cancelRename, commitRename, deleteKeyframe, duplicateSelectedTimelineItem, handleRenameKey, options.selection.setDraggedTimelineItemId, reorderTimelineItem, resolveDelete, selectItem, selectKeyframe, setDraftName, splitSelectedTimelineItem]);
  const viewProps = useMemo(() => ({ readModel, commands, interactions, rulerRef, switcherRef, scrollContainerRef }), [commands, interactions, readModel, rulerRef, switcherRef]);
  return useMemo(() => ({ viewProps, readModel, commands, interactions, playheadFrame, selectedTimelineTargetItem, selectedTransformLocalFrame }), [commands, interactions, playheadFrame, readModel, selectedTimelineTargetItem, selectedTransformLocalFrame, viewProps]);
}

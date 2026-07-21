import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { ProjectHistoryReadState, ProjectHistoryRestorePort } from "@/engines/project/history/projectHistorySnapshot";
import { useProjectHistoryController } from "@/engines/project/controllers/useProjectHistoryController";
import { useProjectHistoryState } from "@/engines/project/state/useProjectHistoryState";

export type UseProjectHistoryOptions = {
  readState: ProjectHistoryReadState;
  restorePort: ProjectHistoryRestorePort;
};

export function useProjectHistory(options: UseProjectHistoryOptions) {
  const {
    comps, currentFrame, lastSelectedItemByCompId, masterEnabledProperties,
    masterOpacity, masterOpacityKeyframes, masterRotation, masterRotationKeyframes,
    masterScale, masterScaleKeyframes, masterScaleLinked, metaByCompId,
    playbackRangeByCompId, renderItemsByCompId, selectedLayerId,
    selectedTimelineTarget, timelineItemsByCompId,
  } = options.readState;
  const readState = useMemo(() => ({
    comps, currentFrame, lastSelectedItemByCompId, masterEnabledProperties,
    masterOpacity, masterOpacityKeyframes, masterRotation, masterRotationKeyframes,
    masterScale, masterScaleKeyframes, masterScaleLinked, metaByCompId,
    playbackRangeByCompId, renderItemsByCompId, selectedLayerId,
    selectedTimelineTarget, timelineItemsByCompId,
  }), [
    comps,
    currentFrame,
    lastSelectedItemByCompId,
    masterEnabledProperties,
    masterOpacity,
    masterOpacityKeyframes,
    masterRotation,
    masterRotationKeyframes,
    masterScale,
    masterScaleKeyframes,
    masterScaleLinked,
    metaByCompId,
    playbackRangeByCompId,
    renderItemsByCompId,
    selectedLayerId,
    selectedTimelineTarget,
    timelineItemsByCompId,
  ]);
  const controller = useProjectHistoryController({
    historyRef: useProjectHistoryState(),
    readState,
    restorePort: options.restorePort,
  });
  const controllerRef = useRef(controller);
  useLayoutEffect(() => {
    controllerRef.current = controller;
  }, [controller]);
  const pushCompositionHistorySnapshot = useCallback((compId: string) => controllerRef.current.pushCompositionHistorySnapshot(compId), []);
  const beginCompositionHistoryCapture = useCallback((compId: string) => controllerRef.current.beginCompositionHistoryCapture(compId), []);
  const markCompositionHistoryCaptureDirty = useCallback((compId: string) => controllerRef.current.markCompositionHistoryCaptureDirty(compId), []);
  const commitCompositionHistoryCapture = useCallback((compId: string) => controllerRef.current.commitCompositionHistoryCapture(compId), []);
  const cancelCompositionHistoryCapture = useCallback((compId: string) => controllerRef.current.cancelCompositionHistoryCapture(compId), []);
  const clearCompositionHistory = useCallback((compId: string) => controllerRef.current.clearCompositionHistory(compId), []);
  const clearAllCompositionHistories = useCallback(() => controllerRef.current.clearAllCompositionHistories(), []);
  const undoCompositionHistory = useCallback((compId: string) => controllerRef.current.undoCompositionHistory(compId), []);
  const redoCompositionHistory = useCallback((compId: string) => controllerRef.current.redoCompositionHistory(compId), []);
  return useMemo(() => ({
    pushCompositionHistorySnapshot,
    beginCompositionHistoryCapture,
    markCompositionHistoryCaptureDirty,
    commitCompositionHistoryCapture,
    cancelCompositionHistoryCapture,
    clearCompositionHistory,
    clearAllCompositionHistories,
    undoCompositionHistory,
    redoCompositionHistory,
  }), [
    beginCompositionHistoryCapture,
    cancelCompositionHistoryCapture,
    clearAllCompositionHistories,
    clearCompositionHistory,
    commitCompositionHistoryCapture,
    markCompositionHistoryCaptureDirty,
    pushCompositionHistorySnapshot,
    redoCompositionHistory,
    undoCompositionHistory,
  ]);
}

export type ProjectHistory = ReturnType<typeof useProjectHistory>;

import type { MutableRefObject } from "react";
import { PROJECT_HISTORY_LIMIT } from "@/engines/project/constants/projectConstants";
import {
  captureProjectHistorySnapshot,
  restoreProjectHistorySnapshot,
  type ProjectHistoryReadState,
  type ProjectHistoryRestorePort,
} from "@/engines/project/history/projectHistorySnapshot";
import type {
  CompositionHistoryState,
  ProjectHistorySnapshot,
} from "@/engines/project/state/useProjectHistoryState";

type UseProjectHistoryControllerOptions = {
  historyRef: MutableRefObject<Record<string, CompositionHistoryState>>;
  readState: ProjectHistoryReadState;
  restorePort: ProjectHistoryRestorePort;
};

export function useProjectHistoryController({
  historyRef,
  readState,
  restorePort,
}: UseProjectHistoryControllerOptions) {
  const getHistoryState = (compId: string): CompositionHistoryState => {
    const existing = historyRef.current[compId];
    if (existing) return existing;

    const next: CompositionHistoryState = {
      past: [],
      future: [],
      pending: null,
      pendingDirty: false,
    };
    historyRef.current[compId] = next;
    return next;
  };

  const captureSnapshot = (compId: string) =>
    captureProjectHistorySnapshot(compId, readState);

  const pushPastSnapshot = (compId: string, snapshot: ProjectHistorySnapshot) => {
    const history = getHistoryState(compId);
    history.past = [
      ...history.past.slice(-(PROJECT_HISTORY_LIMIT - 1)),
      snapshot,
    ];
  };

  const pushCompositionHistorySnapshot = (compId: string) => {
    const history = getHistoryState(compId);
    pushPastSnapshot(compId, captureSnapshot(compId));
    history.future = [];
    history.pending = null;
    history.pendingDirty = false;
  };

  const beginCompositionHistoryCapture = (compId: string) => {
    const history = getHistoryState(compId);
    if (history.pending) {
      if (history.pendingDirty) {
        pushPastSnapshot(compId, history.pending);
        history.future = [];
      }
      history.pending = captureSnapshot(compId);
      history.pendingDirty = false;
      return;
    }
    history.pending = captureSnapshot(compId);
    history.pendingDirty = false;
  };

  const markCompositionHistoryCaptureDirty = (compId: string) => {
    const history = getHistoryState(compId);
    if (!history.pending) history.pending = captureSnapshot(compId);
    history.pendingDirty = true;
  };

  const commitCompositionHistoryCapture = (compId: string) => {
    const history = getHistoryState(compId);
    if (!history.pending) return;
    if (history.pendingDirty) {
      pushPastSnapshot(compId, history.pending);
      history.future = [];
    }
    history.pending = null;
    history.pendingDirty = false;
  };

  const cancelCompositionHistoryCapture = (compId: string) => {
    const history = getHistoryState(compId);
    history.pending = null;
    history.pendingDirty = false;
  };

  const clearCompositionHistory = (compId: string) => {
    delete historyRef.current[compId];
  };

  const clearAllCompositionHistories = () => {
    historyRef.current = {};
  };

  const undoCompositionHistory = (compId: string) => {
    const history = getHistoryState(compId);
    const previous = history.past.at(-1);
    if (!previous) return;

    const current = captureSnapshot(compId);
    history.past = history.past.slice(0, -1);
    history.future = [current, ...history.future].slice(0, PROJECT_HISTORY_LIMIT);
    history.pending = null;
    history.pendingDirty = false;
    restoreProjectHistorySnapshot(previous, restorePort);
  };

  const redoCompositionHistory = (compId: string) => {
    const history = getHistoryState(compId);
    const next = history.future[0];
    if (!next) return;

    pushPastSnapshot(compId, captureSnapshot(compId));
    history.future = history.future.slice(1);
    history.pending = null;
    history.pendingDirty = false;
    restoreProjectHistorySnapshot(next, restorePort);
  };

  return {
    pushCompositionHistorySnapshot,
    beginCompositionHistoryCapture,
    markCompositionHistoryCaptureDirty,
    commitCompositionHistoryCapture,
    cancelCompositionHistoryCapture,
    clearCompositionHistory,
    clearAllCompositionHistories,
    undoCompositionHistory,
    redoCompositionHistory,
  };
}

export type ProjectHistoryController = ReturnType<
  typeof useProjectHistoryController
>;

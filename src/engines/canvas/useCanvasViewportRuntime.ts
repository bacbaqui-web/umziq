import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import {
  useCanvasPanController,
  type CanvasPanDragState,
} from "@/engines/canvas/controllers/useCanvasPanController";
import { useCanvasViewportController } from "@/engines/canvas/controllers/useCanvasViewportController";
import { useCanvasWorkspaceController } from "@/engines/canvas/controllers/useCanvasWorkspaceController";
import {
  getCanvasViewportValues,
  getCenteredCanvasPan,
} from "@/engines/canvas/helpers/canvasViewportHelpers";
import type {
  CanvasViewportProjectReadPort,
  CanvasViewportCoreStatePort,
} from "@/engines/canvas/models/canvasEngineModel";

export function useCanvasViewportRuntime({
  minWorkspaceWidth,
  minWorkspaceHeight,
  shortformFrameWidth,
  shortformFrameHeight,
  project,
  state,
}: {
  minWorkspaceWidth: number;
  minWorkspaceHeight: number;
  shortformFrameWidth: number;
  shortformFrameHeight: number;
  project: CanvasViewportProjectReadPort;
  state: CanvasViewportCoreStatePort;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const pendingInitialViewRef = useRef(false);
  const panDragRef = useRef<CanvasPanDragState | null>(null);
  const panModifierRef = useRef(false);
  const values = useMemo(
    () =>
      getCanvasViewportValues({
        minWorkspaceWidth,
        minWorkspaceHeight,
        workspaceSize: state.previewWorkspaceSize,
        selectedMeta: project.selectedMeta,
        shortformFrameWidth,
        shortformFrameHeight,
        zoom: state.previewZoom,
        pan: state.previewPan,
      }),
    [
      minWorkspaceHeight,
      minWorkspaceWidth,
      project.selectedMeta,
      shortformFrameHeight,
      shortformFrameWidth,
      state.previewPan,
      state.previewWorkspaceSize,
      state.previewZoom,
    ]
  );
  const commands = useCanvasViewportController({
    viewportRef,
    baseOffset: values.previewBaseOffset,
    previewSize: values.previewSize,
    zoom: state.previewZoom,
    pan: state.previewPan,
    fitZoom: values.previewFitZoom,
    setZoom: state.setPreviewZoom,
    setPan: state.setPreviewPan,
  });
  const pan = useCanvasPanController({
    zoom: state.previewZoom,
    pan: state.previewPan,
    viewportRef,
    panDragRef,
    panModifierRef,
    setPan: state.setPreviewPan,
    applyZoom: commands.applyZoom,
  });
  useCanvasWorkspaceController({
    workspaceRef,
    setWorkspaceSize: state.setPreviewWorkspaceSize,
  });

  const applyInitialView = useEffectEvent(() => {
    state.setPreviewZoom(values.previewFitZoom);
    state.setPreviewPan(
      getCenteredCanvasPan(
        values.previewSize.width,
        values.previewSize.height,
        values.previewFitZoom
      )
    );
  });
  useEffect(() => {
    pendingInitialViewRef.current = true;
  }, [project.selectedCompId, project.selectedMeta?.height, project.selectedMeta?.width]);
  useEffect(() => {
    if (
      !pendingInitialViewRef.current ||
      !project.selectedMeta ||
      state.previewWorkspaceSize.width <= 0 ||
      state.previewWorkspaceSize.height <= 0
    ) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      applyInitialView();
      pendingInitialViewRef.current = false;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    project.selectedMeta,
    state.previewWorkspaceSize.height,
    state.previewWorkspaceSize.width,
  ]);

  return {
    viewportRef,
    workspaceRef,
    readModel: {
      ...values,
      previewZoom: state.previewZoom,
      previewPan: state.previewPan,
    },
    commands,
    pan,
  };
}

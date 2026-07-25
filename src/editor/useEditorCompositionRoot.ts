import {
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import {
  PREVIEW_MIN_WORKSPACE_HEIGHT,
  PREVIEW_MIN_WORKSPACE_WIDTH,
  SHORTFORM_FRAME_HEIGHT,
  SHORTFORM_FRAME_WIDTH,
  useLayerDocumentCanvasComposition,
} from "@/engines/canvas";
import type {
  RendererMode,
} from "@/engines/playback-render";
import type {
  EditorShellLayoutProps,
} from "@/editor/EditorShellLayout";
import {
  useEditorCanvasRuntimeState,
} from "@/editor/state/useEditorCanvasRuntimeState";
import {
  useEditorShellLayoutState,
} from "@/editor/state/useEditorShellLayoutState";
import {
  useEditorHistoryShortcuts,
} from "@/editor/useEditorHistoryShortcuts";
import {
  useEditorShellLayout,
} from "@/editor/useEditorShellLayout";
import {
  useLayerDocumentEditorOwner,
} from "@/editor/useLayerDocumentEditorOwner";

export function useEditorCompositionRoot():
EditorShellLayoutProps {
  const shell = useEditorShellLayoutState();
  const canvasState = useEditorCanvasRuntimeState(
    PREVIEW_MIN_WORKSPACE_WIDTH,
    PREVIEW_MIN_WORKSPACE_HEIGHT
  );
  const [rendererMode, setRendererMode] =
    useState<RendererMode>("full-render");
  const layerDocument =
    useLayerDocumentEditorOwner("original");
  const canvas =
    useLayerDocumentCanvasComposition({
      readPort: layerDocument.canvasReadPort,
      commandPort:
        layerDocument.canvasCommandPort,
      resources: layerDocument.resources,
      viewportState: canvasState,
      interactionState: canvasState,
      rendererMode,
      setRendererMode,
      isPreviewPanning:
        canvasState.isPreviewPanning,
      isPreviewPanModifierActive:
        canvasState.isPreviewPanModifierActive,
      setIsPreviewPanning:
        canvasState.setIsPreviewPanning,
      setIsPreviewPanModifierActive:
        canvasState
          .setIsPreviewPanModifierActive,
      minWorkspaceWidth:
        PREVIEW_MIN_WORKSPACE_WIDTH,
      minWorkspaceHeight:
        PREVIEW_MIN_WORKSPACE_HEIGHT,
      shortformFrameWidth:
        SHORTFORM_FRAME_WIDTH,
      shortformFrameHeight:
        SHORTFORM_FRAME_HEIGHT,
      resetRevision:
        layerDocument.ownerEffect.revision,
    });
  const resetCanvasRuntime = useEffectEvent(() => {
    canvasState.setIsDraggingAnchor(false);
    canvasState.setIsDraggingPosition(false);
    canvasState.setIsDraggingScale(false);
    canvasState.setIsDraggingOpacity(false);
    canvasState.setIsDraggingRotation(false);
    canvasState
      .setIsDraggingMotionPathKeyframe(false);
    canvasState.setPositionHandleReadout(null);
    canvasState.setOpacityHandleReadout(null);
    canvasState.setRotationHandleReadout(null);
    canvasState.setScaleHandleReadout(null);
    canvasState
      .setMotionPathKeyframeReadout(null);
    canvasState.setDraggingMotionPathFrame(null);
    canvasState.setHoveredHandle(null);
    canvasState.setHoveredMotionFrame(null);
    canvasState
      .setPendingHandleInteraction(null);
    canvasState
      .setPendingMotionPathInteraction(null);
    canvasState
      .setSuppressedMotionPathClickFrame(null);
    canvasState.setIsAnchorHovered(false);
    canvasState.setDirectInput(null);
  });
  useEffect(() => {
    resetCanvasRuntime();
  }, [layerDocument.ownerEffect.revision]);
  const { startPanelResize } =
    useEditorShellLayout({
      leftPanelWidth: shell.leftPanelWidth,
      rightPanelWidth: shell.rightPanelWidth,
      setLeftPanelWidth:
        shell.setLeftPanelWidth,
      setRightPanelWidth:
        shell.setRightPanelWidth,
      setTimelinePanelHeight:
        shell.setTimelinePanelHeight,
      activePanelResize:
        shell.activePanelResize,
      setActivePanelResize:
        shell.setActivePanelResize,
      isDraggingAnchor:
        canvasState.isDraggingAnchor,
      isDraggingPosition:
        canvasState.isDraggingPosition,
      isDraggingMotionPathKeyframe:
        canvasState
          .isDraggingMotionPathKeyframe,
      isDraggingRotation:
        canvasState.isDraggingRotation,
      isPreviewPanning:
        canvasState.isPreviewPanning,
    });
  useEditorHistoryShortcuts({
    undo: layerDocument.assembly.project.undo,
    redo: layerDocument.assembly.project.redo,
  });
  return {
    leftPanelWidth: shell.leftPanelWidth,
    rightPanelWidth: shell.rightPanelWidth,
    timelinePanelHeight:
      shell.timelinePanelHeight,
    activePanelResize:
      shell.activePanelResize,
    onStartLeftResize: (
      clientX,
      clientY
    ) => startPanelResize(
      "left",
      clientX,
      clientY,
      shell.leftPanelWidth
    ),
    onStartRightResize: (
      clientX,
      clientY
    ) => startPanelResize(
      "right",
      clientX,
      clientY,
      shell.rightPanelWidth
    ),
    onStartBottomResize: (
      clientX,
      clientY
    ) => startPanelResize(
      "bottom",
      clientX,
      clientY,
      shell.timelinePanelHeight
    ),
    psdTreeProps:
      layerDocument.psdTreeProps,
    previewPaneProps: canvas.viewProps,
    propertiesPanelProps:
      layerDocument.propertiesPanelProps,
    timelinePanelProps:
      layerDocument.timelinePanelProps,
  };
}

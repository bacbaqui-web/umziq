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
import {
  formatCompactTime,
  type RendererMode,
} from "@/engines/playback-render";
import {
  useLayerDocumentPropertiesEngine,
} from "@/engines/properties";
import {
  useLayerDocumentPsdTreeEngine,
} from "@/engines/psd-tree";
import {
  TIMELINE_NAME_COL_WIDTH,
  TIMELINE_PX_PER_FRAME,
  useLayerDocumentTimelineEngine,
} from "@/engines/timeline";
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
import {
  useLayerDocumentEditorRuntime,
} from "@/editor/useLayerDocumentEditorRuntime";
import {
  useLayerDocumentPanelEnginePorts,
} from "@/editor/useLayerDocumentPanelEnginePorts";

export function useEditorCompositionRoot():
EditorShellLayoutProps {
  const shell = useEditorShellLayoutState();
  const canvasState = useEditorCanvasRuntimeState(
    PREVIEW_MIN_WORKSPACE_WIDTH,
    PREVIEW_MIN_WORKSPACE_HEIGHT
  );
  const [rendererMode, setRendererMode] =
    useState<RendererMode>("full-render");
  const owner = useLayerDocumentEditorOwner();
  const runtime =
    useLayerDocumentEditorRuntime(owner);
  const panelPorts =
    useLayerDocumentPanelEnginePorts({
      assembly: runtime.assembly,
      draftSession: runtime.draftSession,
      frameInput: runtime.playback,
      quality: "original",
    });
  const scope = runtime.assembly.scope.read();
  if (!scope.ok) {
    throw new Error(
      `LayerDocument scope unavailable: ${scope.reason}`
    );
  }
  const timeline =
    useLayerDocumentTimelineEngine({
      assembly: runtime.assembly,
      playback: runtime.playback,
      nameColumnWidth:
        TIMELINE_NAME_COL_WIDTH,
      defaultPxPerFrame:
        TIMELINE_PX_PER_FRAME,
      allocateLayerDocumentId:
        panelPorts.allocateLayerDocumentId,
      sourceStatus: panelPorts.sourceStatus,
      formatTime: formatCompactTime,
      resetRevision:
        runtime.ownerEffect.localUiRevision,
    });
  const properties =
    useLayerDocumentPropertiesEngine({
      port: panelPorts.properties,
      formatTime: formatCompactTime,
      resetRevision:
        runtime.ownerEffect.localUiRevision,
    });
  const psdTree =
    useLayerDocumentPsdTreeEngine({
      controller:
        panelPorts.psdTreeController,
      parentLayerDocumentId:
        scope.model.activeGroup.layerDocumentId,
      durationFrames:
        scope.model.activeGroup.data
          .durationFrames,
      nextOrder:
        panelPorts.nextPsdLayerOrder,
      cacheContext:
        panelPorts.readPsdCacheContext,
    });
  const canvas =
    useLayerDocumentCanvasComposition({
      readPort: panelPorts.canvasRead,
      commandPort: panelPorts.canvasCommands,
      resources: runtime.resources,
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
        runtime.ownerEffect.revision,
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
  }, [runtime.ownerEffect.revision]);
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
    undo: runtime.assembly.project.undo,
    redo: runtime.assembly.project.redo,
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
      psdTree.viewProps,
    previewPaneProps: canvas.viewProps,
    propertiesPanelProps:
      properties.viewProps,
    timelinePanelProps:
      timeline.viewProps,
    projectLifecycleProps:
      runtime.projectLifecycleProps,
  };
}

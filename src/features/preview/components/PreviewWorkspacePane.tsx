import { useEffect } from "react";
import PreviewInteractionOverlay from "@/features/preview/components/PreviewInteractionOverlay";
import PreviewCanvasFpsBadge from "@/features/preview/components/PreviewCanvasFpsBadge";
import PreviewViewportLayers from "@/features/preview/components/PreviewViewportLayers";
import PreviewWorkspaceControls from "@/features/preview/components/PreviewWorkspaceControls";
import { resolveCanvasPreviewCursor } from "@/engines/canvas";
import {
  isCanvasTransformDragActive,
  shouldRunCanvasDirectSelectionHover,
} from "@/engines/canvas";
import type {
  CanvasPreviewPaneProps,
} from "@/engines/canvas";

export default function PreviewWorkspacePane({
  selectedLayerDocumentId,
  selectedSourceId,
  activeScene,
  previewWorkspaceRef,
  previewViewportRef,
  previewCanvasRef,
  previewOverlayRef,
  previewBaseOffset,
  previewPan,
  previewZoom,
  previewZoomPercent,
  previewQuality,
  previewQualityCommands,
  canvasFpsRuntime,
  previewSize,
  previewViewportWidth,
  previewViewportHeight,
  guide,
  toggleShortformFrame,
  toggleSafeZone,
  showSelectionHighlight,
  toggleSelectionHighlight,
  resetPreviewView,
  setOneToOnePreviewView,
  centerPreviewView,
  handlePreviewViewportWheel,
  handlePreviewViewportMouseDownCapture,
  isPreviewPanning,
  isPreviewPanModifierActive,
  interactionViewModel,
  selectionHighlight,
  directSelectionHover,
  interactionCommands,
}: CanvasPreviewPaneProps) {
  const isTransformDragging = isCanvasTransformDragActive(interactionViewModel);
  useEffect(() => {
    if (isTransformDragging) directSelectionHover.leaveTarget();
  }, [directSelectionHover, isTransformDragging]);

  return (
    <div
      style={{
        gridColumn: "3",
        gridRow: "1",
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        background:
          "radial-gradient(circle at top, rgba(34,40,46,0.82) 0%, rgba(20,24,28,0.96) 42%, rgba(14,16,18,1) 100%)",
      }}
    >
      <div
        ref={previewWorkspaceRef}
        style={{
          position: "absolute",
          inset: 0,
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {activeScene ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "#171a1d",
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.035) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.035) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.035) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.035) 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
              overflow: "hidden",
              cursor: resolveCanvasPreviewCursor({
                isPreviewPanning,
                isPreviewPanModifierActive,
                isDraggingPosition: interactionViewModel.isDraggingPosition,
                isAlphaHit: directSelectionHover.isAlphaHit,
              }),
            }}
            ref={previewViewportRef}
            onWheel={handlePreviewViewportWheel}
            onMouseDownCapture={(event) => {
              directSelectionHover.leaveTarget();
              handlePreviewViewportMouseDownCapture(event);
            }}
            onMouseMove={(event) => {
              const target = event.target;
              const isExcludedTarget = Boolean(
                target instanceof Element && target.closest(
                  ".preview-toolbar,button,input,select,textarea,[contenteditable='true']"
                )
              );
              if (!shouldRunCanvasDirectSelectionHover({
                isPreviewPanning,
                isPreviewPanModifierActive,
                isTransformDragging,
                isExcludedTarget,
              })) {
                directSelectionHover.leaveTarget();
                return;
              }
              directSelectionHover.moveTarget(event.clientX, event.clientY);
            }}
            onMouseLeave={directSelectionHover.leaveTarget}
            onMouseDown={(event) => {
              if (event.button !== 0 || event.detail >= 2) return;
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest(
                  ".preview-toolbar,button,input,select,textarea,[contenteditable='true']"
                )
              ) return;
              interactionCommands.pressTarget(event.clientX, event.clientY);
            }}
            onDoubleClick={(event) => {
              if (
                event.button !== 0 ||
                isPreviewPanning ||
                isPreviewPanModifierActive ||
                isTransformDragging
              ) return;
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest(
                  ".preview-toolbar,button,input,select,textarea,[contenteditable='true']"
                )
              ) return;
              directSelectionHover.doubleClickTarget(event.clientX, event.clientY);
            }}
          >
            <PreviewWorkspaceControls
              previewZoomPercent={previewZoomPercent}
              showShortformFrameOverlay={guide.showShortformFrame}
              toggleShortformFrame={toggleShortformFrame}
              showSafeZoneGuides={guide.showSafeZoneGuides}
              toggleSafeZone={toggleSafeZone}
              showSelectionHighlight={showSelectionHighlight}
              toggleSelectionHighlight={toggleSelectionHighlight}
              resetPreviewView={resetPreviewView}
              setOneToOnePreviewView={setOneToOnePreviewView}
              centerPreviewView={centerPreviewView}
              previewQuality={previewQuality}
              previewQualityCommands={previewQualityCommands}
            />
            <PreviewCanvasFpsBadge runtime={canvasFpsRuntime} />
            <PreviewViewportLayers
              selectedLayerDocumentId={
                selectedLayerDocumentId
              }
              selectedSourceId={selectedSourceId}
              previewCanvasRef={previewCanvasRef}
              previewBaseOffset={previewBaseOffset}
              previewPan={previewPan}
              previewZoom={previewZoom}
              previewSize={previewSize}
              guide={guide}
            />
            <PreviewInteractionOverlay
              previewOverlayRef={previewOverlayRef}
              previewViewportWidth={previewViewportWidth}
              previewViewportHeight={previewViewportHeight}
              viewModel={interactionViewModel}
              selectionHighlight={selectionHighlight}
              commands={interactionCommands}
            />
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#7f8a95",
              fontSize: 14,
              letterSpacing: 0.2,
            }}
          >
            Preview
          </div>
        )}
      </div>
    </div>
  );
}

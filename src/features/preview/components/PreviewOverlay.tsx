import type { RefObject } from "react";
import { createPortal } from "react-dom";
import type {
  CanvasGizmoViewModel,
  CanvasInteractionCommands,
  CanvasSelectionHighlightViewModel,
} from "@/engines/canvas";
import {
  CANVAS_SELECTION_HIGHLIGHT_POINTER_EVENTS,
  CANVAS_SELECTION_OVERLAY_LAYER_ORDER,
} from "@/engines/canvas";
import PreviewGizmoLayer from "@/features/preview/components/PreviewGizmoLayer";
import PreviewMotionPathLayer from "@/features/preview/components/PreviewMotionPathLayer";

type PreviewOverlayProps = {
  overlayRef: RefObject<HTMLDivElement | null>;
  viewportSize: { width: number; height: number };
  viewModel: CanvasGizmoViewModel;
  selectionHighlight: CanvasSelectionHighlightViewModel;
  commands: CanvasInteractionCommands;
};

export default function PreviewOverlay({
  overlayRef,
  viewportSize,
  viewModel,
  selectionHighlight: { attachCanvas: attachSelectionHighlightCanvas },
  commands,
}: PreviewOverlayProps) {
  const isTransformHandleDragging =
    viewModel.isDraggingAnchor ||
    viewModel.isDraggingPosition ||
    viewModel.isDraggingScale ||
    viewModel.isDraggingRotation ||
    viewModel.isDraggingOpacity;

  return (
    <>
      <div
        ref={overlayRef}
        style={{
          position: "absolute",
          width: viewportSize.width,
          height: viewportSize.height,
          pointerEvents: "none",
          cursor: isTransformHandleDragging ? "none" : "default",
        }}
      >
        <canvas
          ref={attachSelectionHighlightCanvas}
          aria-hidden="true"
          data-canvas-overlay-layer={CANVAS_SELECTION_OVERLAY_LAYER_ORDER[0]}
          style={{
            position: "absolute",
            inset: 0,
            width: viewportSize.width,
            height: viewportSize.height,
            pointerEvents: CANVAS_SELECTION_HIGHLIGHT_POINTER_EVENTS,
          }}
        />
        <svg
          data-canvas-overlay-layer={CANVAS_SELECTION_OVERLAY_LAYER_ORDER[1]}
          width={viewportSize.width}
          height={viewportSize.height}
          viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <PreviewMotionPathLayer
            points={viewModel.motionPathPoints}
            motionPathPolyline={viewModel.motionPathPolyline}
            motionPathDragReadout={viewModel.motionPathDragReadout}
            onHoverMotionFrame={commands.hoverMotionFrame}
            onPressMotionPathDot={commands.pressMotionPathPoint}
            onClickMotionPathDot={commands.selectMotionPathPoint}
          />
        </svg>

        <div
          data-canvas-overlay-layer={CANVAS_SELECTION_OVERLAY_LAYER_ORDER[2]}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <PreviewGizmoLayer
            isVisible={viewModel.isVisible}
            cursors={viewModel.cursors}
            viewportSize={viewportSize}
            previewAnchor={viewModel.previewAnchor}
            previewMoveHandle={viewModel.previewMoveHandle}
            previewRotationHandle={viewModel.previewRotationHandle}
            previewOpacityHandle={viewModel.previewOpacityHandle}
            previewScaleHandles={viewModel.previewScaleHandles}
            hoveredHandle={viewModel.hoveredHandle}
            isDraggingAnchor={viewModel.isDraggingAnchor}
            isDraggingPosition={viewModel.isDraggingPosition}
            isDraggingOpacity={viewModel.isDraggingOpacity}
            isDraggingRotation={viewModel.isDraggingRotation}
            positionReadout={viewModel.positionReadout}
            opacityReadout={viewModel.opacityReadout}
            rotationReadout={viewModel.rotationReadout}
            scaleReadout={viewModel.scaleReadout}
            activeScaleHandle={viewModel.activeScaleHandle}
            directInput={viewModel.directInput}
            anchorOpacity={viewModel.anchorOpacity}
            isAnchorHovered={viewModel.isAnchorHovered}
            onPressMove={commands.pressMove}
            onPressRotation={commands.pressRotation}
            onPressOpacity={commands.pressOpacity}
            onPressScale={commands.pressScale}
            onHoverHandle={commands.hoverHandle}
            onOpenRotationInput={commands.openRotationInput}
            onOpenOpacityInput={commands.openOpacityInput}
            onOpenScaleInput={commands.openScaleInput}
            onDirectInputChange={commands.changeDirectInput}
            onDirectInputKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commands.commitDirectInput();
              } else if (event.key === "Escape") {
                event.preventDefault();
                commands.closeDirectInput();
              }
            }}
            onCloseDirectInput={commands.closeDirectInput}
            onCommitDirectInput={commands.commitDirectInput}
            onAnchorMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              commands.pressAnchor();
            }}
            onAnchorHoverChange={commands.hoverAnchor}
          />
        </div>
      </div>
      {isTransformHandleDragging &&
        createPortal(
          <div
            aria-hidden="true"
            data-canvas-transform-drag-cursor-shield="active"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483647,
              cursor: "none",
              pointerEvents: "auto",
            }}
          />,
          document.body,
        )}
    </>
  );
}

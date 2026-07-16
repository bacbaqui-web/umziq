import type { RefObject } from "react";
import type {
  CanvasGizmoViewModel,
  CanvasInteractionCommands,
} from "@/engines/canvas";
import PreviewGizmoLayer from "@/features/preview/components/PreviewGizmoLayer";
import PreviewMotionPathLayer from "@/features/preview/components/PreviewMotionPathLayer";

type PreviewOverlayProps = {
  overlayRef: RefObject<HTMLDivElement | null>;
  viewportSize: { width: number; height: number };
  viewModel: CanvasGizmoViewModel;
  commands: CanvasInteractionCommands;
};

export default function PreviewOverlay({
  overlayRef,
  viewportSize,
  viewModel,
  commands,
}: PreviewOverlayProps) {
  return (
    <div
      ref={overlayRef}
      style={{
        position: "absolute",
        width: viewportSize.width,
        height: viewportSize.height,
        pointerEvents: "none",
        cursor: viewModel.isDraggingAnchor ? "none" : "default",
      }}
    >
      <svg
        width={viewportSize.width}
        height={viewportSize.height}
        viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
        style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
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

      <PreviewGizmoLayer
        isVisible={viewModel.isVisible}
        cursors={viewModel.cursors}
        viewportSize={viewportSize}
        previewCorners={viewModel.previewCorners}
        polygonPoints={viewModel.polygonPoints}
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
        onTargetMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          commands.pressTarget(event.clientX, event.clientY);
        }}
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
  );
}

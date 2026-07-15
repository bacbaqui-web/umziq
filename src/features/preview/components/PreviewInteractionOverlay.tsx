import type { MouseEventHandler, RefObject } from "react";
import PreviewOverlay from "@/features/preview/components/PreviewOverlay";
import type { CompositionMeta, Scale } from "@/editor/types/types";
import type {
  PreviewMotionPathPoint,
  PreviewOverlay as PreviewOverlayData,
  ScaleHandleDirection,
} from "@/editor/types/editorViewTypes";

type PreviewInteractionOverlayProps = {
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  previewZoom: number;
  previewViewportOffset: {
    x: number;
    y: number;
  };
  previewViewportWidth: number;
  previewViewportHeight: number;
  previewSize: {
    width: number;
    height: number;
  };
  selectedMeta: CompositionMeta;
  overlay: PreviewOverlayData;
  motionPath: PreviewMotionPathPoint[];
  currentOpacity: number;
  currentRotation: number;
  currentScale: Scale;
  isDraggingAnchor: boolean;
  isDraggingPosition: boolean;
  isDraggingOpacity: boolean;
  isDraggingRotation: boolean;
  positionReadout: string | null;
  opacityReadout: string | null;
  rotationReadout: string | null;
  scaleReadout: {
    handle: ScaleHandleDirection;
    text: string;
  } | null;
  onStartScaleDrag: (handle: ScaleHandleDirection) => void;
  onStartMoveDrag: (clientX: number, clientY: number) => void;
  onStartOpacityDrag: () => void;
  onStartRotationDrag: (clientX: number, clientY: number) => void;
  onTargetMouseDown: MouseEventHandler<SVGPolygonElement>;
  onAnchorMouseDown: MouseEventHandler<HTMLDivElement>;
  onMotionPathDotClick: (frame: number, isKeyframe: boolean) => void;
  onStartMotionPathKeyframeDrag: (frame: number, clientX: number, clientY: number) => void;
  draggingMotionPathFrame: number | null;
  motionPathDragReadout: string | null;
  onCommitScaleInput: (handle: ScaleHandleDirection, value: number) => void;
  onCommitRotationInput: (value: number) => void;
  onCommitOpacityInput: (value: number) => void;
};

export default function PreviewInteractionOverlay({
  previewOverlayRef,
  previewZoom,
  previewViewportOffset,
  previewViewportWidth,
  previewViewportHeight,
  previewSize,
  selectedMeta,
  overlay,
  motionPath,
  currentOpacity,
  currentRotation,
  currentScale,
  isDraggingAnchor,
  isDraggingPosition,
  isDraggingOpacity,
  isDraggingRotation,
  positionReadout,
  opacityReadout,
  rotationReadout,
  scaleReadout,
  onStartScaleDrag,
  onStartMoveDrag,
  onStartOpacityDrag,
  onStartRotationDrag,
  onTargetMouseDown,
  onAnchorMouseDown,
  onMotionPathDotClick,
  onStartMotionPathKeyframeDrag,
  draggingMotionPathFrame,
  motionPathDragReadout,
  onCommitScaleInput,
  onCommitRotationInput,
  onCommitOpacityInput,
}: PreviewInteractionOverlayProps) {
  return (
    <PreviewOverlay
      overlayRef={previewOverlayRef}
      viewportScale={previewZoom}
      viewportOffset={previewViewportOffset}
      viewportSize={{
        width: previewViewportWidth,
        height: previewViewportHeight,
      }}
      previewSize={previewSize}
      selectedMeta={selectedMeta}
      overlay={overlay}
      motionPath={motionPath}
      currentOpacity={currentOpacity}
      currentRotation={currentRotation}
      currentScale={currentScale}
      isDraggingAnchor={isDraggingAnchor}
      isDraggingPosition={isDraggingPosition}
      isDraggingOpacity={isDraggingOpacity}
      isDraggingRotation={isDraggingRotation}
      positionReadout={positionReadout}
      opacityReadout={opacityReadout}
      rotationReadout={rotationReadout}
      scaleReadout={scaleReadout}
      onStartScaleDrag={onStartScaleDrag}
      onStartMoveDrag={onStartMoveDrag}
      onStartOpacityDrag={onStartOpacityDrag}
      onStartRotationDrag={onStartRotationDrag}
      onTargetMouseDown={onTargetMouseDown}
      onAnchorMouseDown={onAnchorMouseDown}
      onMotionPathDotClick={onMotionPathDotClick}
      onStartMotionPathKeyframeDrag={onStartMotionPathKeyframeDrag}
      draggingMotionPathFrame={draggingMotionPathFrame}
      motionPathDragReadout={motionPathDragReadout}
      onCommitScaleInput={onCommitScaleInput}
      onCommitRotationInput={onCommitRotationInput}
      onCommitOpacityInput={onCommitOpacityInput}
    />
  );
}

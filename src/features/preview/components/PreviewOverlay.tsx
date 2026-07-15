import { type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import type { CompositionMeta, Scale } from "@/editor/types/types";
import type {
  PreviewMotionPathPoint,
  PreviewOverlay as PreviewOverlayData,
  ScaleHandleDirection,
} from "@/editor/types/editorViewTypes";
import PreviewGizmoLayer from "@/features/preview/components/PreviewGizmoLayer";
import PreviewMotionPathLayer from "@/features/preview/components/PreviewMotionPathLayer";
import { buildPreviewOverlayViewModel } from "@/features/preview/geometry/previewOverlayGeometry";
import { usePreviewOverlayState } from "@/features/preview/hooks/usePreviewOverlayState";

type PreviewOverlayProps = {
  overlayRef: RefObject<HTMLDivElement | null>;
  viewportScale: number;
  viewportOffset: {
    x: number;
    y: number;
  };
  viewportSize: {
    width: number;
    height: number;
  };
  previewSize: {
    width: number;
    height: number;
  };
  selectedMeta: CompositionMeta;
  overlay: PreviewOverlayData | null;
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
  onTargetMouseDown: (event: ReactMouseEvent<SVGPolygonElement>) => void;
  onAnchorMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onMotionPathDotClick: (frame: number, isKeyframe: boolean) => void;
  onStartMotionPathKeyframeDrag: (frame: number, clientX: number, clientY: number) => void;
  draggingMotionPathFrame: number | null;
  motionPathDragReadout: string | null;
  onCommitScaleInput: (handle: ScaleHandleDirection, value: number) => void;
  onCommitRotationInput: (value: number) => void;
  onCommitOpacityInput: (value: number) => void;
};

const DRAG_START_THRESHOLD = 4;

export default function PreviewOverlay({
  overlayRef,
  viewportScale,
  viewportOffset,
  viewportSize,
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
}: PreviewOverlayProps) {
  const {
    previewCorners,
    previewAnchor,
    previewRotationHandle,
    previewOpacityHandle,
    previewMoveHandle,
    previewScaleHandles,
    previewMotionPath,
    protectedControlPoints,
    polygonPoints,
    motionPathPolyline,
  } = buildPreviewOverlayViewModel({
    viewportScale,
    viewportOffset,
    previewSize,
    selectedMeta,
    overlay,
    motionPath,
    currentOpacity,
  });
  const {
    hoveredHandle,
    setHoveredHandle,
    hoveredMotionFrame,
    setHoveredMotionFrame,
    setPendingMotionPathInteraction,
    suppressedMotionPathClickFrame,
    setSuppressedMotionPathClickFrame,
    isAnchorHovered,
    setIsAnchorHovered,
    pendingHandleInteraction,
    setPendingHandleInteraction,
    directInput,
    setDirectInput,
    openRotationInput,
    openOpacityInput,
    openScaleInput,
    commitDirectInput,
    closeDirectInput,
    handleDirectInputKeyDown,
  } = usePreviewOverlayState({
    currentOpacity,
    currentRotation,
    currentScale,
    previewRotationHandle,
    previewOpacityHandle,
    onStartScaleDrag,
    onStartMoveDrag,
    onStartOpacityDrag,
    onStartRotationDrag,
    onStartMotionPathKeyframeDrag,
    onCommitScaleInput,
    onCommitRotationInput,
    onCommitOpacityInput,
    dragStartThreshold: DRAG_START_THRESHOLD,
  });

  const activeScaleHandle = scaleReadout
    ? previewScaleHandles.find((handle) => handle.key === scaleReadout.handle) ?? null
    : null;
  const currentMotionFrame =
    previewMotionPath.find((point) => point.isCurrent)?.frame ?? null;
  const anchorOpacity = isDraggingAnchor ? 1 : isAnchorHovered ? 0.96 : 0.005;
  const motionPathInteractionLocked =
    hoveredHandle !== null ||
    isDraggingAnchor ||
    isDraggingPosition ||
    isDraggingOpacity ||
    isDraggingRotation ||
    pendingHandleInteraction !== null ||
    directInput !== null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "absolute",
        width: viewportSize.width,
        height: viewportSize.height,
        pointerEvents: "none",
        cursor: isDraggingAnchor ? "none" : "default",
      }}
    >
      <svg
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
          previewMotionPath={previewMotionPath}
          motionPathPolyline={motionPathPolyline}
          protectedControlPoints={protectedControlPoints}
          currentMotionFrame={currentMotionFrame}
          hoveredMotionFrame={hoveredMotionFrame}
          draggingMotionPathFrame={draggingMotionPathFrame}
          motionPathInteractionLocked={motionPathInteractionLocked}
          motionPathDragReadout={motionPathDragReadout}
          suppressedMotionPathClickFrame={suppressedMotionPathClickFrame}
          onHoverMotionFrame={setHoveredMotionFrame}
          onPressMotionPathDot={(frame, isKeyframe, clientX, clientY) => {
            setPendingMotionPathInteraction({
              frame,
              isKeyframe,
              startClientX: clientX,
              startClientY: clientY,
            });
          }}
          onClickMotionPathDot={(frame, isKeyframe, suppressedClickFrame) => {
            if (suppressedClickFrame === frame) {
              setSuppressedMotionPathClickFrame(null);
              return;
            }
            onMotionPathDotClick(frame, isKeyframe);
          }}
        />
      </svg>

      <PreviewGizmoLayer
        viewportSize={viewportSize}
        previewCorners={previewCorners}
        polygonPoints={polygonPoints}
        previewAnchor={previewAnchor}
        previewMoveHandle={previewMoveHandle}
        previewRotationHandle={previewRotationHandle}
        previewOpacityHandle={previewOpacityHandle}
        previewScaleHandles={previewScaleHandles}
        hoveredHandle={hoveredHandle}
        isDraggingAnchor={isDraggingAnchor}
        isDraggingPosition={isDraggingPosition}
        isDraggingOpacity={isDraggingOpacity}
        isDraggingRotation={isDraggingRotation}
        positionReadout={positionReadout}
        opacityReadout={opacityReadout}
        rotationReadout={rotationReadout}
        scaleReadout={scaleReadout}
        activeScaleHandle={activeScaleHandle}
        directInput={directInput}
        anchorOpacity={anchorOpacity}
        isAnchorHovered={isAnchorHovered}
        onTargetMouseDown={onTargetMouseDown}
        onPressMove={(clientX, clientY) => {
          setPendingHandleInteraction({
            kind: "move",
            startClientX: clientX,
            startClientY: clientY,
          });
        }}
        onPressRotation={(clientX, clientY) => {
          setPendingHandleInteraction({
            kind: "rotation",
            startClientX: clientX,
            startClientY: clientY,
          });
        }}
        onPressOpacity={(clientX, clientY) => {
          setPendingHandleInteraction({
            kind: "opacity",
            startClientX: clientX,
            startClientY: clientY,
          });
        }}
        onPressScale={(handle, clientX, clientY) => {
          setPendingHandleInteraction({
            kind: "scale",
            handle,
            startClientX: clientX,
            startClientY: clientY,
          });
        }}
        onHoverHandle={setHoveredHandle}
        onOpenRotationInput={openRotationInput}
        onOpenOpacityInput={openOpacityInput}
        onOpenScaleInput={openScaleInput}
        onDirectInputChange={(value) =>
          setDirectInput((prev) => (prev ? { ...prev, value } : prev))
        }
        onDirectInputKeyDown={handleDirectInputKeyDown}
        onCloseDirectInput={closeDirectInput}
        onCommitDirectInput={commitDirectInput}
        onAnchorMouseDown={onAnchorMouseDown}
        onAnchorHoverChange={setIsAnchorHovered}
      />
    </div>
  );
}

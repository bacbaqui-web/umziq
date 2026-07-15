import PreviewGizmoBackdrop from "@/features/preview/components/PreviewGizmoBackdrop";
import PreviewGizmoControls from "@/features/preview/components/PreviewGizmoControls";
import type { ActivePreviewGizmoLayerProps } from "@/features/preview/types/previewGizmoLayerTypes";

export default function PreviewGizmoActiveLayer({
  viewportSize,
  previewCorners,
  polygonPoints,
  previewAnchor,
  previewMoveHandle,
  previewRotationHandle,
  previewOpacityHandle,
  previewScaleHandles,
  hoveredHandle,
  isDraggingAnchor,
  isDraggingPosition,
  isDraggingOpacity,
  isDraggingRotation,
  positionReadout,
  opacityReadout,
  rotationReadout,
  scaleReadout,
  activeScaleHandle,
  directInput,
  anchorOpacity,
  isAnchorHovered,
  onTargetMouseDown,
  onPressMove,
  onPressRotation,
  onPressOpacity,
  onPressScale,
  onHoverHandle,
  onOpenRotationInput,
  onOpenOpacityInput,
  onOpenScaleInput,
  onDirectInputChange,
  onDirectInputKeyDown,
  onCloseDirectInput,
  onCommitDirectInput,
  onAnchorMouseDown,
  onAnchorHoverChange,
}: ActivePreviewGizmoLayerProps) {
  const handlesProps = {
    previewMoveHandle,
    previewRotationHandle,
    previewOpacityHandle,
    previewScaleHandles,
    hoveredHandle,
    isDraggingPosition,
    isDraggingOpacity,
    isDraggingRotation,
    onPressMove,
    onPressRotation,
    onPressOpacity,
    onPressScale,
    onHoverHandle,
    onOpenRotationInput,
    onOpenOpacityInput,
    onOpenScaleInput,
  };
  const readoutsProps = {
    previewMoveHandle,
    previewRotationHandle,
    previewOpacityHandle,
    activeScaleHandle,
    positionReadout,
    opacityReadout,
    rotationReadout,
    scaleReadout,
    isDraggingOpacity,
    isDraggingRotation,
    directInput,
    onDirectInputChange,
    onDirectInputKeyDown,
    onCloseDirectInput,
    onCommitDirectInput,
  };
  const anchorProps = {
    previewAnchor,
    anchorOpacity,
    isDraggingAnchor,
    isAnchorHovered,
    onAnchorMouseDown,
    onAnchorHoverChange,
  };

  return (
    <>
      <PreviewGizmoBackdrop
        viewportSize={viewportSize}
        previewCorners={previewCorners}
        polygonPoints={polygonPoints}
        previewAnchor={previewAnchor}
        previewMoveHandle={previewMoveHandle}
        previewRotationHandle={previewRotationHandle}
        previewOpacityHandle={previewOpacityHandle}
        previewScaleHandles={previewScaleHandles}
        hoveredHandle={hoveredHandle}
        isDraggingPosition={isDraggingPosition}
        isDraggingOpacity={isDraggingOpacity}
        isDraggingRotation={isDraggingRotation}
        onTargetMouseDown={onTargetMouseDown}
      />
      <PreviewGizmoControls
        handlesProps={handlesProps}
        readoutsProps={readoutsProps}
        anchorProps={anchorProps}
      />
    </>
  );
}

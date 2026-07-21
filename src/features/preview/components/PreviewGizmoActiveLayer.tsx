import PreviewGizmoBackdrop from "@/features/preview/components/PreviewGizmoBackdrop";
import PreviewGizmoConnectionHitLayer from "@/features/preview/components/PreviewGizmoConnectionHitLayer";
import PreviewGizmoControls from "@/features/preview/components/PreviewGizmoControls";
import type { ActivePreviewGizmoLayerProps } from "@/features/preview/types/previewGizmoLayerTypes";

export default function PreviewGizmoActiveLayer({
  cursors,
  viewportSize,
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
    cursors,
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
        previewRotationHandle={previewRotationHandle}
        previewOpacityHandle={previewOpacityHandle}
        previewScaleHandles={previewScaleHandles}
        hoveredHandle={hoveredHandle}
        isDraggingOpacity={isDraggingOpacity}
        isDraggingRotation={isDraggingRotation}
      />
      <PreviewGizmoConnectionHitLayer
        viewportSize={viewportSize}
        cursors={cursors}
        previewRotationHandle={previewRotationHandle}
        previewOpacityHandle={previewOpacityHandle}
        previewScaleHandles={previewScaleHandles}
        onPressRotation={onPressRotation}
        onPressOpacity={onPressOpacity}
        onPressScale={onPressScale}
        onHoverHandle={onHoverHandle}
        onOpenRotationInput={onOpenRotationInput}
        onOpenOpacityInput={onOpenOpacityInput}
        onOpenScaleInput={onOpenScaleInput}
      />
      <PreviewGizmoControls
        handlesProps={handlesProps}
        readoutsProps={readoutsProps}
        anchorProps={anchorProps}
      />
    </>
  );
}

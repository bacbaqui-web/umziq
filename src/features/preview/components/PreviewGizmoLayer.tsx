import PreviewGizmoActiveLayer from "@/features/preview/components/PreviewGizmoActiveLayer";
import type { PreviewGizmoLayerProps } from "@/features/preview/types/previewGizmoLayerTypes";

export default function PreviewGizmoLayer(props: PreviewGizmoLayerProps) {
  const {
    previewAnchor,
    previewMoveHandle,
    previewRotationHandle,
    previewOpacityHandle,
  } = props;

  if (!props.isVisible || !previewAnchor || !previewMoveHandle || !previewRotationHandle || !previewOpacityHandle) {
    return null;
  }

  return (
    <PreviewGizmoActiveLayer
      {...props}
      previewAnchor={previewAnchor}
      previewMoveHandle={previewMoveHandle}
      previewRotationHandle={previewRotationHandle}
      previewOpacityHandle={previewOpacityHandle}
    />
  );
}

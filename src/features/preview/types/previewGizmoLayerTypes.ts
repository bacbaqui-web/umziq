import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import type { ScaleHandleDirection } from "@/editor/types/editorViewTypes";
import type { DirectInputState } from "@/features/preview/hooks/usePreviewOverlayState";
import type {
  HoveredGizmoHandle,
  PreviewLineHandle,
  PreviewPoint,
  PreviewScaleHandle,
} from "@/features/preview/types/previewGizmoTypes";

export type PreviewGizmoLayerProps = {
  viewportSize: {
    width: number;
    height: number;
  };
  previewCorners: {
    nw: PreviewPoint;
    ne: PreviewPoint;
    se: PreviewPoint;
    sw: PreviewPoint;
  } | null;
  polygonPoints: string;
  previewAnchor: PreviewPoint | null;
  previewMoveHandle: PreviewLineHandle | null;
  previewRotationHandle: PreviewLineHandle | null;
  previewOpacityHandle: PreviewLineHandle | null;
  previewScaleHandles: PreviewScaleHandle[];
  hoveredHandle: HoveredGizmoHandle;
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
  activeScaleHandle: PreviewScaleHandle | null;
  directInput: DirectInputState;
  anchorOpacity: number;
  isAnchorHovered: boolean;
  onTargetMouseDown: (event: ReactMouseEvent<SVGPolygonElement>) => void;
  onPressMove: (clientX: number, clientY: number) => void;
  onPressRotation: (clientX: number, clientY: number) => void;
  onPressOpacity: (clientX: number, clientY: number) => void;
  onPressScale: (handle: ScaleHandleDirection, clientX: number, clientY: number) => void;
  onHoverHandle: (handle: HoveredGizmoHandle) => void;
  onOpenRotationInput: () => void;
  onOpenOpacityInput: () => void;
  onOpenScaleInput: (handle: ScaleHandleDirection, x: number, y: number) => void;
  onDirectInputChange: (value: string) => void;
  onDirectInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onCloseDirectInput: () => void;
  onCommitDirectInput: () => void;
  onAnchorMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onAnchorHoverChange: (hovered: boolean) => void;
};

export type ActivePreviewGizmoLayerProps = PreviewGizmoLayerProps & {
  previewAnchor: PreviewPoint;
  previewMoveHandle: PreviewLineHandle;
  previewRotationHandle: PreviewLineHandle;
  previewOpacityHandle: PreviewLineHandle;
};

import {
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Position } from "@/models";
import {
  DEFAULT_LAYER_DOCUMENT_PROJECT_CANVAS_SETTINGS,
  type LayerDocumentProjectCanvasSettings,
} from "@/models";
import type {
  CanvasDirectInputState,
  CanvasHoveredHandle,
  CanvasPendingHandleInteraction,
  CanvasPendingMotionPathInteraction,
  ScaleHandleDirection,
} from "@/engines/canvas";

export function useEditorCanvasRuntimeState(
  minWidth: number,
  minHeight: number,
  projectSettings: LayerDocumentProjectCanvasSettings | undefined,
  commitProjectSettings: (settings: LayerDocumentProjectCanvasSettings) => void
) {
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] =
    useState<Position>({ x: 0, y: 0 });
  const [previewWorkspaceSize, setPreviewWorkspaceSize] =
    useState({ width: minWidth, height: minHeight });
  const viewSettings = projectSettings ??
    DEFAULT_LAYER_DOCUMENT_PROJECT_CANVAS_SETTINGS;
  const persistedSetter = <K extends keyof LayerDocumentProjectCanvasSettings>(
    key: K
  ): Dispatch<SetStateAction<LayerDocumentProjectCanvasSettings[K]>> => (action) => {
    const current = projectSettings ??
      DEFAULT_LAYER_DOCUMENT_PROJECT_CANVAS_SETTINGS;
    const next = typeof action === "function"
      ? (action as (value: LayerDocumentProjectCanvasSettings[K]) =>
          LayerDocumentProjectCanvasSettings[K])(current[key])
      : action;
    commitProjectSettings({ ...current, [key]: next });
  };
  const {
    showShortformFrameOverlay,
    showSafeZoneGuides,
    showSelectionHighlight,
    cameraScalePercent,
    cameraDimOpacityPercent,
    showWhiteBackground,
  } = viewSettings;
  const setShowShortformFrameOverlay = persistedSetter(
    "showShortformFrameOverlay"
  );
  const setShowSafeZoneGuides = persistedSetter(
    "showSafeZoneGuides"
  );
  const setShowSelectionHighlight = persistedSetter(
    "showSelectionHighlight"
  );
  const setCameraScalePercent = persistedSetter(
    "cameraScalePercent"
  );
  const setCameraDimOpacityPercent = persistedSetter(
    "cameraDimOpacityPercent"
  );
  const setShowWhiteBackground = persistedSetter(
    "showWhiteBackground"
  );
  const [isDraggingAnchor, setIsDraggingAnchor] = useState(false);
  const [isDraggingPosition, setIsDraggingPosition] = useState(false);
  const [isDraggingScale, setIsDraggingScale] = useState(false);
  const [isDraggingOpacity, setIsDraggingOpacity] = useState(false);
  const [isDraggingRotation, setIsDraggingRotation] = useState(false);
  const [
    isDraggingMotionPathKeyframe,
    setIsDraggingMotionPathKeyframe,
  ] = useState(false);
  const [isPreviewPanning, setIsPreviewPanning] = useState(false);
  const [
    isPreviewPanModifierActive,
    setIsPreviewPanModifierActive,
  ] = useState(false);
  const [rotationHandleReadout, setRotationHandleReadout] =
    useState<string | null>(null);
  const [opacityHandleReadout, setOpacityHandleReadout] =
    useState<string | null>(null);
  const [scaleHandleReadout, setScaleHandleReadout] =
    useState<{
      handle: ScaleHandleDirection;
      text: string;
    } | null>(null);
  const [positionHandleReadout, setPositionHandleReadout] =
    useState<string | null>(null);
  const [motionPathKeyframeReadout, setMotionPathKeyframeReadout] =
    useState<string | null>(null);
  const [draggingMotionPathFrame, setDraggingMotionPathFrame] =
    useState<number | null>(null);
  const [hoveredHandle, setHoveredHandle] =
    useState<CanvasHoveredHandle>(null);
  const [hoveredMotionFrame, setHoveredMotionFrame] =
    useState<number | null>(null);
  const [pendingHandleInteraction, setPendingHandleInteraction] =
    useState<CanvasPendingHandleInteraction>(null);
  const [
    pendingMotionPathInteraction,
    setPendingMotionPathInteraction,
  ] = useState<CanvasPendingMotionPathInteraction>(null);
  const [
    suppressedMotionPathClickFrame,
    setSuppressedMotionPathClickFrame,
  ] = useState<number | null>(null);
  const [isAnchorHovered, setIsAnchorHovered] = useState(false);
  const [directInput, setDirectInput] =
    useState<CanvasDirectInputState>(null);
  return {
    previewZoom, setPreviewZoom,
    previewPan, setPreviewPan,
    previewWorkspaceSize, setPreviewWorkspaceSize,
    showShortformFrameOverlay, setShowShortformFrameOverlay,
    showSafeZoneGuides, setShowSafeZoneGuides,
    showSelectionHighlight, setShowSelectionHighlight,
    cameraScalePercent, setCameraScalePercent,
    cameraDimOpacityPercent, setCameraDimOpacityPercent,
    showWhiteBackground, setShowWhiteBackground,
    isDraggingAnchor, setIsDraggingAnchor,
    isDraggingPosition, setIsDraggingPosition,
    isDraggingScale, setIsDraggingScale,
    isDraggingOpacity, setIsDraggingOpacity,
    isDraggingRotation, setIsDraggingRotation,
    isDraggingMotionPathKeyframe,
    setIsDraggingMotionPathKeyframe,
    isPreviewPanning, setIsPreviewPanning,
    isPreviewPanModifierActive,
    setIsPreviewPanModifierActive,
    rotationHandleReadout, setRotationHandleReadout,
    opacityHandleReadout, setOpacityHandleReadout,
    scaleHandleReadout, setScaleHandleReadout,
    positionHandleReadout, setPositionHandleReadout,
    motionPathKeyframeReadout,
    setMotionPathKeyframeReadout,
    draggingMotionPathFrame, setDraggingMotionPathFrame,
    hoveredHandle, setHoveredHandle,
    hoveredMotionFrame, setHoveredMotionFrame,
    pendingHandleInteraction, setPendingHandleInteraction,
    pendingMotionPathInteraction,
    setPendingMotionPathInteraction,
    suppressedMotionPathClickFrame,
    setSuppressedMotionPathClickFrame,
    isAnchorHovered, setIsAnchorHovered,
    directInput, setDirectInput,
  };
}

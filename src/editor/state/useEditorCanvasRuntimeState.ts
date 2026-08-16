import {
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Position } from "@/models";
import type {
  CanvasDirectInputState,
  CanvasHoveredHandle,
  CanvasPendingHandleInteraction,
  CanvasPendingMotionPathInteraction,
  ScaleHandleDirection,
} from "@/engines/canvas";

type ProjectCanvasViewSettings = {
  showShortformFrameOverlay: boolean;
  showSafeZoneGuides: boolean;
  showSelectionHighlight: boolean;
  cameraScalePercent: number;
  showWhiteBackground: boolean;
};

function readProjectCanvasViewSettings(
  projectId: string
): ProjectCanvasViewSettings {
  const readBoolean = (name: string, fallback: boolean) => {
    if (typeof window === "undefined") return fallback;
    const stored = window.localStorage.getItem(
      `umziq.project.${projectId}.${name}`
    );
    return stored === null ? fallback : stored === "true";
  };
  const readNumber = (name: string, fallback: number) => {
    if (typeof window === "undefined") return fallback;
    const stored = Number(window.localStorage.getItem(
      `umziq.project.${projectId}.${name}`
    ));
    return Number.isFinite(stored) && stored >= 1 ? stored : fallback;
  };
  return {
    showShortformFrameOverlay: readBoolean("camera.visible", true),
    showSafeZoneGuides: readBoolean("safeZone.visible", false),
    showSelectionHighlight: readBoolean("selectionHighlight.visible", true),
    cameraScalePercent: readNumber("camera.scalePercent", 100),
    showWhiteBackground: readBoolean("background.white", false),
  };
}

export function useEditorCanvasRuntimeState(
  minWidth: number,
  minHeight: number,
  projectId: string
) {
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] =
    useState<Position>({ x: 0, y: 0 });
  const [previewWorkspaceSize, setPreviewWorkspaceSize] =
    useState({ width: minWidth, height: minHeight });
  const [viewSettingsByProject, setViewSettingsByProject] = useState<
    Record<string, ProjectCanvasViewSettings>
  >(() => ({ [projectId]: readProjectCanvasViewSettings(projectId) }));
  const viewSettings = viewSettingsByProject[projectId] ??
    readProjectCanvasViewSettings(projectId);
  const persistedSetter = <K extends keyof ProjectCanvasViewSettings>(
    key: K,
    storageName: string
  ): Dispatch<SetStateAction<ProjectCanvasViewSettings[K]>> => (action) => {
    setViewSettingsByProject((currentByProject) => {
      const current = currentByProject[projectId] ??
        readProjectCanvasViewSettings(projectId);
      const next = typeof action === "function"
        ? (action as (value: ProjectCanvasViewSettings[K]) =>
            ProjectCanvasViewSettings[K])(current[key])
        : action;
      window.localStorage.setItem(
        `umziq.project.${projectId}.${storageName}`,
        String(next)
      );
      return {
        ...currentByProject,
        [projectId]: { ...current, [key]: next },
      };
    });
  };
  const {
    showShortformFrameOverlay,
    showSafeZoneGuides,
    showSelectionHighlight,
    cameraScalePercent,
    showWhiteBackground,
  } = viewSettings;
  const setShowShortformFrameOverlay = persistedSetter(
    "showShortformFrameOverlay", "camera.visible"
  );
  const setShowSafeZoneGuides = persistedSetter(
    "showSafeZoneGuides", "safeZone.visible"
  );
  const setShowSelectionHighlight = persistedSetter(
    "showSelectionHighlight", "selectionHighlight.visible"
  );
  const setCameraScalePercent = persistedSetter(
    "cameraScalePercent", "camera.scalePercent"
  );
  const setShowWhiteBackground = persistedSetter(
    "showWhiteBackground", "background.white"
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

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Position } from "@/models";
import type { PreviewGuideGeometry } from "@/engines/canvas/helpers/canvasGuideHelpers";
import type { PreviewOverlay } from "@/engines/canvas/models/canvasViewModel";

export type CanvasSize = { width: number; height: number };
export type CanvasSceneSize = {
  readonly width: number;
  readonly height: number;
};

export type CanvasViewportStatePort = {
  previewZoom: number;
  setPreviewZoom: Dispatch<SetStateAction<number>>;
  previewPan: Position;
  setPreviewPan: Dispatch<SetStateAction<Position>>;
  previewWorkspaceSize: CanvasSize;
  setPreviewWorkspaceSize: Dispatch<SetStateAction<CanvasSize>>;
  showShortformFrameOverlay: boolean;
  setShowShortformFrameOverlay: Dispatch<SetStateAction<boolean>>;
  showSafeZoneGuides: boolean;
  setShowSafeZoneGuides: Dispatch<SetStateAction<boolean>>;
  showSelectionGlow: boolean;
  setShowSelectionGlow: Dispatch<SetStateAction<boolean>>;
};

export type CanvasViewportCoreStatePort = Pick<
  CanvasViewportStatePort,
  | "previewZoom"
  | "setPreviewZoom"
  | "previewPan"
  | "setPreviewPan"
  | "previewWorkspaceSize"
  | "setPreviewWorkspaceSize"
>;

export type CanvasPanStatePort = {
  setIsPreviewPanning: Dispatch<SetStateAction<boolean>>;
  setIsPreviewPanModifierActive: Dispatch<SetStateAction<boolean>>;
};

export type CanvasViewportReadModel = {
  previewViewportWidth: number;
  previewViewportHeight: number;
  previewFitZoom: number;
  previewSize: CanvasSize;
  previewBaseOffset: Position;
  previewViewportOffset: Position;
  previewZoom: number;
  previewPan: Position;
  previewZoomPercent: number;
};

export type CanvasViewportCommands = {
  resetViewport: () => void;
  centerViewport: () => void;
  setActualSize: () => void;
  applyZoom: (nextZoom: number, clientX?: number, clientY?: number) => void;
};

export type CanvasGuideViewModel = {
  previewSize: CanvasSize;
  geometry: PreviewGuideGeometry;
  showShortformFrame: boolean;
  showSafeZoneGuides: boolean;
  safeZoneStrokeWidth: number;
};

export type CanvasGuideCommands = {
  toggleShortformFrame: () => void;
  toggleSafeZone: () => void;
};

export type CanvasSelectionReadModel = {
  overlay: PreviewOverlay;
  previewCorners: NonNullable<PreviewOverlay>["corners"] | null;
  previewAnchor: Position | null;
  previewCenter: Position | null;
  polygonPoints: string;
};

export type CanvasDomRefs = {
  workspaceRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
};

export type CanvasViewportProjectReadPort = {
  selectedCompId: string;
  selectedMeta: CanvasSceneSize | null;
};

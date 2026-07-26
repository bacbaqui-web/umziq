import type {
  MouseEvent,
  RefObject,
  WheelEvent,
} from "react";
import type {
  Position,
} from "@/models";
import type {
  RendererMode,
} from "@/engines/playback-render";
import type {
  CanvasGuideViewModel,
} from "@/engines/canvas/models/canvasEngineModel";
import type {
  CanvasDirectSelectionHoverViewModel,
} from "@/engines/canvas/models/canvasDirectSelectionModel";
import type {
  CanvasInteractionCommands,
  CanvasGizmoViewModel,
} from "@/engines/canvas/models/canvasInteractionModel";
import type {
  PreviewQualityControlCommands,
  PreviewQualityControlViewModel,
} from "@/engines/canvas/models/previewQualityControlModel";
import type {
  CanvasSelectionGlowViewModel,
} from "@/engines/canvas/models/canvasSelectionGlowModel";
import type {
  CanvasFpsRuntime,
} from "@/engines/canvas/models/canvasFpsModel";

export interface CanvasPreviewPaneProps {
  /** Runtime observation identity; never a persisted Canvas entity. */
  selectedLayerDocumentId: string | null;
  selectedSourceId: string | null;
  activeScene:
    | {
        readonly identity: string;
        readonly width: number;
        readonly height: number;
      }
    | null;
  previewWorkspaceRef:
    RefObject<HTMLDivElement | null>;
  previewViewportRef:
    RefObject<HTMLDivElement | null>;
  previewCanvasRef:
    RefObject<HTMLCanvasElement | null>;
  previewOverlayRef:
    RefObject<HTMLDivElement | null>;
  previewBaseOffset: Position;
  previewPan: Position;
  previewZoom: number;
  previewZoomPercent: number;
  rendererMode: RendererMode;
  setRendererMode: (mode: RendererMode) => void;
  previewQuality: PreviewQualityControlViewModel;
  previewQualityCommands:
    PreviewQualityControlCommands;
  canvasFpsRuntime: CanvasFpsRuntime;
  previewSize: {
    width: number;
    height: number;
  };
  previewViewportWidth: number;
  previewViewportHeight: number;
  guide: CanvasGuideViewModel;
  toggleShortformFrame: () => void;
  toggleSafeZone: () => void;
  showSelectionGlow: boolean;
  toggleSelectionGlow: () => void;
  resetPreviewView: () => void;
  setOneToOnePreviewView: () => void;
  centerPreviewView: () => void;
  handlePreviewViewportWheel:
    (event: WheelEvent<HTMLDivElement>) => void;
  handlePreviewViewportMouseDownCapture:
    (event: MouseEvent<HTMLDivElement>) => void;
  isPreviewPanning: boolean;
  isPreviewPanModifierActive: boolean;
  interactionViewModel: CanvasGizmoViewModel;
  selectionGlow: CanvasSelectionGlowViewModel;
  directSelectionHover:
    CanvasDirectSelectionHoverViewModel;
  interactionCommands: CanvasInteractionCommands;
}

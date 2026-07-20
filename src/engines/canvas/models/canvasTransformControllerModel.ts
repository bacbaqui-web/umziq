import type { RefObject } from "react";
import type {
  ApplyAnchorCommand,
  TransformEditMode,
  TransformTargetSelection,
} from "@/engines/animation";
import type {
  PreviewSceneTransformPatch,
  PreviewSceneUpdateTarget,
} from "@/engines/playback-render";
import type { DraftTransformSnapshot } from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import type {
  CanvasInteractionStatePort,
  CanvasPointerController,
} from "@/engines/canvas/models/canvasInteractionModel";
import type { RuntimeMetricsResource } from "@/engines/canvas/models/runtimeMetricsModel";
import type { PreviewOverlay } from "@/engines/canvas/models/canvasViewModel";
import type { PreviewPointerContext } from "@/engines/canvas/helpers/canvasPointerHelpers";
import type {
  CompositionMeta,
  Position,
  PropertyTrackState,
  Scale,
} from "@/models";

export type CanvasHistoryPort = {
  push: () => void;
  begin: () => void;
  markDirty: () => void;
  commit: () => void;
  cancel: () => void;
};

export type CanvasTransformCommandPort = {
  applyPosition: (value: Position, mode: TransformEditMode) => void;
  applyScale: (value: Scale, mode: TransformEditMode) => void;
  applyRotation: (value: number, mode: TransformEditMode) => void;
  applyOpacity: (value: number, mode: TransformEditMode) => void;
  applyAnchor: (command: {
    target: { kind: "layer" | "composition"; id: string };
    anchor: Position;
    transformOffset: Position;
  }) => void;
};

export type CanvasPreviewUpdatePort = {
  updateTransform: (
    target: PreviewSceneUpdateTarget | null,
    patch: PreviewSceneTransformPatch
  ) => void;
  reset: () => void;
};

export type CanvasTransformDraftCommands = {
  updateAnchor: (anchor: Position) => ApplyAnchorCommand | null;
  reset: () => void;
};

export type UseCanvasTransformControllerOptions = {
  masterCompId: string;
  overlayRef: RefObject<HTMLDivElement | null>;
  selectedMeta: CompositionMeta | null;
  previewSize: { width: number; height: number };
  previewZoom: number;
  previewViewportOffset: Position;
  selectedOverlay: PreviewOverlay;
  selectedTarget: TransformTargetSelection;
  selectedTimelineTargetItem: { startFrame: number } | null;
  selectedTransformLocalFrame: number;
  selectedPropertyState: PropertyTrackState;
  playheadFrame: number;
  resolvedPosition: Position;
  resolvedOpacity: number;
  drafts: {
    setPosition: (value: Position | null) => void;
    setScale: (value: Scale | null) => void;
    setRotation: (value: number | null) => void;
    setOpacity: (value: number | null) => void;
  };
  state: CanvasInteractionStatePort;
  history: CanvasHistoryPort;
  commands: CanvasTransformCommandPort;
  pointer: CanvasPointerController;
  previewUpdates: CanvasPreviewUpdatePort;
  setDraftTransformSnapshot: (snapshot: DraftTransformSnapshot | null) => void;
  metrics?: RuntimeMetricsResource;
};

export type CanvasPointerContextResolver = (
  clientX: number,
  clientY: number
) => PreviewPointerContext | null;

export type CanvasTransformDraftRuntimePort = {
  updateTransform: (
    patch: PreviewSceneTransformPatch,
    localFrame?: number
  ) => DraftTransformSnapshot | null;
  reset: () => void;
};

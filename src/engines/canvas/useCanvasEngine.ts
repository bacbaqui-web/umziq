import { useRef } from "react";
import type {
  Composition,
  CompositionMeta,
  Layer,
  Position,
  PropertyTrackState,
  Scale,
  TimelineItem,
} from "@/models";
import type { TransformEditMode, TransformTargetSelection } from "@/engines/animation";
import type { RenderItem } from "@/engines/project";
import type { RenderFrame } from "@/engines/playback-render";
import { useCanvasGuideController } from "@/engines/canvas/controllers/useCanvasGuideController";
import { useCanvasRenderController } from "@/engines/canvas/controllers/useCanvasRenderController";
import { useCanvasSelectionController } from "@/engines/canvas/controllers/useCanvasSelectionController";
import { useCanvasPointerController } from "@/engines/canvas/controllers/useCanvasPointerController";
import { useCanvasTransformController } from "@/engines/canvas/controllers/useCanvasTransformController";
import { useCanvasMotionPathController } from "@/engines/canvas/controllers/useCanvasMotionPathController";
import { useCanvasGizmoController } from "@/engines/canvas/controllers/useCanvasGizmoController";
import type { CanvasInteractionStatePort } from "@/engines/canvas/models/canvasInteractionModel";
import type { ScaleHandleDirection } from "@/engines/canvas/models/canvasViewModel";
import type {
  CanvasPanStatePort,
  CanvasViewportProjectReadPort,
  CanvasViewportStatePort,
} from "@/engines/canvas/models/canvasEngineModel";
import { useCanvasViewportEngine } from "@/engines/canvas/useCanvasViewportEngine";

export type UseCanvasEngineOptions = {
  minWorkspaceWidth: number;
  minWorkspaceHeight: number;
  shortformFrameWidth: number;
  shortformFrameHeight: number;
  project: CanvasViewportProjectReadPort;
  state: CanvasViewportStatePort;
  panState: CanvasPanStatePort;
  render: {
    frame: RenderFrame | null;
    items: readonly RenderItem[];
    localFrameBySourceId: ReadonlyMap<string, number>;
  };
  selection: {
    target: TransformTargetSelection;
    timelineItems: readonly TimelineItem[];
    playheadFrame: number;
    metaByCompId: Readonly<Record<string, CompositionMeta>>;
  };
  interaction: {
    masterCompId: string;
    selectedTimelineTargetItem: TimelineItem | null;
    selectedTransformLocalFrame: number;
    selectedPropertyState: PropertyTrackState;
    resolvedPosition: Position;
    resolvedScale: Scale;
    resolvedRotation: number;
    resolvedOpacity: number;
    allLayersById: ReadonlyMap<string, Layer>;
    allCompositionsById: ReadonlyMap<string, Composition>;
    state: CanvasInteractionStatePort;
    seekFrame: (frame: number) => void;
    drafts: {
      setPosition: (value: Position | null) => void;
      setScale: (value: Scale | null) => void;
      setRotation: (value: number | null) => void;
      setOpacity: (value: number | null) => void;
    };
    history: {
      push: () => void;
      begin: () => void;
      markDirty: () => void;
      commit: () => void;
      cancel: () => void;
    };
    commands: {
      applyPosition: (value: Position, mode: TransformEditMode) => void;
      applyScale: (value: Scale, mode: TransformEditMode) => void;
      applyRotation: (value: number, mode: TransformEditMode) => void;
      applyOpacity: (value: number, mode: TransformEditMode) => void;
      applyAnchor: (command: {
        target: { kind: "layer" | "composition"; id: string };
        anchor: Position;
        transformOffset: Position;
      }) => void;
      upsertPositionKeyframe: (command: {
        target: { kind: "layer" | "composition"; id: string };
        property: "position";
        frame: number;
        value: Position;
      }) => void;
      selectPositionKeyframe: (
        target: { kind: "layer" | "composition"; id: string },
        property: "position",
        frame: number
      ) => void;
      applySelection: (
        compId: string,
        selection: { sourceId: string; kind: "layer" | "subComp" }
      ) => void;
      commitScaleInput: (handle: ScaleHandleDirection, value: number) => void;
      commitRotationInput: (value: number) => void;
      commitOpacityInput: (value: number) => void;
    };
  };
};

export function useCanvasEngine(options: UseCanvasEngineOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const viewport = useCanvasViewportEngine({
    minWorkspaceWidth: options.minWorkspaceWidth,
    minWorkspaceHeight: options.minWorkspaceHeight,
    shortformFrameWidth: options.shortformFrameWidth,
    shortformFrameHeight: options.shortformFrameHeight,
    project: options.project,
    state: options.state,
    panState: options.panState,
  });
  const guide = useCanvasGuideController({
    previewSize: viewport.readModel.previewSize,
    zoom: viewport.readModel.previewZoom,
    shortformFrameWidth: options.shortformFrameWidth,
    shortformFrameHeight: options.shortformFrameHeight,
    showShortformFrame: options.state.showShortformFrameOverlay,
    setShowShortformFrame: options.state.setShowShortformFrameOverlay,
    showSafeZoneGuides: options.state.showSafeZoneGuides,
    setShowSafeZoneGuides: options.state.setShowSafeZoneGuides,
  });
  const selection = useCanvasSelectionController({
    selectedTransformTarget: options.selection.target,
    selectedTimelineItems: options.selection.timelineItems,
    playheadFrame: options.selection.playheadFrame,
    metaByCompId: options.selection.metaByCompId,
    renderItems: options.render.items,
    localFrameBySourceId: options.render.localFrameBySourceId,
    selectedMeta: options.project.selectedMeta,
    previewSize: viewport.readModel.previewSize,
    viewportScale: viewport.readModel.previewZoom,
    viewportOffset: viewport.readModel.previewViewportOffset,
  });
  const pointer = useCanvasPointerController();
  const transform = useCanvasTransformController({
    masterCompId: options.interaction.masterCompId,
    overlayRef,
    selectedMeta: options.project.selectedMeta,
    previewSize: viewport.readModel.previewSize,
    previewZoom: viewport.readModel.previewZoom,
    previewViewportOffset: viewport.readModel.previewViewportOffset,
    selectedOverlay: selection.overlay,
    selectedTarget: options.selection.target,
    selectedTimelineTargetItem: options.interaction.selectedTimelineTargetItem,
    selectedTransformLocalFrame: options.interaction.selectedTransformLocalFrame,
    selectedPropertyState: options.interaction.selectedPropertyState,
    playheadFrame: options.selection.playheadFrame,
    resolvedPosition: options.interaction.resolvedPosition,
    resolvedOpacity: options.interaction.resolvedOpacity,
    allLayersById: options.interaction.allLayersById,
    allCompositionsById: options.interaction.allCompositionsById,
    metaByCompId: options.selection.metaByCompId,
    drafts: options.interaction.drafts,
    state: options.interaction.state,
    history: options.interaction.history,
    commands: options.interaction.commands,
    pointer,
  });
  const motionPath = useCanvasMotionPathController({
    overlayRef,
    selectedMeta: options.project.selectedMeta,
    previewSize: viewport.readModel.previewSize,
    previewZoom: viewport.readModel.previewZoom,
    previewViewportOffset: viewport.readModel.previewViewportOffset,
    selectedCompId: options.project.selectedCompId,
    selectedTarget: options.selection.target,
    selectedTimelineTargetItem: options.interaction.selectedTimelineTargetItem,
    selectedTimelineItems: options.selection.timelineItems,
    playheadFrame: options.selection.playheadFrame,
    metaByCompId: options.selection.metaByCompId,
    renderItems: options.render.items,
    seekFrame: options.interaction.seekFrame,
    drafts: options.interaction.drafts,
    commands: options.interaction.commands,
    history: options.interaction.history,
    state: options.interaction.state,
    pointer,
  });
  const selectedMeta = options.project.selectedMeta ?? {
    width: 1,
    height: 1,
    layerCount: 0,
    sourceFileName: "",
    frameRate: 1,
    durationFrames: 1,
  };
  const gizmo = useCanvasGizmoController({
    viewportScale: viewport.readModel.previewZoom,
    viewportOffset: viewport.readModel.previewViewportOffset,
    previewSize: viewport.readModel.previewSize,
    selectedMeta,
    selection,
    motionPath: motionPath.motionPath,
    currentOpacity: options.interaction.resolvedOpacity,
    currentRotation: options.interaction.resolvedRotation,
    currentScale: options.interaction.resolvedScale,
    state: options.interaction.state,
    transform,
    motion: motionPath,
    directInput: {
      commitScale: options.interaction.commands.commitScaleInput,
      commitRotation: options.interaction.commands.commitRotationInput,
      commitOpacity: options.interaction.commands.commitOpacityInput,
    },
  });
  useCanvasRenderController({ canvasRef, renderFrame: options.render.frame });

  return {
    refs: {
      workspaceRef: viewport.workspaceRef,
      viewportRef: viewport.viewportRef,
      canvasRef,
      overlayRef,
    },
    viewport: viewport.readModel,
    viewportCommands: viewport.commands,
    viewportInteractions: viewport.pan,
    guide: guide.viewModel,
    guideCommands: guide.commands,
    selection,
    interaction: gizmo,
  };
}

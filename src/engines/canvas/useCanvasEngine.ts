import { useRef } from "react";
import type {
  Composition,
  CompositionMeta,
  Layer,
  Position,
  PropertyTrackState,
  Scale,
  TimelineItem,
  TimelineSelection,
} from "@/models";
import type { TransformEditMode, TransformTargetSelection } from "@/engines/animation";
import type { RenderItem } from "@/engines/project";
import type {
  EvaluatedScene,
  PreviewScene,
  RenderDrawableSourceResolver,
  RenderFrame,
} from "@/engines/playback-render";
import { useCanvasGuideController } from "@/engines/canvas/controllers/useCanvasGuideController";
import { useCanvasRenderController } from "@/engines/canvas/controllers/useCanvasRenderController";
import { useCanvasSelectionController } from "@/engines/canvas/controllers/useCanvasSelectionController";
import { useCanvasPointerController } from "@/engines/canvas/controllers/useCanvasPointerController";
import { useCanvasTransformComposer } from "@/engines/canvas/composers/useCanvasTransformComposer";
import { useCanvasMotionPathController } from "@/engines/canvas/controllers/useCanvasMotionPathController";
import { useCanvasGizmoController } from "@/engines/canvas/controllers/useCanvasGizmoController";
import { useCanvasDirectSelectionController } from "@/engines/canvas/controllers/useCanvasDirectSelectionController";
import { usePreviewUpdatePipeline } from "@/engines/canvas/controllers/usePreviewUpdatePipeline";
import type { CanvasInteractionStatePort } from "@/engines/canvas/models/canvasInteractionModel";
import type { ScaleHandleDirection } from "@/engines/canvas/models/canvasViewModel";
import type {
  CanvasPanStatePort,
  CanvasViewportProjectReadPort,
  CanvasViewportStatePort,
} from "@/engines/canvas/models/canvasEngineModel";
import type { RuntimeMetricsResource } from "@/engines/canvas/models/runtimeMetricsModel";
import type { DirtyStateResource } from "@/engines/canvas/models/dirtyStateModel";
import type {
  CompositionPreviewCacheRuntime,
} from "@/engines/canvas/models/compositionCacheModel";
import type {
  PreviewSurfaceCacheRuntime,
} from "@/engines/canvas/models/surfaceCacheModel";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";
import { useCanvasViewportEngine } from "@/engines/canvas/useCanvasViewportEngine";
import {
  resolveDraftOverlayRuntimeValuesForTarget,
  type DraftTransformSnapshot,
} from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";

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
    previewScene?: PreviewScene | null;
    evaluatedScene: EvaluatedScene | null;
    items: readonly RenderItem[];
    localFrameBySourceId: ReadonlyMap<string, number>;
    resolveDrawableSource?: RenderDrawableSourceResolver;
    pixelScale: number;
    previewQuality: ResolvedPreviewQuality;
    metrics?: RuntimeMetricsResource;
    dirty?: DirtyStateResource;
    compositionCache?: CompositionPreviewCacheRuntime;
    surfaceCache?: PreviewSurfaceCacheRuntime;
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
    draftTransformSnapshot: DraftTransformSnapshot | null;
    setDraftTransformSnapshot: (snapshot: DraftTransformSnapshot | null) => void;
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
        selection: TimelineSelection
      ) => void;
      enterComposition: (compId: string) => void;
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
    draftTransformSnapshot: options.interaction.draftTransformSnapshot,
  });
  const pointer = useCanvasPointerController();
  const previewUpdatePipeline = usePreviewUpdatePipeline({
    previewScene: options.render.previewScene,
    evaluatedScene: options.render.evaluatedScene,
    metrics: options.render.metrics,
    dirty: options.render.dirty,
  });
  const transform = useCanvasTransformComposer({
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
    drafts: options.interaction.drafts,
    state: options.interaction.state,
    history: options.interaction.history,
    commands: options.interaction.commands,
    pointer,
    previewUpdates: previewUpdatePipeline.commands,
    setDraftTransformSnapshot: options.interaction.setDraftTransformSnapshot,
    metrics: options.render.metrics,
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
    draftTransformSnapshot: options.interaction.draftTransformSnapshot,
    seekFrame: options.interaction.seekFrame,
    drafts: options.interaction.drafts,
    commands: options.interaction.commands,
    history: options.interaction.history,
    state: options.interaction.state,
    pointer,
  });
  const directSelection = useCanvasDirectSelectionController({
    overlayRef,
    selectedCompId: options.project.selectedCompId,
    evaluatedScene: options.render.evaluatedScene,
    renderItems: options.render.items,
    timelineItems: options.selection.timelineItems,
    layersById: options.interaction.allLayersById,
    compositionsById: options.interaction.allCompositionsById,
    metaByCompId: options.selection.metaByCompId,
    viewportScale: viewport.readModel.previewZoom,
    viewportOffset: viewport.readModel.previewViewportOffset,
    viewportSize: {
      width: viewport.readModel.previewViewportWidth,
      height: viewport.readModel.previewViewportHeight,
    },
    selectedTimelineItem: options.interaction.selectedTimelineTargetItem,
    draftTransformSnapshot: options.interaction.draftTransformSnapshot,
    isGlowEnabled: options.state.showSelectionGlow,
    applySelection: options.interaction.commands.applySelection,
    enterComposition: options.interaction.commands.enterComposition,
    startPositionDrag: transform.startPositionDrag,
  });
  const selectedMeta = options.project.selectedMeta ?? {
    width: 1,
    height: 1,
    layerCount: 0,
    sourceFileName: "",
    frameRate: 1,
    durationFrames: 1,
  };
  const draftOverlayRuntime = resolveDraftOverlayRuntimeValuesForTarget(
    options.selection.target,
    options.interaction.draftTransformSnapshot
  );
  const gizmo = useCanvasGizmoController({
    viewportScale: viewport.readModel.previewZoom,
    viewportOffset: viewport.readModel.previewViewportOffset,
    previewSize: viewport.readModel.previewSize,
    selectedMeta,
    selection,
    motionPath: motionPath.motionPath,
    currentOpacity: draftOverlayRuntime?.opacity ?? options.interaction.resolvedOpacity,
    currentRotation: draftOverlayRuntime?.rotation ?? options.interaction.resolvedRotation,
    currentScale: draftOverlayRuntime?.scale ?? options.interaction.resolvedScale,
    state: options.interaction.state,
    transform,
    pressTarget: directSelection.pressTarget,
    motion: motionPath,
    directInput: {
      commitScale: options.interaction.commands.commitScaleInput,
      commitRotation: options.interaction.commands.commitRotationInput,
      commitOpacity: options.interaction.commands.commitOpacityInput,
    },
  });
  useCanvasRenderController({
    canvasRef,
    renderFrame: options.render.frame,
    previewScene: previewUpdatePipeline.previewScene,
    isPreviewDraftActive: previewUpdatePipeline.isPreviewDraftActive,
    renderItems: options.render.items,
    resolveDrawableSource: options.render.resolveDrawableSource,
    pixelScale: options.render.pixelScale,
    previewQuality: options.render.previewQuality,
    metrics: options.render.metrics,
    compositionCache: options.render.compositionCache,
    surfaceCache: options.render.surfaceCache,
  });

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
    interaction: { ...gizmo, glow: directSelection.glow, hover: directSelection.hover },
    draftTransformCommands: {
      updateAnchor: transform.updateAnchorDraft,
      reset: transform.resetDraftRuntime,
    },
  };
}

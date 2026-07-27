import {
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  LayerDocumentEditorFrameReadModelResult,
  LayerDocumentSourceSamplingQuality,
  LayerDocumentSourceRuntimeResource,
  LayerDocumentSourceRuntimeResourcePort,
  PreviewScene,
  RuntimeMetricRecordPort,
} from "@/render";
import {
  createLayerDocumentCanvasCommands,
} from "@/engines/canvas/adapters/layerDocumentCanvasCommandAdapter";
import {
  createLayerDocumentCanvasRenderAssetPort,
} from "@/engines/canvas/adapters/layerDocumentCanvasRenderAssetAdapter";
import {
  buildLayerDocumentCanvasReadModel,
  mapCanvasPreviewQualityToSourceSamplingQuality,
} from "@/engines/canvas/adapters/layerDocumentCanvasReadAdapter";
import {
  useLayerDocumentCanvasPreviewBridge,
} from "@/engines/canvas/adapters/useLayerDocumentCanvasPreviewBridge";
import {
  useCanvasGuideController,
} from "@/engines/canvas/controllers/useCanvasGuideController";
import {
  useCanvasRenderController,
} from "@/engines/canvas/controllers/useCanvasRenderController";
import {
  useCanvasViewportEngine,
} from "@/engines/canvas/useCanvasViewportEngine";
import {
  useCanvasPreviewRuntime,
} from "@/engines/canvas/useCanvasPreviewRuntime";
import {
  PREVIEW_QUALITY_SCALE,
} from "@/engines/canvas/constants/previewQualityConstants";
import {
  createRuntimeMetricRecordPort,
} from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import {
  buildPreviewQualityControlViewModel,
} from "@/engines/canvas/helpers/previewQualityControlHelpers";
import type {
  CanvasInteractionStatePort,
} from "@/engines/canvas/models/canvasInteractionModel";
import type {
  CanvasViewportStatePort,
} from "@/engines/canvas/models/canvasEngineModel";
import type {
  LayerDocumentCanvasCommandPort,
  LayerDocumentCanvasSceneDescriptor,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";
import type {
  CanvasPreviewPaneProps,
} from "@/engines/canvas/models/canvasPreviewPaneModel";

export interface LayerDocumentCanvasReadPort {
  readonly read: (options: {
    sourceSamplingQuality:
      LayerDocumentSourceSamplingQuality;
    runtimeMetrics?: RuntimeMetricRecordPort;
  }) => {
    readonly selectedLayerDocumentId: string | null;
    readonly runtime: LayerDocumentEditorFrameReadModelResult;
    readonly activeScene:
      LayerDocumentCanvasSceneDescriptor;
  };
}

function adaptRuntimeResource(
  resource: LayerDocumentSourceRuntimeResource
) {
  const image = resource.resource as CanvasImageSource;
  const candidate = resource.resource as {
    getContext?: unknown;
  } | null;
  return {
    source: {
      kind: "original" as const,
      image,
      pixelSize:
        resource.resolution.logicalSize,
    },
    alphaCanvas:
      candidate &&
      typeof candidate.getContext === "function"
        ? resource.resource as HTMLCanvasElement
        : null,
  };
}

export function useLayerDocumentCanvasComposition<
  TCommitResult,
  TSelectionResult,
  TKeyframeResult,
>(options: {
  readPort: LayerDocumentCanvasReadPort;
  commandPort: LayerDocumentCanvasCommandPort<
    TCommitResult,
    TSelectionResult,
    TKeyframeResult
  >;
  resources:
    LayerDocumentSourceRuntimeResourcePort;
  viewportState:
    CanvasViewportStatePort;
  interactionState:
    CanvasInteractionStatePort;
  isPreviewPanning: boolean;
  isPreviewPanModifierActive: boolean;
  setIsPreviewPanning:
    Dispatch<SetStateAction<boolean>>;
  setIsPreviewPanModifierActive:
    Dispatch<SetStateAction<boolean>>;
  minWorkspaceWidth: number;
  minWorkspaceHeight: number;
  shortformFrameWidth: number;
  shortformFrameHeight: number;
  resetRevision?: number;
}) {
  const previewRuntime =
    useCanvasPreviewRuntime();
  const runtimeMetrics = useMemo(
    () =>
      createRuntimeMetricRecordPort(
        previewRuntime.metrics
      ),
    [previewRuntime.metrics]
  );
  const previewQuality =
    previewRuntime.quality;
  const sourceSamplingQuality =
    mapCanvasPreviewQualityToSourceSamplingQuality(
      previewQuality
    );
  const consumer = options.readPort.read({
    sourceSamplingQuality,
    runtimeMetrics,
  });
  const selectedMeta = {
    width: consumer.activeScene.width,
    height: consumer.activeScene.height,
  };
  const viewport = useCanvasViewportEngine({
    minWorkspaceWidth:
      options.minWorkspaceWidth,
    minWorkspaceHeight:
      options.minWorkspaceHeight,
    shortformFrameWidth:
      options.shortformFrameWidth,
    shortformFrameHeight:
      options.shortformFrameHeight,
    project: {
      selectedCompId:
        consumer.activeScene.layerDocumentId,
      selectedMeta,
    },
    state: options.viewportState,
    panState: {
      setIsPreviewPanning:
        options.setIsPreviewPanning,
      setIsPreviewPanModifierActive:
        options.setIsPreviewPanModifierActive,
    },
  });
  const renderAssets = useMemo(
    () =>
      createLayerDocumentCanvasRenderAssetPort({
        resources: options.resources,
        adaptResource: adaptRuntimeResource,
      }),
    [options.resources]
  );
  const previousPreviewScene =
    useRef<PreviewScene | null>(null);
  const readResult = buildLayerDocumentCanvasReadModel({
    activeScene: consumer.activeScene,
    runtime: consumer.runtime,
    selectedLayerDocumentId:
      consumer.selectedLayerDocumentId,
    previewQuality,
    viewport: {
      previewSize:
        viewport.readModel.previewSize,
      viewportScale:
        viewport.readModel.previewZoom,
      viewportOffset:
        viewport.readModel.previewViewportOffset,
    },
    renderAssets,
    previousPreviewScene:
      // The prior fast-preview scene is an incremental renderer cache,
      // not application state.
      // eslint-disable-next-line react-hooks/refs
      previousPreviewScene.current,
    runtimeMetrics,
  });
  if (!readResult.ok) {
    throw new Error(
      `LayerDocument Canvas unavailable: ${readResult.reason}`
    );
  }
  const commandPort = options.commandPort;
  const commands = useMemo(
    () =>
      createLayerDocumentCanvasCommands({
        selectedLayerDocumentId:
          consumer.selectedLayerDocumentId,
        sourceSamplingQuality,
        port: commandPort,
        runtimeMetrics,
      }),
    [
      commandPort,
      consumer.selectedLayerDocumentId,
      sourceSamplingQuality,
      runtimeMetrics,
    ]
  );
  const overlayRef =
    useRef<HTMLDivElement | null>(null);
  const bridge =
    useLayerDocumentCanvasPreviewBridge({
      overlayRef,
      readModel: readResult.model,
      commands,
      state: options.interactionState,
      isGlowEnabled:
        options.viewportState.showSelectionGlow,
      viewportSize: {
        width:
          viewport.readModel.previewViewportWidth,
        height:
          viewport.readModel.previewViewportHeight,
      },
      resetRevision: options.resetRevision,
    });
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);
  const guide = useCanvasGuideController({
    previewSize:
      viewport.readModel.previewSize,
    zoom: viewport.readModel.previewZoom,
    shortformFrameWidth:
      options.shortformFrameWidth,
    shortformFrameHeight:
      options.shortformFrameHeight,
    showShortformFrame:
      options.viewportState
        .showShortformFrameOverlay,
    setShowShortformFrame:
      options.viewportState
        .setShowShortformFrameOverlay,
    showSafeZoneGuides:
      options.viewportState.showSafeZoneGuides,
    setShowSafeZoneGuides:
      options.viewportState
        .setShowSafeZoneGuides,
  });
  useCanvasRenderController({
    canvasRef,
    previewScene:
      bridge.renderer.previewScene,
    resolveNodeVisual:
      bridge.renderer.resolveNodeVisual,
    pixelScale:
      PREVIEW_QUALITY_SCALE[previewQuality],
    previewQuality,
    metrics: previewRuntime.metrics,
    compositionCache:
      previewRuntime.compositionCache,
    surfaceCache: previewRuntime.surfaceCache,
    onCanvasPainted:
      previewRuntime.fps.recordFrame,
  });
  useEffect(() => {
    previousPreviewScene.current =
      bridge.renderer.previewScene;
  }, [bridge.renderer.previewScene]);
  const previewQualityControl = useMemo(
    () =>
      buildPreviewQualityControlViewModel({
        preference: previewRuntime.preference,
        quality: previewQuality,
      }),
    [
      previewRuntime.preference,
      previewQuality,
    ]
  );
  const viewProps:
  CanvasPreviewPaneProps = {
    selectedLayerDocumentId:
      readResult.model.selectedLayerDocumentId,
    selectedSourceId:
      readResult.model.selectedInput?.sourceId ?? null,
    activeScene:
      bridge.previewWorkspaceScene,
    previewWorkspaceRef: viewport.workspaceRef,
    previewViewportRef: viewport.viewportRef,
    previewCanvasRef: canvasRef,
    previewOverlayRef: overlayRef,
    previewBaseOffset:
      viewport.readModel.previewBaseOffset,
    previewPan:
      options.viewportState.previewPan,
    previewZoom:
      options.viewportState.previewZoom,
    previewZoomPercent:
      viewport.readModel.previewZoomPercent,
    previewQuality: previewQualityControl,
    previewQualityCommands:
      previewRuntime.commands,
    canvasFpsRuntime: previewRuntime.fps,
    previewSize:
      viewport.readModel.previewSize,
    previewViewportWidth:
      viewport.readModel.previewViewportWidth,
    previewViewportHeight:
      viewport.readModel.previewViewportHeight,
    guide: guide.viewModel,
    toggleShortformFrame:
      guide.commands.toggleShortformFrame,
    toggleSafeZone:
      guide.commands.toggleSafeZone,
    showSelectionGlow:
      options.viewportState.showSelectionGlow,
    toggleSelectionGlow: () =>
      options.viewportState
        .setShowSelectionGlow(
          (current) => !current
        ),
    resetPreviewView:
      viewport.commands.resetViewport,
    setOneToOnePreviewView:
      viewport.commands.setActualSize,
    centerPreviewView:
      viewport.commands.centerViewport,
    handlePreviewViewportWheel:
      viewport.pan.handleWheel,
    handlePreviewViewportMouseDownCapture:
      viewport.pan.handleMouseDownCapture,
    isPreviewPanning:
      options.isPreviewPanning,
    isPreviewPanModifierActive:
      options.isPreviewPanModifierActive,
    interactionViewModel:
      bridge.interactionViewModel,
    selectionGlow: bridge.selectionGlow,
    directSelectionHover:
      bridge.directSelectionHover,
    interactionCommands:
      bridge.interactionCommands,
  };
  return {
    viewProps,
    readModel: readResult.model,
    previewQuality,
  };
}

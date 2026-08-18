import {
  useEffect,
  useMemo,
  useRef,
  useState,
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
  useCanvasViewportRuntime,
} from "@/engines/canvas/useCanvasViewportRuntime";
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
import {
  getCanvasWheelZoom,
} from "@/engines/canvas/helpers/canvasViewportHelpers";
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

export function useLayerDocumentCanvasEngine<
  TCommitResult,
  TSelectionResult,
  TKeyframeResult,
>(options: {
  projectId: string;
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
  cameraScalePercent: number;
  setCameraScalePercent: (percent: number) => void;
  resetRevision?: number;
}) {
  const [cameraScaleDraft, setCameraScaleDraft] = useState(
    options.cameraScalePercent
  );
  useEffect(() => {
    setCameraScaleDraft(options.cameraScalePercent);
  }, [options.cameraScalePercent]);
  const previewRuntime =
    useCanvasPreviewRuntime(options.projectId);
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
  const evaluatedScene = consumer.runtime.ok
    ? consumer.runtime.model.scene
    : null;
  const canvasScene = evaluatedScene
    ? {
        ...consumer.activeScene,
        width: evaluatedScene.size.width,
        height: evaluatedScene.size.height,
      }
    : consumer.activeScene;
  const sceneOrigin = evaluatedScene?.origin ?? { x: 0, y: 0 };
  const selectedMeta = {
    width: canvasScene.width,
    height: canvasScene.height,
  };
  const cameraScale = Math.max(1, cameraScaleDraft) / 100;
  const cameraFitPadding = 1.02;
  const viewport = useCanvasViewportRuntime({
    minWorkspaceWidth:
      options.minWorkspaceWidth,
    minWorkspaceHeight:
      options.minWorkspaceHeight,
    shortformFrameWidth:
      options.shortformFrameWidth * cameraScale * cameraFitPadding,
    shortformFrameHeight:
      options.shortformFrameHeight * cameraScale * cameraFitPadding,
    project: {
      selectedCompId:
        canvasScene.layerDocumentId,
      selectedMeta,
    },
    state: options.viewportState,
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
    activeScene: canvasScene,
    runtime: consumer.runtime,
    selectedLayerDocumentId:
      consumer.selectedLayerDocumentId,
    previewQuality,
    viewport: {
      previewSize:
        viewport.readModel.previewSize,
      viewportScale:
        viewport.readModel.previewZoom,
      viewportOffset: {
        x:
          viewport.readModel.previewViewportOffset.x -
          sceneOrigin.x * viewport.readModel.previewZoom,
        y:
          viewport.readModel.previewViewportOffset.y -
          sceneOrigin.y * viewport.readModel.previewZoom,
      },
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
      isHighlightEnabled:
        options.viewportState.showSelectionHighlight,
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
    cameraScalePercent: cameraScaleDraft,
    cameraDimOpacityPercent:
      options.viewportState.cameraDimOpacityPercent,
    setCameraScalePercent:
      setCameraScaleDraft,
    commitCameraScalePercent:
      options.setCameraScalePercent,
  });
  useCanvasRenderController({
    canvasRef,
    previewScene:
      bridge.renderer.previewScene,
    resolveNodeVisual:
      bridge.renderer.resolveNodeVisual,
    pixelScale: PREVIEW_QUALITY_SCALE[previewQuality],
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
    setCameraScalePercent:
      guide.commands.setCameraScalePercent,
    commitCameraScalePercent:
      guide.commands.commitCameraScalePercent,
    cameraDimOpacityPercent:
      options.viewportState.cameraDimOpacityPercent,
    setCameraDimOpacityPercent: (percent) =>
      options.viewportState.setCameraDimOpacityPercent(
        Math.min(100, Math.max(0, percent))
      ),
    showSelectionHighlight:
      options.viewportState.showSelectionHighlight,
    toggleSelectionHighlight: () =>
      options.viewportState
        .setShowSelectionHighlight(
          (current) => !current
        ),
    showWhiteBackground:
      options.viewportState.showWhiteBackground,
    toggleWhiteBackground: () =>
      options.viewportState.setShowWhiteBackground(
        (current) => !current
      ),
    resetPreviewView:
      viewport.commands.resetViewport,
    setOneToOnePreviewView:
      viewport.commands.setActualSize,
    zoomOutPreviewView: () =>
      viewport.commands.applyZoom(
        getCanvasWheelZoom(options.viewportState.previewZoom, 1)
      ),
    zoomInPreviewView: () =>
      viewport.commands.applyZoom(
        getCanvasWheelZoom(options.viewportState.previewZoom, -1)
      ),
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
    selectionHighlight: bridge.selectionHighlight,
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

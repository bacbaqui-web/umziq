import {
  useEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  LayerDocumentRuntimeReadModelResult,
  LayerDocumentSourceRuntimeResource,
  LayerDocumentSourceRuntimeResourcePort,
  PreviewScene,
  RendererMode,
} from "@/engines/playback-render";
import {
  createLayerDocumentCanvasCommands,
} from "@/engines/canvas/adapters/layerDocumentCanvasCommandAdapter";
import {
  createLayerDocumentCanvasRenderAssetPort,
} from "@/engines/canvas/adapters/layerDocumentCanvasRenderAssetAdapter";
import {
  buildLayerDocumentCanvasModeReadModel,
} from "@/engines/canvas/adapters/layerDocumentCanvasModeAdapter";
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
} from "@/engines/canvas/models/layerDocumentCanvasModeModel";
import type PreviewWorkspacePane
  from "@/features/preview/components/PreviewWorkspacePane";

export interface LayerDocumentCanvasReadPort {
  readonly read: (options: {
    quality: string;
    rendererMode: RendererMode;
  }) => {
    readonly selectedLayerDocumentId: string | null;
    readonly runtime: LayerDocumentRuntimeReadModelResult;
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
  rendererMode: RendererMode;
  setRendererMode: (mode: RendererMode) => void;
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
  const quality =
    previewRuntime.build.activeQuality ??
    previewRuntime.automaticQuality
      .resolvedQuality;
  const consumer = options.readPort.read({
    quality,
    rendererMode: options.rendererMode,
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
  const mode = buildLayerDocumentCanvasModeReadModel({
    mode: "layer-document",
    activeScene: consumer.activeScene,
    runtime: consumer.runtime,
    selectedLayerDocumentId:
      consumer.selectedLayerDocumentId,
    rendererMode: options.rendererMode,
    quality,
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
  });
  if (!mode.ok) {
    throw new Error(
      `LayerDocument Canvas unavailable: ${mode.reason}`
    );
  }
  const commandPort = options.commandPort;
  const commands = useMemo(
    () =>
      createLayerDocumentCanvasCommands({
        selectedLayerDocumentId:
          consumer.selectedLayerDocumentId,
        quality,
        port: commandPort,
      }),
    [
      commandPort,
      consumer.selectedLayerDocumentId,
      quality,
    ]
  );
  const overlayRef =
    useRef<HTMLDivElement | null>(null);
  const bridge =
    useLayerDocumentCanvasPreviewBridge({
      overlayRef,
      readModel: mode.model,
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
  const isDraftActive =
    consumer.runtime.ok &&
    consumer.runtime.model.inputs.some(
      (input) => input.draftApplied
    );
  useCanvasRenderController({
    canvasRef,
    renderFrame:
      bridge.renderer.renderFrame,
    previewScene:
      bridge.renderer.previewScene,
    isPreviewDraftActive: isDraftActive,
    resolveNodeVisual:
      bridge.renderer.resolveNodeVisual,
    pixelScale:
      PREVIEW_QUALITY_SCALE[quality],
    previewQuality: quality,
    metrics: previewRuntime.metrics,
    compositionCache:
      previewRuntime.compositionCache,
    surfaceCache: previewRuntime.surfaceCache,
  });
  useEffect(() => {
    previousPreviewScene.current =
      bridge.renderer.previewScene;
  }, [bridge.renderer.previewScene]);
  const previewQuality = useMemo(
    () =>
      buildPreviewQualityControlViewModel({
        preference:
          previewRuntime.preference,
        automaticQuality:
          previewRuntime.automaticQuality,
        memoryEstimates:
          previewRuntime.memoryEstimates,
        build: previewRuntime.build,
      }),
    [
      previewRuntime.build,
      previewRuntime.automaticQuality,
      previewRuntime.memoryEstimates,
      previewRuntime.preference,
    ]
  );
  const viewProps:
  ComponentProps<typeof PreviewWorkspacePane> = {
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
    rendererMode: options.rendererMode,
    setRendererMode: options.setRendererMode,
    previewQuality,
    previewQualityCommands:
      previewRuntime.commands,
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
    readModel: mode.model,
    quality,
  };
}

import type {
  LayerDocumentTransformDraftSnapshot,
} from "@/engines/playback-render";
import {
  applyLayerDocumentTransformDraft,
  evaluateLayerDocumentTransform,
  isLayerDocumentDraftForInput,
} from "@/engines/playback-render";
import type {
  LayerDocumentPropertiesCommandPort,
} from "@/engines/properties";
import type {
  LayerDocumentPsdTreeCommandPort,
} from "@/engines/project";
import {
  layerDocumentGlobalFrameToLocalFrame,
} from "@/models";
import type {
  LayerDocumentConsumerCutoverAssembly,
} from "@/cutover/layerDocumentConsumerCutoverModel";

function frameRateForLayer(
  assembly: LayerDocumentConsumerCutoverAssembly,
  layerDocumentId: string
) {
  const project = assembly.project.read();
  const layer = project.payload.layerDocumentsById[layerDocumentId];
  const parentId = layer?.common.placement.parentLayerDocumentId;
  const parent = parentId
    ? project.payload.layerDocumentsById[parentId]
    : layer;
  return parent?.type === "group" ? parent.data.frameRate : 30;
}

/**
 * Cutover-side adapter: engines expose narrow ports and never import this
 * assembly. Display values are evaluated from the owner project before a
 * matching common Draft snapshot is applied.
 */
export function createLayerDocumentPropertiesCommandPort(options: {
  assembly: LayerDocumentConsumerCutoverAssembly;
  readDraft: () => LayerDocumentTransformDraftSnapshot | null;
  quality?: string;
}): LayerDocumentPropertiesCommandPort {
  const read = () => {
    const descriptor = options.assembly.properties.describe();
    const globalFrame =
      options.assembly.playback.read().currentFrame;
    if (descriptor.status !== "ready") {
      return {
        descriptor,
        globalFrame,
        localFrame: null,
        displayedTransform: null,
      };
    }
    const project = options.assembly.project.read();
    const layer = project.payload.layerDocumentsById[
      descriptor.descriptor.layerDocumentId
    ];
    if (!layer) {
      return {
        descriptor,
        globalFrame,
        localFrame: null,
        displayedTransform: null,
      };
    }
    const localFrame = layerDocumentGlobalFrameToLocalFrame(
      globalFrame,
      layer.common.placement
    );
    const base = evaluateLayerDocumentTransform(
      layer,
      localFrame,
      frameRateForLayer(options.assembly, layer.layerDocumentId)
    );
    const input = {
      layerDocumentId: layer.layerDocumentId,
      globalFrame,
      localFrame,
    };
    const draft = options.readDraft();
    const evaluated = isLayerDocumentDraftForInput(input, draft)
      ? applyLayerDocumentTransformDraft(base, draft.patch)
      : base;
    return {
      descriptor,
      globalFrame,
      localFrame,
      displayedTransform: {
        position: { ...evaluated.transform.position },
        transformOffset: { ...evaluated.transform.transformOffset },
        anchor: { ...evaluated.transform.anchor },
        scale: { ...evaluated.transform.scale },
        scaleLinked: layer.common.transform.scaleLinked,
        rotation: evaluated.transform.rotation,
        opacity: evaluated.opacity,
      },
    };
  };
  return {
    read,
    preview: (layerDocumentId, patch) => {
      const prepared = options.assembly.canvas.pointerMove({
        layerDocumentId,
        patch,
        quality: options.quality ?? "preview",
      });
      return prepared ? { ok: true } : { ok: false };
    },
    commit: options.assembly.canvas.pointerUp,
    cancel: options.assembly.canvas.cancelDraft,
    dispatchPanel: options.assembly.properties.dispatch,
    dispatchTimeline: options.assembly.timeline.dispatchIntent,
    selectKeyframe:
      options.assembly.timeline.selectTransformKeyframe,
    readSelectedKeyframe: () =>
      options.assembly.timeline.readViewProps()
        .selectedTransformKeyframe,
  };
}

export function createLayerDocumentPsdTreeCommandPort(
  assembly: LayerDocumentConsumerCutoverAssembly
): LayerDocumentPsdTreeCommandPort {
  return {
    readTree: assembly.sources.readTree,
    readProject: assembly.project.read,
    selectSource: assembly.selection.selectSource,
    confirmImport: assembly.sources.confirmPreparedPsdImport,
    cancelImport: assembly.sources.cancelPreparedPsdImport,
    confirmRefresh: assembly.sources.confirmPreparedPsdRefresh,
    cancelRefresh: assembly.sources.cancelPreparedPsdRefresh,
    refreshSource: assembly.sources.refreshSource,
    reconnect: assembly.sources.reconnect,
    deleteSource: assembly.sources.deleteSource,
  };
}

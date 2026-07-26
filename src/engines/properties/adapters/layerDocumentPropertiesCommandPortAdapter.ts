import {
  layerDocumentGlobalFrameToLocalFrame,
  type LayerDocumentProject,
  type LayerDocumentTimelineIntent,
} from "@/models";
import {
  applyLayerDocumentTransformDraft,
  evaluateLayerDocumentTransform,
  isLayerDocumentDraftForInput,
  type LayerDocumentTransformDraftSnapshot,
  type PreviewSceneTransformPatch,
} from "@/engines/playback-render";
import type {
  LayerDocumentTransformKeyframeSelection,
} from "@/engines/project";
import type {
  LayerDocumentPanelCommand,
  LayerDocumentPanelDescriptorResult,
} from "@/engines/properties/models/layerDocumentPanelModel";
import type {
  LayerDocumentPropertiesCommandPort,
} from "@/engines/properties/adapters/layerDocumentPropertiesController";

function frameRateForLayer(
  project: LayerDocumentProject,
  layerDocumentId: string
) {
  const layer =
    project.payload.layerDocumentsById[layerDocumentId];
  const parentId =
    layer?.common.placement.parentLayerDocumentId;
  const parent = parentId
    ? project.payload.layerDocumentsById[parentId]
    : layer;
  return parent?.type === "group"
    ? parent.data.frameRate
    : 30;
}

export function createLayerDocumentPropertiesCommandPort(
  options: {
    readDescriptor:
      () => LayerDocumentPanelDescriptorResult;
    readProject: () => LayerDocumentProject;
    readDraft:
      () => LayerDocumentTransformDraftSnapshot | null;
    readGlobalFrame: () => number;
    previewDraft: (command: {
      layerDocumentId: string;
      patch: PreviewSceneTransformPatch;
      quality: string;
      globalFrame: number;
    }) => unknown | null;
    commitDraft:
      LayerDocumentPropertiesCommandPort["commit"];
    cancelDraft:
      LayerDocumentPropertiesCommandPort["cancel"];
    dispatchPanel: (
      command: LayerDocumentPanelCommand
    ) => { readonly ok: boolean };
    dispatchTimeline: (
      intent: LayerDocumentTimelineIntent
    ) => { readonly ok: boolean };
    selectKeyframe: (
      selection:
        LayerDocumentTransformKeyframeSelection | null
    ) => unknown;
    readSelectedKeyframe:
      () => LayerDocumentTransformKeyframeSelection | null;
    quality?: string;
  }
): LayerDocumentPropertiesCommandPort {
  const read = () => {
    const descriptor = options.readDescriptor();
    const globalFrame = options.readGlobalFrame();
    if (descriptor.status !== "ready") {
      return {
        descriptor,
        globalFrame,
        localFrame: null,
        displayedTransform: null,
      };
    }
    const project = options.readProject();
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
    const localFrame =
      layerDocumentGlobalFrameToLocalFrame(
        globalFrame,
        layer.common.placement
      );
    const base = evaluateLayerDocumentTransform(
      layer,
      localFrame,
      frameRateForLayer(
        project,
        layer.layerDocumentId
      )
    );
    const input = {
      layerDocumentId: layer.layerDocumentId,
      globalFrame,
      localFrame,
    };
    const draft = options.readDraft();
    const evaluated =
      isLayerDocumentDraftForInput(input, draft)
        ? applyLayerDocumentTransformDraft(
            base,
            draft.patch
          )
        : base;
    return {
      descriptor,
      globalFrame,
      localFrame,
      displayedTransform: {
        position: { ...evaluated.transform.position },
        transformOffset: {
          ...evaluated.transform.transformOffset,
        },
        anchor: { ...evaluated.transform.anchor },
        scale: { ...evaluated.transform.scale },
        scaleLinked:
          layer.common.transform.scaleLinked,
        rotation: evaluated.transform.rotation,
        opacity: evaluated.opacity,
      },
    };
  };
  return {
    read,
    preview: (layerDocumentId, patch) => {
      const prepared = options.previewDraft({
        layerDocumentId,
        patch,
        quality: options.quality ?? "preview",
        globalFrame: options.readGlobalFrame(),
      });
      return prepared ? { ok: true } : { ok: false };
    },
    commit: options.commitDraft,
    cancel: options.cancelDraft,
    dispatchPanel: options.dispatchPanel,
    dispatchTimeline: options.dispatchTimeline,
    selectKeyframe: options.selectKeyframe,
    readSelectedKeyframe:
      options.readSelectedKeyframe,
  };
}

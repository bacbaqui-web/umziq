import {
  layerDocumentGlobalFrameToLocalFrame,
  type LayerDocumentProject,
  type LayerDocumentTimelineIntent,
} from "@/models";
import {
  applyLayerDocumentTransformDraft,
  evaluateLayerDocumentTransform,
  isLayerDocumentDraftForInput,
  type LayerDocumentSourceSamplingQuality,
  type LayerDocumentTransformDraftSnapshot,
  type PreviewSceneTransformPatch,
} from "@/render";
import type {
  LayerDocumentTransformKeyframeSelection,
} from "@/engines/project";
import type {
  LayerDocumentPropertiesCommand,
  LayerDocumentPropertiesDescriptorResult,
} from "@/engines/visual/models/layerDocumentPropertiesModel";
import type {
  LayerDocumentPropertiesCommandPort,
} from "@/engines/visual/controllers/layerDocumentPropertiesController";

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

function parentCenterForLayer(
  project: LayerDocumentProject,
  layerDocumentId: string
) {
  const layer = project.payload.layerDocumentsById[layerDocumentId];
  const parentId = layer?.common.placement.parentLayerDocumentId;
  const parent = parentId
    ? project.payload.layerDocumentsById[parentId]
    : null;
  return parent?.type === "group"
    ? { x: parent.data.width / 2, y: parent.data.height / 2 }
    : { x: 0, y: 0 };
}

function toEditorPosition(
  position: { readonly x: number; readonly y: number },
  center: { readonly x: number; readonly y: number }
) {
  return { x: position.x - center.x, y: position.y - center.y };
}

function toStoredPosition(
  position: { readonly x: number; readonly y: number },
  center: { readonly x: number; readonly y: number }
) {
  return { x: position.x + center.x, y: position.y + center.y };
}

function descriptorInEditorCoordinates(
  result: LayerDocumentPropertiesDescriptorResult,
  center: { readonly x: number; readonly y: number }
): LayerDocumentPropertiesDescriptorResult {
  if (result.status !== "ready") return result;
  const descriptor = result.descriptor;
  return {
    ...result,
    descriptor: {
      ...descriptor,
      transform: {
        ...descriptor.transform,
        position: toEditorPosition(descriptor.transform.position, center),
      },
      animation: {
        ...descriptor.animation,
        positionKeyframes: descriptor.animation.positionKeyframes.map(
          (keyframe) => ({
            ...keyframe,
            value: toEditorPosition(keyframe.value, center),
          })
        ),
      },
    },
  };
}

function commandInStoredCoordinates(
  command: LayerDocumentPropertiesCommand,
  center: { readonly x: number; readonly y: number }
): LayerDocumentPropertiesCommand {
  if (command.kind === "upsert-position-keyframe") {
    return {
      ...command,
      value: toStoredPosition(command.value, center),
    };
  }
  if (command.kind === "set-animation") {
    return {
      ...command,
      animation: {
        ...command.animation,
        positionKeyframes: command.animation.positionKeyframes.map(
          (keyframe) => ({
            ...keyframe,
            value: toStoredPosition(keyframe.value, center),
          })
        ),
      },
    };
  }
  return command;
}

export function createLayerDocumentPropertiesCommandPort(
  options: {
    readDescriptor:
      () => LayerDocumentPropertiesDescriptorResult;
    readProject: () => LayerDocumentProject;
    readDraft:
      () => LayerDocumentTransformDraftSnapshot | null;
    readGlobalFrame: () => number;
    previewDraft: (command: {
      layerDocumentId: string;
      patch: PreviewSceneTransformPatch;
      sourceSamplingQuality:
        LayerDocumentSourceSamplingQuality;
      globalFrame: number;
    }) => unknown | null;
    commitDraft:
      LayerDocumentPropertiesCommandPort["commit"];
    cancelDraft:
      LayerDocumentPropertiesCommandPort["cancel"];
    dispatchPanel: (
      command: LayerDocumentPropertiesCommand
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
    sourceSamplingQuality?:
      LayerDocumentSourceSamplingQuality;
  }
): LayerDocumentPropertiesCommandPort {
  const read = () => {
    const rawDescriptor = options.readDescriptor();
    const globalFrame = options.readGlobalFrame();
    if (rawDescriptor.status !== "ready") {
      return {
        descriptor: rawDescriptor,
        globalFrame,
        localFrame: null,
        displayedTransform: null,
      };
    }
    const project = options.readProject();
    const layer = project.payload.layerDocumentsById[
      rawDescriptor.descriptor.layerDocumentId
    ];
    if (!layer) {
      return {
        descriptor: rawDescriptor,
        globalFrame,
        localFrame: null,
        displayedTransform: null,
      };
    }
    const center = parentCenterForLayer(project, layer.layerDocumentId);
    const descriptor = descriptorInEditorCoordinates(rawDescriptor, center);
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
        position: toEditorPosition(evaluated.transform.position, center),
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
      const project = options.readProject();
      const center = parentCenterForLayer(project, layerDocumentId);
      const prepared = options.previewDraft({
        layerDocumentId,
        patch: patch.position
          ? {
              ...patch,
              position: toStoredPosition(patch.position, center),
            }
          : patch,
        sourceSamplingQuality:
          options.sourceSamplingQuality ?? "preview",
        globalFrame: options.readGlobalFrame(),
      });
      return prepared ? { ok: true } : { ok: false };
    },
    commit: options.commitDraft,
    cancel: options.cancelDraft,
    dispatchPanel: (command) => {
      const center = parentCenterForLayer(
        options.readProject(),
        command.kind === "commit-transform"
          ? command.intent.layerDocumentId
          : command.layerDocumentId
      );
      return options.dispatchPanel(
        commandInStoredCoordinates(command, center)
      );
    },
    dispatchTimeline: options.dispatchTimeline,
    selectKeyframe: options.selectKeyframe,
    readSelectedKeyframe:
      options.readSelectedKeyframe,
  };
}

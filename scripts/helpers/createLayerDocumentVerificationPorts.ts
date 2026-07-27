import {
  createLayerDocumentCanvasDraftAdapter,
  type LayerDocumentCanvasDraftPort,
} from "@/engines/canvas/adapters/layerDocumentCanvasDraftAdapter";
import {
  createLayerDocumentPsdRuntimeRegistrationBridge,
  type LayerDocumentSourceRuntimeResourcePort,
  type RuntimeMetricRecordPort,
} from "@/render";
import type {
  LayerDocumentProjectOwnerEffect,
  LayerDocumentProjectOwnerPort,
  LayerDocumentSourcePreparationPort,
  LayerDocumentSourceRuntimeResolutionPort,
} from "@/engines/project";
import {
  createLayerDocumentPropertiesOwnerCommandAdapter,
} from "@/engines/properties/adapters/layerDocumentPropertiesOwnerCommandAdapter";
import type {
  LayerDocumentPanelCommandPreparation,
  LayerDocumentPanelPreparationPort,
} from "@/engines/properties/models/layerDocumentPanelModel";
import {
  createLayerDocumentPsdTreeSourceCommandAdapter,
} from "@/engines/psd-tree/adapters/layerDocumentPsdPreparedSourceAdapter";
import {
  createLayerDocumentTimelineCommandAdapter,
} from "@/engines/timeline/adapters/layerDocumentTimelineIntentCommitAdapter";
import {
  createLayerDocumentTimelineConsumerAdapter,
} from "@/engines/timeline/adapters/layerDocumentTimelineConsumerAdapter";
import {
  createLayerTypeOwnerCommandAdapter,
  type LayerDocumentAudioPreparationPort,
  type LayerDocumentDrawingPreparationPort,
  type LayerDocumentTextPreparationPort,
} from "@/layer-types";
import {
  createEditorProjectOwnerCommandAdapter,
  readEditorOwnerGroupScope,
  type EditorOwnerCommandResult,
} from "@/editor/project-owner";

/**
 * Verification-only fixture. Production wiring lives in the Editor Runtime,
 * Panel port hook, and Composition Root.
 */
export function createLayerDocumentVerificationPorts(
  input: {
    owner: LayerDocumentProjectOwnerPort;
    panelPreparation:
      LayerDocumentPanelPreparationPort;
    sourcePreparation:
      LayerDocumentSourcePreparationPort;
    drawingPreparation:
      LayerDocumentDrawingPreparationPort;
    textPreparation:
      LayerDocumentTextPreparationPort;
    audioPreparation:
      LayerDocumentAudioPreparationPort;
    sourceRuntime:
      LayerDocumentSourceRuntimeResourcePort;
    sourceResolution:
      LayerDocumentSourceRuntimeResolutionPort;
    draftSession: LayerDocumentCanvasDraftPort;
    effects: {
      applyOwnerEffect: (
        effect: LayerDocumentProjectOwnerEffect
      ) => void;
    };
    metrics: RuntimeMetricRecordPort;
  }
) {
  const readProject = () =>
    input.owner.state.currentProject;
  const readSelectedLayerDocumentId = () =>
    input.owner.state.session.layerSelection
      ?.layerDocumentId ?? null;
  const readActiveGroupLayerDocumentId = () =>
    input.owner.state.session.activeGroupLayerDocumentId;
  const readScope = () =>
    readEditorOwnerGroupScope(input.owner);
  const ownerCommands =
    createEditorProjectOwnerCommandAdapter({
      owner: input.owner,
      sourceRuntime: input.sourceRuntime,
      clearDraft: input.draftSession.clear,
      applyOwnerEffect:
        input.effects.applyOwnerEffect,
      incrementMetric: input.metrics.increment,
    });
  const timelineCommands =
    createLayerDocumentTimelineCommandAdapter({
      owner: input.owner,
      readProject,
      commit:
        ownerCommands.commitLayerPreparation,
      deliver: ownerCommands.deliver,
    });
  const timelineConsumer =
    createLayerDocumentTimelineConsumerAdapter({
      owner: input.owner,
      readProject,
      readActiveGroupLayerDocumentId,
      readSelectedLayerDocumentId,
      readScope,
      resolution: input.sourceResolution,
      selectLayer: ownerCommands.selectLayer,
      dispatchIntent:
        timelineCommands.dispatchIntent,
    });
  const propertiesOwner =
    createLayerDocumentPropertiesOwnerCommandAdapter<
      EditorOwnerCommandResult<
        LayerDocumentPanelCommandPreparation
      >
    >({
      readProject,
      readSelectedLayerDocumentId,
      preparation: input.panelPreparation,
      readSourceResolutionStatus: (sourceId) =>
        input.sourceResolution.read(sourceId).status,
      reject: ownerCommands.reject,
      commit:
        ownerCommands.commitLayerTransaction,
    });
  const canvasDraft =
    createLayerDocumentCanvasDraftAdapter<
      EditorOwnerCommandResult<
        LayerDocumentPanelCommandPreparation
      >
    >({
      readProject,
      readActiveGroupLayerDocumentId,
      readSelectedLayerDocumentId,
      readSelectedTransformKeyframe: () =>
        input.owner.state.runtimeSession
          .selectedTransformKeyframe,
      readScope,
      draft: input.draftSession,
      resolvePsdSource:
        input.sourceRuntime.createPsdResolver(),
      sourceResolution: input.sourceResolution,
      incrementMetric: input.metrics.increment,
      preparePointerMove:
        input.panelPreparation.draft
          .preparePointerMove,
      preparePointerUp:
        input.panelPreparation.draft.preparePointerUp,
      rejectCommit:
        propertiesOwner.rejectCanvasDraft,
      commitTransform:
        propertiesOwner.commitTransformIntent,
      commitMotionPath:
        propertiesOwner.commitPositionKeyframe,
    });
  const registrationBridge =
    createLayerDocumentPsdRuntimeRegistrationBridge(
      input.sourceRuntime
    );
  const sources =
    createLayerDocumentPsdTreeSourceCommandAdapter({
      readProject,
      readSelectedLayerDocumentId,
      readActiveGroupLayerDocumentId,
      readSourceSelection: () =>
        input.owner.state.session.sourceSelection,
      selectLayer: ownerCommands.selectLayer,
      selectSource: ownerCommands.selectSource,
      enterGroup: ownerCommands.enterGroup,
      preparation: input.sourcePreparation,
      commit:
        ownerCommands.commitSourcePreparation,
      bridge: registrationBridge,
      sourceResolution: input.sourceResolution,
    });
  return {
    project: {
      read: readProject,
      undo: ownerCommands.undo,
      redo: ownerCommands.redo,
    },
    selection: {
      selectLayer: ownerCommands.selectLayer,
      selectSource: ownerCommands.selectSource,
    },
    scope: {
      read: readScope,
      enter: ownerCommands.enterGroup,
    },
    timeline: {
      readViewProps:
        timelineConsumer.readViewProps,
      dispatchIntent:
        timelineCommands.dispatchIntent,
      selectTransformKeyframe:
        timelineCommands.selectTransformKeyframe,
      acknowledgeSourceStatus:
        ownerCommands.acknowledgeSourceStatus,
    },
    canvas: {
      readViewProps: canvasDraft.readViewProps,
      pointerMove: canvasDraft.publish,
      pointerUp: canvasDraft.commitTransform,
      motionPathPointerMove:
        canvasDraft.publishMotionPath,
      motionPathPointerUp:
        canvasDraft.commitMotionPath,
      cancelDraft: canvasDraft.cancel,
      directSelect: ownerCommands.selectLayer,
      selectMotionPathKeyframe:
        timelineCommands.selectTransformKeyframe,
    },
    properties: {
      describe: propertiesOwner.describe,
      dispatch: propertiesOwner.dispatch,
    },
    domains: createLayerTypeOwnerCommandAdapter({
      readProject,
      drawing: input.drawingPreparation,
      text: input.textPreparation,
      audio: input.audioPreparation,
      commit: ownerCommands.commitLayerPreparation,
    }),
    sources,
    runtime: {
      resources: input.sourceRuntime,
      resolutions: input.sourceResolution,
      registrationBridge,
    },
  };
}

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
  LayerDocumentNexusEffect,
  LayerDocumentNexusPort,
  LayerDocumentSourcePreparationPort,
  LayerDocumentSourceRuntimeResolutionPort,
} from "@/engines/project";
import {
  createLayerDocumentPropertiesNexusCommandAdapter,
} from "@/engines/visual/adapters/layerDocumentPropertiesNexusCommandAdapter";
import type {
  LayerDocumentPropertiesCommandPreparation,
} from "@/engines/visual/models/layerDocumentPropertiesModel";
import type {
  LayerDocumentPanelPreparationPort,
} from "@/engines/visual/models/layerDocumentPanelModel";
import {
  createLayerDocumentLibrarySourceCommandAdapter,
} from "@/engines/library/adapters/layerDocumentLibrarySourceCommandAdapter";
import {
  createLayerDocumentTimelineCommandAdapter,
} from "@/engines/timeline/adapters/layerDocumentTimelineIntentCommitAdapter";
import {
  createLayerDocumentTimelineConsumerAdapter,
} from "@/engines/timeline/adapters/layerDocumentTimelineConsumerAdapter";
import {
  createLayerTypeNexusCommandAdapter,
  type LayerDocumentAudioPreparationPort,
  type LayerDocumentDrawingPreparationPort,
  type LayerDocumentTextPreparationPort,
} from "@/layer-types";
import {
  createEditorNexusCommandAdapter,
  readEditorNexusGroupScope,
  type EditorNexusCommandResult,
} from "@/editor/nexus";

/**
 * Verification-only fixture. Production wiring lives in the Editor Runtime,
 * Panel port hook, and Composition Root.
 */
export function createLayerDocumentVerificationPorts(
  input: {
    nexus: LayerDocumentNexusPort;
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
      applyNexusEffect: (
        effect: LayerDocumentNexusEffect
      ) => void;
    };
    metrics: RuntimeMetricRecordPort;
  }
) {
  const readProject = () =>
    input.nexus.state.currentProject;
  const readSelectedLayerDocumentId = () =>
    input.nexus.state.session.layerSelection
      ?.layerDocumentId ?? null;
  const readActiveGroupLayerDocumentId = () =>
    input.nexus.state.session.activeGroupLayerDocumentId;
  const readScope = () =>
    readEditorNexusGroupScope(input.nexus);
  const nexusCommands =
    createEditorNexusCommandAdapter({
      nexus: input.nexus,
      sourceRuntime: input.sourceRuntime,
      clearDraft: input.draftSession.clear,
      applyNexusEffect:
        input.effects.applyNexusEffect,
      incrementMetric: input.metrics.increment,
    });
  const timelineCommands =
    createLayerDocumentTimelineCommandAdapter({
      nexus: input.nexus,
      readProject,
      commit:
        nexusCommands.commitLayerPreparation,
      deliver: nexusCommands.deliver,
    });
  const timelineConsumer =
    createLayerDocumentTimelineConsumerAdapter({
      nexus: input.nexus,
      readProject,
      readActiveGroupLayerDocumentId,
      readSelectedLayerDocumentId,
      readScope,
      resolution: input.sourceResolution,
      selectLayer: nexusCommands.selectLayer,
      dispatchIntent:
        timelineCommands.dispatchIntent,
    });
  const propertiesNexus =
    createLayerDocumentPropertiesNexusCommandAdapter<
      EditorNexusCommandResult<
        LayerDocumentPropertiesCommandPreparation
      >
    >({
      readProject,
      readSelectedLayerDocumentId,
      preparation: input.panelPreparation,
      readSourceResolutionStatus: (sourceId) =>
        input.sourceResolution.read(sourceId).status,
      reject: nexusCommands.reject,
      commit:
        nexusCommands.commitLayerTransaction,
    });
  const canvasDraft =
    createLayerDocumentCanvasDraftAdapter<
      EditorNexusCommandResult<
        LayerDocumentPropertiesCommandPreparation
      >
    >({
      readProject,
      readActiveGroupLayerDocumentId,
      readSelectedLayerDocumentId,
      readSelectedTransformKeyframe: () =>
        input.nexus.state.runtimeSession
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
        propertiesNexus.rejectCanvasDraft,
      commitTransform:
        propertiesNexus.commitTransformIntent,
      commitMotionPath:
        propertiesNexus.commitPositionKeyframe,
    });
  const registrationBridge =
    createLayerDocumentPsdRuntimeRegistrationBridge(
      input.sourceRuntime
    );
  const sources =
    createLayerDocumentLibrarySourceCommandAdapter({
      readProject,
      readSelectedLayerDocumentId,
      readActiveGroupLayerDocumentId,
      readSourceSelection: () =>
        input.nexus.state.session.sourceSelection,
      selectLayer: nexusCommands.selectLayer,
      selectSource: nexusCommands.selectSource,
      enterGroup: nexusCommands.enterGroup,
      preparation: input.sourcePreparation,
      commit:
        nexusCommands.commitSourcePreparation,
      bridge: registrationBridge,
      sourceResolution: input.sourceResolution,
    });
  return {
    project: {
      read: readProject,
      undo: nexusCommands.undo,
      redo: nexusCommands.redo,
    },
    selection: {
      selectLayer: nexusCommands.selectLayer,
      selectSource: nexusCommands.selectSource,
    },
    scope: {
      read: readScope,
      enter: nexusCommands.enterGroup,
    },
    timeline: {
      readViewProps:
        timelineConsumer.readViewProps,
      dispatchIntent:
        timelineCommands.dispatchIntent,
      selectTransformKeyframe:
        timelineCommands.selectTransformKeyframe,
      acknowledgeSourceStatus:
        nexusCommands.acknowledgeSourceStatus,
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
      directSelect: nexusCommands.selectLayer,
      selectMotionPathKeyframe:
        timelineCommands.selectTransformKeyframe,
    },
    properties: {
      describe: propertiesNexus.describe,
      dispatch: propertiesNexus.dispatch,
    },
    domains: createLayerTypeNexusCommandAdapter({
      readProject,
      drawing: input.drawingPreparation,
      text: input.textPreparation,
      audio: input.audioPreparation,
      commit: nexusCommands.commitLayerPreparation,
    }),
    sources,
    runtime: {
      resources: input.sourceRuntime,
      resolutions: input.sourceResolution,
      registrationBridge,
    },
  };
}

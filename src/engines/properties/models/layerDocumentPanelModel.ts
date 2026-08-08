import type {
  LayerDocumentProject,
} from "@/models";
import type {
  LayerDocumentDraftInteractionPreparation,
  LayerDocumentRuntimeInput,
  LayerDocumentTransformDraftSnapshot,
  PreviewSceneTransformPatch,
} from "@/render";
import type {
  LayerDocumentPropertiesCommand,
  LayerDocumentPropertiesCommandPreparation,
  LayerDocumentPropertiesDescriptorResult,
} from "@/engines/properties/models/layerDocumentPropertiesModel";

export interface LayerDocumentPanelPreparationPort {
  readonly query: {
    readonly describe: (options: {
      project: LayerDocumentProject;
      selectedLayerDocumentId: string | null;
      readSourceResolutionStatus: (
        sourceId: string
      ) =>
        | "unresolved"
        | "resolving"
        | "available"
        | "missing"
        | "error";
    }) => LayerDocumentPropertiesDescriptorResult;
  };
  readonly commands: {
    readonly prepare: (options: {
      project: LayerDocumentProject;
      selectedLayerDocumentId: string | null;
      command: LayerDocumentPropertiesCommand;
    }) => LayerDocumentPropertiesCommandPreparation;
  };
  readonly draft: {
    readonly preparePointerMove: (options: {
      input: LayerDocumentRuntimeInput;
      patch: PreviewSceneTransformPatch;
    }) => LayerDocumentDraftInteractionPreparation;
    readonly preparePointerUp: (
      draft: LayerDocumentTransformDraftSnapshot
    ) => LayerDocumentDraftInteractionPreparation;
  };
}

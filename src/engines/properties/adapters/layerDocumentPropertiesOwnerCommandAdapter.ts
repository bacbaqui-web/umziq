import type {
  LayerDocumentProject,
  Position,
} from "@/models";
import type {
  LayerDocumentTransformCommitIntent,
} from "@/render";
import type {
  LayerDocumentTransformKeyframeSelection,
} from "@/engines/project";
import type {
  LayerDocumentPropertiesCommand,
  LayerDocumentPropertiesCommandPreparation,
} from "@/engines/properties/models/layerDocumentPropertiesModel";
import type {
  LayerDocumentPanelPreparationPort,
} from "@/engines/properties/models/layerDocumentPanelModel";

export function createLayerDocumentPropertiesOwnerCommandAdapter<
  TCommandResult,
>(options: {
  readProject: () => LayerDocumentProject;
  readSelectedLayerDocumentId:
    () => string | null;
  preparation: LayerDocumentPanelPreparationPort;
  readSourceResolutionStatus: (
    sourceId: string
  ) =>
    | "unresolved"
    | "resolving"
    | "available"
    | "missing"
    | "error";
  reject: (
    message: string,
    preparation: LayerDocumentPropertiesCommandPreparation
  ) => TCommandResult;
  commit: (
    transaction: Extract<
      LayerDocumentPropertiesCommandPreparation,
      { readonly ok: true }
    >["transaction"],
    selection?:
      LayerDocumentTransformKeyframeSelection
  ) => TCommandResult;
}) {
  const commitPreparation = (
    preparation: LayerDocumentPropertiesCommandPreparation,
    selection?:
      LayerDocumentTransformKeyframeSelection
  ) =>
    preparation.ok
      ? options.commit(
          preparation.transaction,
          selection
        )
      : options.reject(
          preparation.message,
          preparation
        );
  const rejectCanvasDraft = (
    message: string,
    layerDocumentId: string | null
  ) => {
    const selectedLayerDocumentId =
      options.readSelectedLayerDocumentId();
    const preparation: Extract<
      LayerDocumentPropertiesCommandPreparation,
      { readonly ok: false }
    > = {
      ok: false,
      status: "rejected",
      selectedLayerDocumentId,
      layerDocumentId,
      reason: selectedLayerDocumentId
        ? "no-change"
        : "no-selection",
      errorCode: null,
      message,
      project: options.readProject(),
      projectUpdateCount: 0,
      transactionCount: 0,
      historyEntryCount: 0,
    };
    return options.reject(message, preparation);
  };
  return {
    commitPreparation,
    rejectCanvasDraft,
    describe: () =>
      options.preparation.query.describe({
        project: options.readProject(),
        selectedLayerDocumentId:
          options.readSelectedLayerDocumentId(),
        readSourceResolutionStatus:
          options.readSourceResolutionStatus,
      }),
    dispatch: (command: LayerDocumentPropertiesCommand) =>
      commitPreparation(
        options.preparation.commands.prepare({
          project: options.readProject(),
          selectedLayerDocumentId:
            options.readSelectedLayerDocumentId(),
          command,
        })
      ),
    commitTransformIntent: (
      intent: LayerDocumentTransformCommitIntent
    ) =>
      commitPreparation(
        options.preparation.commands.prepare({
          project: options.readProject(),
          selectedLayerDocumentId:
            options.readSelectedLayerDocumentId(),
          command: {
            kind: "commit-transform",
            intent,
          },
        })
      ),
    commitPositionKeyframe: (command: {
      layerDocumentId: string;
      localFrame: number;
      globalFrame: number;
      position: Position;
    }) =>
      commitPreparation(
        options.preparation.commands.prepare({
          project: options.readProject(),
          selectedLayerDocumentId:
            options.readSelectedLayerDocumentId(),
          command: {
            kind: "upsert-position-keyframe",
            layerDocumentId:
              command.layerDocumentId,
            localFrame: command.localFrame,
            value: command.position,
          },
        }),
        {
          layerDocumentId:
            command.layerDocumentId,
          property: "position",
          localFrame: command.localFrame,
          globalFrame: command.globalFrame,
        }
      ),
  };
}

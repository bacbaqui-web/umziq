import type {
  LayerDocumentProject,
  Position,
} from "@/models";
import type {
  LayerDocumentTransformCommitIntent,
} from "@/engines/playback-render";
import type {
  LayerDocumentTransformKeyframeSelection,
} from "@/engines/project";
import type {
  LayerDocumentPanelCommand,
  LayerDocumentPanelCommandPreparation,
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
    preparation: LayerDocumentPanelCommandPreparation
  ) => TCommandResult;
  commit: (
    transaction: Extract<
      LayerDocumentPanelCommandPreparation,
      { readonly ok: true }
    >["transaction"],
    selection?:
      LayerDocumentTransformKeyframeSelection
  ) => TCommandResult;
}) {
  const commitPreparation = (
    preparation: LayerDocumentPanelCommandPreparation,
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
      LayerDocumentPanelCommandPreparation,
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
    dispatch: (command: LayerDocumentPanelCommand) =>
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

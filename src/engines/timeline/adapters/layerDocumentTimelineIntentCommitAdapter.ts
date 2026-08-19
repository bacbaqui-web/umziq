import {
  buildLayerDocumentTimelineIntentTransaction,
  layerDocumentLocalFrameToGlobalFrame,
  type LayerDocumentProject,
  type LayerDocumentTimelineIntent,
  type LayerDocumentTransactionResult,
} from "@/models";
import type {
  LayerDocumentNexusPort,
  LayerDocumentNexusTransitionResult,
  LayerDocumentTransformKeyframeSelection,
  NexusSelectionPort,
} from "@/engines/project";

type LegacyNexusTransitionPort = Pick<
  LayerDocumentNexusPort,
  "transition"
>;

export interface LayerDocumentTimelineNexusCommitPreparation {
  readonly transaction:
    LayerDocumentTransactionResult;
  readonly selectTransformKeyframe?:
    LayerDocumentTransformKeyframeSelection;
}

export function prepareLayerDocumentTimelineNexusCommit(
  project: LayerDocumentProject,
  intent: LayerDocumentTimelineIntent
): LayerDocumentTimelineNexusCommitPreparation {
  const transaction =
    buildLayerDocumentTimelineIntentTransaction(
      project,
      intent
    );
  if (
    intent.kind !== "move-keyframe" ||
    !transaction.ok
  ) {
    return { transaction };
  }
  const layer =
    transaction.transaction.after.payload
      .layerDocumentsById[intent.layerDocumentId];
  return {
    transaction,
    selectTransformKeyframe: {
      layerDocumentId: intent.layerDocumentId,
      property: intent.property,
      localFrame: intent.toLocalFrame,
      globalFrame:
        layerDocumentLocalFrameToGlobalFrame(
          intent.toLocalFrame,
          layer.common.placement
        ),
    },
  };
}

export function transitionLayerDocumentTimelineKeyframeSelection(
  nexus: NexusSelectionPort | LegacyNexusTransitionPort,
  selection:
    LayerDocumentTransformKeyframeSelection | null
): LayerDocumentNexusTransitionResult {
  return "selectTransformKeyframe" in nexus
    ? nexus.selectTransformKeyframe(selection)
    : nexus.transition({
        kind: "set-transform-keyframe-selection",
        selection,
      });
}

export function createLayerDocumentTimelineCommandAdapter<
  TCommandResult,
>(options: {
  nexus: NexusSelectionPort | LegacyNexusTransitionPort;
  readProject: () => LayerDocumentProject;
  commit: (
    transaction: LayerDocumentTransactionResult,
    selection?:
      LayerDocumentTransformKeyframeSelection
  ) => TCommandResult;
  deliver: (
    transition:
      LayerDocumentNexusTransitionResult
  ) => TCommandResult;
}) {
  return {
    dispatchIntent: (
      intent: LayerDocumentTimelineIntent
    ) => {
      const prepared =
        prepareLayerDocumentTimelineNexusCommit(
          options.readProject(),
          intent
        );
      return options.commit(
        prepared.transaction,
        prepared.selectTransformKeyframe
      );
    },
    selectTransformKeyframe: (
      selection:
        LayerDocumentTransformKeyframeSelection | null
    ) =>
      options.deliver(
        transitionLayerDocumentTimelineKeyframeSelection(
          options.nexus,
          selection
        )
      ),
  };
}

import {
  buildLayerDocumentTimelineIntentTransaction,
  layerDocumentLocalFrameToGlobalFrame,
  type LayerDocumentProject,
  type LayerDocumentTimelineIntent,
  type LayerDocumentTransactionResult,
} from "@/models";
import type {
  LayerDocumentProjectOwnerPort,
  LayerDocumentProjectOwnerTransitionResult,
  LayerDocumentTransformKeyframeSelection,
} from "@/engines/project";

export interface LayerDocumentTimelineOwnerCommitPreparation {
  readonly transaction:
    LayerDocumentTransactionResult;
  readonly selectTransformKeyframe?:
    LayerDocumentTransformKeyframeSelection;
}

export function prepareLayerDocumentTimelineOwnerCommit(
  project: LayerDocumentProject,
  intent: LayerDocumentTimelineIntent
): LayerDocumentTimelineOwnerCommitPreparation {
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
  owner: LayerDocumentProjectOwnerPort,
  selection:
    LayerDocumentTransformKeyframeSelection | null
): LayerDocumentProjectOwnerTransitionResult {
  return owner.transition({
    kind: "set-transform-keyframe-selection",
    selection,
  });
}

export function createLayerDocumentTimelineCommandAdapter<
  TCommandResult,
>(options: {
  owner: LayerDocumentProjectOwnerPort;
  readProject: () => LayerDocumentProject;
  commit: (
    transaction: LayerDocumentTransactionResult,
    selection?:
      LayerDocumentTransformKeyframeSelection
  ) => TCommandResult;
  deliver: (
    transition:
      LayerDocumentProjectOwnerTransitionResult
  ) => TCommandResult;
}) {
  return {
    dispatchIntent: (
      intent: LayerDocumentTimelineIntent
    ) => {
      const prepared =
        prepareLayerDocumentTimelineOwnerCommit(
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
          options.owner,
          selection
        )
      ),
  };
}

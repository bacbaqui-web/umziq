import type {
  LayerDocumentProject,
} from "@/models/layerDocumentModel";
import type {
  LayerDocumentTimelineIntent,
} from "@/models/layerDocumentTimelineIntentModel";
import type {
  LayerDocumentTransactionResult,
} from "@/models/layerDocumentTransactionModel";
import {
  buildSetLayerDocumentNameTransaction,
  buildUpdateLayerDocumentCommonTransaction,
  buildUpdateLayerDocumentDomainTransaction,
} from "@/models/layerDocumentContentTransactions";
import {
  buildDeleteLayerDocumentTransaction,
  buildDuplicateLayerDocumentTransaction,
} from "@/models/layerDocumentStructuralTransactions";
import {
  buildMoveLayerDocumentTransaction,
  buildMoveLayerDocumentKeyframeTransaction,
  buildRemoveLayerDocumentKeyframeTransaction,
  buildSplitLayerDocumentTransaction,
} from "@/models/layerDocumentTimelineTransactions";

/**
 * Converts a Timeline UI intent into one unapplied semantic transaction.
 * The caller remains responsible for any future atomic commit.
 */
export function buildLayerDocumentTimelineIntentTransaction(
  project: LayerDocumentProject,
  intent: LayerDocumentTimelineIntent
): LayerDocumentTransactionResult {
  switch (intent.kind) {
    case "set-modifiers":
      return buildUpdateLayerDocumentCommonTransaction(project, {
        layerDocumentId: intent.layerDocumentId,
        update: { kind: "set-modifiers", modifiers: intent.modifiers },
      });
    case "set-timing":
      return buildUpdateLayerDocumentCommonTransaction(project, {
        layerDocumentId: intent.layerDocumentId,
        update: {
          kind: "set-placement-timing",
          startFrame: intent.startFrame,
          durationFrames: intent.durationFrames,
          sourceOffsetFrames: intent.sourceOffsetFrames,
        },
      });
    case "set-visibility":
      return buildUpdateLayerDocumentCommonTransaction(project, {
        layerDocumentId: intent.layerDocumentId,
        update: {
          kind: "set-visibility",
          visible: intent.visible,
        },
      });
    case "set-alias": {
      const alias = intent.alias?.trim() || null;
      return buildUpdateLayerDocumentCommonTransaction(project, {
        layerDocumentId: intent.layerDocumentId,
        update: { kind: "set-alias", alias },
      });
    }
    case "rename-layer":
      return buildSetLayerDocumentNameTransaction(project, {
        layerDocumentId: intent.layerDocumentId,
        name: intent.name,
      });
    case "delete-layer":
      return buildDeleteLayerDocumentTransaction(project, {
        layerDocumentId: intent.layerDocumentId,
      });
    case "duplicate-layer":
      return buildDuplicateLayerDocumentTransaction(project, {
        layerDocumentId: intent.layerDocumentId,
        newLayerDocumentId: intent.newLayerDocumentId,
      });
    case "move-layer":
      return buildMoveLayerDocumentTransaction(project, {
        layerDocumentId: intent.layerDocumentId,
        newParentLayerDocumentId: intent.newParentLayerDocumentId,
        newOrder: intent.newOrder,
      });
    case "split-layer":
      return buildSplitLayerDocumentTransaction(project, {
        layerDocumentId: intent.layerDocumentId,
        newLayerDocumentId: intent.newLayerDocumentId,
        splitGlobalFrame: intent.splitGlobalFrame,
      });
    case "move-keyframe":
      return buildMoveLayerDocumentKeyframeTransaction(
        project,
        intent
      );
    case "remove-keyframe":
      return buildRemoveLayerDocumentKeyframeTransaction(
        project,
        intent
      );
    case "set-group-duration": {
      const group =
        project.payload.layerDocumentsById[
          intent.layerDocumentId
        ];
      if (group?.type !== "group") {
        return buildUpdateLayerDocumentDomainTransaction(
          project,
          {
            layerDocumentId: intent.layerDocumentId,
            update: {
              kind: "set-group-composition-metadata",
              data: {
                width: 0,
                height: 0,
                frameRate: 0,
                durationFrames:
                  intent.durationFrames,
              },
            },
          }
        );
      }
      return buildUpdateLayerDocumentDomainTransaction(
        project,
        {
          layerDocumentId: intent.layerDocumentId,
          update: {
            kind: "set-group-composition-metadata",
            data: {
              width: group.data.width,
              height: group.data.height,
              frameRate: group.data.frameRate,
              durationFrames: intent.durationFrames,
            },
          },
        }
      );
    }
  }
}

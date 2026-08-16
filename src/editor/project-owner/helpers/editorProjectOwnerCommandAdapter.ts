import type {
  LayerDocumentTransaction,
  LayerDocumentTransactionResult,
  LibrarySourceSelection,
} from "@/models";
import type {
  LayerDocumentProjectOwnerEffect,
  LayerDocumentProjectOwnerPort,
  LayerDocumentProjectOwnerTransitionResult,
  LayerDocumentSourceTransaction,
  LayerDocumentSourceTransactionResult,
  LayerDocumentTransformKeyframeSelection,
} from "@/engines/project";
import type {
  LayerDocumentSourceRuntimeResourcePort,
} from "@/render";
import type {
  EditorOwnerCommandResult,
} from "@/editor/project-owner/models/editorProjectOwnerModel";
import {
  commandEditorOwnerAcknowledgeSourceStatus,
  commandEditorOwnerActiveGroup,
  commandEditorOwnerHistory,
  commandEditorOwnerLayerSelection,
  commandEditorOwnerSourceSelection,
  commitEditorOwnerLayerTransaction,
  commitEditorOwnerSourceTransaction,
} from "@/editor/project-owner/helpers/editorProjectOwnerCommandHelpers";

function applyRuntimeCacheEffect(
  sourceRuntime:
    LayerDocumentSourceRuntimeResourcePort,
  effect: LayerDocumentProjectOwnerEffect
) {
  if (effect.runtimeCachePolicy === "invalidate-all") {
    sourceRuntime.invalidate({ kind: "all" });
    return;
  }
  if (
    effect.runtimeCachePolicy !==
    "apply-source-invalidations"
  ) return;
  effect.sourceRestorationIds.forEach((sourceId) => {
    sourceRuntime.restoreSource(sourceId);
  });
  effect.sourceDisposalIds.forEach((sourceId) => {
    sourceRuntime.invalidate({
      kind: "source",
      sourceId,
    });
  });
  effect.suspendedSourceDisposalIds.forEach(
    (sourceId) => {
      sourceRuntime.disposeSuspendedSource(sourceId);
    }
  );
  effect.sourceInvalidationIds.forEach((sourceId) => {
    sourceRuntime.suspendSource(sourceId);
  });
  const invalidatedKeys = new Set<string>();
  effect.cacheInvalidations.forEach((descriptor) => {
    const key = JSON.stringify([
      descriptor.sourceId,
      descriptor.sourceResourceCacheKeyBefore,
    ]);
    if (invalidatedKeys.has(key)) return;
    invalidatedKeys.add(key);
    sourceRuntime.invalidate({
      kind: "cache-key",
      sourceId: descriptor.sourceId,
      sourceResourceCacheKey:
        descriptor.sourceResourceCacheKeyBefore,
    });
  });
}

export function createEditorProjectOwnerCommandAdapter(
  options: {
    owner: LayerDocumentProjectOwnerPort;
    sourceRuntime:
      LayerDocumentSourceRuntimeResourcePort;
    clearDraft: () => void;
    applyOwnerEffect: (
      effect: LayerDocumentProjectOwnerEffect
    ) => void;
    incrementMetric: (name: string) => void;
  }
) {
  const reject = <TPreparation>(
    message: string,
    preparation: TPreparation
  ): EditorOwnerCommandResult<TPreparation> => ({
    ok: false,
    stage: "preparation",
    message,
    preparation,
  });
  const deliver = <TPreparation = unknown>(
    transition:
      LayerDocumentProjectOwnerTransitionResult
  ): EditorOwnerCommandResult<TPreparation> => {
    if (!transition.ok) {
      return {
        ok: false,
        stage: "owner",
        message: transition.error.message,
        transition,
      };
    }
    if (transition.effect.clearDraft) {
      options.clearDraft();
    }
    applyRuntimeCacheEffect(
      options.sourceRuntime,
      transition.effect
    );
    if (transition.changed) {
      options.incrementMetric(
        "layerDocumentOwnerTransition"
      );
    }
    if (transition.effect.recomputeRender) {
      options.incrementMetric(
        "layerDocumentRenderRecompute"
      );
    }
    options.applyOwnerEffect(transition.effect);
    return { ok: true, transition };
  };
  const commitLayerTransaction = <
    TPreparation = unknown,
  >(
    transaction: LayerDocumentTransaction,
    selection?:
      LayerDocumentTransformKeyframeSelection
  ): EditorOwnerCommandResult<TPreparation> =>
    deliver<TPreparation>(
      commitEditorOwnerLayerTransaction(
        options.owner,
        transaction,
        selection
      )
    );
  const commitSourceTransaction = <
    TPreparation = unknown,
  >(
    transaction: LayerDocumentSourceTransaction
  ): EditorOwnerCommandResult<TPreparation> =>
    deliver<TPreparation>(
      commitEditorOwnerSourceTransaction(
        options.owner,
        transaction
      )
    );
  return {
    reject,
    deliver,
    commitLayerTransaction,
    commitSourceTransaction,
    commitLayerPreparation: (
      preparation: LayerDocumentTransactionResult,
      selection?:
        LayerDocumentTransformKeyframeSelection
    ) =>
      preparation.ok
        ? commitLayerTransaction(
            preparation.transaction,
            selection
          )
        : reject(
            preparation.error.message,
            preparation
          ),
    commitSourcePreparation: (
      preparation:
        LayerDocumentSourceTransactionResult
    ) =>
      preparation.ok
        ? commitSourceTransaction(
            preparation.transaction
          )
        : reject(
            preparation.error.message,
            preparation
          ),
    undo: () =>
      deliver(
        commandEditorOwnerHistory(
          options.owner,
          "undo"
        )
      ),
    redo: () =>
      deliver(
        commandEditorOwnerHistory(
          options.owner,
          "redo"
        )
      ),
    selectLayer: (layerDocumentId: string | null) =>
      deliver(
        commandEditorOwnerLayerSelection(
          options.owner,
          layerDocumentId
        )
      ),
    selectSource: (
      selection: LibrarySourceSelection | null
    ) =>
      deliver(
        commandEditorOwnerSourceSelection(
          options.owner,
          selection
        )
      ),
    enterGroup: (layerDocumentId: string) =>
      deliver(
        commandEditorOwnerActiveGroup(
          options.owner,
          layerDocumentId
        )
      ),
    acknowledgeSourceStatus: (sourceId: string) =>
      deliver(
        commandEditorOwnerAcknowledgeSourceStatus(
          options.owner,
          sourceId
        )
      ),
  };
}

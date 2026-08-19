import type {
  LayerDocumentTransaction,
  LayerDocumentTransactionResult,
  LibrarySourceSelection,
} from "@/models";
import type {
  LayerDocumentNexusEffect,
  LayerDocumentNexusTransitionResult,
  LayerDocumentSourceTransaction,
  LayerDocumentSourceTransactionResult,
  LayerDocumentTransformKeyframeSelection,
  NexusHistoryPort,
  NexusProjectReadPort,
  NexusSelectionPort,
  NexusTransactionPort,
} from "@/engines/project";
import type {
  LayerDocumentSourceRuntimeResourcePort,
} from "@/render";
import type {
  EditorNexusCommandResult,
} from "@/editor/nexus/models/editorNexusModel";
import type { EditorAudioRuntimePort } from "@/editor/audio-runtime";
import {
  commandEditorNexusAcknowledgeSourceStatus,
  commandEditorNexusActiveGroup,
  commandEditorNexusHistory,
  commandEditorNexusLayerSelection,
  commandEditorNexusSourceSelection,
  commitEditorNexusLayerTransaction,
  commitEditorNexusSourceTransaction,
} from "@/editor/nexus/helpers/editorNexusCommandHelpers";

function applyRuntimeCacheEffect(
  sourceRuntime:
    LayerDocumentSourceRuntimeResourcePort,
  effect: LayerDocumentNexusEffect,
  audioRuntime: EditorAudioRuntimePort | undefined,
  project: import("@/models").LayerDocumentProject
) {
  if (effect.runtimeCachePolicy === "invalidate-all") {
    sourceRuntime.invalidate({ kind: "all" });
    audioRuntime?.replaceProject(project);
    return;
  }
  if (
    effect.runtimeCachePolicy !==
    "apply-source-invalidations"
  ) {
    audioRuntime?.reconcileProject(project);
    return;
  }
  effect.sourceRestorationIds.forEach((sourceId) => {
    sourceRuntime.restoreSource(sourceId);
    audioRuntime?.restoreSource(sourceId);
  });
  effect.sourceDisposalIds.forEach((sourceId) => {
    sourceRuntime.invalidate({
      kind: "source",
      sourceId,
    });
    audioRuntime?.disposeSource(sourceId);
  });
  effect.sourceInvalidationIds.forEach((sourceId) => {
    sourceRuntime.suspendSource(sourceId);
    audioRuntime?.suspendSource(sourceId);
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
  audioRuntime?.reconcileProject(project);
}

export function createEditorNexusCommandAdapter(
  options: {
    nexus: NexusProjectReadPort &
      NexusTransactionPort &
      NexusHistoryPort &
      NexusSelectionPort;
    sourceRuntime:
      LayerDocumentSourceRuntimeResourcePort;
    audioRuntime?: EditorAudioRuntimePort;
    clearDraft: () => void;
    applyNexusEffect: (
      effect: LayerDocumentNexusEffect
    ) => void;
    incrementMetric: (name: string) => void;
  }
) {
  const reject = <TPreparation>(
    message: string,
    preparation: TPreparation
  ): EditorNexusCommandResult<TPreparation> => ({
    ok: false,
    stage: "preparation",
    message,
    preparation,
  });
  const deliver = <TPreparation = unknown>(
    transition:
      LayerDocumentNexusTransitionResult
  ): EditorNexusCommandResult<TPreparation> => {
    if (!transition.ok) {
      return {
        ok: false,
        stage: "nexus",
        message: transition.error.message,
        transition,
      };
    }
    if (transition.effect.clearDraft) {
      options.clearDraft();
    }
    applyRuntimeCacheEffect(
      options.sourceRuntime,
      transition.effect,
      options.audioRuntime,
      transition.state.currentProject
    );
    if (transition.changed) {
      options.incrementMetric(
        "layerDocumentNexusTransition"
      );
    }
    if (transition.effect.recomputeRender) {
      options.incrementMetric(
        "layerDocumentRenderRecompute"
      );
    }
    options.applyNexusEffect(transition.effect);
    return { ok: true, transition };
  };
  const commitLayerTransaction = <
    TPreparation = unknown,
  >(
    transaction: LayerDocumentTransaction,
    selection?:
      LayerDocumentTransformKeyframeSelection
  ): EditorNexusCommandResult<TPreparation> =>
    deliver<TPreparation>(
      commitEditorNexusLayerTransaction(
        options.nexus,
        transaction,
        selection
      )
    );
  const commitSourceTransaction = <
    TPreparation = unknown,
  >(
    transaction: LayerDocumentSourceTransaction
  ): EditorNexusCommandResult<TPreparation> =>
    deliver<TPreparation>(
      commitEditorNexusSourceTransaction(
        options.nexus,
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
        commandEditorNexusHistory(
          options.nexus,
          "undo"
        )
      ),
    redo: () =>
      deliver(
        commandEditorNexusHistory(
          options.nexus,
          "redo"
        )
      ),
    selectLayer: (layerDocumentId: string | null) =>
      deliver(
        commandEditorNexusLayerSelection(
          options.nexus,
          layerDocumentId
        )
      ),
    selectSource: (
      selection: LibrarySourceSelection | null
    ) =>
      deliver(
        commandEditorNexusSourceSelection(
          options.nexus,
          selection
        )
      ),
    enterGroup: (layerDocumentId: string) =>
      deliver(
        commandEditorNexusActiveGroup(
          options.nexus,
          layerDocumentId
        )
      ),
    acknowledgeSourceStatus: (sourceId: string) =>
      deliver(
        commandEditorNexusAcknowledgeSourceStatus(
          options.nexus,
          sourceId
        )
      ),
  };
}

import type {
  LayerDocumentTransaction,
  LibrarySourceSelection,
} from "@/models";
import {
  buildLayerDocumentGroupScopeReadModel,
} from "@/models";
import type {
  LayerDocumentNexusPort,
  LayerDocumentSourceTransaction,
  LayerDocumentTransformKeyframeSelection,
  NexusHistoryPort,
  NexusProjectReadPort,
  NexusSelectionPort,
  NexusTransactionPort,
} from "@/engines/project";

type LegacyNexusTransitionPort = Pick<
  LayerDocumentNexusPort,
  "transition"
>;

export function commitEditorNexusLayerTransaction(
  nexus: NexusTransactionPort | LegacyNexusTransitionPort,
  transaction: LayerDocumentTransaction,
  selectTransformKeyframe?:
    LayerDocumentTransformKeyframeSelection
) {
  return "commitLayerTransaction" in nexus
    ? nexus.commitLayerTransaction(transaction, selectTransformKeyframe)
    : nexus.transition({
        kind: "commit-layer-transaction",
        transaction,
        ...(selectTransformKeyframe ? { selectTransformKeyframe } : {}),
      });
}

export function commitEditorNexusSourceTransaction(
  nexus: NexusTransactionPort | LegacyNexusTransitionPort,
  transaction: LayerDocumentSourceTransaction
) {
  return "commitSourceTransaction" in nexus
    ? nexus.commitSourceTransaction(transaction)
    : nexus.transition({ kind: "commit-source-transaction", transaction });
}

export function commandEditorNexusHistory(
  nexus: NexusHistoryPort | LegacyNexusTransitionPort,
  direction: "undo" | "redo"
) {
  if ("undo" in nexus) {
    return direction === "undo" ? nexus.undo() : nexus.redo();
  }
  return nexus.transition({ kind: direction });
}

export function readEditorNexusGroupScope(
  nexus: NexusProjectReadPort
) {
  return buildLayerDocumentGroupScopeReadModel(
    nexus.state.currentProject,
    nexus.state.session.activeGroupLayerDocumentId
  );
}

export function commandEditorNexusLayerSelection(
  nexus: NexusSelectionPort | LegacyNexusTransitionPort,
  layerDocumentId: string | null
) {
  const selection = layerDocumentId
    ? { kind: "layer-document" as const, layerDocumentId }
    : null;
  return "selectLayer" in nexus
    ? nexus.selectLayer(selection)
    : nexus.transition({ kind: "set-layer-selection", selection });
}

export function commandEditorNexusSourceSelection(
  nexus: NexusSelectionPort | LegacyNexusTransitionPort,
  selection: LibrarySourceSelection | null
) {
  return "selectSource" in nexus
    ? nexus.selectSource(selection)
    : nexus.transition({ kind: "set-source-selection", selection });
}

export function commandEditorNexusActiveGroup(
  nexus: NexusSelectionPort | LegacyNexusTransitionPort,
  layerDocumentId: string
) {
  return "setActiveGroup" in nexus
    ? nexus.setActiveGroup(layerDocumentId)
    : nexus.transition({ kind: "set-active-group", layerDocumentId });
}

export function commandEditorNexusAcknowledgeSourceStatus(
  nexus: NexusSelectionPort | LegacyNexusTransitionPort,
  sourceId: string
) {
  return "acknowledgeSourceStatus" in nexus
    ? nexus.acknowledgeSourceStatus(sourceId)
    : nexus.transition({ kind: "acknowledge-source-status", sourceId });
}

import type {
  LayerDocumentTransaction,
  LibrarySourceSelection,
} from "@/models";
import {
  buildLayerDocumentGroupScopeReadModel,
} from "@/models";
import type {
  LayerDocumentProjectOwnerPort,
  LayerDocumentSourceTransaction,
  LayerDocumentTransformKeyframeSelection,
} from "@/engines/project";

export function commitEditorOwnerLayerTransaction(
  owner: LayerDocumentProjectOwnerPort,
  transaction: LayerDocumentTransaction,
  selectTransformKeyframe?:
    LayerDocumentTransformKeyframeSelection
) {
  return owner.transition({
    kind: "commit-layer-transaction",
    transaction,
    ...(selectTransformKeyframe
      ? { selectTransformKeyframe }
      : {}),
  });
}

export function commitEditorOwnerSourceTransaction(
  owner: LayerDocumentProjectOwnerPort,
  transaction: LayerDocumentSourceTransaction
) {
  return owner.transition({
    kind: "commit-source-transaction",
    transaction,
  });
}

export function commandEditorOwnerHistory(
  owner: LayerDocumentProjectOwnerPort,
  direction: "undo" | "redo"
) {
  return owner.transition({ kind: direction });
}

export function readEditorOwnerGroupScope(
  owner: LayerDocumentProjectOwnerPort
) {
  return buildLayerDocumentGroupScopeReadModel(
    owner.state.currentProject,
    owner.state.session.activeGroupLayerDocumentId
  );
}

export function commandEditorOwnerLayerSelection(
  owner: LayerDocumentProjectOwnerPort,
  layerDocumentId: string | null
) {
  return owner.transition({
    kind: "set-layer-selection",
    selection: layerDocumentId
      ? {
          kind: "layer-document",
          layerDocumentId,
        }
      : null,
  });
}

export function commandEditorOwnerSourceSelection(
  owner: LayerDocumentProjectOwnerPort,
  selection: LibrarySourceSelection | null
) {
  return owner.transition({
    kind: "set-source-selection",
    selection,
  });
}

export function commandEditorOwnerActiveGroup(
  owner: LayerDocumentProjectOwnerPort,
  layerDocumentId: string
) {
  return owner.transition({
    kind: "set-active-group",
    layerDocumentId,
  });
}

export function commandEditorOwnerAcknowledgeSourceStatus(
  owner: LayerDocumentProjectOwnerPort,
  sourceId: string
) {
  return owner.transition({
    kind: "acknowledge-source-status",
    sourceId,
  });
}

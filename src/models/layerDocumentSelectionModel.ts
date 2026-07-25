import type { LayerDocumentProject } from "@/models/layerDocumentModel";
import type {
  LayerDocumentSelectionChange,
} from "@/models/layerDocumentTransactionModel";

export interface LayerDocumentSelection {
  kind: "layer-document";
  layerDocumentId: string;
}

/**
 * PSD Tree selects a Source resource, not one of its Layer placements.
 * It is deliberately not assignable to LayerDocumentSelection.
 */
export interface PsdTreeSourceSelection {
  kind: "psd-tree-source";
  sourceId: string;
}

export type StaleLayerDocumentSelectionPolicy =
  | {
      kind: "clear";
    }
  | {
      kind: "select-layer";
      layerDocumentId: string;
    };

export type LayerDocumentSelectionNormalization =
  | {
      status: "preserved";
      selection: LayerDocumentSelection;
    }
  | {
      status: "fallback";
      selection: LayerDocumentSelection;
    }
  | {
      status: "cleared";
      selection: null;
    };

function selectionExists(
  project: LayerDocumentProject,
  selection: LayerDocumentSelection
): boolean {
  return Boolean(
    project.payload.layerDocumentsById[selection.layerDocumentId]
  );
}

export function normalizeLayerDocumentSelection(
  project: LayerDocumentProject,
  selection: LayerDocumentSelection | null,
  stalePolicy: StaleLayerDocumentSelectionPolicy = { kind: "clear" }
): LayerDocumentSelectionNormalization {
  if (
    selection?.kind === "layer-document" &&
    selectionExists(project, selection)
  ) {
    return { status: "preserved", selection };
  }
  if (
    selection !== null &&
    stalePolicy.kind === "select-layer" &&
    project.payload.layerDocumentsById[stalePolicy.layerDocumentId]
  ) {
    return {
      status: "fallback",
      selection: {
        kind: "layer-document",
        layerDocumentId: stalePolicy.layerDocumentId,
      },
    };
  }
  return { status: "cleared", selection: null };
}

export function applyLayerDocumentSelectionChange(
  project: LayerDocumentProject,
  currentSelection: LayerDocumentSelection | null,
  change: LayerDocumentSelectionChange,
  stalePolicy: StaleLayerDocumentSelectionPolicy = { kind: "clear" }
): LayerDocumentSelectionNormalization {
  switch (change.kind) {
    case "clear":
      return { status: "cleared", selection: null };
    case "select":
      return normalizeLayerDocumentSelection(
        project,
        {
          kind: "layer-document",
          layerDocumentId: change.layerDocumentId,
        },
        stalePolicy
      );
    case "preserve":
      return normalizeLayerDocumentSelection(
        project,
        currentSelection,
        stalePolicy
      );
  }
}

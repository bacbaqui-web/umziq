import type { LayerDocument, LayerDocumentProject, SourceRegistryRecord } from "@/models/layerDocumentModel";
import type { LayerDocumentValidationIssue } from "@/models/layerDocumentSourceValidation";
import { addIssue } from "@/models/layerDocumentSourceValidation";

function validateSourceCompatibility(
  layer: LayerDocument,
  source: SourceRegistryRecord | undefined,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const reference = layer.common.source;
  if (reference && !source) {
    addIssue(
      issues,
      "invalid-source-reference",
      `${path}.common.source.sourceId`,
      `Dangling Source reference: ${reference.sourceId}`
    );
    return;
  }
  const kind = source?.kind;
  const valid =
    (layer.type === "psd" && kind === "psd-node") ||
    ((layer.type === "drawing" ||
      layer.type === "text" ||
      layer.type === "shape") &&
      reference === null) ||
    (layer.type === "audio" &&
      (reference === null || kind === "audio")) ||
    (layer.type === "video" &&
      (reference === null || kind === "video")) ||
    (layer.type === "group" &&
      (reference === null ||
        kind === "psd-document" ||
        kind === "psd-node")) ||
    layer.type === "unknown";
  if (!valid) {
    addIssue(
      issues,
      "invalid-source-kind",
      `${path}.common.source`,
      `Source kind is not valid for Layer type ${layer.type}`
    );
  }
}
function findParentCycle(
  layers: Record<string, LayerDocument>
): string[] | null {
  const finished = new Set<string>();
  const active = new Set<string>();
  const path: string[] = [];

  const visit = (layerId: string): string[] | null => {
    if (active.has(layerId)) {
      const start = path.indexOf(layerId);
      return [...path.slice(start), layerId];
    }
    if (finished.has(layerId)) return null;
    const layer = layers[layerId];
    if (!layer) return null;
    active.add(layerId);
    path.push(layerId);
    const parentId = layer.common.placement.parentLayerDocumentId;
    const cycle = parentId ? visit(parentId) : null;
    if (cycle) return cycle;
    path.pop();
    active.delete(layerId);
    finished.add(layerId);
    return null;
  };

  for (const layerId of Object.keys(layers)) {
    const cycle = visit(layerId);
    if (cycle) return cycle;
  }
  return null;
}

export function validateCrossReferences(
  project: LayerDocumentProject,
  issues: LayerDocumentValidationIssue[]
) {
  const layers = project.payload.layerDocumentsById;
  const sources = project.payload.sourceRegistry.sourcesById;
  const rootIds = Object.values(layers)
    .filter(
      (layer) =>
        layer.type === "group" && layer.data.role === "project-root"
    )
    .map((layer) => layer.layerDocumentId);
  if (rootIds.length !== 1) {
    addIssue(
      issues,
      "invalid-root-count",
      "$.payload.layerDocumentsById",
      `Expected exactly one project-root Group, received ${rootIds.length}`
    );
  }
  const rootId = rootIds[0];
  const siblingsByParent = new Map<string | null, LayerDocument[]>();

  Object.values(layers).forEach((layer) => {
    const path = `$.payload.layerDocumentsById.${layer.layerDocumentId}`;
    const parentId = layer.common.placement.parentLayerDocumentId;
    const parent = parentId ? layers[parentId] : undefined;
    if (layer.layerDocumentId === rootId) {
      if (parentId !== null) {
        addIssue(
          issues,
          "invalid-parent",
          `${path}.common.placement.parentLayerDocumentId`,
          "The project-root Group must have no parent"
        );
      }
    } else if (!parentId || parent?.type !== "group") {
      addIssue(
        issues,
        "invalid-parent",
        `${path}.common.placement.parentLayerDocumentId`,
        "Every non-root Layer must reference an existing Group parent"
      );
    }
    const siblings = siblingsByParent.get(parentId) ?? [];
    siblings.push(layer);
    siblingsByParent.set(parentId, siblings);
    const reference = layer.common.source;
    validateSourceCompatibility(
      layer,
      reference ? sources[reference.sourceId] : undefined,
      path,
      issues
    );
  });

  siblingsByParent.forEach((siblings, parentId) => {
    const orders = siblings.map((layer) => layer.common.placement.order);
    const sorted = [...orders].sort((left, right) => left - right);
    const contiguous = sorted.every((order, index) => order === index);
    if (!contiguous) {
      addIssue(
        issues,
        "invalid-sibling-order",
        "$.payload.layerDocumentsById",
        `Sibling order for parent ${parentId ?? "<root>"} must be contiguous 0..n-1`
      );
    }
  });

  Object.values(sources).forEach((source) => {
    if (source.kind !== "psd-node") return;
    const documentSource = sources[source.data.documentSourceId];
    if (documentSource?.kind !== "psd-document") {
      addIssue(
        issues,
        "invalid-source-reference",
        `$.payload.sourceRegistry.sourcesById.${source.sourceId}.data.documentSourceId`,
        "PSD node must reference an existing PSD document Source"
      );
    }
  });

  const cycle = findParentCycle(layers);
  if (cycle) {
    addIssue(
      issues,
      "parent-cycle",
      "$.payload.layerDocumentsById",
      `Layer parent cycle: ${cycle.join(" -> ")}`
    );
  }
}

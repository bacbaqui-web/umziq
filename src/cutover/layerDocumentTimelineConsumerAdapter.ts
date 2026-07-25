import {
  buildLayerDocumentTimelineReadModel,
  type LayerDocumentProject,
  type LayerDocumentTimelineRowReadModel,
} from "@/models";
import type {
  LayerDocumentTimelineConsumerRow,
} from "@/cutover/layerDocumentConsumerCutoverModel";

function adaptRow(
  project: LayerDocumentProject,
  row: LayerDocumentTimelineRowReadModel
): LayerDocumentTimelineConsumerRow {
  const layer =
    project.payload.layerDocumentsById[row.layerDocumentId];
  return {
    layerDocumentId: row.layerDocumentId,
    parentLayerDocumentId:
      row.placement.parentLayerDocumentId,
    depth: row.depth,
    order: row.placement.order,
    name: layer?.name ?? row.label,
    alias: layer?.common.placement.alias ?? null,
    label: row.label,
    type: row.type,
    sourceId: row.source?.sourceId ?? null,
    source: row.source,
    startFrame: row.placement.startFrame,
    durationFrames: row.placement.durationFrames,
    sourceOffsetFrames: row.placement.sourceOffsetFrames,
    visible: row.placement.visible,
    children: row.children.map((child) =>
      adaptRow(project, child)
    ),
  };
}

export type LayerDocumentTimelineConsumerRowsResult =
  | {
      readonly available: true;
      readonly rows:
        readonly LayerDocumentTimelineConsumerRow[];
    }
  | {
      readonly available: false;
      readonly rows: readonly [];
    };

/**
 * Keeps the consumer projection Layer-identity based. Source identity is
 * descriptive only, so duplicate placements remain independently editable.
 */
export function buildLayerDocumentTimelineConsumerRows(
  project: LayerDocumentProject,
  activeGroupLayerDocumentId?: string | null
): LayerDocumentTimelineConsumerRowsResult {
  const result = buildLayerDocumentTimelineReadModel(
    project,
    "exclude",
    activeGroupLayerDocumentId
  );
  if (!result.ok) return { available: false, rows: [] };
  return {
    available: true,
    rows: result.model.rows.map((row) =>
      adaptRow(project, row)
    ),
  };
}

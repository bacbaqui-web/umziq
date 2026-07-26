import {
  buildLayerDocumentTimelineReadModel,
  type LayerDocumentGroupScopeReadModelResult,
  type LayerDocumentProject,
  type LayerDocumentTimelineIntent,
  type LayerDocumentTimelineRowReadModel,
} from "@/models";
import type {
  LayerDocumentProjectOwnerPort,
  LayerDocumentSourceRuntimeResolutionReadPort,
} from "@/engines/project";
import type {
  LayerDocumentTimelineConsumerRow,
  LayerDocumentTimelineConsumerRowsResult,
} from "@/engines/timeline/models/layerDocumentTimelineConsumerModel";

function adaptRow(
  project: LayerDocumentProject,
  row: LayerDocumentTimelineRowReadModel,
  resolution:
    LayerDocumentSourceRuntimeResolutionReadPort
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
    source: row.source
      ? {
          ...row.source,
          resolutionStatus:
            resolution.read(row.source.sourceId).status,
        }
      : null,
    startFrame: row.placement.startFrame,
    durationFrames: row.placement.durationFrames,
    sourceOffsetFrames:
      row.placement.sourceOffsetFrames,
    visible: row.placement.visible,
    children: row.children.map((child) =>
      adaptRow(project, child, resolution)
    ),
  };
}

export function buildLayerDocumentTimelineConsumerRows(
  project: LayerDocumentProject,
  resolution:
    LayerDocumentSourceRuntimeResolutionReadPort,
  activeGroupLayerDocumentId?: string | null
): LayerDocumentTimelineConsumerRowsResult {
  const result = buildLayerDocumentTimelineReadModel(
    project,
    "exclude",
    activeGroupLayerDocumentId
  );
  if (!result.ok) {
    return { available: false, rows: [] };
  }
  return {
    available: true,
    rows: result.model.rows.map((row) =>
      adaptRow(project, row, resolution)
    ),
  };
}

export function createLayerDocumentTimelineConsumerAdapter<
  TCommandResult,
>(options: {
  owner: LayerDocumentProjectOwnerPort;
  readProject: () => LayerDocumentProject;
  readActiveGroupLayerDocumentId:
    () => string;
  readSelectedLayerDocumentId:
    () => string | null;
  readScope:
    () => LayerDocumentGroupScopeReadModelResult;
  resolution:
    LayerDocumentSourceRuntimeResolutionReadPort;
  selectLayer: (
    layerDocumentId: string | null
  ) => TCommandResult;
  dispatchIntent: (
    intent: LayerDocumentTimelineIntent
  ) => TCommandResult;
}) {
  return {
    readViewProps: () => {
      const projection =
        buildLayerDocumentTimelineConsumerRows(
          options.readProject(),
          options.resolution,
          options.readActiveGroupLayerDocumentId()
        );
      return {
        available: projection.available,
        selectedLayerDocumentId:
          options.readSelectedLayerDocumentId(),
        selectedTransformKeyframe:
          options.owner.state.runtimeSession
            .selectedTransformKeyframe,
        acknowledgedSourceStatuses:
          options.owner.state.runtimeSession
            .acknowledgedSourceStatuses ?? [],
        scope: options.readScope(),
        rows: projection.rows,
        commands: {
          selectLayer: options.selectLayer,
          dispatchIntent: options.dispatchIntent,
        },
      };
    },
  };
}

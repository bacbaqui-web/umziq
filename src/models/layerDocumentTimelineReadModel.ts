import type {
  LayerDocument,
  LayerDocumentProject,
  LayerDocumentType,
  SourceRegistryKind,
} from "@/models/layerDocumentModel";
import {
  validateLayerDocumentProject,
  type LayerDocumentValidationIssue,
} from "@/models/layerDocumentValidation";
import {
  buildLayerDocumentGroupScopeReadModel,
} from "@/models/layerDocumentGroupScopeModel";

export type LayerDocumentTimelineRootRowPolicy = "exclude" | "include";

export interface LayerDocumentTimelinePlacementReadModel {
  readonly parentLayerDocumentId: string | null;
  readonly order: number;
  readonly startFrame: number;
  readonly durationFrames: number;
  readonly sourceOffsetFrames: number;
  readonly visible: boolean;
}

export interface LayerDocumentTimelineSourceReadModel {
  readonly sourceId: string;
  readonly kind: SourceRegistryKind;
  readonly displayName: string;
}

export interface LayerDocumentTimelineRowReadModel {
  /** Placement identity is always the Layer Document ID, never sourceId. */
  readonly layerDocumentId: string;
  readonly label: string;
  readonly type: LayerDocumentType;
  readonly source: LayerDocumentTimelineSourceReadModel | null;
  readonly placement: LayerDocumentTimelinePlacementReadModel;
  readonly depth: number;
  readonly children: readonly LayerDocumentTimelineRowReadModel[];
}

export interface LayerDocumentTimelineReadModel {
  readonly rootLayerDocumentId: string;
  readonly rootRowPolicy: LayerDocumentTimelineRootRowPolicy;
  readonly rows: readonly LayerDocumentTimelineRowReadModel[];
}

export type LayerDocumentTimelineReadModelResult =
  | {
      readonly ok: true;
      readonly model: LayerDocumentTimelineReadModel;
    }
  | {
      readonly ok: false;
      readonly issues: readonly LayerDocumentValidationIssue[];
    };

function sortedChildren(
  project: LayerDocumentProject,
  parentLayerDocumentId: string | null
): LayerDocument[] {
  return Object.values(project.payload.layerDocumentsById)
    .filter(
      (layer) =>
        layer.common.placement.parentLayerDocumentId ===
        parentLayerDocumentId
    )
    .sort(
      (left, right) =>
        left.common.placement.order - right.common.placement.order
    );
}

function buildRow(
  project: LayerDocumentProject,
  layer: LayerDocument,
  depth: number
): LayerDocumentTimelineRowReadModel {
  const placement = layer.common.placement;
  const sourceRecord = layer.common.source
    ? project.payload.sourceRegistry.sourcesById[
        layer.common.source.sourceId
      ]
    : null;
  return {
    layerDocumentId: layer.layerDocumentId,
    label: placement.alias ?? layer.name,
    type: layer.type,
    source: sourceRecord
      ? {
          sourceId: sourceRecord.sourceId,
          kind: sourceRecord.kind,
          displayName: sourceRecord.displayName,
        }
      : null,
    placement: {
      parentLayerDocumentId: placement.parentLayerDocumentId,
      order: placement.order,
      startFrame: placement.startFrame,
      durationFrames: placement.durationFrames,
      sourceOffsetFrames: placement.sourceOffsetFrames,
      visible: placement.visible,
    },
    depth,
    children: sortedChildren(project, layer.layerDocumentId).map(
      (child) => buildRow(project, child, depth + 1)
    ),
  };
}

/**
 * Builds a pure hierarchical Timeline projection. The project-root row is
 * excluded by default, but its policy is explicit for future UI cutover.
 */
export function buildLayerDocumentTimelineReadModel(
  project: LayerDocumentProject,
  rootRowPolicy: LayerDocumentTimelineRootRowPolicy = "exclude",
  activeGroupLayerDocumentId?: string | null
): LayerDocumentTimelineReadModelResult {
  const issues = validateLayerDocumentProject(project);
  if (issues.length > 0) return { ok: false, issues };

  const scope = buildLayerDocumentGroupScopeReadModel(
    project,
    activeGroupLayerDocumentId
  );
  if (!scope.ok) {
    return {
      ok: false,
      issues: [{
        code: "invalid-root-count",
        path: "$.payload.layerDocumentsById",
        message: "Timeline read model requires one project-root Group",
      }],
    };
  }
  const root = scope.model.activeGroup;

  const rows =
    rootRowPolicy === "include"
      ? [buildRow(project, root, 0)]
      : sortedChildren(project, root.layerDocumentId).map(
          (layer) => buildRow(project, layer, 0)
        );
  return {
    ok: true,
    model: {
      rootLayerDocumentId: root.layerDocumentId,
      rootRowPolicy,
      rows,
    },
  };
}

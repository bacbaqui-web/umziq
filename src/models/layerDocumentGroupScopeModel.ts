import type {
  GroupLayerDocument,
  LayerDocumentProject,
} from "@/models/layerDocumentModel";
import {
  validateLayerDocumentProject,
} from "@/models/layerDocumentValidation";

export interface LayerDocumentGroupScopeSegment {
  readonly layerDocumentId: string;
  readonly label: string;
  readonly role: GroupLayerDocument["data"]["role"];
}

export interface LayerDocumentGroupScopeReadModel {
  readonly rootLayerDocumentId: string;
  readonly activeGroupLayerDocumentId: string;
  readonly activeGroup: GroupLayerDocument;
  readonly breadcrumb: readonly LayerDocumentGroupScopeSegment[];
}

export type LayerDocumentGroupScopeReadModelResult =
  | {
      readonly ok: true;
      readonly model: LayerDocumentGroupScopeReadModel;
    }
  | {
      readonly ok: false;
      readonly reason: "invalid-project" | "root-not-found";
    };

function projectRoot(
  project: LayerDocumentProject
): GroupLayerDocument | null {
  return (
    Object.values(project.payload.layerDocumentsById).find(
      (layer): layer is GroupLayerDocument =>
        layer.type === "group" &&
        layer.data.role === "project-root"
    ) ?? null
  );
}

export function normalizeActiveGroupLayerDocumentId(
  project: LayerDocumentProject,
  activeGroupLayerDocumentId?: string | null
): string | null {
  const root = projectRoot(project);
  if (!root) return null;
  const requested = activeGroupLayerDocumentId
    ? project.payload.layerDocumentsById[
        activeGroupLayerDocumentId
      ]
    : null;
  return requested?.type === "group"
    ? requested.layerDocumentId
    : root.layerDocumentId;
}

/** Shared Timeline/Canvas Layer-identity navigation scope. */
export function buildLayerDocumentGroupScopeReadModel(
  project: LayerDocumentProject,
  activeGroupLayerDocumentId?: string | null
): LayerDocumentGroupScopeReadModelResult {
  if (validateLayerDocumentProject(project).length > 0) {
    return { ok: false, reason: "invalid-project" };
  }
  const root = projectRoot(project);
  if (!root) return { ok: false, reason: "root-not-found" };
  const activeId = normalizeActiveGroupLayerDocumentId(
    project,
    activeGroupLayerDocumentId
  );
  const active = activeId
    ? project.payload.layerDocumentsById[activeId]
    : null;
  if (!active || active.type !== "group") {
    return { ok: false, reason: "root-not-found" };
  }

  const reversed: LayerDocumentGroupScopeSegment[] = [];
  let cursor: GroupLayerDocument | null = active;
  while (cursor) {
    reversed.push({
      layerDocumentId: cursor.layerDocumentId,
      label: cursor.common.placement.alias ?? cursor.name,
      role: cursor.data.role,
    });
    if (cursor.layerDocumentId === root.layerDocumentId) break;
    const parentId: string | null =
      cursor.common.placement.parentLayerDocumentId;
    const parent: GroupLayerDocument | null = parentId
      ? project.payload.layerDocumentsById[parentId]
          ?.type === "group"
        ? project.payload.layerDocumentsById[
            parentId
          ] as GroupLayerDocument
        : null
      : null;
    cursor = parent;
  }
  return {
    ok: true,
    model: {
      rootLayerDocumentId: root.layerDocumentId,
      activeGroupLayerDocumentId: active.layerDocumentId,
      activeGroup: active,
      breadcrumb: reversed.reverse(),
    },
  };
}

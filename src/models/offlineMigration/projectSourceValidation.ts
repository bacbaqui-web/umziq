import { findNonPlainDataPath } from "@/models/plainDataModel";
import type {
  GroupSource,
  ProjectSourceDocument,
} from "@/models/offlineMigration/projectSourceModel";

export type ProjectSourceIntegrityIssue =
  | {
      type: "non-plain-data";
      path: string;
    }
  | {
      type: "missing-root-source";
      sourceId: string;
    }
  | {
      type: "source-key-mismatch";
      sourceKey: string;
      sourceId: string;
    }
  | {
      type: "missing-group-source";
      groupId: string;
    }
  | {
      type: "group-timeline-mismatch";
      groupId: string;
      timelineId: string;
    }
  | {
      type: "missing-item-source";
      groupId: string;
      itemId: string;
      sourceId: string;
    }
  | {
      type: "item-group-mismatch";
      groupId: string;
      itemId: string;
      itemGroupId: string;
    }
  | {
      type: "duplicate-item-id";
      itemId: string;
    }
  | {
      type: "group-cycle";
      sourceIds: string[];
    };

function isGroupSource(
  source: ProjectSourceDocument["sourcesById"][string] | undefined
): source is GroupSource {
  return source?.type === "group";
}

function referencedGroupIds(
  project: ProjectSourceDocument,
  groupId: string
): string[] {
  return (project.timelineItemsByGroupId[groupId] ?? []).flatMap((item) =>
    isGroupSource(project.sourcesById[item.sourceId]) ? [item.sourceId] : []
  );
}

export function findGroupReferenceCycle(
  project: ProjectSourceDocument
): string[] | null {
  const visited = new Set<string>();
  const active = new Set<string>();
  const path: string[] = [];

  const visit = (groupId: string): string[] | null => {
    if (active.has(groupId)) {
      const cycleStart = path.indexOf(groupId);
      return [...path.slice(cycleStart), groupId];
    }
    if (visited.has(groupId)) return null;

    active.add(groupId);
    path.push(groupId);

    for (const childGroupId of referencedGroupIds(project, groupId)) {
      const cycle = visit(childGroupId);
      if (cycle) return cycle;
    }

    path.pop();
    active.delete(groupId);
    visited.add(groupId);
    return null;
  };

  for (const source of Object.values(project.sourcesById)) {
    if (source.type !== "group") continue;
    const cycle = visit(source.sourceId);
    if (cycle) return cycle;
  }

  return null;
}

export function canReferenceSourceFromGroup(
  project: ProjectSourceDocument,
  groupId: string,
  sourceId: string
): boolean {
  const source = project.sourcesById[sourceId];
  if (!isGroupSource(source)) return source !== undefined;
  if (groupId === sourceId) return false;

  const pending = [sourceId];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === groupId) return false;
    visited.add(current);
    pending.push(...referencedGroupIds(project, current));
  }

  return true;
}

export function validateProjectSourceDocument(
  project: ProjectSourceDocument
): ProjectSourceIntegrityIssue[] {
  const nonPlainDataPath = findNonPlainDataPath(project);
  if (nonPlainDataPath) {
    return [{ type: "non-plain-data", path: nonPlainDataPath }];
  }

  const issues: ProjectSourceIntegrityIssue[] = [];
  const itemIds = new Set<string>();

  Object.entries(project.sourcesById).forEach(([sourceKey, source]) => {
    if (source.sourceId !== sourceKey) {
      issues.push({
        type: "source-key-mismatch",
        sourceKey,
        sourceId: source.sourceId,
      });
    }
  });

  project.rootSourceIds.forEach((sourceId) => {
    if (!isGroupSource(project.sourcesById[sourceId])) {
      issues.push({ type: "missing-root-source", sourceId });
    }
  });

  Object.entries(project.timelineItemsByGroupId).forEach(
    ([groupId, items]) => {
      const groupSource = project.sourcesById[groupId];
      if (!isGroupSource(groupSource)) {
        issues.push({ type: "missing-group-source", groupId });
      } else if (groupSource.content.timelineId !== groupId) {
        issues.push({
          type: "group-timeline-mismatch",
          groupId,
          timelineId: groupSource.content.timelineId,
        });
      }

      items.forEach((item) => {
        if (item.groupId !== groupId) {
          issues.push({
            type: "item-group-mismatch",
            groupId,
            itemId: item.itemId,
            itemGroupId: item.groupId,
          });
        }
        if (!project.sourcesById[item.sourceId]) {
          issues.push({
            type: "missing-item-source",
            groupId,
            itemId: item.itemId,
            sourceId: item.sourceId,
          });
        }
        if (itemIds.has(item.itemId)) {
          issues.push({ type: "duplicate-item-id", itemId: item.itemId });
        }
        itemIds.add(item.itemId);
      });
    }
  );

  const cycle = findGroupReferenceCycle(project);
  if (cycle) {
    issues.push({ type: "group-cycle", sourceIds: cycle });
  }

  return issues;
}

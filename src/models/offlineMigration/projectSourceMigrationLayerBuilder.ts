import type { GroupLayerData, LayerDocument, LayerDocumentCommon, LayerSourceReference } from "@/models/layerDocumentModel";
import type { PlainDataObject } from "@/models/plainDataModel";
import type { GroupSource, ProjectSource, ProjectSourceDocument } from "@/models/offlineMigration/projectSourceModel";
import { allocateLayerId, clonePlainData, isRecord, type MigratedLayerTypeAndData, type MigrationContext, type ProjectSourceLayerMigrationIssue, type ProjectSourceLayerMigrationOrigin } from "@/models/offlineMigration/projectSourceMigrationIdentity";
import { buildCommon, hasDefaultAnimation, hasDefaultTransform, pathKey } from "@/models/offlineMigration/projectSourceMigrationSourceBuilder";

function buildGroupData(
  document: ProjectSourceDocument,
  source: GroupSource,
  role: GroupLayerData["role"],
  issues: ProjectSourceLayerMigrationIssue[]
): GroupLayerData | null {
  const sourceId = source.sourceId;
  const meta = document.compositionMetaByGroupId[sourceId];
  if (!meta) {
    issues.push({
      code: "missing-group-meta",
      path: `$.compositionMetaByGroupId.${sourceId}`,
      message: `Group Source ${sourceId} requires Composition metadata`,
    });
    return null;
  }
  if (source.content.sourceIdentity === null) {
    const ownedItemCount =
      document.timelineItemsByGroupId[sourceId]?.length ?? 0;
    /*
     * The product's virtual Master is synthetic, not imported source metadata:
     * legacy master + "Project" maps to the project-root role, while its name,
     * transform, animation, children, and composition dimensions are preserved
     * by the root Layer Document. No user-authored source locator is discarded.
     */
    const hasSyntheticMasterMetadata =
      role === "project-root" &&
      source.content.legacyCompositionType === "master" &&
      meta.sourceFileName === "Project";
    const hasDefaultSourceMetadata =
      source.content.legacyCompositionType === null &&
      meta.sourceFileName.trim().length === 0;
    const hasRepresentableSourceMetadata =
      hasSyntheticMasterMetadata || hasDefaultSourceMetadata;
    const unrepresentable = [
      source.content.timelineId !== sourceId
        ? "timelineId differs from the Group Source ID"
        : null,
      !hasRepresentableSourceMetadata
        ? "legacyCompositionType/sourceFileName is not a supported root semantic"
        : null,
      source.content.sourcePath !== null
        ? "sourcePath exists without source identity"
        : null,
      source.content.sourceFingerprint !== null
        ? "sourceFingerprint exists without source identity"
        : null,
      source.content.importSettings !== null
        ? "importSettings exists without source identity"
        : null,
      meta.layerCount !== ownedItemCount
        ? "compositionMeta.layerCount does not match owned placements"
        : null,
    ].filter((message): message is string => message !== null);
    if (unrepresentable.length > 0) {
      issues.push({
        code: "unrepresentable-group-source-metadata",
        path: `$.sourcesById.${sourceId}`,
        message:
          `Source-less Group ${sourceId} has metadata with no lossless ` +
          `Layer Document location: ${unrepresentable.join(", ")}`,
      });
      return null;
    }
  }
  return {
    role,
    width: meta.width,
    height: meta.height,
    frameRate: meta.frameRate,
    durationFrames: meta.durationFrames,
  };
}

function buildLayerTypeAndData(
  context: MigrationContext,
  source: ProjectSource,
  groupRole: GroupLayerData["role"] | null
): MigratedLayerTypeAndData | null {
  switch (source.type) {
    case "psd":
      return { type: "psd", data: {} };
    case "drawing":
      return {
        type: "drawing",
        data: clonePlainData(source.content),
      };
    case "text":
      return {
        type: "text",
        data: clonePlainData(source.content),
      };
    case "audio":
      if (
        source.content.descriptor.kind === "empty" &&
        source.content.durationFrames !== null
      ) {
        context.issues.push({
          code: "unrepresentable-audio-state",
          path: `$.sourcesById.${source.sourceId}.content.durationFrames`,
          message:
            "Source-less empty Audio duration cannot be represented losslessly",
        });
        return null;
      }
      return {
        type: "audio",
        data: {
          gain: 1,
          muted: false,
          fadeInFrames: 0,
          fadeOutFrames: 0,
        },
      };
    case "group": {
      const data = buildGroupData(
        context.document,
        source,
        groupRole ?? "composition",
        context.issues
      );
      return data ? { type: "group", data } : null;
    }
    case "shape": {
      const raw = source.content.data;
      if (
        Object.keys(raw).every((key) =>
          key === "documentVersion" || key === "shapes"
        ) &&
        typeof raw.documentVersion === "number" &&
        Number.isInteger(raw.documentVersion) &&
        raw.documentVersion >= 1 &&
        Array.isArray(raw.shapes) &&
        raw.shapes.every(isRecord)
      ) {
        return {
          type: "shape",
          data: {
            documentVersion: raw.documentVersion,
            shapes: clonePlainData(raw.shapes as PlainDataObject[]),
          },
        };
      }
      return {
        type: "unknown",
        data: {
          originalType: source.content.originalType,
          rawData: clonePlainData(source.content.data),
        },
      };
    }
    case "video": {
      const raw = source.content.data;
      const hasExternalSource =
        context.sourceReferences[source.sourceId] !== null;
      const hasOnlySourceFields = Object.keys(raw).every((key) =>
        [
          "fileName",
          "mimeType",
          "path",
          "fingerprint",
          "durationFrames",
          "width",
          "height",
        ].includes(key)
      );
      if (hasExternalSource && hasOnlySourceFields) {
        return { type: "video", data: {} };
      }
      return {
        type: "unknown",
        data: {
          originalType: source.content.originalType,
          rawData: clonePlainData(source.content.data),
        },
      };
    }
    case "unknown":
      return {
        type: "unknown",
        data: {
          originalType: source.content.originalType,
          rawData: clonePlainData(source.content.data),
        },
      };
  }
}

export function createLayerDocument(
  context: MigrationContext,
  source: ProjectSource,
  layerDocumentId: string,
  placement: LayerDocumentCommon["placement"],
  groupRole: GroupLayerData["role"] | null
): LayerDocument | null {
  const typeAndData = buildLayerTypeAndData(
    context,
    source,
    groupRole
  );
  if (!typeAndData) return null;
  const common = buildCommon(
    source,
    context.sourceReferences[source.sourceId] ?? null,
    placement
  );
  if (
    common.source === null &&
    (source.availability !== "available" || source.syncStatus !== "normal")
  ) {
    context.issues.push({
      code: "unrepresentable-source-state",
      path: `$.sourcesById.${source.sourceId}`,
      message:
        `Source-less Layer ${source.sourceId} cannot preserve ` +
        `availability=${source.availability}, syncStatus=${source.syncStatus}`,
    });
    return null;
  }
  const revision = common.source === null ? source.sourceVersion : 0;

  switch (typeAndData.type) {
    case "psd":
      if (!common.source) {
        context.issues.push({
          code: "missing-psd-source-identity",
          path: `$.sourcesById.${source.sourceId}`,
          message: "PSD Layer could not resolve a Source Registry reference",
        });
        return null;
      }
      return {
        layerDocumentId,
        name: source.name,
        revision,
        type: "psd",
        common: { ...common, source: common.source },
        data: typeAndData.data,
      };
    case "drawing":
      return {
        layerDocumentId,
        name: source.name,
        revision,
        type: "drawing",
        common: { ...common, source: null },
        data: typeAndData.data,
      };
    case "text":
      return {
        layerDocumentId,
        name: source.name,
        revision,
        type: "text",
        common: { ...common, source: null },
        data: typeAndData.data,
      };
    case "audio":
      return {
        layerDocumentId,
        name: source.name,
        revision,
        type: "audio",
        common,
        data: typeAndData.data,
      };
    case "video":
      return {
        layerDocumentId,
        name: source.name,
        revision,
        type: "video",
        common,
        data: typeAndData.data,
      };
    case "shape":
      return {
        layerDocumentId,
        name: source.name,
        revision,
        type: "shape",
        common: { ...common, source: null },
        data: typeAndData.data,
      };
    case "group":
      return {
        layerDocumentId,
        name: source.name,
        revision,
        type: "group",
        common,
        data: typeAndData.data,
      };
    case "unknown":
      return {
        layerDocumentId,
        name: source.name,
        revision,
        type: "unknown",
        common,
        data: typeAndData.data,
      };
  }
}

export function expandGroupChildren(
  context: MigrationContext,
  groupSourceId: string,
  parentLayerDocumentId: string,
  ancestorItemIds: readonly string[]
) {
  const items = context.document.timelineItemsByGroupId[groupSourceId] ?? [];
  items.forEach((item, order) => {
    const source = context.document.sourcesById[item.sourceId];
    if (!source) return;
    const origin: ProjectSourceLayerMigrationOrigin = {
      kind: "placement",
      sourceId: source.sourceId,
      itemId: item.itemId,
      ancestorItemIds,
    };
    const layerDocumentId = allocateLayerId(context, origin);
    if (!layerDocumentId) return;
    const layer = createLayerDocument(
      context,
      source,
      layerDocumentId,
      {
        parentLayerDocumentId,
        order,
        startFrame: item.startFrame,
        durationFrames: item.durationFrames,
        sourceOffsetFrames: item.sourceOffsetFrames,
        visible: item.visible,
        alias: item.alias,
      },
      source.type === "group" ? "composition" : null
    );
    if (!layer) return;
    context.layerDocumentsById[layerDocumentId] = layer;
    context.layerDocumentIdByPlacementPath[
      pathKey(ancestorItemIds, item.itemId)
    ] = layerDocumentId;
    context.placedSourceIds.add(source.sourceId);
    if (source.type === "group") {
      expandGroupChildren(
        context,
        source.sourceId,
        layerDocumentId,
        [...ancestorItemIds, item.itemId]
      );
    }
  });
}

function isExternalLeafSource(
  source: ProjectSource,
  reference: LayerSourceReference | null
) {
  return (
    reference !== null &&
    (source.type === "psd" ||
      source.type === "audio" ||
      source.type === "video")
  );
}

function unplacedExternalEditIssues(
  source: ProjectSource
): ProjectSourceLayerMigrationIssue[] {
  const sourcePath = `$.sourcesById.${source.sourceId}`;
  const issues: ProjectSourceLayerMigrationIssue[] = [];
  if (!hasDefaultTransform(source)) {
    issues.push({
      code: "unplaced-external-non-default-transform",
      path: `${sourcePath}.transform`,
      message:
        `Unplaced external Source ${source.sourceId} has a non-default Transform`,
    });
  }
  if (!hasDefaultAnimation(source)) {
    issues.push({
      code: "unplaced-external-non-default-animation",
      path: `${sourcePath}.animation`,
      message:
        `Unplaced external Source ${source.sourceId} has non-default Animation`,
    });
  }
  if (source.effects.length > 0) {
    issues.push({
      code: "unplaced-external-non-default-effects",
      path: `${sourcePath}.effects`,
      message:
        `Unplaced external Source ${source.sourceId} has Effects with no Layer`,
    });
  }
  if (source.modifiers.length > 0) {
    issues.push({
      code: "unplaced-external-non-default-modifiers",
      path: `${sourcePath}.modifiers`,
      message:
        `Unplaced external Source ${source.sourceId} has Modifiers with no Layer`,
    });
  }
  return issues;
}

export function findUnplacedSourceIssues(
  context: MigrationContext
): {
  issues: ProjectSourceLayerMigrationIssue[];
  retainedExternalSourceIds: string[];
} {
  const issues: ProjectSourceLayerMigrationIssue[] = [];
  const retainedExternalSourceIds: string[] = [];
  Object.keys(context.document.sourcesById)
    .sort()
    .forEach((sourceId) => {
      if (context.placedSourceIds.has(sourceId)) return;
      const source = context.document.sourcesById[sourceId];
      const reference = context.sourceReferences[sourceId] ?? null;
      const ownedItems =
        source.type === "group"
          ? context.document.timelineItemsByGroupId[sourceId] ?? []
          : [];
      if (ownedItems.length > 0) {
        issues.push({
          code: "unplaced-group-content",
          path: `$.timelineItemsByGroupId.${sourceId}`,
          message: `Unplaced Group ${sourceId} owns editable descendants`,
        });
        return;
      }
      if (
        isExternalLeafSource(source, reference) ||
        (source.type === "group" && reference)
      ) {
        const editIssues = unplacedExternalEditIssues(source);
        if (editIssues.length > 0) {
          issues.push(...editIssues);
          return;
        }
        retainedExternalSourceIds.push(sourceId);
        return;
      }
      issues.push({
        code: "unplaced-editable-source",
        path: `$.sourcesById.${sourceId}`,
        message: `Source-less editable Source ${sourceId} has no Placement`,
      });
    });
  return { issues, retainedExternalSourceIds };
}

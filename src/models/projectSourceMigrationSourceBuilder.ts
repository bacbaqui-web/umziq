import type { LayerAnimation, LayerDocumentCommon, LayerEffect, LayerModifier, LayerSourceReference, LayerTransform, SourceRegistryRecord } from "@/models/layerDocumentModel";
import type { PlainDataObject } from "@/models/plainDataModel";
import type { FutureLayerSource, GroupSource, ProjectSource, ProjectSourceDocument } from "@/models/projectSourceModel";
import { allocateSourceId, clonePlainData, stableHash, type ProjectSourceLayerMigrationIssue, type RegistryBuildResult } from "@/models/projectSourceMigrationIdentity";

export function pathKey(ancestorItemIds: readonly string[], itemId: string | null) {
  return JSON.stringify([...ancestorItemIds, itemId]);
}

export function cloneTransform(source: ProjectSource): LayerTransform {
  return clonePlainData(source.transform);
}

export function cloneAnimation(source: ProjectSource): LayerAnimation {
  return clonePlainData(source.animation);
}

export function cloneEffects(source: ProjectSource): LayerEffect[] {
  return clonePlainData(source.effects);
}

export function cloneModifiers(source: ProjectSource): LayerModifier[] {
  return source.modifiers.map((modifier) => ({
    modifierId: modifier.id,
    type: "wiggle",
    enabled: true,
    frequency: modifier.frequency,
    amount: modifier.amount,
  }));
}

export function hasDefaultTransform(source: ProjectSource): boolean {
  // Mirrors createDefaultProjectSourceTransform without importing Engine code.
  const transform = source.transform;
  return (
    transform.position.x === 0 &&
    transform.position.y === 0 &&
    transform.transformOffset.x === 0 &&
    transform.transformOffset.y === 0 &&
    transform.anchor.x === 0 &&
    transform.anchor.y === 0 &&
    transform.scale.x === 100 &&
    transform.scale.y === 100 &&
    transform.scaleLinked === true &&
    transform.rotation === 0 &&
    transform.opacity === 100
  );
}

export function hasDefaultAnimation(source: ProjectSource): boolean {
  // Mirrors createDefaultProjectSourceAnimation without importing Engine code.
  const animation = source.animation;
  return (
    animation.positionKeyframes.length === 0 &&
    animation.scaleKeyframes.length === 0 &&
    animation.rotationKeyframes.length === 0 &&
    animation.opacityKeyframes.length === 0 &&
    animation.enabledProperties.position === false &&
    animation.enabledProperties.scale === false &&
    animation.enabledProperties.rotation === false &&
    animation.enabledProperties.opacity === false
  );
}

export function buildCommon(
  source: ProjectSource,
  sourceReference: LayerSourceReference | null,
  placement: LayerDocumentCommon["placement"]
): LayerDocumentCommon {
  return {
    source: sourceReference ? { ...sourceReference } : null,
    transform: cloneTransform(source),
    placement: { ...placement },
    animation: cloneAnimation(source),
    effects: cloneEffects(source),
    modifiers: cloneModifiers(source),
  };
}

function sourceRefresh(source: ProjectSource, fileName: string, path: string | null) {
  return {
    status: source.syncStatus,
    reconnectHint: {
      fileName,
      path,
    },
  };
}

function collectPsdFileNames(document: ProjectSourceDocument): string[] {
  return [
    ...new Set(
      Object.values(document.sourcesById).flatMap((source) => {
        if (source.type === "psd" && source.content.sourceIdentity) {
          return [source.content.sourceIdentity.sourceFileName];
        }
        if (source.type === "group" && source.content.sourceIdentity) {
          return [source.content.sourceIdentity.sourceFileName];
        }
        return [];
      })
    ),
  ].sort();
}

function collectPsdSourcesForFile(
  document: ProjectSourceDocument,
  fileName: string
): Array<Extract<ProjectSource, { type: "psd" | "group" }>> {
  return Object.values(document.sourcesById)
    .filter(
      (
        source
      ): source is Extract<ProjectSource, { type: "psd" | "group" }> =>
        (source.type === "psd" || source.type === "group") &&
        source.content.sourceIdentity?.sourceFileName === fileName
    )
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
}

function buildPsdDocumentRecords(
  document: ProjectSourceDocument,
  records: Record<string, SourceRegistryRecord>,
  documentSourceIdByFileName: Map<string, string>,
  reservedIds: Set<string>,
  issues: ProjectSourceLayerMigrationIssue[]
) {
  collectPsdFileNames(document).forEach((fileName) => {
    const sources = collectPsdSourcesForFile(document, fileName);
    const groupWithSettings = sources.find(
      (source): source is GroupSource =>
        source.type === "group" && source.content.importSettings !== null
    );
    if (!groupWithSettings?.content.importSettings) {
      issues.push({
        code: "missing-psd-document-settings",
        path: "$.sourcesById",
        message: `PSD file ${fileName} has no document import settings`,
      });
      return;
    }
    const serializedSettings = new Set(
      sources.flatMap((source) =>
        source.type === "group" && source.content.importSettings
          ? [JSON.stringify(source.content.importSettings)]
          : []
      )
    );
    if (serializedSettings.size > 1) {
      issues.push({
        code: "conflicting-psd-document-settings",
        path: "$.sourcesById",
        message: `PSD file ${fileName} has conflicting import settings`,
      });
      return;
    }
    const documentSource = sources.find(
      (source) => source.content.sourceIdentity?.sourceKey === "document"
    ) ?? groupWithSettings;
    const sourceId = allocateSourceId(
      `psd-document-${stableHash(fileName)}`,
      `psd-document:${fileName}`,
      reservedIds,
      issues
    );
    if (!sourceId) return;
    const sourcePath = documentSource.content.sourcePath ?? fileName;
    const sourceVersion = Math.max(
      1,
      ...sources.map((source) => source.sourceVersion)
    );
    records[sourceId] = {
      sourceId,
      kind: "psd-document",
      displayName: fileName,
      path: sourcePath,
      fingerprint: documentSource.content.sourceFingerprint,
      version: sourceVersion,
      availability: documentSource.availability,
      refresh: sourceRefresh(documentSource, fileName, sourcePath),
      data: {
        fileName,
        importSettings: clonePlainData(
          groupWithSettings.content.importSettings
        ),
      },
    };
    documentSourceIdByFileName.set(fileName, sourceId);
  });
}

function buildPsdSourceRecord(
  source: Extract<ProjectSource, { type: "psd" | "group" }>,
  documentSourceIdByFileName: ReadonlyMap<string, string>,
  records: Record<string, SourceRegistryRecord>,
  reservedIds: Set<string>,
  issues: ProjectSourceLayerMigrationIssue[]
): LayerSourceReference | null {
  const identity = source.content.sourceIdentity;
  if (!identity) {
    if (source.type === "psd") {
      issues.push({
        code: "missing-psd-source-identity",
        path: `$.sourcesById.${source.sourceId}.content.sourceIdentity`,
        message: "PSD Layer Source requires a stable source identity",
      });
    }
    return null;
  }
  const documentSourceId = documentSourceIdByFileName.get(
    identity.sourceFileName
  );
  if (!documentSourceId) return null;
  if (identity.sourceKey === "document") {
    return { sourceId: documentSourceId };
  }
  if (!source.content.sourcePath) {
    issues.push({
      code: "missing-psd-source-path",
      path: `$.sourcesById.${source.sourceId}.content.sourcePath`,
      message: "PSD node requires a source path",
    });
    return null;
  }
  const sourceId = allocateSourceId(
    source.sourceId,
    `psd-node:${identity.sourceFileName}:${identity.sourceKey}`,
    reservedIds,
    issues
  );
  if (!sourceId) return null;
  records[sourceId] = {
    sourceId,
    kind: "psd-node",
    displayName: source.name,
    path: source.content.sourcePath,
    fingerprint: source.content.sourceFingerprint,
    version: source.sourceVersion,
    availability: source.availability,
    refresh: sourceRefresh(
      source,
      identity.sourceFileName,
      source.content.sourcePath
    ),
    data: {
      documentSourceId,
      sourceKey: identity.sourceKey,
      sourcePath: source.content.sourcePath,
      nativeVisible: null,
    },
  };
  return { sourceId };
}

function buildAudioSourceRecord(
  source: Extract<ProjectSource, { type: "audio" }>,
  records: Record<string, SourceRegistryRecord>,
  reservedIds: Set<string>,
  issues: ProjectSourceLayerMigrationIssue[]
): LayerSourceReference | null {
  if (source.content.descriptor.kind === "empty") return null;
  const descriptor = source.content.descriptor;
  const sourceId = allocateSourceId(
    source.sourceId,
    `audio:${source.sourceId}:${descriptor.fileName}`,
    reservedIds,
    issues
  );
  if (!sourceId) return null;
  records[sourceId] = {
    sourceId,
    kind: "audio",
    displayName: descriptor.fileName,
    path: null,
    fingerprint: null,
    version: source.sourceVersion,
    availability: source.availability,
    refresh: sourceRefresh(source, descriptor.fileName, null),
    data: {
      fileName: descriptor.fileName,
      mimeType: descriptor.mimeType,
      durationFrames: source.content.durationFrames,
    },
  };
  return { sourceId };
}

function readString(
  record: PlainDataObject,
  key: string
): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function readFiniteNumber(
  record: PlainDataObject,
  key: string
): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildVideoSourceRecord(
  source: FutureLayerSource,
  records: Record<string, SourceRegistryRecord>,
  reservedIds: Set<string>,
  issues: ProjectSourceLayerMigrationIssue[]
): LayerSourceReference | null {
  const data = source.content.data;
  const fileName = readString(data, "fileName");
  if (!fileName) return null;
  const sourceId = allocateSourceId(
    source.sourceId,
    `video:${source.sourceId}:${fileName}`,
    reservedIds,
    issues
  );
  if (!sourceId) return null;
  const path = readString(data, "path") ?? fileName;
  const durationFrames = readFiniteNumber(data, "durationFrames");
  const width = readFiniteNumber(data, "width");
  const height = readFiniteNumber(data, "height");
  if (
    (durationFrames !== null &&
      (!Number.isInteger(durationFrames) || durationFrames < 1)) ||
    (width !== null && width < 1) ||
    (height !== null && height < 1)
  ) {
    return null;
  }
  records[sourceId] = {
    sourceId,
    kind: "video",
    displayName: fileName,
    path,
    fingerprint: readString(data, "fingerprint"),
    version: source.sourceVersion,
    availability: source.availability,
    refresh: sourceRefresh(source, fileName, path),
    data: {
      fileName,
      mimeType: readString(data, "mimeType"),
      durationFrames,
      width,
      height,
    },
  };
  return { sourceId };
}

export function buildSourceRegistry(
  document: ProjectSourceDocument
): RegistryBuildResult {
  const records: Record<string, SourceRegistryRecord> = {};
  const referenceByProjectSourceId: Record<
    string,
    LayerSourceReference | null
  > = {};
  const issues: ProjectSourceLayerMigrationIssue[] = [];
  const reservedIds = new Set<string>();
  const documentSourceIdByFileName = new Map<string, string>();

  buildPsdDocumentRecords(
    document,
    records,
    documentSourceIdByFileName,
    reservedIds,
    issues
  );

  Object.keys(document.sourcesById)
    .sort()
    .forEach((projectSourceId) => {
      const source = document.sourcesById[projectSourceId];
      let reference: LayerSourceReference | null = null;
      if (source.type === "psd" || source.type === "group") {
        reference = buildPsdSourceRecord(
          source,
          documentSourceIdByFileName,
          records,
          reservedIds,
          issues
        );
      } else if (source.type === "audio") {
        reference = buildAudioSourceRecord(
          source,
          records,
          reservedIds,
          issues
        );
      } else if (source.type === "video") {
        reference = buildVideoSourceRecord(
          source,
          records,
          reservedIds,
          issues
        );
      }
      referenceByProjectSourceId[projectSourceId] = reference;
    });

  return { records, referenceByProjectSourceId, issues };
}

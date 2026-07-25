import type { LayerDocument, LayerDocumentProject, LayerSourceReference, SourceRegistryRecord } from "@/models/layerDocumentModel";
import type { ProjectSourceDocument } from "@/models/projectSourceModel";

export type ProjectSourceLayerMigrationIssueCode =
  | "non-plain-input"
  | "invalid-input-schema"
  | "invalid-project-source"
  | "invalid-project-metadata"
  | "invalid-root-source"
  | "missing-group-meta"
  | "missing-psd-document-settings"
  | "conflicting-psd-document-settings"
  | "missing-psd-source-identity"
  | "missing-psd-source-path"
  | "unrepresentable-source-state"
  | "unrepresentable-group-source-metadata"
  | "unrepresentable-audio-state"
  | "unplaced-editable-source"
  | "unplaced-group-content"
  | "unplaced-external-non-default-transform"
  | "unplaced-external-non-default-animation"
  | "unplaced-external-non-default-effects"
  | "unplaced-external-non-default-modifiers"
  | "layer-id-allocation-failed"
  | "source-id-allocation-failed"
  | "invalid-migration-output";

export interface ProjectSourceLayerMigrationIssue {
  code: ProjectSourceLayerMigrationIssueCode;
  path: string;
  message: string;
}

export interface ProjectSourceLayerMigrationOrigin {
  kind: "root" | "placement";
  sourceId: string;
  itemId: string | null;
  ancestorItemIds: readonly string[];
}

export type ProjectSourceLayerIdCandidateFactory = (
  origin: ProjectSourceLayerMigrationOrigin,
  attempt: number
) => string;

export interface ProjectSourceToLayerDocumentMigrationInput {
  document: ProjectSourceDocument;
  projectId: string;
  name: string;
  layerIdCandidateFactory?: ProjectSourceLayerIdCandidateFactory;
}

export interface ProjectSourceToLayerDocumentMigrationReport {
  layerDocumentIdByPlacementPath: Record<string, string>;
  sourceRegistryIdByProjectSourceId: Record<string, string | null>;
  retainedUnplacedExternalSourceIds: string[];
}

export type ProjectSourceToLayerDocumentMigrationResult =
  | {
      ok: true;
      project: LayerDocumentProject;
      report: ProjectSourceToLayerDocumentMigrationReport;
    }
  | {
      ok: false;
      issues: ProjectSourceLayerMigrationIssue[];
    };

export type UnknownRecord = Record<string, unknown>;

export type RegistryBuildResult = {
  records: Record<string, SourceRegistryRecord>;
  referenceByProjectSourceId: Record<string, LayerSourceReference | null>;
  issues: ProjectSourceLayerMigrationIssue[];
};

export type MigrationContext = {
  document: ProjectSourceDocument;
  sourceReferences: RegistryBuildResult["referenceByProjectSourceId"];
  layerDocumentsById: Record<string, LayerDocument>;
  layerDocumentIdByPlacementPath: Record<string, string>;
  placedSourceIds: Set<string>;
  reservedLayerIds: Set<string>;
  issues: ProjectSourceLayerMigrationIssue[];
  layerIdCandidateFactory: ProjectSourceLayerIdCandidateFactory;
};

export type MigratedLayerTypeAndData<
  TLayer extends LayerDocument = LayerDocument,
> = TLayer extends LayerDocument
  ? Pick<TLayer, "type" | "data">
  : never;

export function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function clonePlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function defaultLayerIdCandidateFactory(
  origin: ProjectSourceLayerMigrationOrigin,
  attempt: number
): string {
  const pathKey = JSON.stringify([
    origin.kind,
    ...origin.ancestorItemIds,
    origin.itemId,
    origin.sourceId,
  ]);
  const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
  return `layer-${stableHash(pathKey)}${suffix}`;
}

export function allocateLayerId(
  context: MigrationContext,
  origin: ProjectSourceLayerMigrationOrigin
): string | null {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = context.layerIdCandidateFactory(origin, attempt).trim();
    if (!candidate || context.reservedLayerIds.has(candidate)) continue;
    context.reservedLayerIds.add(candidate);
    return candidate;
  }
  context.issues.push({
    code: "layer-id-allocation-failed",
    path: "$.payload.layerDocumentsById",
    message: `Could not allocate Layer Document ID for ${origin.sourceId}`,
  });
  return null;
}

export function allocateSourceId(
  preferredId: string,
  identityKey: string,
  reservedIds: Set<string>,
  issues: ProjectSourceLayerMigrationIssue[]
): string | null {
  const candidates = [
    preferredId,
    `source-${stableHash(identityKey)}`,
    ...Array.from(
      { length: 98 },
      (_, index) => `source-${stableHash(identityKey)}-${index + 2}`
    ),
  ];
  for (const candidate of candidates) {
    const normalized = candidate.trim();
    if (!normalized || reservedIds.has(normalized)) continue;
    reservedIds.add(normalized);
    return normalized;
  }
  issues.push({
    code: "source-id-allocation-failed",
    path: "$.payload.sourceRegistry.sourcesById",
    message: `Could not allocate Source Registry ID for ${identityKey}`,
  });
  return null;
}

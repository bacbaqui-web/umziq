import { LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION, type LayerDocumentProject } from "@/models/layerDocumentModel";
import { validateLayerDocumentProject } from "@/models/layerDocumentValidation";
import { allocateLayerId, defaultLayerIdCandidateFactory, type MigrationContext, type ProjectSourceLayerMigrationOrigin, type ProjectSourceToLayerDocumentMigrationInput, type ProjectSourceToLayerDocumentMigrationResult } from "@/models/projectSourceMigrationIdentity";
import { buildSourceRegistry, pathKey } from "@/models/projectSourceMigrationSourceBuilder";
import { createLayerDocument, expandGroupChildren, findUnplacedSourceIssues } from "@/models/projectSourceMigrationLayerBuilder";
import { inputIssues } from "@/models/projectSourceMigrationInputValidation";

export type { ProjectSourceLayerIdCandidateFactory, ProjectSourceLayerMigrationIssue, ProjectSourceLayerMigrationIssueCode, ProjectSourceLayerMigrationOrigin, ProjectSourceToLayerDocumentMigrationInput, ProjectSourceToLayerDocumentMigrationReport, ProjectSourceToLayerDocumentMigrationResult } from "@/models/projectSourceMigrationIdentity";

export function migrateProjectSourceToLayerDocumentProject(
  input: ProjectSourceToLayerDocumentMigrationInput
): ProjectSourceToLayerDocumentMigrationResult {
  const initialIssues = inputIssues(input);
  if (initialIssues.length > 0) {
    return { ok: false, issues: initialIssues };
  }

  const registry = buildSourceRegistry(input.document);
  if (registry.issues.length > 0) {
    return { ok: false, issues: registry.issues };
  }
  const context: MigrationContext = {
    document: input.document,
    sourceReferences: registry.referenceByProjectSourceId,
    layerDocumentsById: {},
    layerDocumentIdByPlacementPath: {},
    placedSourceIds: new Set<string>(),
    reservedLayerIds: new Set<string>(),
    issues: [],
    layerIdCandidateFactory:
      input.layerIdCandidateFactory ?? defaultLayerIdCandidateFactory,
  };
  const rootSourceId = input.document.rootSourceIds[0];
  const rootSource = input.document.sourcesById[rootSourceId];
  if (rootSource.type !== "group") {
    return {
      ok: false,
      issues: [{
        code: "invalid-root-source",
        path: "$.document.rootSourceIds[0]",
        message: "Root Source must be a Group",
      }],
    };
  }
  const rootOrigin: ProjectSourceLayerMigrationOrigin = {
    kind: "root",
    sourceId: rootSource.sourceId,
    itemId: null,
    ancestorItemIds: [],
  };
  const rootLayerDocumentId = allocateLayerId(context, rootOrigin);
  if (!rootLayerDocumentId) {
    return { ok: false, issues: context.issues };
  }
  const rootMeta = input.document.compositionMetaByGroupId[rootSource.sourceId];
  const rootLayer = createLayerDocument(
    context,
    rootSource,
    rootLayerDocumentId,
    {
      parentLayerDocumentId: null,
      order: 0,
      startFrame: 0,
      durationFrames: rootMeta?.durationFrames ?? 1,
      sourceOffsetFrames: 0,
      visible: true,
      alias: null,
    },
    "project-root"
  );
  if (!rootLayer) {
    return { ok: false, issues: context.issues };
  }
  context.layerDocumentsById[rootLayerDocumentId] = rootLayer;
  context.layerDocumentIdByPlacementPath[pathKey([], null)] =
    rootLayerDocumentId;
  context.placedSourceIds.add(rootSource.sourceId);
  expandGroupChildren(
    context,
    rootSource.sourceId,
    rootLayerDocumentId,
    []
  );
  if (context.issues.length > 0) {
    return { ok: false, issues: context.issues };
  }

  const unplaced = findUnplacedSourceIssues(context);
  if (unplaced.issues.length > 0) {
    return { ok: false, issues: unplaced.issues };
  }

  const project: LayerDocumentProject = {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: input.projectId.trim(),
      name: input.name.trim(),
    },
    payload: {
      layerDocumentsById: context.layerDocumentsById,
      sourceRegistry: {
        sourcesById: registry.records,
      },
    },
  };
  const outputIssues = validateLayerDocumentProject(project);
  if (outputIssues.length > 0) {
    return {
      ok: false,
      issues: [{
        code: "invalid-migration-output",
        path: outputIssues[0].path,
        message: outputIssues[0].message,
      }],
    };
  }

  return {
    ok: true,
    project,
    report: {
      layerDocumentIdByPlacementPath:
        context.layerDocumentIdByPlacementPath,
      sourceRegistryIdByProjectSourceId: Object.fromEntries(
        Object.keys(input.document.sourcesById)
          .sort()
          .map((sourceId) => [
            sourceId,
            registry.referenceByProjectSourceId[sourceId]?.sourceId ?? null,
          ])
      ),
      retainedUnplacedExternalSourceIds:
        unplaced.retainedExternalSourceIds,
    },
  };
}

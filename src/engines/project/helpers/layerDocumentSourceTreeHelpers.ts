import type {
  LayerDocumentProject,
  PsdDocumentSourceRecord,
  PsdNodeSourceRecord,
  PsdTreeSourceSelection,
  SourceRegistryRecord,
} from "@/models";
import {
  layerDocumentSourceDescriptorPath,
} from "@/models";
import type {
  LayerDocumentSourceRuntimeResolutionReadPort,
} from "@/engines/project/models/layerDocumentSourceRuntimeResolutionModel";
import type {
  NonPsdSourceTreeItem,
  PsdSourceTreeDocument,
  PsdSourceTreeNode,
  PsdSourceTreeReadModel,
  SourceRegistryTreeMetadata,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

function metadata(
  source: SourceRegistryRecord,
  resolution: LayerDocumentSourceRuntimeResolutionReadPort
): SourceRegistryTreeMetadata {
  const resolutionStatus =
    resolution.read(source.sourceId).status;
  return {
    sourceId: source.sourceId,
    kind: source.kind,
    displayName: source.displayName,
    path: layerDocumentSourceDescriptorPath(source),
    resolutionStatus,
    reconciliationStatus: source.refresh.status,
    refreshStatus:
      resolutionStatus === "available"
        ? source.refresh.status
        : "missing",
  };
}

function compareTreeMetadata(
  left: SourceRegistryTreeMetadata,
  right: SourceRegistryTreeMetadata
): number {
  return left.displayName.localeCompare(right.displayName) ||
    left.sourceId.localeCompare(right.sourceId);
}

function parentSourcePath(sourcePath: string): string | null {
  const separatorIndex = sourcePath.lastIndexOf("/");
  return separatorIndex > 0
    ? sourcePath.slice(0, separatorIndex)
    : null;
}

function documentRootSourcePaths(
  document: PsdDocumentSourceRecord | null
): ReadonlySet<string> {
  if (!document) return new Set();
  return new Set(
    [
      document.locator.relativePathHint,
      document.locator.suggestedFileName,
    ]
      .filter((path): path is string => Boolean(path))
      .map((path) => path.replace(/\/+$/, ""))
      .filter((path) => path.length > 0)
  );
}

interface PsdNodeHierarchy {
  readonly roots: readonly PsdSourceTreeNode[];
  readonly orphans: readonly PsdSourceTreeNode[];
}

function buildPsdNodeHierarchy(options: {
  sources: readonly PsdNodeSourceRecord[];
  document: PsdDocumentSourceRecord | null;
  resolution: LayerDocumentSourceRuntimeResolutionReadPort;
}): PsdNodeHierarchy {
  const documentExists = options.document !== null;
  const documentRootPaths = documentRootSourcePaths(options.document);
  const sourcesByPath = new Map<string, PsdNodeSourceRecord[]>();
  options.sources.forEach((source) => {
    const matches = sourcesByPath.get(source.data.sourcePath);
    if (matches) matches.push(source);
    else sourcesByPath.set(source.data.sourcePath, [source]);
  });
  const childrenByParentId = new Map<string, PsdNodeSourceRecord[]>();
  const rootSources: PsdNodeSourceRecord[] = [];
  const orphanReasonBySourceId = new Map<
    string,
    Exclude<PsdSourceTreeNode["orphanReason"], null>
  >();

  options.sources.forEach((source) => {
    const parentPath = parentSourcePath(source.data.sourcePath);
    if (
      parentPath === null ||
      documentRootPaths.has(parentPath.replace(/\/+$/, ""))
    ) {
      rootSources.push(source);
      if (!documentExists) {
        orphanReasonBySourceId.set(source.sourceId, "missing-document");
      }
      return;
    }
    const parentCandidates = sourcesByPath.get(parentPath) ?? [];
    if (parentCandidates.length === 1) {
      const children =
        childrenByParentId.get(parentCandidates[0].sourceId);
      if (children) children.push(source);
      else childrenByParentId.set(parentCandidates[0].sourceId, [source]);
      return;
    }
    rootSources.push(source);
    orphanReasonBySourceId.set(
      source.sourceId,
      !documentExists
        ? "missing-document"
        : parentCandidates.length === 0
          ? "missing-parent"
          : "ambiguous-parent"
    );
  });

  const buildNode = (
    source: PsdNodeSourceRecord
  ): PsdSourceTreeNode => ({
    ...metadata(source, options.resolution),
    kind: "psd-node",
    documentSourceId: source.data.documentSourceId,
    sourcePath: source.data.sourcePath,
    children: (childrenByParentId.get(source.sourceId) ?? [])
      .map(buildNode)
      .sort(compareTreeMetadata),
    orphanReason: orphanReasonBySourceId.get(source.sourceId) ?? null,
  });
  const builtRoots = rootSources
    .map(buildNode)
    .sort(compareTreeMetadata);

  if (!documentExists) {
    return { roots: [], orphans: builtRoots };
  }
  return {
    roots: builtRoots.filter((node) => node.orphanReason === null),
    orphans: builtRoots.filter((node) => node.orphanReason !== null),
  };
}

function nonPsdSource(
  source: Extract<
    SourceRegistryRecord,
    { kind: "audio" | "video" | "unknown" }
  >,
  resolution: LayerDocumentSourceRuntimeResolutionReadPort
): NonPsdSourceTreeItem {
  return {
    ...metadata(source, resolution),
    kind: source.kind,
    treePolicy: source.kind === "unknown"
      ? "preserved-resource-leaf"
      : "resource-leaf",
  };
}

export function buildPsdSourceTreeReadModel(options: {
  project: LayerDocumentProject;
  selection: PsdTreeSourceSelection | null;
  resolution: LayerDocumentSourceRuntimeResolutionReadPort;
}): PsdSourceTreeReadModel {
  const sources = Object.values(
    options.project.payload.sourceRegistry.sourcesById
  );
  const nodesByDocumentId = new Map<string, PsdNodeSourceRecord[]>();
  sources.forEach((source) => {
    if (source.kind !== "psd-node") return;
    const nodes = nodesByDocumentId.get(source.data.documentSourceId);
    if (nodes) nodes.push(source);
    else nodesByDocumentId.set(source.data.documentSourceId, [source]);
  });

  const documentsById = new Map(
    sources
      .filter((source): source is PsdDocumentSourceRecord =>
        source.kind === "psd-document"
      )
      .map((source) => [source.sourceId, source])
  );
  const orphanNodes: PsdSourceTreeNode[] = [];
  const hierarchyByDocumentId = new Map<string, PsdNodeHierarchy>();
  nodesByDocumentId.forEach((nodes, documentSourceId) => {
    const hierarchy = buildPsdNodeHierarchy({
      sources: nodes,
      document: documentsById.get(documentSourceId) ?? null,
      resolution: options.resolution,
    });
    hierarchyByDocumentId.set(documentSourceId, hierarchy);
    orphanNodes.push(...hierarchy.orphans);
  });

  const documents: PsdSourceTreeDocument[] = sources
    .filter((source): source is Extract<
      SourceRegistryRecord,
      { kind: "psd-document" }
    > => source.kind === "psd-document")
    .map((source) => ({
      ...metadata(source, options.resolution),
      kind: "psd-document" as const,
      children: hierarchyByDocumentId.get(source.sourceId)?.roots ?? [],
    }))
    .sort(compareTreeMetadata);
  const nonPsdSources = sources
    .filter((source): source is Extract<
      SourceRegistryRecord,
      { kind: "audio" | "video" | "unknown" }
    > =>
      source.kind === "audio" ||
      source.kind === "video" ||
      source.kind === "unknown"
    )
    .map((source) => nonPsdSource(source, options.resolution))
    .sort(compareTreeMetadata);
  const selectedSourceId = options.selection?.sourceId ?? null;
  const selectionExists = Boolean(
    selectedSourceId &&
    options.project.payload.sourceRegistry.sourcesById[selectedSourceId]
  );

  return {
    selectionKind: "psd-tree-source",
    selectedSourceId: selectionExists ? selectedSourceId : null,
    selectionStatus: !selectedSourceId
      ? "none"
      : selectionExists
        ? "selected"
        : "stale",
    documents,
    orphanNodes: orphanNodes.sort(compareTreeMetadata),
    nonPsdSources,
  };
}

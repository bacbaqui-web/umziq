import type { Layer as PsdLayer, Psd } from "ag-psd";
import type {
  GroupLayerDocument,
  LayerDocument,
  LayerDocumentCommon,
  LayerSourceReference,
  PsdDocumentSourceRecord,
  PsdNodeSourceRecord,
  SourceRegistryRecord,
} from "@/models";
import type {
  ImportSourceRegistryCommand,
  RefreshPsdSourceRegistryCommand,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";
import type {
  LayerDocumentSourceRuntimeResource,
} from "@/engines/playback-render";
import {
  buildLayerDocumentSourceResourceCacheKey,
  layerDocumentSourceVisualKeyPolicy,
} from "@/engines/playback-render";
import {
  analyzeParsedPsd,
} from "@/engines/project/import/psdImportAnalyzer";
import {
  buildLayerSourceFingerprint,
} from "@/engines/project/import/psdLayerConverter";
import {
  isGroupLayer,
  normalizePsdOpacity,
} from "@/engines/project/import/psdImportHelpers";
import {
  parsePsdFile,
} from "@/engines/project/import/psdParser";
import {
  createLayerDocumentPreparedRuntimeLifecycle,
  type LayerDocumentPreparedRuntimeLifecycle,
} from "@/engines/project/import/layerDocumentPreparedRuntimeLifecycle";

export interface PreparedLayerDocumentPsdImport {
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
  readonly groupCount: number;
  readonly layerCount: number;
  readonly command: ImportSourceRegistryCommand;
  readonly runtime: LayerDocumentPreparedRuntimeLifecycle;
}

export interface PreparedLayerDocumentPsdRefresh {
  readonly command: Omit<
    RefreshPsdSourceRegistryCommand,
    "cacheContext"
  >;
  readonly runtime: LayerDocumentPreparedRuntimeLifecycle;
}

function stableId(prefix: string, token: string, key: string) {
  const normalized = `${token}:${key}`
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-");
  return `${prefix}:${normalized}`;
}

function common(options: {
  parentLayerDocumentId: string;
  order: number;
  sourceId: string;
  durationFrames: number;
  layer?: PsdLayer;
}): LayerDocumentCommon<LayerSourceReference> {
  const canvas = options.layer?.canvas;
  const center = {
    x: (canvas?.width ?? 0) / 2,
    y: (canvas?.height ?? 0) / 2,
  };
  return {
    source: { sourceId: options.sourceId },
    transform: {
      position: {
        x: (options.layer?.left ?? 0) + center.x,
        y: (options.layer?.top ?? 0) + center.y,
      },
      transformOffset: { x: 0, y: 0 },
      anchor: center,
      scale: { x: 100, y: 100 },
      scaleLinked: true,
      rotation: 0,
      opacity: normalizePsdOpacity(options.layer?.opacity),
    },
    placement: {
      parentLayerDocumentId: options.parentLayerDocumentId,
      order: options.order,
      startFrame: 0,
      durationFrames: options.durationFrames,
      sourceOffsetFrames: 0,
      visible: !options.layer?.hidden,
      alias: null,
    },
    animation: {
      positionKeyframes: [],
      scaleKeyframes: [],
      rotationKeyframes: [],
      opacityKeyframes: [],
      enabledProperties: {
        position: false,
        scale: false,
        rotation: false,
        opacity: false,
      },
    },
    effects: [],
    modifiers: [],
  };
}

function documentSource(options: {
  sourceId: string;
  fileName: string;
  version: number;
  fingerprint: string;
}): PsdDocumentSourceRecord {
  return {
    sourceId: options.sourceId,
    kind: "psd-document",
    displayName: options.fileName,
    path: options.fileName,
    fingerprint: options.fingerprint,
    version: options.version,
    availability: "available",
    refresh: { status: "normal", reconnectHint: null },
    data: {
      fileName: options.fileName,
      importSettings: {
        compositionName: options.fileName.replace(/\.psd$/i, ""),
        hiddenLayerMode: "preserve",
      },
    },
  };
}

function nodeSource(options: {
  sourceId: string;
  documentSourceId: string;
  sourceKey: string;
  sourcePath: string;
  displayName: string;
  layer: PsdLayer;
  version: number;
}): PsdNodeSourceRecord {
  return {
    sourceId: options.sourceId,
    kind: "psd-node",
    displayName: options.displayName,
    path: options.sourcePath,
    fingerprint: buildLayerSourceFingerprint(options.layer),
    version: options.version,
    availability: "available",
    refresh: { status: "normal", reconnectHint: null },
    data: {
      documentSourceId: options.documentSourceId,
      sourceKey: options.sourceKey,
      sourcePath: options.sourcePath,
      nativeVisible: !options.layer.hidden,
    },
  };
}

function runtimeResource(options: {
  source: PsdNodeSourceRecord;
  layer: PsdLayer;
}): LayerDocumentSourceRuntimeResource | null {
  const canvas = options.layer.canvas;
  if (!canvas || isGroupLayer(options.layer)) return null;
  const sourceResourceCacheKey =
    buildLayerDocumentSourceResourceCacheKey({
      sourceId: options.source.sourceId,
      sourceKind: options.source.kind,
      visualKeyPolicy: layerDocumentSourceVisualKeyPolicy(
        options.source.kind
      ),
      sourceVersion: options.source.version,
      sourceFingerprint: options.source.fingerprint,
      localFrame: 0,
      quality: "preview",
    });
  return {
    sourceId: options.source.sourceId,
    sourceResourceCacheKey,
    resolution: {
      renderItemId: `runtime:${options.source.sourceId}`,
      drawableId: `drawable:${options.source.sourceId}`,
      logicalSize: {
        width: canvas.width,
        height: canvas.height,
      },
    },
    resource: canvas,
    dispose: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

function buildTree(options: {
  psd: Psd;
  token: string;
  fileName: string;
  documentSourceId: string;
  compositionLayerDocumentId: string;
  durationFrames: number;
  existingBySourceKey?: ReadonlyMap<string, PsdNodeSourceRecord>;
}) {
  const analysis = analyzeParsedPsd(options.psd);
  const sources: PsdNodeSourceRecord[] = [];
  const layers: LayerDocument[] = [];
  const runtimeResources: LayerDocumentSourceRuntimeResource[] = [];

  const visit = (
    nodes: typeof analysis.tree,
    parentLayerDocumentId: string,
    parentPath: string
  ) => {
    nodes.forEach((node, order) => {
      const parsed = analysis.sourceNodeByKey.get(node.sourceKey);
      if (!parsed) return;
      const existing =
        options.existingBySourceKey?.get(node.sourceKey);
      const sourceId = existing?.sourceId ??
        stableId("psd-source", options.token, node.sourceKey);
      const layerDocumentId = stableId(
        "layer-document",
        options.token,
        node.sourceKey
      );
      const sourcePath = `${parentPath}/${node.displayName}`;
      const source = nodeSource({
        sourceId,
        documentSourceId: options.documentSourceId,
        sourceKey: node.sourceKey,
        sourcePath,
        displayName: node.displayName,
        layer: parsed,
        version: existing ? existing.version + 1 : 1,
      });
      sources.push(source);
      const layerCommon = common({
        parentLayerDocumentId,
        order,
        sourceId,
        durationFrames: options.durationFrames,
        layer: parsed,
      });
      if (node.kind === "group") {
        layers.push({
          layerDocumentId,
          name: node.displayName,
          revision: 0,
          type: "group",
          common: layerCommon,
          data: {
            role: "composition",
            width: options.psd.width,
            height: options.psd.height,
            frameRate: 30,
            durationFrames: options.durationFrames,
          },
        });
        visit(node.children, layerDocumentId, sourcePath);
      } else {
        layers.push({
          layerDocumentId,
          name: node.displayName,
          revision: 0,
          type: "psd",
          common: layerCommon,
          data: {},
        });
        const resource = runtimeResource({ source, layer: parsed });
        if (resource) runtimeResources.push(resource);
      }
    });
  };
  visit(
    analysis.tree,
    options.compositionLayerDocumentId,
    options.fileName
  );
  return {
    analysis,
    sources,
    layers,
    runtimeResources,
  };
}

export async function prepareLayerDocumentPsdImport(options: {
  file: File;
  token: string;
  parentLayerDocumentId: string;
  order: number;
  durationFrames: number;
  parsePsd?: (file: File) => Promise<Psd>;
}): Promise<PreparedLayerDocumentPsdImport> {
  const psd = await (options.parsePsd ?? parsePsdFile)(options.file);
  const documentSourceId = stableId(
    "psd-document",
    options.token,
    options.file.name
  );
  const compositionLayerDocumentId = stableId(
    "layer-document",
    options.token,
    "composition"
  );
  const tree = buildTree({
    psd,
    token: options.token,
    fileName: options.file.name,
    documentSourceId,
    compositionLayerDocumentId,
    durationFrames: options.durationFrames,
  });
  const doc = documentSource({
    sourceId: documentSourceId,
    fileName: options.file.name,
    version: 1,
    fingerprint: `${psd.width}x${psd.height}:${options.file.size}`,
  });
  const composition: GroupLayerDocument = {
    layerDocumentId: compositionLayerDocumentId,
    name: options.file.name.replace(/\.psd$/i, ""),
    revision: 0,
    type: "group",
    common: common({
      parentLayerDocumentId: options.parentLayerDocumentId,
      order: options.order,
      sourceId: documentSourceId,
      durationFrames: options.durationFrames,
    }),
    data: {
      role: "composition",
      width: psd.width,
      height: psd.height,
      frameRate: 30,
      durationFrames: options.durationFrames,
    },
  };
  const runtimeResources = tree.runtimeResources;
  return {
    fileName: options.file.name,
    width: psd.width,
    height: psd.height,
    groupCount: tree.analysis.groupCount,
    layerCount: tree.analysis.layerCount,
    command: {
      sources: [doc, ...tree.sources],
      layers: [composition, ...tree.layers],
      selectSourceId: documentSourceId,
      selectLayerDocumentId: compositionLayerDocumentId,
    },
    runtime: createLayerDocumentPreparedRuntimeLifecycle(
      runtimeResources
    ),
  };
}

export async function prepareLayerDocumentPsdRefresh(options: {
  file: File;
  documentSource: PsdDocumentSourceRecord;
  existingSources: readonly SourceRegistryRecord[];
  parsePsd?: (file: File) => Promise<Psd>;
}): Promise<PreparedLayerDocumentPsdRefresh> {
  const psd = await (options.parsePsd ?? parsePsdFile)(options.file);
  const existingBySourceKey = new Map(
    options.existingSources.flatMap((source) =>
      source.kind === "psd-node" &&
      source.data.documentSourceId === options.documentSource.sourceId
        ? [[source.data.sourceKey, source] as const]
        : []
    )
  );
  const tree = buildTree({
    psd,
    token: options.documentSource.sourceId,
    fileName: options.file.name,
    documentSourceId: options.documentSource.sourceId,
    compositionLayerDocumentId: "refresh-does-not-create-layers",
    durationFrames: 1,
    existingBySourceKey,
  });
  const existingSourceIds = new Set(
    options.existingSources.map((source) => source.sourceId)
  );
  const refreshedNodeSources = tree.sources.map((source) => ({
    ...source,
    refresh: {
      ...source.refresh,
      status: existingSourceIds.has(source.sourceId)
        ? "updated" as const
        : "new" as const,
    },
  }));
  const refreshedSourceIds = new Set(
    refreshedNodeSources.map((source) => source.sourceId)
  );
  const deletePendingSources =
    options.existingSources.flatMap((source) => {
      if (
        source.kind !== "psd-node" ||
        source.data.documentSourceId !==
          options.documentSource.sourceId ||
        refreshedSourceIds.has(source.sourceId)
      ) return [];
      return [{
        ...source,
        version: source.version + 1,
        refresh: {
          ...source.refresh,
          status: "deletePending" as const,
        },
      }];
    });
  const runtimeResources = tree.runtimeResources;
  return {
    command: {
      documentSource: {
        ...documentSource({
          sourceId: options.documentSource.sourceId,
          fileName: options.file.name,
          version: options.documentSource.version + 1,
          fingerprint:
            `${psd.width}x${psd.height}:${options.file.size}`,
        }),
        refresh: {
          status: "updated",
          reconnectHint: null,
        },
      },
      nodeSources: [
        ...refreshedNodeSources,
        ...deletePendingSources,
      ],
    },
    runtime: createLayerDocumentPreparedRuntimeLifecycle(
      runtimeResources
    ),
  };
}

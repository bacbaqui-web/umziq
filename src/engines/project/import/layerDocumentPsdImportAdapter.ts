import type { Layer as PsdLayer, Psd } from "ag-psd";
import type {
  GroupLayerDocument,
  LayerDocument,
  LayerDocumentCommon,
  LayerSourceReference,
  PsdDocumentSourceRecord,
  PsdNodeSourceRecord,
  SourceRegistryRecord,
  LinkedSourceContentFingerprint,
} from "@/models";
import type {
  ImportSourceRegistryCommand,
  RefreshPsdSourceRegistryCommand,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";
import type {
  LayerDocumentSourceRuntimeResource,
} from "@/render";
import {
  buildLayerDocumentSourceResourceCacheKey,
  layerDocumentSourceVisualKeyPolicy,
} from "@/render";
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
import { parsePsdArrayBuffer } from "@/engines/project/import/psdParser";
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
  readonly resolution: PreparedLayerDocumentPsdResolution;
  readonly previewImagesByLayerDocumentId?: Readonly<Record<string, string>>;
  readonly previewSizesByLayerDocumentId?: Readonly<
    Record<string, { width: number; height: number }>
  >;
}

function buildPreviewImage(
  _psd: Psd,
  layers: readonly PsdLayer[]
): { url: string | null; width: number; height: number } | null {
  if (typeof document === "undefined") return null;
  const candidates = layers.filter((layer) => layer.canvas);
  if (!candidates.length) return null;
  const visible = candidates.filter((layer) => !layer.hidden);
  const bounds = candidates.reduce<{
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>(
    (result, layer) => {
      const left = layer.left ?? 0;
      const top = layer.top ?? 0;
      const width = layer.canvas?.width ?? 0;
      const height = layer.canvas?.height ?? 0;
      return {
        left: Math.min(result.left, left),
        top: Math.min(result.top, top),
        right: Math.max(result.right, left + width),
        bottom: Math.max(result.bottom, top + height),
      };
    },
    {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    }
  );
  const contentWidth = Math.max(1, bounds.right - bounds.left);
  const contentHeight = Math.max(1, bounds.bottom - bounds.top);
  const maxSize = 220;
  const scale = Math.min(
    maxSize / contentWidth,
    maxSize / contentHeight,
    1
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(contentWidth * scale));
  canvas.height = Math.max(1, Math.round(contentHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  [...visible].reverse().forEach((layer) => {
    if (!layer.canvas) return;
    context.globalAlpha =
      normalizePsdOpacity(layer.opacity) / 100;
    context.drawImage(
      layer.canvas,
      Math.round(((layer.left ?? 0) - bounds.left) * scale),
      Math.round(((layer.top ?? 0) - bounds.top) * scale),
      Math.max(1, Math.round(layer.canvas.width * scale)),
      Math.max(1, Math.round(layer.canvas.height * scale))
    );
  });
  context.globalAlpha = 1;
  const pixels = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  ).data;
  let hasVisiblePixel = false;
  for (let index = 3; index < pixels.length; index += 4) {
    if ((pixels[index] ?? 0) > 0) {
      hasVisiblePixel = true;
      break;
    }
  }
  return {
    url: hasVisiblePixel ? canvas.toDataURL("image/png") : null,
    width: Math.round(contentWidth),
    height: Math.round(contentHeight),
  };
}

export interface PreparedLayerDocumentPsdRefresh {
  readonly command: Omit<
    RefreshPsdSourceRegistryCommand,
    "cacheContext"
  >;
  readonly runtime: LayerDocumentPreparedRuntimeLifecycle;
  readonly resolution: PreparedLayerDocumentPsdResolution;
}

export interface PreparedLayerDocumentPsdResolution {
  readonly documentSourceId: string;
  readonly sourceIds: readonly string[];
  readonly file: File;
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
  logicalSize?: {
    width: number;
    height: number;
  };
  position?: { x: number; y: number };
}): LayerDocumentCommon<LayerSourceReference> {
  const canvas = options.layer?.canvas;
  const logicalSize = options.logicalSize ?? canvas;
  const center = {
    x: (logicalSize?.width ?? 0) / 2,
    y: (logicalSize?.height ?? 0) / 2,
  };
  const sourceLeft = options.logicalSize
    ? 0
    : options.layer?.left ?? 0;
  const sourceTop = options.logicalSize
    ? 0
    : options.layer?.top ?? 0;
  return {
    source: { sourceId: options.sourceId },
    transform: {
      position: {
        x: options.position?.x ?? sourceLeft + center.x,
        y: options.position?.y ?? sourceTop + center.y,
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
  locatorId: string;
  relativePathHint: string | null;
  contentFingerprint: LinkedSourceContentFingerprint;
  importSettings?: PsdDocumentSourceRecord["data"]["importSettings"];
}): PsdDocumentSourceRecord {
  return {
    sourceId: options.sourceId,
    kind: "psd-document",
    displayName: options.fileName,
    version: options.version,
    refresh: { status: "normal" },
    locator: {
      locatorId: options.locatorId,
      kind: "linked-file",
      suggestedFileName: options.fileName,
      relativePathHint: options.relativePathHint,
    },
    contentFingerprint: options.contentFingerprint,
    data: {
      importSettings: options.importSettings ?? {
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
    version: options.version,
    refresh: { status: "normal" },
    data: {
      documentSourceId: options.documentSourceId,
      sourceKey: options.sourceKey,
      sourcePath: options.sourcePath,
      visualFingerprint: buildLayerSourceFingerprint(options.layer),
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
      sourceFingerprint: options.source.data.visualFingerprint,
      localFrame: 0,
      sourceSamplingQuality: "preview",
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
  const previewImagesByLayerDocumentId: Record<string, string> = {};
  const previewSizesByLayerDocumentId: Record<
    string,
    { width: number; height: number }
  > = {};

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
        logicalSize:
          node.kind === "group"
            ? {
                width: options.psd.width,
                height: options.psd.height,
              }
            : undefined,
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
      const previewLayers = node.kind === "group"
        ? (() => {
            const descendants: PsdLayer[] = [];
            const collect = (children: typeof node.children) => {
              children.forEach((child) => {
                const childLayer =
                  analysis.sourceNodeByKey.get(child.sourceKey);
                if (childLayer && child.kind === "layer") {
                  descendants.push(childLayer);
                }
                collect(child.children);
              });
            };
            collect(node.children);
            return descendants;
          })()
        : [parsed];
      const preview = buildPreviewImage(options.psd, previewLayers);
      previewImagesByLayerDocumentId[layerDocumentId] =
        preview?.url ?? "";
      if (preview) {
        previewSizesByLayerDocumentId[layerDocumentId] = {
          width: preview.width,
          height: preview.height,
        };
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
    previewImagesByLayerDocumentId,
    previewSizesByLayerDocumentId,
  };
}

export async function prepareLayerDocumentPsdImport(options: {
  file: File;
  token: string;
  parentLayerDocumentId: string;
  order: number;
  durationFrames: number;
  parentWidth?: number;
  parentHeight?: number;
  parsePsd?: (
    buffer: ArrayBuffer
  ) => Psd | Promise<Psd>;
}): Promise<PreparedLayerDocumentPsdImport> {
  const buffer = await options.file.arrayBuffer();
  const [psd, contentFingerprint] = await Promise.all([
    options.parsePsd
      ? options.parsePsd(buffer)
      : Promise.resolve(parsePsdArrayBuffer(buffer)),
    buildSha256Fingerprint(buffer),
  ]);
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
    locatorId: `linked:${documentSourceId}`,
    relativePathHint: null,
    contentFingerprint,
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
      logicalSize: {
        width: psd.width,
        height: psd.height,
      },
      position:
        options.parentWidth !== undefined &&
        options.parentHeight !== undefined
          ? {
              x: options.parentWidth / 2,
              y: options.parentHeight / 2,
            }
          : undefined,
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
    resolution: {
      documentSourceId,
      sourceIds: [doc, ...tree.sources].map(
        (source) => source.sourceId
      ),
      file: options.file,
    },
    previewImagesByLayerDocumentId:
      tree.previewImagesByLayerDocumentId,
    previewSizesByLayerDocumentId:
      tree.previewSizesByLayerDocumentId,
  };
}

export async function prepareLayerDocumentPsdRefresh(options: {
  file: File;
  buffer?: ArrayBuffer;
  documentSource: PsdDocumentSourceRecord;
  existingSources: readonly SourceRegistryRecord[];
  parsePsd?: (
    buffer: ArrayBuffer
  ) => Psd | Promise<Psd>;
}): Promise<PreparedLayerDocumentPsdRefresh> {
  const buffer =
    options.buffer ?? await options.file.arrayBuffer();
  const [psd, contentFingerprint] = await Promise.all([
    options.parsePsd
      ? options.parsePsd(buffer)
      : Promise.resolve(parsePsdArrayBuffer(buffer)),
    buildSha256Fingerprint(buffer),
  ]);
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
          locatorId:
            options.documentSource.locator.locatorId,
          relativePathHint:
            options.documentSource.locator.relativePathHint,
          contentFingerprint,
          importSettings:
            options.documentSource.data.importSettings,
        }),
        refresh: {
          status: "updated",
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
    resolution: {
      documentSourceId: options.documentSource.sourceId,
      sourceIds: [
        options.documentSource.sourceId,
        ...refreshedNodeSources.map((source) => source.sourceId),
      ],
      file: options.file,
    },
  };
}

async function buildSha256Fingerprint(
  buffer: ArrayBuffer
): Promise<LinkedSourceContentFingerprint> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const digestHex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return {
    algorithm: "sha-256",
    digestHex,
    byteLength: buffer.byteLength,
  };
}

import type {
  LayerDocumentProject,
  LayerDocument,
} from "@/models";
import {
  layerDocumentSourceVisualFingerprint,
} from "@/models/layerDocumentSourceDescriptorHelpers";
import type {
  LayerDocumentSourceRuntimeResourcePort,
} from "@/render";
import {
  buildLayerDocumentSourceResourceCacheKey,
  layerDocumentSourceVisualKeyPolicy,
} from "@/render";
import type {
  LibraryHoverPreviewViewModel,
} from "@/engines/library/models/libraryModel";

type PreviewReaderOptions = {
  readProject: () => LayerDocumentProject;
  resources: LayerDocumentSourceRuntimeResourcePort;
  readAudioWaveform: (sourceId: string, bins: number) => readonly number[];
};

function visualResource(
  project: LayerDocumentProject,
  layer: LayerDocument,
  resources: LayerDocumentSourceRuntimeResourcePort
) {
  const sourceId = layer.common.source?.sourceId;
  if (!sourceId) return null;
  const source = project.payload.sourceRegistry.sourcesById[sourceId];
  if (!source || source.kind !== "psd-node") return null;
  const sourceResourceCacheKey = buildLayerDocumentSourceResourceCacheKey({
    sourceId,
    sourceKind: source.kind,
    visualKeyPolicy: layerDocumentSourceVisualKeyPolicy(source.kind),
    sourceVersion: source.version,
    sourceFingerprint: layerDocumentSourceVisualFingerprint(source),
    localFrame: 0,
    sourceSamplingQuality: "preview",
  });
  return resources.resolve({ sourceId, sourceResourceCacheKey });
}

function isDrawable(value: unknown): value is CanvasImageSource {
  return !!value && typeof value === "object" &&
    ("width" in value || "videoWidth" in value || "naturalWidth" in value);
}

export function createLayerDocumentLibraryPreviewReader(
  options: PreviewReaderOptions
) {
  const cache = new Map<string, HTMLCanvasElement>();

  const visualSignature = (
    project: LayerDocumentProject,
    layer: LayerDocument
  ): unknown => {
    const sourceId = layer.common.source?.sourceId;
    const source = sourceId
      ? project.payload.sourceRegistry.sourcesById[sourceId]
      : null;
    const children = layer.type === "group"
      ? Object.values(project.payload.layerDocumentsById)
          .filter((candidate) => candidate.common.placement.parentLayerDocumentId === layer.layerDocumentId)
          .sort((left, right) => left.common.placement.order - right.common.placement.order)
          .map((child) => visualSignature(project, child))
      : [];
    return [layer.layerDocumentId, layer.revision, source?.version ?? null, children];
  };

  const renderVisual = (
    project: LayerDocumentProject,
    layer: LayerDocument
  ): { surface: CanvasImageSource | null; width: number | null; height: number | null; missing: boolean } => {
    if (layer.type !== "group") {
      const entry = visualResource(project, layer, options.resources);
      const width = entry?.resolution.logicalSize.width ?? null;
      const height = entry?.resolution.logicalSize.height ?? null;
      return {
        surface: entry && isDrawable(entry.resource) ? entry.resource : null,
        width,
        height,
        missing: !!layer.common.source && !entry,
      };
    }

    const width = Math.max(1, Math.round(layer.data.width));
    const height = Math.max(1, Math.round(layer.data.height));
    const children = Object.values(project.payload.layerDocumentsById)
      .filter((candidate) => candidate.common.placement.parentLayerDocumentId === layer.layerDocumentId)
      .sort((left, right) => left.common.placement.order - right.common.placement.order);
    const fingerprint = JSON.stringify([
      project.metadata.projectId,
      visualSignature(project, layer),
    ]);
    const cached = cache.get(fingerprint);
    if (cached) return { surface: cached, width, height, missing: false };
    if (typeof document === "undefined") return { surface: null, width, height, missing: false };

    const scale = Math.min(1, 360 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return { surface: null, width, height, missing: false };
    context.scale(scale, scale);
    // Library order is front-to-back: the first visible row must be painted
    // last, matching drawPreviewNodesToContext in the Canvas renderer.
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (!child) continue;
      if (!child.common.placement.visible || child.type === "audio") continue;
      const rendered = renderVisual(project, child);
      if (!rendered.surface || !rendered.width || !rendered.height) continue;
      const transform = child.common.transform;
      context.save();
      context.globalAlpha = Math.max(0, Math.min(1, transform.opacity / 100));
      context.translate(
        transform.position.x + transform.transformOffset.x,
        transform.position.y + transform.transformOffset.y
      );
      context.rotate((transform.rotation * Math.PI) / 180);
      context.scale(transform.scale.x / 100, transform.scale.y / 100);
      try {
        context.drawImage(
          rendered.surface,
          -transform.anchor.x,
          -transform.anchor.y,
          rendered.width,
          rendered.height
        );
      } catch {
        // A disposed runtime bitmap is treated as a missing preview only.
      }
      context.restore();
    }
    if (cache.size > 96) cache.clear();
    cache.set(fingerprint, canvas);
    return { surface: canvas, width, height, missing: false };
  };

  return (layerDocumentId: string): LibraryHoverPreviewViewModel | null => {
    const project = options.readProject();
    const layer = project.payload.layerDocumentsById[layerDocumentId];
    if (!layer) return null;
    if (layer.type === "audio") {
      const sourceId = layer.common.source?.sourceId;
      const source = sourceId ? project.payload.sourceRegistry.sourcesById[sourceId] : null;
      const waveform = sourceId ? options.readAudioWaveform(sourceId, 96) : [];
      const durationFrames = source?.kind === "audio" ? source.data.durationFrames : null;
      return {
        kind: "audio",
        name: layer.name,
        durationSeconds: durationFrames === null ? null : durationFrames / 30,
        channelCount: source?.kind === "audio" ? source.data.channelCount : null,
        sampleRate: source?.kind === "audio" ? source.data.sampleRate : null,
        waveform,
        status: !source ? "missing" : waveform.length ? "ready" : "empty",
      };
    }
    const rendered = renderVisual(project, layer);
    return {
      kind: "visual",
      name: layer.name,
      width: rendered.width,
      height: rendered.height,
      surface: rendered.surface,
      status: rendered.missing ? "missing" : rendered.surface ? "ready" : "empty",
    };
  };
}

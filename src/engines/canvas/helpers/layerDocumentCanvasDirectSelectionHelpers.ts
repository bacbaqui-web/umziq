import {
  applyCanvasSelectionMatrix,
  isPointInCanvasSelectionProjection,
} from "@/engines/canvas/helpers/canvasDirectSelectionGeometryHelpers";
import {
  SELECTION_ALPHA_THRESHOLD,
} from "@/engines/canvas/constants/canvasSelectionAlphaConstants";
import type {
  CanvasSelectionPoint,
} from "@/engines/canvas/models/canvasDirectSelectionModel";
import type {
  CanvasSelectionGlowRenderer,
} from "@/engines/canvas/models/canvasSelectionGlowModel";
import type {
  SelectionSourceAlphaEntry,
  SelectionSourceAlphaProvider,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";
import type {
  LayerDocumentCanvasDirectSelectionCandidate,
  LayerDocumentCanvasDirectSelectionHit,
  LayerDocumentCanvasDirectSelectionIntent,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";

export function hitLayerDocumentCanvasDirectSelection(options: {
  point: CanvasSelectionPoint;
  candidates:
    readonly LayerDocumentCanvasDirectSelectionCandidate[];
  provider: SelectionSourceAlphaProvider;
  compositionSize: { width: number; height: number };
  viewportScale: number;
  viewportOffset: CanvasSelectionPoint;
  cacheMode?: "selection" | "hover";
}): LayerDocumentCanvasDirectSelectionHit {
  const cacheMode = options.cacheMode ?? "selection";
  const worldPoint = {
    x:
      (options.point.x - options.viewportOffset.x) /
      options.viewportScale,
    y:
      (options.point.y - options.viewportOffset.y) /
      options.viewportScale,
  };
  if (
    !Number.isFinite(worldPoint.x) ||
    !Number.isFinite(worldPoint.y) ||
    worldPoint.x < 0 ||
    worldPoint.y < 0 ||
    worldPoint.x >= options.compositionSize.width ||
    worldPoint.y >= options.compositionSize.height
  ) {
    if (cacheMode === "selection") {
      options.provider.retain([]);
    }
    return { status: "none" };
  }
  for (
    let index = 0;
    index < options.candidates.length;
    index += 1
  ) {
    const candidate = options.candidates[index];
    if (
      !candidate ||
      !isPointInCanvasSelectionProjection(
        options.point,
        candidate.projection
      )
    ) {
      continue;
    }
    if (candidate.status === "blocked") {
      return { status: "blocked", candidate };
    }
    const alpha = options.provider.get(
      candidate.descriptor
    );
    if (alpha.status === "unavailable") {
      return { status: "blocked", candidate };
    }
    const sourcePoint = applyCanvasSelectionMatrix(
      candidate.projection.viewportToSource,
      options.point
    );
    if (
      alpha.entry.sample(sourcePoint.x, sourcePoint.y) >
      SELECTION_ALPHA_THRESHOLD
    ) {
      if (cacheMode === "selection") {
        options.provider.retain([
          alpha.entry.visualFingerprint,
        ]);
      }
      return { status: "hit", candidate };
    }
    options.provider.release(
      alpha.entry.visualFingerprint
    );
  }
  if (cacheMode === "selection") {
    options.provider.retain([]);
  }
  return { status: "none" };
}

function resolveLayerDocumentCanvasGlowSource(
  candidate:
    | Extract<
        LayerDocumentCanvasDirectSelectionCandidate,
        { status: "ready" }
      >
    | null,
  provider: SelectionSourceAlphaProvider
): {
  candidate: Extract<
    LayerDocumentCanvasDirectSelectionCandidate,
    { status: "ready" }
  >;
  entry: SelectionSourceAlphaEntry;
} | null {
  if (!candidate) return null;
  const alpha = provider.get(candidate.descriptor);
  return alpha.status === "ready"
    ? { candidate, entry: alpha.entry }
    : null;
}

export function resolveLayerDocumentCanvasDirectSelectionIntent(
  hit: LayerDocumentCanvasDirectSelectionHit,
  selectedLayerDocumentId: string | null
): LayerDocumentCanvasDirectSelectionIntent {
  if (hit.status === "blocked") {
    return { type: "preserve" };
  }
  if (hit.status === "none") return { type: "clear" };
  const layerDocumentId =
    hit.candidate.layerDocumentId;
  return layerDocumentId === selectedLayerDocumentId
    ? { type: "drag", layerDocumentId }
    : { type: "select", layerDocumentId };
}

export function buildLayerDocumentCanvasGlowSelectionKey(
  candidate:
    | Extract<
        LayerDocumentCanvasDirectSelectionCandidate,
        { status: "ready" }
      >
    | null
) {
  return candidate
    ? `layer-document:${candidate.layerDocumentId}:` +
        `${candidate.sourceResourceCacheKey ?? "source-less"}`
    : null;
}

export function drawLayerDocumentCanvasGlow(options: {
  enabled: boolean;
  target: HTMLCanvasElement | null;
  provider: SelectionSourceAlphaProvider | null;
  renderer: CanvasSelectionGlowRenderer | null;
  candidate:
    | Extract<
        LayerDocumentCanvasDirectSelectionCandidate,
        { status: "ready" }
      >
    | null;
  viewportSize: { width: number; height: number };
  devicePixelRatio: number;
}) {
  const { target, provider, renderer } = options;
  if (!options.enabled) {
    provider?.retain([]);
    renderer?.clearSelection(target);
    return false;
  }
  if (!target || !provider || !renderer) {
    renderer?.clearSelection(target);
    return false;
  }
  const source = resolveLayerDocumentCanvasGlowSource(
    options.candidate,
    provider
  );
  if (!source) {
    provider.retain([]);
    renderer.clearSelection(target);
    return false;
  }
  provider.retain([source.entry.visualFingerprint]);
  return renderer.draw(target, {
    entry: source.entry,
    projection: source.candidate.projection,
    viewportSize: options.viewportSize,
    devicePixelRatio: options.devicePixelRatio,
  }) !== null;
}

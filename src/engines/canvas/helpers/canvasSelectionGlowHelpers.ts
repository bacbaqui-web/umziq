import type { TimelineItem } from "@/models";
import {
  CANVAS_SELECTION_GLOW_BLUR_CSS_PIXELS,
  CANVAS_SELECTION_GLOW_RGBA,
} from "@/engines/canvas/constants/canvasSelectionGlowConstants";
import { SELECTION_ALPHA_THRESHOLD } from "@/engines/canvas/constants/canvasSelectionAlphaConstants";
import type {
  CanvasReadySelectionCandidate,
  CanvasSelectionCandidate,
} from "@/engines/canvas/models/canvasDirectSelectionModel";
import type {
  CanvasSelectionGlowDrawInput,
  CanvasSelectionGlowRenderer,
} from "@/engines/canvas/models/canvasSelectionGlowModel";
import type {
  SelectionSourceAlphaEntry,
  SelectionSourceAlphaProvider,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

export function resolveSelectedCanvasGlowCandidate(
  candidates: readonly CanvasSelectionCandidate[],
  selectedTimelineItem: TimelineItem | null
): CanvasReadySelectionCandidate | null {
  if (!selectedTimelineItem) return null;
  const matches = candidates.filter((candidate) =>
    candidate.timelineItem?.id === selectedTimelineItem.id &&
    candidate.timelineItem.sourceId === selectedTimelineItem.sourceId &&
    candidate.timelineItem.kind === selectedTimelineItem.kind
  );
  return matches.length === 1 && matches[0].status === "ready"
    ? matches[0]
    : null;
}

export function buildCanvasSelectionGlowSelectionKey(
  candidate: CanvasReadySelectionCandidate | null
) {
  return candidate
    ? `${candidate.selection.kind}:${candidate.selection.itemId ?? ""}:${candidate.selection.sourceId}`
    : null;
}

export function resolveSelectedCanvasGlowSource(
  candidates: readonly CanvasSelectionCandidate[],
  selectedTimelineItem: TimelineItem | null,
  provider: SelectionSourceAlphaProvider
): { candidate: CanvasReadySelectionCandidate; entry: SelectionSourceAlphaEntry } | null {
  const candidate = resolveSelectedCanvasGlowCandidate(candidates, selectedTimelineItem);
  if (!candidate) return null;
  const alpha = provider.get(candidate.descriptor);
  return alpha.status === "ready" ? { candidate, entry: alpha.entry } : null;
}

export function releaseCanvasSelectionGlow(options: {
  target: HTMLCanvasElement | null;
  provider: SelectionSourceAlphaProvider | null;
  renderer: CanvasSelectionGlowRenderer | null;
}) {
  options.provider?.clear();
  options.renderer?.clearSelection(options.target);
}

export function drawSelectedCanvasGlow(options: {
  enabled: boolean;
  target: HTMLCanvasElement | null;
  provider: SelectionSourceAlphaProvider | null;
  renderer: CanvasSelectionGlowRenderer | null;
  candidate: CanvasReadySelectionCandidate | null;
  selectedTimelineItem: TimelineItem | null;
  viewportSize: { width: number; height: number };
  devicePixelRatio: number;
}) {
  if (!options.enabled) return false;
  const { target, provider, renderer, candidate } = options;
  if (!target || !provider || !renderer || !candidate) {
    provider?.retain([]);
    renderer?.clearSelection(target);
    return false;
  }
  const source = resolveSelectedCanvasGlowSource(
    [candidate],
    options.selectedTimelineItem,
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

export function buildCanvasSelectionGlowMaskRgba(
  entry: SelectionSourceAlphaEntry
): Uint8ClampedArray | null {
  const pixelCount = entry.width * entry.height;
  if (!Number.isInteger(entry.width) || !Number.isInteger(entry.height) ||
      entry.width <= 0 || entry.height <= 0 || entry.alphaBytes.length !== pixelCount) {
    return null;
  }
  const rgba = new Uint8ClampedArray(pixelCount * 4);
  for (let index = 0; index < pixelCount; index += 1) {
    if ((entry.alphaBytes[index] ?? 0) <= SELECTION_ALPHA_THRESHOLD) continue;
    rgba[index * 4] = CANVAS_SELECTION_GLOW_RGBA[0];
    rgba[index * 4 + 1] = CANVAS_SELECTION_GLOW_RGBA[1];
    rgba[index * 4 + 2] = CANVAS_SELECTION_GLOW_RGBA[2];
    rgba[index * 4 + 3] = 255;
  }
  return rgba;
}

export function buildCanvasSelectionGlowDrawPlan(
  input: CanvasSelectionGlowDrawInput
) {
  const dpr = Number.isFinite(input.devicePixelRatio)
    ? Math.max(1, input.devicePixelRatio)
    : 1;
  const matrix = input.projection.sourceToViewport;
  return {
    backingSize: {
      width: Math.max(1, Math.ceil(input.viewportSize.width * dpr)),
      height: Math.max(1, Math.ceil(input.viewportSize.height * dpr)),
    },
    sourceToDevice: {
      a: matrix.a * dpr,
      b: matrix.b * dpr,
      c: matrix.c * dpr,
      d: matrix.d * dpr,
      e: matrix.e * dpr,
      f: matrix.f * dpr,
    },
    blurDevicePixels: CANVAS_SELECTION_GLOW_BLUR_CSS_PIXELS * dpr,
    glowAlpha: CANVAS_SELECTION_GLOW_RGBA[3] / 255,
    compositeSequence: [
      "clear-viewport",
      "draw-blurred-selected-mask",
      "destination-out-selected-interior",
    ] as const,
  };
}

import type { TimelineItem } from "@/models";
import { SELECTION_ALPHA_THRESHOLD } from "@/engines/canvas/constants/canvasSelectionAlphaConstants";
import {
  applyCanvasSelectionMatrix,
  isPointInCanvasSelectionProjection,
} from "@/engines/canvas/helpers/canvasDirectSelectionGeometryHelpers";
import type {
  CanvasDirectSelectionHit,
  CanvasDirectSelectionIntent,
  CanvasSelectionCandidate,
  CanvasSelectionPoint,
} from "@/engines/canvas/models/canvasDirectSelectionModel";
import type { SelectionSourceAlphaProvider } from "@/engines/canvas/models/canvasSelectionAlphaModel";

export function hitCanvasDirectSelection(options: {
  point: CanvasSelectionPoint;
  candidates: readonly CanvasSelectionCandidate[];
  provider: SelectionSourceAlphaProvider;
  compositionSize: { width: number; height: number };
  viewportScale: number;
  viewportOffset: CanvasSelectionPoint;
  cacheMode?: "selection" | "hover";
}): CanvasDirectSelectionHit {
  const cacheMode = options.cacheMode ?? "selection";
  const worldPoint = {
    x: (options.point.x - options.viewportOffset.x) / options.viewportScale,
    y: (options.point.y - options.viewportOffset.y) / options.viewportScale,
  };
  if (!Number.isFinite(worldPoint.x) || !Number.isFinite(worldPoint.y) ||
      worldPoint.x < 0 || worldPoint.y < 0 ||
      worldPoint.x >= options.compositionSize.width ||
      worldPoint.y >= options.compositionSize.height) {
    if (cacheMode === "selection") options.provider.retain([]);
    return { status: "none" };
  }

  for (let index = options.candidates.length - 1; index >= 0; index -= 1) {
    const candidate = options.candidates[index];
    if (!isPointInCanvasSelectionProjection(options.point, candidate.projection)) continue;
    if (candidate.status === "blocked") return { status: "blocked", candidate };
    const alpha = options.provider.get(candidate.descriptor);
    if (alpha.status === "unavailable") return { status: "blocked", candidate };
    const sourcePoint = applyCanvasSelectionMatrix(
      candidate.projection.viewportToSource,
      options.point
    );
    if (alpha.entry.sample(sourcePoint.x, sourcePoint.y) > SELECTION_ALPHA_THRESHOLD) {
      if (cacheMode === "selection") {
        options.provider.retain([alpha.entry.visualFingerprint]);
      }
      return { status: "hit", candidate };
    }
    options.provider.release(alpha.entry.visualFingerprint);
  }
  if (cacheMode === "selection") options.provider.retain([]);
  return { status: "none" };
}

export function resolveCanvasPreviewCursor(options: {
  isPreviewPanning: boolean;
  isPreviewPanModifierActive: boolean;
  isDraggingPosition: boolean;
  isAlphaHit: boolean;
}): "default" | "grab" | "grabbing" | "pointer" {
  if (options.isPreviewPanning) return "grabbing";
  if (options.isPreviewPanModifierActive) return "grab";
  if (options.isDraggingPosition) return "grabbing";
  if (options.isAlphaHit) return "pointer";
  return "default";
}

export function resolveCanvasDirectSelectionIntent(
  hit: CanvasDirectSelectionHit,
  selectedTimelineItem: TimelineItem | null
): CanvasDirectSelectionIntent {
  if (hit.status === "blocked") return { type: "preserve" };
  if (hit.status === "none") return { type: "clear" };
  const selection = hit.candidate.selection;
  const selected = selectedTimelineItem;
  if (selected?.id === selection.itemId &&
      selected?.sourceId === selection.sourceId &&
      selected?.kind === selection.kind) {
    return { type: "drag" };
  }
  return { type: "select", selection };
}

export function resolveCanvasDirectSelectionCompositionEntry(
  hit: CanvasDirectSelectionHit
): string | null {
  if (hit.status !== "hit" || hit.candidate.selection.kind !== "subComp") return null;
  const target = hit.candidate.target;
  if (target?.kind !== "composition") return null;
  return target.id;
}

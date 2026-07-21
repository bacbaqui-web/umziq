import type { Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import type { RenderDrawable, RenderItem } from "@/engines/project";
import type {
  EvaluatedScene,
  EvaluatedSceneNode,
  EvaluatedSceneTransform,
} from "@/engines/playback-render";
import { buildCanvasSelectionProjection } from "@/engines/canvas/helpers/canvasDirectSelectionGeometryHelpers";
import type { DraftTransformSnapshot } from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import type { CanvasSelectionCandidate } from "@/engines/canvas/models/canvasDirectSelectionModel";
import type { SelectionSourceAlphaDescriptor } from "@/engines/canvas/models/canvasSelectionAlphaModel";
import { STATIC_PSD_SELECTION_FRAME_VISUAL_KEY } from "@/engines/canvas/constants/canvasSelectionAlphaConstants";

type CandidateOptions = {
  evaluatedScene: EvaluatedScene | null;
  renderItems: readonly RenderItem[];
  timelineItems: readonly TimelineItem[];
  layersById: ReadonlyMap<string, Layer>;
  compositionsById: ReadonlyMap<string, Composition>;
  metaByCompId: Readonly<Record<string, CompositionMeta>>;
  viewportScale: number;
  viewportOffset: { x: number; y: number };
  selectedTimelineItem: TimelineItem | null;
  draftTransformSnapshot: DraftTransformSnapshot | null;
};

function isActive(item: TimelineItem, scene: EvaluatedScene) {
  return item.visible && item.compId === scene.compositionId &&
    scene.globalFrame >= item.startFrame &&
    scene.globalFrame < item.startFrame + item.durationFrames;
}

function hasSelectableSceneGeometry(node: EvaluatedSceneNode) {
  const size = node.type === "drawable" ? node.logicalSize : node.size;
  const transformValues = [
    node.transform.position.x,
    node.transform.position.y,
    node.transform.transformOffset.x,
    node.transform.transformOffset.y,
    node.transform.anchor.x,
    node.transform.anchor.y,
    node.transform.scale.x,
    node.transform.scale.y,
    node.transform.rotation,
  ];
  return node.visible && Number.isFinite(node.opacity) && node.opacity > 0 &&
    Number.isFinite(size.width) && Number.isFinite(size.height) &&
    size.width > 0 && size.height > 0 &&
    transformValues.every(Number.isFinite) &&
    node.transform.scale.x !== 0 && node.transform.scale.y !== 0;
}

function findDrawable(renderItem: RenderItem, node: EvaluatedSceneNode) {
  if (node.type !== "drawable") return null;
  const matches = renderItem.drawables.filter((drawable) => drawable.id === node.drawableId);
  return matches.length === 1 ? matches[0] : null;
}

function descriptorForDrawable(
  node: Extract<EvaluatedSceneNode, { type: "drawable" }>,
  drawable: RenderDrawable,
  layersById: ReadonlyMap<string, Layer>,
  opacity: number
): SelectionSourceAlphaDescriptor | null {
  if (!drawable.canvas || !drawable.visible) return null;
  const layerId = node.layerId ?? drawable.sourceLayerId;
  const layer = layerId ? layersById.get(layerId) : undefined;
  return {
    kind: "layer",
    sourceCanvas: drawable.canvas,
    logicalSize: node.logicalSize,
    sourceFingerprint: layer?.sourceFingerprint ?? null,
    sourceRevision: layer?.sourceFingerprint ?? "unversioned-layer",
    frameVisualKey: STATIC_PSD_SELECTION_FRAME_VISUAL_KEY,
    opacity,
    visible: node.visible,
  };
}

function buildDescriptor(
  node: EvaluatedSceneNode,
  renderItem: RenderItem,
  layersById: ReadonlyMap<string, Layer>,
  compositionsById: ReadonlyMap<string, Composition>,
  opacity: number
): SelectionSourceAlphaDescriptor | null {
  if (node.type === "drawable") {
    const drawable = findDrawable(renderItem, node);
    return drawable
      ? descriptorForDrawable(node, drawable, layersById, opacity)
      : null;
  }
  const orderedChildren = node.children.map((child) => {
    const source = buildDescriptor(
      child,
      renderItem,
      layersById,
      compositionsById,
      child.opacity
    );
    return source ? { source, transform: child.transform } : null;
  });
  if (orderedChildren.some((child) => child === null)) return null;
  const composition = compositionsById.get(node.targetCompId);
  return {
    kind: "subComp",
    logicalSize: node.size,
    sourceFingerprint: composition?.sourceFingerprint ?? null,
    sourceRevision: composition?.sourceFingerprint ?? "unversioned-composition",
    frameVisualKey: STATIC_PSD_SELECTION_FRAME_VISUAL_KEY,
    opacity,
    visible: node.visible,
    orderedChildren: orderedChildren.filter(
      (child): child is NonNullable<typeof child> => child !== null
    ),
  };
}

function resolveEffectiveTransform(
  node: EvaluatedSceneNode,
  item: TimelineItem,
  selectedTimelineItem: TimelineItem | null,
  snapshot: DraftTransformSnapshot | null
): { transform: EvaluatedSceneTransform; opacity: number } {
  const exactItem = selectedTimelineItem?.id === item.id &&
    selectedTimelineItem.sourceId === item.sourceId &&
    selectedTimelineItem.kind === item.kind;
  const targetMatches = node.type === "drawable"
    ? snapshot?.target.kind === "layer" && snapshot.target.id === (node.layerId ?? node.sourceId)
    : snapshot?.target.kind === "composition" && snapshot.target.id === node.targetCompId;
  if (!exactItem || !snapshot || !targetMatches || snapshot.localFrame !== node.localFrame) {
    return { transform: node.transform, opacity: node.opacity };
  }
  return {
    transform: {
      position: snapshot.position,
      transformOffset: snapshot.transformOffset,
      anchor: snapshot.anchor,
      scale: snapshot.scale,
      rotation: snapshot.rotation,
    },
    opacity: snapshot.opacity,
  };
}

export function buildCanvasDirectSelectionCandidates(
  options: CandidateOptions
): CanvasSelectionCandidate[] {
  const scene = options.evaluatedScene;
  if (!scene) return [];
  const candidates: CanvasSelectionCandidate[] = [];
  scene.nodes.forEach((node, sceneNodeIndex) => {
    if (!hasSelectableSceneGeometry(node)) return;
    const size = node.type === "drawable" ? node.logicalSize : node.size;
    if (size.width <= 0 || size.height <= 0) return;
    const kind = node.type === "drawable" ? "layer" : "subComp";
    const timelineMatches = options.timelineItems.filter((item) =>
      isActive(item, scene) && item.kind === kind && item.sourceId === node.sourceId &&
      (node.type === "drawable" || item.targetCompId === node.targetCompId)
    );
    if (timelineMatches.length === 0) return;
    const renderMatches = options.renderItems.filter((item) =>
      item.visible && item.kind === kind && item.sourceId === node.sourceId &&
      (node.type === "drawable" || item.targetCompId === node.targetCompId)
    );
    const sceneIdentityMatches = scene.nodes.filter((other) =>
      hasSelectableSceneGeometry(other) && other.type === node.type &&
      other.sourceId === node.sourceId &&
      (node.type === "drawable" ||
        (other.type === "composition" && other.targetCompId === node.targetCompId))
    );
    const exactItem = timelineMatches.length === 1 ? timelineMatches[0] : null;
    const exactRender = renderMatches.length === 1 && renderMatches[0].id === node.renderItemId
      ? renderMatches[0]
      : null;
    const effective = exactItem
      ? resolveEffectiveTransform(
          node, exactItem, options.selectedTimelineItem, options.draftTransformSnapshot
        )
      : { transform: node.transform, opacity: node.opacity };
    if (!Number.isFinite(effective.opacity) || effective.opacity <= 0) return;
    const projection = buildCanvasSelectionProjection({
      size,
      transform: effective.transform,
      viewportScale: options.viewportScale,
      viewportOffset: options.viewportOffset,
    });
    if (!projection) return;
    const drawable = exactRender ? findDrawable(exactRender, node) : null;
    const target = node.type === "drawable"
      ? { kind: "layer" as const, id: node.layerId ?? node.sourceId }
      : { kind: "composition" as const, id: node.targetCompId };
    const base = {
      sceneNodeIndex,
      renderItemId: node.renderItemId,
      sourceId: node.sourceId,
      drawable,
      target,
      timelineItem: exactItem,
      projection,
    };
    if (!exactItem || !exactRender || sceneIdentityMatches.length !== 1) {
      candidates.push({ ...base, status: "blocked", reason: "ambiguous-identity" });
      return;
    }
    const descriptor = buildDescriptor(
      node, exactRender, options.layersById, options.compositionsById, effective.opacity
    );
    if (!descriptor) {
      candidates.push({ ...base, status: "blocked", reason: "missing-drawable" });
      return;
    }
    candidates.push({
      ...base,
      status: "ready",
      selection: { itemId: exactItem.id, sourceId: exactItem.sourceId, kind: exactItem.kind },
      descriptor,
    });
  });
  return candidates;
}

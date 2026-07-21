import type {
  Composition,
  CompositionMeta,
  Layer,
  TimelineItem,
  TimelineSelection,
} from "@/models";
import type { RenderDrawable, RenderItem } from "@/engines/project";
import type {
  EvaluatedScene,
  EvaluatedSceneNode,
  EvaluatedSceneSize,
  EvaluatedSceneTransform,
} from "@/engines/playback-render";
import { STATIC_PSD_SELECTION_FRAME_VISUAL_KEY } from "@/engines/canvas/constants/canvasSelectionAlphaConstants";
import { buildCanvasSelectionProjection } from "@/engines/canvas/helpers/canvasDirectSelectionGeometryHelpers";
import type { DraftTransformSnapshot } from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import type {
  CanvasSelectionCandidate,
  CanvasSelectionProjection,
} from "@/engines/canvas/models/canvasDirectSelectionModel";
import type { SelectionSourceAlphaDescriptor } from "@/engines/canvas/models/canvasSelectionAlphaModel";

type StaticCandidateOptions = {
  evaluatedScene: EvaluatedScene | null;
  renderItems: readonly RenderItem[];
  timelineItems: readonly TimelineItem[];
  layersById: ReadonlyMap<string, Layer>;
  compositionsById: ReadonlyMap<string, Composition>;
};

type CandidateOptions = StaticCandidateOptions & {
  metaByCompId: Readonly<Record<string, CompositionMeta>>;
  viewportScale: number;
  viewportOffset: { x: number; y: number };
  selectedTimelineItem: TimelineItem | null;
  draftTransformSnapshot: DraftTransformSnapshot | null;
};

type StaticCandidateBase = {
  readonly sceneNodeIndex: number;
  readonly renderItemId: string;
  readonly sourceId: string;
  readonly drawable: RenderDrawable | null;
  readonly target: { readonly kind: "layer" | "composition"; readonly id: string };
  readonly timelineItem: TimelineItem | null;
  readonly sourceSize: EvaluatedSceneSize;
  readonly sourceTransform: EvaluatedSceneTransform;
  readonly sourceOpacity: number;
  readonly localFrame: number;
};

type StaticReadyCandidate = StaticCandidateBase & {
  readonly status: "ready";
  readonly selection: NonNullable<TimelineSelection>;
  readonly descriptor: SelectionSourceAlphaDescriptor;
};

type StaticBlockedCandidate = StaticCandidateBase & {
  readonly status: "blocked";
  readonly reason: "ambiguous-identity" | "missing-drawable";
};

export type CanvasDirectSelectionStaticCandidate =
  | StaticReadyCandidate
  | StaticBlockedCandidate;

type ProjectionOptions = {
  staticCandidates: readonly CanvasDirectSelectionStaticCandidate[];
  viewportScale: number;
  viewportOffset: { x: number; y: number };
};

type DraftProjectionOptions = ProjectionOptions & {
  viewportCandidates: readonly CanvasSelectionCandidate[];
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

function buildIdentityKey(
  kind: "layer" | "subComp",
  sourceId: string,
  targetCompId?: string
) {
  return kind === "layer"
    ? `layer:${sourceId}`
    : `subComp:${sourceId}:${targetCompId ?? ""}`;
}

function buildNodeIdentityKey(node: EvaluatedSceneNode) {
  return buildIdentityKey(
    node.type === "drawable" ? "layer" : "subComp",
    node.sourceId,
    node.type === "composition" ? node.targetCompId : undefined
  );
}

function appendIndexValue<T>(index: Map<string, T[]>, key: string, value: T) {
  const values = index.get(key);
  if (values) values.push(value);
  else index.set(key, [value]);
}

function buildTimelineIndex(
  items: readonly TimelineItem[],
  scene: EvaluatedScene
) {
  const index = new Map<string, TimelineItem[]>();
  items.forEach((item) => {
    if (!isActive(item, scene)) return;
    appendIndexValue(
      index,
      buildIdentityKey(item.kind, item.sourceId, item.targetCompId),
      item
    );
  });
  return index;
}

function buildRenderIndex(items: readonly RenderItem[]) {
  const index = new Map<string, RenderItem[]>();
  items.forEach((item) => {
    if (!item.visible) return;
    appendIndexValue(
      index,
      buildIdentityKey(item.kind, item.sourceId, item.targetCompId),
      item
    );
  });
  return index;
}

function buildSceneIdentityCount(scene: EvaluatedScene) {
  const counts = new Map<string, number>();
  scene.nodes.forEach((node) => {
    if (!hasSelectableSceneGeometry(node)) return;
    const key = buildNodeIdentityKey(node);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function buildDrawableIndex(renderItem: RenderItem) {
  const index = new Map<string, RenderDrawable[]>();
  renderItem.drawables.forEach((drawable) => {
    appendIndexValue(index, drawable.id, drawable);
  });
  return index;
}

function findDrawable(
  drawableIndex: ReadonlyMap<string, readonly RenderDrawable[]>,
  node: EvaluatedSceneNode
) {
  if (node.type !== "drawable") return null;
  const matches = drawableIndex.get(node.drawableId) ?? [];
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
  drawableIndex: ReadonlyMap<string, readonly RenderDrawable[]>,
  layersById: ReadonlyMap<string, Layer>,
  compositionsById: ReadonlyMap<string, Composition>,
  opacity: number
): SelectionSourceAlphaDescriptor | null {
  if (node.type === "drawable") {
    const drawable = findDrawable(drawableIndex, node);
    return drawable
      ? descriptorForDrawable(node, drawable, layersById, opacity)
      : null;
  }
  const orderedChildren = node.children.map((child) => {
    const source = buildDescriptor(
      child,
      drawableIndex,
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

function buildCandidateProjection(
  candidate: CanvasDirectSelectionStaticCandidate,
  transform: EvaluatedSceneTransform,
  opacity: number,
  options: ProjectionOptions,
  reusedProjection?: CanvasSelectionProjection
): CanvasSelectionCandidate | null {
  if (!Number.isFinite(opacity) || opacity <= 0) return null;
  const projection = reusedProjection ?? buildCanvasSelectionProjection({
    size: candidate.sourceSize,
    transform,
    viewportScale: options.viewportScale,
    viewportOffset: options.viewportOffset,
  });
  if (!projection) return null;
  const base = {
    sceneNodeIndex: candidate.sceneNodeIndex,
    renderItemId: candidate.renderItemId,
    sourceId: candidate.sourceId,
    drawable: candidate.drawable,
    target: candidate.target,
    timelineItem: candidate.timelineItem,
    projection,
  };
  if (candidate.status === "blocked") {
    return { ...base, status: candidate.status, reason: candidate.reason };
  }
  return {
    ...base,
    status: candidate.status,
    selection: candidate.selection,
    descriptor: opacity === candidate.sourceOpacity
      ? candidate.descriptor
      : { ...candidate.descriptor, opacity },
  };
}

function isSameTransform(
  left: EvaluatedSceneTransform,
  right: EvaluatedSceneTransform
) {
  return left.position.x === right.position.x &&
    left.position.y === right.position.y &&
    left.transformOffset.x === right.transformOffset.x &&
    left.transformOffset.y === right.transformOffset.y &&
    left.anchor.x === right.anchor.x &&
    left.anchor.y === right.anchor.y &&
    left.scale.x === right.scale.x &&
    left.scale.y === right.scale.y &&
    left.rotation === right.rotation;
}

function matchesScopedDraft(
  candidate: CanvasDirectSelectionStaticCandidate,
  selectedTimelineItem: TimelineItem | null,
  snapshot: DraftTransformSnapshot | null
) {
  const item = candidate.timelineItem;
  if (!item || !selectedTimelineItem || !snapshot) return false;
  const exactItem = selectedTimelineItem.id === item.id &&
    selectedTimelineItem.sourceId === item.sourceId &&
    selectedTimelineItem.kind === item.kind;
  const targetMatches = snapshot.target.kind === candidate.target.kind &&
    snapshot.target.id === candidate.target.id;
  return exactItem && targetMatches && snapshot.localFrame === candidate.localFrame;
}

export function buildCanvasDirectSelectionStaticCandidates(
  options: StaticCandidateOptions
): CanvasDirectSelectionStaticCandidate[] {
  const scene = options.evaluatedScene;
  if (!scene) return [];
  const timelineIndex = buildTimelineIndex(options.timelineItems, scene);
  const renderIndex = buildRenderIndex(options.renderItems);
  const sceneIdentityCount = buildSceneIdentityCount(scene);
  const drawableIndices = new WeakMap<RenderItem, Map<string, RenderDrawable[]>>();
  const candidates: CanvasDirectSelectionStaticCandidate[] = [];

  scene.nodes.forEach((node, sceneNodeIndex) => {
    if (!hasSelectableSceneGeometry(node)) return;
    const identityKey = buildNodeIdentityKey(node);
    const timelineMatches = timelineIndex.get(identityKey) ?? [];
    if (timelineMatches.length === 0) return;
    const renderMatches = renderIndex.get(identityKey) ?? [];
    const exactItem = timelineMatches.length === 1 ? timelineMatches[0] : null;
    const exactRender = renderMatches.length === 1 &&
      renderMatches[0]?.id === node.renderItemId
      ? renderMatches[0]
      : null;
    const drawableIndex = exactRender
      ? drawableIndices.get(exactRender) ?? buildDrawableIndex(exactRender)
      : new Map<string, RenderDrawable[]>();
    if (exactRender && !drawableIndices.has(exactRender)) {
      drawableIndices.set(exactRender, drawableIndex);
    }
    const drawable = exactRender ? findDrawable(drawableIndex, node) : null;
    const target = node.type === "drawable"
      ? { kind: "layer" as const, id: node.layerId ?? node.sourceId }
      : { kind: "composition" as const, id: node.targetCompId };
    const base: StaticCandidateBase = {
      sceneNodeIndex,
      renderItemId: node.renderItemId,
      sourceId: node.sourceId,
      drawable,
      target,
      timelineItem: exactItem,
      sourceSize: node.type === "drawable" ? node.logicalSize : node.size,
      sourceTransform: node.transform,
      sourceOpacity: node.opacity,
      localFrame: node.localFrame,
    };
    if (!exactItem || !exactRender || sceneIdentityCount.get(identityKey) !== 1) {
      candidates.push({ ...base, status: "blocked", reason: "ambiguous-identity" });
      return;
    }
    const descriptor = buildDescriptor(
      node,
      drawableIndex,
      options.layersById,
      options.compositionsById,
      node.opacity
    );
    if (!descriptor) {
      candidates.push({ ...base, status: "blocked", reason: "missing-drawable" });
      return;
    }
    candidates.push({
      ...base,
      status: "ready",
      selection: {
        itemId: exactItem.id,
        sourceId: exactItem.sourceId,
        kind: exactItem.kind,
      },
      descriptor,
    });
  });
  return candidates;
}

export function buildCanvasDirectSelectionViewportCandidates(
  options: ProjectionOptions
): CanvasSelectionCandidate[] {
  return options.staticCandidates.flatMap((candidate) => {
    const projected = buildCandidateProjection(
      candidate,
      candidate.sourceTransform,
      candidate.sourceOpacity,
      options
    );
    return projected ? [projected] : [];
  });
}

export function applyCanvasDirectSelectionDraft(
  options: DraftProjectionOptions
): CanvasSelectionCandidate[] {
  const snapshot = options.draftTransformSnapshot;
  const selectedItem = options.selectedTimelineItem;
  if (!snapshot || !selectedItem) return options.viewportCandidates.slice();
  const viewportBySceneIndex = new Map(
    options.viewportCandidates.map((candidate) => [candidate.sceneNodeIndex, candidate])
  );
  return options.staticCandidates.flatMap((candidate) => {
    const viewportCandidate = viewportBySceneIndex.get(candidate.sceneNodeIndex);
    if (!matchesScopedDraft(candidate, selectedItem, snapshot)) {
      return viewportCandidate ? [viewportCandidate] : [];
    }
    const transform: EvaluatedSceneTransform = {
      position: snapshot.position,
      transformOffset: snapshot.transformOffset,
      anchor: snapshot.anchor,
      scale: snapshot.scale,
      rotation: snapshot.rotation,
    };
    const projected = buildCandidateProjection(
      candidate,
      transform,
      snapshot.opacity,
      options,
      viewportCandidate && isSameTransform(transform, candidate.sourceTransform)
        ? viewportCandidate.projection
        : undefined
    );
    return projected ? [projected] : [];
  });
}

export function buildCanvasDirectSelectionCandidates(
  options: CandidateOptions
): CanvasSelectionCandidate[] {
  const staticCandidates = buildCanvasDirectSelectionStaticCandidates(options);
  const viewportCandidates = buildCanvasDirectSelectionViewportCandidates({
    staticCandidates,
    viewportScale: options.viewportScale,
    viewportOffset: options.viewportOffset,
  });
  return applyCanvasDirectSelectionDraft({
    staticCandidates,
    viewportCandidates,
    viewportScale: options.viewportScale,
    viewportOffset: options.viewportOffset,
    selectedTimelineItem: options.selectedTimelineItem,
    draftTransformSnapshot: options.draftTransformSnapshot,
  });
}

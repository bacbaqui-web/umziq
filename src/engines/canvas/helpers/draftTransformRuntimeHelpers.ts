import {
  evaluateCompositionOpacity,
  evaluateCompositionPosition,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerOpacity,
  evaluateLayerPosition,
  evaluateLayerRotation,
  evaluateLayerScale,
  type TransformTargetSelection,
} from "@/engines/animation";
import {
  getCompensatedTransformOffset,
  getTransformGeometry,
  resolveAnchorFromWorldPoint,
} from "@/engines/canvas/helpers/canvasCoordinateHelpers";
import type { PreviewOverlay } from "@/engines/canvas/models/canvasViewModel";
import type {
  PreviewSceneTransformPatch,
  PreviewSceneUpdateTarget,
} from "@/engines/playback-render";
import type { CompositionMeta, Position, Scale } from "@/models";

export type DraftTransformPatch = PreviewSceneTransformPatch;

export type DraftTransformSnapshot = {
  target: PreviewSceneUpdateTarget;
  localFrame: number;
  sourceWidth: number;
  sourceHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  position: Position;
  scale: Scale;
  rotation: number;
  opacity: number;
  anchor: Position;
  transformOffset: Position;
  pivot: Position;
  pivotMode: "anchor";
  geometry: ReturnType<typeof getTransformGeometry>;
  draft: {
    active: boolean;
    changed: {
      position: boolean;
      scale: boolean;
      rotation: boolean;
      opacity: boolean;
      anchor: boolean;
      transformOffset: boolean;
    };
  };
};

export type DraftOverlayRuntimeValues = Pick<
  DraftTransformSnapshot,
  | "position"
  | "scale"
  | "rotation"
  | "opacity"
  | "anchor"
  | "transformOffset"
  | "pivot"
  | "draft"
>;

type ResolveDraftTransformSnapshotOptions = {
  target: TransformTargetSelection;
  localFrame: number;
  frameRate?: number;
  selectedMeta: CompositionMeta | null;
  overlay: PreviewOverlay;
  patch: DraftTransformPatch;
};

function hasPatchValue<Key extends keyof DraftTransformPatch>(
  patch: DraftTransformPatch,
  key: Key
) {
  return patch[key] !== undefined;
}

function getPreviewUpdateTarget(
  target: TransformTargetSelection
): PreviewSceneUpdateTarget | null {
  if (!target) return null;
  if (target.kind === "layer") {
    return { kind: "layer", id: target.layer.id };
  }
  return { kind: "composition", id: target.composition.id };
}

function getSnapshotSize(
  overlay: PreviewOverlay,
  selectedMeta: CompositionMeta | null
) {
  return {
    sourceWidth: overlay?.sourceWidth ?? selectedMeta?.width ?? 0,
    sourceHeight: overlay?.sourceHeight ?? selectedMeta?.height ?? 0,
    canvasWidth: overlay?.canvasWidth ?? selectedMeta?.width ?? 0,
    canvasHeight: overlay?.canvasHeight ?? selectedMeta?.height ?? 0,
  };
}

export function isDraftTransformSnapshotForOverlay(
  overlay: PreviewOverlay,
  snapshot: DraftTransformSnapshot | null
): snapshot is DraftTransformSnapshot {
  if (!overlay || !snapshot) return false;
  return (
    overlay.targetKind === snapshot.target.kind &&
    overlay.targetId === snapshot.target.id
  );
}

export function isDraftTransformSnapshotForTarget(
  target: TransformTargetSelection,
  snapshot: DraftTransformSnapshot | null
): snapshot is DraftTransformSnapshot {
  if (!target || !snapshot) return false;
  if (target.kind === "layer") {
    return snapshot.target.kind === "layer" && snapshot.target.id === target.layer.id;
  }
  return (
    snapshot.target.kind === "composition" &&
    snapshot.target.id === target.composition.id
  );
}

export function isDraftTransformSnapshotForTargetAtFrame(
  target: TransformTargetSelection,
  localFrame: number,
  snapshot: DraftTransformSnapshot | null
): snapshot is DraftTransformSnapshot {
  return (
    isDraftTransformSnapshotForTarget(target, snapshot) &&
    snapshot.localFrame === localFrame
  );
}

export function resolveDraftOverlayRuntimeValues(
  overlay: PreviewOverlay,
  snapshot: DraftTransformSnapshot | null
): DraftOverlayRuntimeValues | null {
  if (!isDraftTransformSnapshotForOverlay(overlay, snapshot)) return null;

  return {
    position: snapshot.position,
    scale: snapshot.scale,
    rotation: snapshot.rotation,
    opacity: snapshot.opacity,
    anchor: snapshot.anchor,
    transformOffset: snapshot.transformOffset,
    pivot: snapshot.pivot,
    draft: snapshot.draft,
  };
}

export function resolveDraftOverlayRuntimeValuesForTarget(
  target: TransformTargetSelection,
  snapshot: DraftTransformSnapshot | null
): DraftOverlayRuntimeValues | null {
  if (!isDraftTransformSnapshotForTarget(target, snapshot)) return null;

  return {
    position: snapshot.position,
    scale: snapshot.scale,
    rotation: snapshot.rotation,
    opacity: snapshot.opacity,
    anchor: snapshot.anchor,
    transformOffset: snapshot.transformOffset,
    pivot: snapshot.pivot,
    draft: snapshot.draft,
  };
}

export function resolveDraftOverlayRuntimeValuesForTargetAtFrame(
  target: TransformTargetSelection,
  localFrame: number,
  snapshot: DraftTransformSnapshot | null
): DraftOverlayRuntimeValues | null {
  if (!isDraftTransformSnapshotForTargetAtFrame(target, localFrame, snapshot)) {
    return null;
  }

  return {
    position: snapshot.position,
    scale: snapshot.scale,
    rotation: snapshot.rotation,
    opacity: snapshot.opacity,
    anchor: snapshot.anchor,
    transformOffset: snapshot.transformOffset,
    pivot: snapshot.pivot,
    draft: snapshot.draft,
  };
}

export function resolveDraftOverlayForTarget(
  target: TransformTargetSelection,
  snapshot: DraftTransformSnapshot | null
): PreviewOverlay {
  if (!isDraftTransformSnapshotForTarget(target, snapshot)) return null;
  return toPreviewOverlayFromDraftTransformSnapshot(snapshot);
}

export function resolveDraftTransformSnapshot({
  target,
  localFrame,
  frameRate,
  selectedMeta,
  overlay,
  patch,
}: ResolveDraftTransformSnapshotOptions): DraftTransformSnapshot | null {
  const previewTarget = getPreviewUpdateTarget(target);
  if (!target || !previewTarget) return null;

  const base =
    target.kind === "layer"
      ? {
          position: evaluateLayerPosition(target.layer, localFrame, frameRate),
          scale: evaluateLayerScale(target.layer, localFrame),
          rotation: evaluateLayerRotation(target.layer, localFrame),
          opacity: evaluateLayerOpacity(target.layer, localFrame),
          anchor: target.layer.anchor,
          transformOffset: target.layer.transformOffset,
        }
      : {
          position: evaluateCompositionPosition(
            target.composition,
            localFrame,
            frameRate
          ),
          scale: evaluateCompositionScale(target.composition, localFrame),
          rotation: evaluateCompositionRotation(target.composition, localFrame),
          opacity: evaluateCompositionOpacity(target.composition, localFrame),
          anchor: target.composition.anchor,
          transformOffset: target.composition.transformOffset,
        };
  const size = getSnapshotSize(overlay, selectedMeta);
  const position = patch.position ?? base.position;
  const scale = patch.scale ?? base.scale;
  const rotation = patch.rotation ?? base.rotation;
  const opacity = patch.opacity ?? base.opacity;
  const anchor = patch.anchor ?? base.anchor;
  const transformOffset = patch.transformOffset ?? base.transformOffset;
  const geometry = getTransformGeometry(
    size.sourceWidth,
    size.sourceHeight,
    position,
    transformOffset,
    anchor,
    scale,
    rotation
  );

  return {
    target: previewTarget,
    localFrame,
    ...size,
    position,
    scale,
    rotation,
    opacity,
    anchor,
    transformOffset,
    pivot: geometry.anchorWorld,
    pivotMode: "anchor",
    geometry,
    draft: {
      active: Object.values(patch).some((value) => value !== undefined),
      changed: {
        position: hasPatchValue(patch, "position"),
        scale: hasPatchValue(patch, "scale"),
        rotation: hasPatchValue(patch, "rotation"),
        opacity: hasPatchValue(patch, "opacity"),
        anchor: hasPatchValue(patch, "anchor"),
        transformOffset: hasPatchValue(patch, "transformOffset"),
      },
    },
  };
}

export function toPreviewSceneTransformPatch(
  snapshot: DraftTransformSnapshot
): PreviewSceneTransformPatch {
  return {
    position: snapshot.position,
    scale: snapshot.scale,
    rotation: snapshot.rotation,
    opacity: snapshot.opacity,
    anchor: snapshot.anchor,
    transformOffset: snapshot.transformOffset,
  };
}

export function resolveDraftAnchorTransformCommand(
  snapshot: DraftTransformSnapshot,
  worldPoint: Position
) {
  const anchor = resolveAnchorFromWorldPoint(
    worldPoint,
    snapshot.position,
    snapshot.transformOffset,
    snapshot.anchor,
    snapshot.scale,
    snapshot.rotation,
    snapshot.sourceWidth,
    snapshot.sourceHeight
  );

  return resolveDraftAnchorTransformCommandFromLocalAnchor(snapshot, anchor);
}

export function resolveDraftAnchorTransformCommandFromLocalAnchor(
  snapshot: DraftTransformSnapshot,
  localAnchor: Position
) {
  const anchor = {
    x: Math.min(Math.max(localAnchor.x, 0), snapshot.sourceWidth),
    y: Math.min(Math.max(localAnchor.y, 0), snapshot.sourceHeight),
  };
  const transformOffset = getCompensatedTransformOffset(
    snapshot.transformOffset,
    snapshot.anchor,
    anchor,
    snapshot.scale,
    snapshot.rotation
  );

  return {
    target: snapshot.target,
    anchor,
    transformOffset,
  };
}

export function toPreviewOverlayFromDraftTransformSnapshot(
  snapshot: DraftTransformSnapshot
): PreviewOverlay {
  const targetKind = snapshot.target.kind;
  const targetId = snapshot.target.id;
  const { geometry } = snapshot;
  if (geometry.bounds.width <= 0 || geometry.bounds.height <= 0) return null;

  return {
    targetKind,
    targetId,
    x: geometry.bounds.x,
    y: geometry.bounds.y,
    width: geometry.bounds.width,
    height: geometry.bounds.height,
    centerX: geometry.centerWorld.x,
    centerY: geometry.centerWorld.y,
    corners: geometry.corners,
    anchorX: geometry.anchorWorld.x,
    anchorY: geometry.anchorWorld.y,
    scaleX: snapshot.scale.x,
    scaleY: snapshot.scale.y,
    rotation: snapshot.rotation,
    sourceWidth: snapshot.sourceWidth,
    sourceHeight: snapshot.sourceHeight,
    canvasWidth: snapshot.canvasWidth,
    canvasHeight: snapshot.canvasHeight,
  };
}

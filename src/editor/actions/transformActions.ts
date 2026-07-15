import type {
  AnimatableProperty,
  Composition,
  Position,
  Scale,
} from "@/editor/types/types";
import {
  updateCompositionNodeRecursively,
  updateLayerRecursively,
} from "@/editor/actions/compositionActions";
import {
  upsertOpacityKeyframe,
  upsertPositionKeyframe,
  upsertRotationKeyframe,
  upsertScaleKeyframe,
} from "@/editor/actions/keyframeActions";

export function applyScaleValueToComps(
  comps: Composition[],
  targetKind: "layer" | "composition",
  targetId: string,
  nextScale: Scale,
  frame: number,
  shouldCreateKeyframe: boolean
) {
  return comps.map((comp) =>
    targetKind === "layer"
      ? updateLayerRecursively(comp, targetId, (layer) => ({
          ...layer,
          scale: nextScale,
          scaleKeyframes: shouldCreateKeyframe
            ? upsertScaleKeyframe(layer.scaleKeyframes, frame, nextScale)
            : layer.scaleKeyframes,
        }))
      : updateCompositionNodeRecursively(comp, targetId, (target) => ({
          ...target,
          scale: nextScale,
          scaleKeyframes: shouldCreateKeyframe
            ? upsertScaleKeyframe(target.scaleKeyframes, frame, nextScale)
            : target.scaleKeyframes,
        }))
  );
}

export function applyRotationValueToComps(
  comps: Composition[],
  targetKind: "layer" | "composition",
  targetId: string,
  nextRotation: number,
  frame: number,
  shouldCreateKeyframe: boolean
) {
  return comps.map((comp) =>
    targetKind === "layer"
      ? updateLayerRecursively(comp, targetId, (layer) => ({
          ...layer,
          rotation: nextRotation,
          rotationKeyframes: shouldCreateKeyframe
            ? upsertRotationKeyframe(layer.rotationKeyframes, frame, nextRotation)
            : layer.rotationKeyframes,
        }))
      : updateCompositionNodeRecursively(comp, targetId, (target) => ({
          ...target,
          rotation: nextRotation,
          rotationKeyframes: shouldCreateKeyframe
            ? upsertRotationKeyframe(target.rotationKeyframes, frame, nextRotation)
            : target.rotationKeyframes,
        }))
  );
}

export function applyPositionValueToComps(
  comps: Composition[],
  targetKind: "layer" | "composition",
  targetId: string,
  nextPosition: Position,
  frame: number,
  shouldCreateKeyframe: boolean
) {
  return comps.map((comp) =>
    targetKind === "layer"
      ? updateLayerRecursively(comp, targetId, (layer) => ({
          ...layer,
          position: nextPosition,
          positionKeyframes: shouldCreateKeyframe
            ? upsertPositionKeyframe(layer.positionKeyframes, frame, nextPosition)
            : layer.positionKeyframes,
        }))
      : updateCompositionNodeRecursively(comp, targetId, (target) => ({
          ...target,
          position: nextPosition,
          positionKeyframes: shouldCreateKeyframe
            ? upsertPositionKeyframe(target.positionKeyframes, frame, nextPosition)
            : target.positionKeyframes,
        }))
  );
}

export function applyOpacityValueToComps(
  comps: Composition[],
  targetKind: "layer" | "composition",
  targetId: string,
  nextOpacity: number,
  frame: number,
  shouldCreateKeyframe: boolean
) {
  return comps.map((comp) =>
    targetKind === "layer"
      ? updateLayerRecursively(comp, targetId, (layer) => ({
          ...layer,
          opacity: nextOpacity,
          opacityKeyframes: shouldCreateKeyframe
            ? upsertOpacityKeyframe(layer.opacityKeyframes, frame, nextOpacity)
            : layer.opacityKeyframes,
        }))
      : updateCompositionNodeRecursively(comp, targetId, (target) => ({
          ...target,
          opacity: nextOpacity,
          opacityKeyframes: shouldCreateKeyframe
            ? upsertOpacityKeyframe(target.opacityKeyframes, frame, nextOpacity)
            : target.opacityKeyframes,
        }))
  );
}

export function setScaleLinkedOnTarget(
  comps: Composition[],
  targetKind: "layer" | "composition",
  targetId: string,
  linked: boolean
) {
  return comps.map((comp) =>
    targetKind === "layer"
      ? updateLayerRecursively(comp, targetId, (layer) => ({
          ...layer,
          scaleLinked: linked,
        }))
      : updateCompositionNodeRecursively(comp, targetId, (target) => ({
          ...target,
          scaleLinked: linked,
        }))
  );
}

export function togglePropertyTrackOnTarget(
  comps: Composition[],
  targetKind: "layer" | "composition",
  targetId: string,
  property: AnimatableProperty,
  enabled: boolean,
  values: {
    position: Position;
    scale: Scale;
    rotation: number;
    opacity: number;
  },
  frames: {
    position: number;
    scale: number;
    rotation: number;
    opacity: number;
  }
) {
  const updater =
    targetKind === "layer"
      ? (comp: Composition) =>
          updateLayerRecursively(comp, targetId, (target) => {
            const nextTarget = {
              ...target,
              enabledProperties: {
                ...target.enabledProperties,
                [property]: enabled,
              },
            };

            if (!enabled) {
              return nextTarget;
            }

            if (property === "position") {
              return {
                ...nextTarget,
                positionKeyframes: upsertPositionKeyframe(
                  target.positionKeyframes,
                  frames.position,
                  values.position
                ),
              };
            }

            if (property === "opacity") {
              return {
                ...nextTarget,
                opacityKeyframes: upsertOpacityKeyframe(
                  target.opacityKeyframes,
                  frames.opacity,
                  values.opacity
                ),
              };
            }

            if (property === "scale") {
              return {
                ...nextTarget,
                scaleKeyframes: upsertScaleKeyframe(
                  target.scaleKeyframes,
                  frames.scale,
                  values.scale
                ),
              };
            }

            if (property === "rotation") {
              return {
                ...nextTarget,
                rotationKeyframes: upsertRotationKeyframe(
                  target.rotationKeyframes,
                  frames.rotation,
                  values.rotation
                ),
              };
            }

            return nextTarget;
          })
      : (comp: Composition) =>
          updateCompositionNodeRecursively(comp, targetId, (target) => {
            const nextTarget = {
              ...target,
              enabledProperties: {
                ...target.enabledProperties,
                [property]: enabled,
              },
            };

            if (!enabled) {
              return nextTarget;
            }

            if (property === "position") {
              return {
                ...nextTarget,
                positionKeyframes: upsertPositionKeyframe(
                  target.positionKeyframes,
                  frames.position,
                  values.position
                ),
              };
            }

            if (property === "opacity") {
              return {
                ...nextTarget,
                opacityKeyframes: upsertOpacityKeyframe(
                  target.opacityKeyframes,
                  frames.opacity,
                  values.opacity
                ),
              };
            }

            if (property === "scale") {
              return {
                ...nextTarget,
                scaleKeyframes: upsertScaleKeyframe(
                  target.scaleKeyframes,
                  frames.scale,
                  values.scale
                ),
              };
            }

            if (property === "rotation") {
              return {
                ...nextTarget,
                rotationKeyframes: upsertRotationKeyframe(
                  target.rotationKeyframes,
                  frames.rotation,
                  values.rotation
                ),
              };
            }

            return nextTarget;
          });

  return comps.map(updater);
}

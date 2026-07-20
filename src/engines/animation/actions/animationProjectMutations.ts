import type {
  AnimatableProperty,
  Composition,
  Layer,
  ModifierNumberField,
  ModifierType,
  Position,
  Scale,
} from "@/models";
import type {
  AnimationTargetDescriptor,
  PropertyKeyframeCommand,
} from "@/engines/animation/models/animationCommandModel";
import type { SelectedKeyframe } from "@/engines/animation/models/animationSessionModel";
import {
  getTargetKeyframes,
  replaceTargetKeyframes,
  type SupportedKeyframeList,
  updateTargetKeyframes,
} from "@/engines/animation/helpers/keyframeTargetHelpers";
import {
  moveKeyframeValue,
  removeKeyframeValue,
  upsertKeyframeValue,
} from "@/engines/animation/helpers/keyframeTrackHelpers";
import {
  type PropertyTrackFrames,
  type PropertyTrackValues,
  updateTargetPropertyTrack,
} from "@/engines/animation/helpers/propertyTrackHelpers";
import {
  createDefaultModifier,
  findModifier,
  normalizeModifierInstances,
  normalizeModifierNumber,
} from "@/engines/animation/modifiers/modifierRegistry";

function updateLayerInComposition(
  composition: Composition,
  targetId: string,
  updater: (layer: Layer) => Layer
): Composition {
  return {
    ...composition,
    layers: composition.layers.map((layer) => (layer.id === targetId ? updater(layer) : layer)),
    children: composition.children?.map((child) =>
      updateLayerInComposition(child, targetId, updater)
    ),
  };
}

function updateCompositionInTree(
  composition: Composition,
  targetId: string,
  updater: (target: Composition) => Composition
): Composition {
  const current = composition.id === targetId ? updater(composition) : composition;
  return {
    ...current,
    children: current.children?.map((child) =>
      updateCompositionInTree(child, targetId, updater)
    ),
  };
}

function updateAnimationTarget(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  updater: (current: Layer | Composition) => Layer | Composition
) {
  return comps.map((comp) =>
    target.kind === "layer"
      ? updateLayerInComposition(comp, target.id, (layer) => updater(layer) as Layer)
      : updateCompositionInTree(comp, target.id, (composition) =>
          updater(composition) as Composition
        )
  );
}

export function applyPositionToCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  value: Position,
  frame: number,
  animated: boolean
) {
  return updateAnimationTarget(comps, target, (current) => ({
    ...current,
    position: value,
    positionKeyframes: animated
      ? upsertKeyframeValue(current.positionKeyframes, frame, value)
      : current.positionKeyframes,
  }));
}

export function applyScaleToCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  value: Scale,
  frame: number,
  animated: boolean
) {
  return updateAnimationTarget(comps, target, (current) => ({
    ...current,
    scale: value,
    scaleKeyframes: animated
      ? upsertKeyframeValue(current.scaleKeyframes, frame, value)
      : current.scaleKeyframes,
  }));
}

export function applyRotationToCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  value: number,
  frame: number,
  animated: boolean
) {
  return updateAnimationTarget(comps, target, (current) => ({
    ...current,
    rotation: value,
    rotationKeyframes: animated
      ? upsertKeyframeValue(current.rotationKeyframes, frame, value)
      : current.rotationKeyframes,
  }));
}

export function applyOpacityToCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  value: number,
  frame: number,
  animated: boolean
) {
  return updateAnimationTarget(comps, target, (current) => ({
    ...current,
    opacity: value,
    opacityKeyframes: animated
      ? upsertKeyframeValue(current.opacityKeyframes, frame, value)
      : current.opacityKeyframes,
  }));
}

export function applyAnchorToCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  anchor: Position,
  transformOffset: Position
) {
  return updateAnimationTarget(comps, target, (current) => ({
    ...current,
    anchor,
    transformOffset,
  }));
}

export function setScaleLinkedInCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  linked: boolean
) {
  return updateAnimationTarget(comps, target, (current) => ({
    ...current,
    scaleLinked: linked,
  }));
}

export function setPropertyTrackInCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  property: AnimatableProperty,
  enabled: boolean,
  values: PropertyTrackValues,
  frames: PropertyTrackFrames
) {
  return updateAnimationTarget(comps, target, (current) =>
    updateTargetPropertyTrack(current, property, enabled, values, frames)
  );
}

export function setPropertyTrackEnabledOnlyInCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  property: AnimatableProperty,
  enabled: boolean
) {
  return updateAnimationTarget(comps, target, (current) => ({
    ...current,
    enabledProperties: { ...current.enabledProperties, [property]: enabled },
  }));
}

export function addModifierToCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  type: ModifierType
) {
  return updateAnimationTarget(comps, target, (current) => {
    const modifiers = normalizeModifierInstances(current.modifiers, current.id);
    if (findModifier(modifiers, type)) return current;
    return {
      ...current,
      modifiers: [...modifiers, createDefaultModifier(type, current.id)],
    };
  });
}

export function removeModifierFromCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  type: ModifierType
) {
  return updateAnimationTarget(comps, target, (current) => ({
    ...current,
    modifiers: normalizeModifierInstances(current.modifiers, current.id).filter(
      (modifier) => modifier.type !== type
    ),
  }));
}

export function updateModifierNumberInCompositions(
  comps: Composition[],
  target: AnimationTargetDescriptor,
  type: ModifierType,
  field: ModifierNumberField,
  value: number
) {
  return updateAnimationTarget(comps, target, (current) => ({
    ...current,
    modifiers: normalizeModifierInstances(current.modifiers, current.id).map(
      (modifier) => modifier.type === type
        ? { ...modifier, [field]: normalizeModifierNumber(value) }
        : modifier
    ),
  }));
}

export function movePropertyKeyframeInCompositions(
  comps: Composition[],
  command: PropertyKeyframeCommand & { toFrame: number }
) {
  return updateAnimationTarget(comps, command.target, (current) =>
    updateTargetKeyframes(current, command.property, (keyframes) =>
      moveKeyframeValue(
        keyframes as never[],
        command.frame,
        command.toFrame
      ) as unknown as SupportedKeyframeList
    )
  );
}

export function removePropertyKeyframeFromCompositions(
  comps: Composition[],
  command: PropertyKeyframeCommand
) {
  return updateAnimationTarget(comps, command.target, (current) =>
    replaceTargetKeyframes(
      current,
      command.property,
      removeKeyframeValue(
        getTargetKeyframes(current, command.property) as never[],
        command.frame
      ) as unknown as SupportedKeyframeList
    )
  );
}

export function applyPositionValueToComps(
  comps: Composition[], targetKind: "layer" | "composition", targetId: string,
  value: Position, frame: number, animated: boolean
) {
  return applyPositionToCompositions(comps, { kind: targetKind, id: targetId }, value, frame, animated);
}

export function applyScaleValueToComps(
  comps: Composition[], targetKind: "layer" | "composition", targetId: string,
  value: Scale, frame: number, animated: boolean
) {
  return applyScaleToCompositions(comps, { kind: targetKind, id: targetId }, value, frame, animated);
}

export function applyRotationValueToComps(
  comps: Composition[], targetKind: "layer" | "composition", targetId: string,
  value: number, frame: number, animated: boolean
) {
  return applyRotationToCompositions(comps, { kind: targetKind, id: targetId }, value, frame, animated);
}

export function applyOpacityValueToComps(
  comps: Composition[], targetKind: "layer" | "composition", targetId: string,
  value: number, frame: number, animated: boolean
) {
  return applyOpacityToCompositions(comps, { kind: targetKind, id: targetId }, value, frame, animated);
}

export function setScaleLinkedOnTarget(
  comps: Composition[], targetKind: "layer" | "composition", targetId: string, linked: boolean
) {
  return setScaleLinkedInCompositions(comps, { kind: targetKind, id: targetId }, linked);
}

export function togglePropertyTrackOnTarget(
  comps: Composition[], targetKind: "layer" | "composition", targetId: string,
  property: AnimatableProperty, enabled: boolean, values: PropertyTrackValues,
  frames: PropertyTrackFrames
) {
  return setPropertyTrackInCompositions(comps, { kind: targetKind, id: targetId }, property, enabled, values, frames);
}

export function moveLayerKeyframeRecursively(
  comp: Composition, targetKind: "layer" | "composition", targetId: string,
  fromFrame: number, toFrame: number, property: AnimatableProperty
) {
  return movePropertyKeyframeInCompositions([comp], {
    target: { kind: targetKind, id: targetId }, property, frame: fromFrame, toFrame,
  })[0];
}

export function removeSelectedKeyframeFromComps(
  comps: Composition[], selected: NonNullable<SelectedKeyframe>
) {
  return removePropertyKeyframeFromCompositions(comps, {
    target: { kind: selected.targetKind, id: selected.targetId },
    property: selected.property,
    frame: selected.frame,
  });
}

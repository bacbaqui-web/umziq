/** Pure deterministic modifier evaluation. */
import type {
  LayerModifier,
  ModifierInstance,
  Position,
  WiggleModifierInstance,
} from "@/models";

type CanonicalMotionModifier = Extract<
  LayerModifier,
  { type: "wiggle" | "oscillate" | "swing" }
>;
type MotionModifier = ModifierInstance | CanonicalMotionModifier;

const modifierIdentity = (modifier: MotionModifier) =>
  "modifierId" in modifier ? modifier.modifierId : modifier.id;
const modifierEnabled = (modifier: MotionModifier) =>
  !("enabled" in modifier) || modifier.enabled;

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicSignedValue(seed: string) {
  let value = hashText(seed);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return ((value >>> 0) / 0xffffffff) * 2 - 1;
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

function interpolateOffset(
  modifier: WiggleModifierInstance | Extract<CanonicalMotionModifier, { type: "wiggle" }>,
  targetId: string,
  axis: "x" | "y",
  localFrame: number,
  frameRate: number
) {
  const safeFrameRate = Math.max(1, Number(frameRate) || 1);
  const phase = (Math.max(0, localFrame) / safeFrameRate) * modifier.frequency;
  const segment = Math.floor(phase);
  const progress = smoothStep(phase - segment);
  const seed = `${targetId}:${modifierIdentity(modifier)}:${axis}`;
  const from = deterministicSignedValue(`${seed}:${segment}`);
  const to = deterministicSignedValue(`${seed}:${segment + 1}`);
  return (from + (to - from) * progress) * modifier.amount;
}

export function evaluateWiggleOffset(
  modifier: WiggleModifierInstance | Extract<CanonicalMotionModifier, { type: "wiggle" }>,
  targetId: string,
  localFrame: number,
  frameRate: number
): Position {
  if (modifier.frequency <= 0 || modifier.amount <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: interpolateOffset(modifier, targetId, "x", localFrame, frameRate),
    y: interpolateOffset(modifier, targetId, "y", localFrame, frameRate),
  };
}

export function applyPositionModifiers(
  basePosition: Position,
  targetId: string,
  modifiers: readonly MotionModifier[] | undefined,
  localFrame: number,
  frameRate: number
): Position {
  return (modifiers ?? []).reduce((position, modifier) => {
    if (!modifierEnabled(modifier)) return position;
    if (modifier.type === "wiggle") {
      const offset = evaluateWiggleOffset(modifier, targetId, localFrame, frameRate);
      return { x: position.x + offset.x, y: position.y + offset.y };
    }
    if (modifier.type === "oscillate" && modifier.frequency > 0 && modifier.amount > 0) {
      const safeFrameRate = Math.max(1, Number(frameRate) || 1);
      const seconds = Math.max(0, localFrame) / safeFrameRate;
      const distance = Math.sin(seconds * modifier.frequency * Math.PI * 2) * modifier.amount;
      const radians = modifier.angle * Math.PI / 180;
      return {
        x: position.x + Math.cos(radians) * distance,
        y: position.y + Math.sin(radians) * distance,
      };
    }
    return position;
  }, basePosition);
}

export function applyRotationModifiers(
  baseRotation: number,
  modifiers: readonly MotionModifier[] | undefined,
  localFrame: number,
  frameRate: number
) {
  const safeFrameRate = Math.max(1, Number(frameRate) || 1);
  return (modifiers ?? []).reduce((rotation, modifier) => {
    if (!modifierEnabled(modifier) || modifier.type !== "swing" || modifier.frequency <= 0 || modifier.amount <= 0) {
      return rotation;
    }
    const seconds = Math.max(0, localFrame) / safeFrameRate;
    return rotation + Math.sin(seconds * modifier.frequency * Math.PI * 2) * modifier.amount;
  }, baseRotation);
}

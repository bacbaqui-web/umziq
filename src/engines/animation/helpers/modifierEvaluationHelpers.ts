import type { ModifierInstance, Position, WiggleModifierInstance } from "@/models";

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
  modifier: WiggleModifierInstance,
  targetId: string,
  axis: "x" | "y",
  localFrame: number,
  frameRate: number
) {
  const safeFrameRate = Math.max(1, Number(frameRate) || 1);
  const phase = (Math.max(0, localFrame) / safeFrameRate) * modifier.frequency;
  const segment = Math.floor(phase);
  const progress = smoothStep(phase - segment);
  const seed = `${targetId}:${modifier.id}:${axis}`;
  const from = deterministicSignedValue(`${seed}:${segment}`);
  const to = deterministicSignedValue(`${seed}:${segment + 1}`);
  return (from + (to - from) * progress) * modifier.amount;
}

export function evaluateWiggleOffset(
  modifier: WiggleModifierInstance,
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
  modifiers: readonly ModifierInstance[] | undefined,
  localFrame: number,
  frameRate: number
): Position {
  return (modifiers ?? []).reduce((position, modifier) => {
    if (modifier.type !== "wiggle") return position;
    const offset = evaluateWiggleOffset(modifier, targetId, localFrame, frameRate);
    return { x: position.x + offset.x, y: position.y + offset.y };
  }, basePosition);
}

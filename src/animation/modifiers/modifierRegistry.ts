/** Pure Modifier definitions, normalization and lookup. */
import type {
  ModifierInstance,
  ModifierNumberField,
  ModifierType,
  OscillateModifierInstance,
  SwingModifierInstance,
  WiggleModifierInstance,
} from "@/models";
import type { AccelerationModifierInstance, AnimatableProperty } from "@/models";

export type ModifierNumberSettingDefinition = {
  field: ModifierNumberField;
  label: string;
  min: number;
};

export type ModifierDefinition = {
  type: ModifierType;
  label: string;
  appliesTo: "position" | "rotation" | "opacity" | "multiple";
  settings: readonly ModifierNumberSettingDefinition[];
};

export const MODIFIER_DEFINITIONS: readonly ModifierDefinition[] = [
  {
    type: "acceleration",
    label: "가속·감속",
    appliesTo: "multiple",
    settings: [],
  },
  {
    type: "mouth-basic",
    label: "입뻥긋(기본)",
    appliesTo: "opacity",
    settings: [],
  },
  {
    type: "wiggle",
    label: "부들부들",
    appliesTo: "position",
    settings: [
      { field: "frequency", label: "초당 횟수", min: 0 },
      { field: "amount", label: "흔들림 정도", min: 0 },
    ],
  },
  {
    type: "oscillate",
    label: "왔다갔다",
    appliesTo: "position",
    settings: [
      { field: "angle", label: "이동 각도", min: 0 },
      { field: "frequency", label: "초당 횟수", min: 0 },
      { field: "amount", label: "이동 거리", min: 0 },
    ],
  },
  {
    type: "swing",
    label: "흔들흔들",
    appliesTo: "rotation",
    settings: [
      { field: "frequency", label: "초당 횟수", min: 0 },
      { field: "amount", label: "회전 각도", min: 0 },
    ],
  },
];

export function getModifierDefinition(type: ModifierType) {
  return MODIFIER_DEFINITIONS.find((definition) => definition.type === type) ?? null;
}

export function createDefaultModifier(
  type: ModifierType,
  targetId: string
): ModifierInstance {
  if (type === "wiggle") {
    return {
      id: `${targetId}:wiggle`,
      type,
      frequency: 0,
      amount: 0,
    };
  }
  if (type === "swing") {
    return {
      id: `${targetId}:swing`,
      type,
      frequency: 0,
      amount: 0,
    };
  }
  if (type === "oscillate") {
    return {
      id: `${targetId}:oscillate`,
      type,
      angle: 0,
      frequency: 0,
      amount: 0,
    };
  }
  if (type === "mouth-basic") {
    return {
      id: `${targetId}:mouth-basic`,
      type,
      audioLayerDocumentId: null,
      startFrame: 0,
      durationFrames: 1,
      transitionFrames: [],
    };
  }
  if (type === "acceleration") {
    return {
      id: `${targetId}:acceleration`,
      type,
      properties: ["position"],
      curve: "ease-out-soft",
      startFrame: 0,
      durationFrames: 1,
    };
  }

  throw new Error(`지원하지 않는 Modifier type: ${type satisfies never}`);
}

export function normalizeModifierNumber(value: unknown, min = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(min, numericValue) : min;
}

function normalizeWiggleModifier(
  source: Partial<WiggleModifierInstance>,
  targetId: string
): WiggleModifierInstance {
  return {
    id: typeof source.id === "string" && source.id.length > 0
      ? source.id
      : `${targetId}:wiggle`,
    type: "wiggle",
    frequency: normalizeModifierNumber(source.frequency),
    amount: normalizeModifierNumber(source.amount),
  };
}

function normalizeSwingModifier(
  source: Partial<SwingModifierInstance>,
  targetId: string
): SwingModifierInstance {
  return {
    id: typeof source.id === "string" && source.id.length > 0
      ? source.id
      : `${targetId}:swing`,
    type: "swing",
    frequency: normalizeModifierNumber(source.frequency),
    amount: normalizeModifierNumber(source.amount),
  };
}

function normalizeOscillateModifier(
  source: Partial<OscillateModifierInstance>,
  targetId: string
): OscillateModifierInstance {
  return {
    id: typeof source.id === "string" && source.id.length > 0
      ? source.id
      : `${targetId}:oscillate`,
    type: "oscillate",
    angle: Number.isFinite(Number(source.angle)) ? Number(source.angle) : 0,
    frequency: normalizeModifierNumber(source.frequency),
    amount: normalizeModifierNumber(source.amount),
  };
}

function normalizeMouthBasicModifier(
  source: Partial<import("@/models").MouthBasicModifierInstance>,
  targetId: string
): import("@/models").MouthBasicModifierInstance {
  const durationFrames = Math.max(1, Math.floor(Number(source.durationFrames) || 1));
  const transitionFrames = Array.isArray(source.transitionFrames)
    ? [...new Set(source.transitionFrames
        .map((frame) => Math.floor(Number(frame)))
        .filter((frame) => Number.isFinite(frame) && frame >= 0 && frame < durationFrames))]
        .sort((left, right) => left - right)
    : [];
  return {
    id: typeof source.id === "string" && source.id.length > 0
      ? source.id
      : `${targetId}:mouth-basic`,
    type: "mouth-basic",
    audioLayerDocumentId: typeof source.audioLayerDocumentId === "string"
      ? source.audioLayerDocumentId
      : null,
    startFrame: Math.floor(Number(source.startFrame) || 0),
    durationFrames,
    transitionFrames,
  };
}

function normalizeAccelerationModifier(
  source: Partial<AccelerationModifierInstance>,
  targetId: string
): AccelerationModifierInstance {
  const allowedProperties: readonly AnimatableProperty[] = ["position", "scale", "rotation", "opacity"];
  const properties: AnimatableProperty[] = Array.isArray(source.properties)
    ? allowedProperties.filter((property) => source.properties?.includes(property))
    : ["position"];
  const allowedCurves = ["ease-out-soft", "ease-out-strong", "ease-in-soft", "ease-in-strong"] as const;
  return {
    id: typeof source.id === "string" && source.id.length > 0 ? source.id : `${targetId}:acceleration`,
    type: "acceleration",
    properties: properties.length > 0 ? properties : ["position" as const],
    curve: allowedCurves.includes(source.curve as typeof allowedCurves[number])
      ? source.curve as typeof allowedCurves[number]
      : "ease-out-soft",
    startFrame: Math.floor(Number(source.startFrame) || 0),
    durationFrames: Math.max(1, Math.floor(Number(source.durationFrames) || 1)),
  };
}

export function normalizeModifierInstances(
  source: unknown,
  targetId: string
): ModifierInstance[] {
  if (!Array.isArray(source)) return [];

  const normalized = new Map<ModifierType, ModifierInstance>();
  source.forEach((candidate) => {
    if (!candidate || typeof candidate !== "object") return;
    const modifier = candidate as Partial<ModifierInstance>;
    if (modifier.type === "wiggle" && !normalized.has("wiggle")) {
      normalized.set("wiggle", normalizeWiggleModifier(modifier, targetId));
    }
    if (modifier.type === "swing" && !normalized.has("swing")) {
      normalized.set("swing", normalizeSwingModifier(modifier, targetId));
    }
    if (modifier.type === "oscillate" && !normalized.has("oscillate")) {
      normalized.set("oscillate", normalizeOscillateModifier(modifier, targetId));
    }
    if (modifier.type === "mouth-basic" && !normalized.has("mouth-basic")) {
      normalized.set("mouth-basic", normalizeMouthBasicModifier(modifier, targetId));
    }
    if (modifier.type === "acceleration" && !normalized.has("acceleration")) {
      normalized.set("acceleration", normalizeAccelerationModifier(modifier, targetId));
    }
  });

  return MODIFIER_DEFINITIONS.flatMap((definition) => {
    const modifier = normalized.get(definition.type);
    return modifier ? [modifier] : [];
  });
}

export function normalizeTargetModifiers<T extends { id: string; modifiers?: unknown }>(
  target: T
): Omit<T, "modifiers"> & { modifiers: ModifierInstance[] } {
  return {
    ...target,
    modifiers: normalizeModifierInstances(target.modifiers, target.id),
  };
}

export function findModifier(
  modifiers: readonly ModifierInstance[] | undefined,
  type: ModifierType
) {
  return modifiers?.find((modifier) => modifier.type === type) ?? null;
}

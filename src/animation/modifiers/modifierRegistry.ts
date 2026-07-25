/** Pure Modifier definitions, normalization and lookup. */
import type {
  ModifierInstance,
  ModifierNumberField,
  ModifierType,
  WiggleModifierInstance,
} from "@/models";

export type ModifierNumberSettingDefinition = {
  field: ModifierNumberField;
  label: string;
  min: number;
};

export type ModifierDefinition = {
  type: ModifierType;
  label: string;
  appliesTo: "position";
  settings: readonly ModifierNumberSettingDefinition[];
};

export const MODIFIER_DEFINITIONS: readonly ModifierDefinition[] = [
  {
    type: "wiggle",
    label: "부들부들",
    appliesTo: "position",
    settings: [
      { field: "frequency", label: "초당 얼마나", min: 0 },
      { field: "amount", label: "흔들림 정도", min: 0 },
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

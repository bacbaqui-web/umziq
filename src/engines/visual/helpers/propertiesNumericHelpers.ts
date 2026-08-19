import type { Position, Scale } from "@/models";
import type {
  PropertiesNumericInputId,
  PropertiesNumericProperty,
} from "@/engines/visual/models/propertiesEngineModel";

export type ParsedNumericDraft =
  | { kind: "number"; value: number }
  | { kind: "intermediate" }
  | { kind: "invalid" };

const INTERMEDIATE_NUMERIC_DRAFTS = new Set(["", "-", ".", "-."]);
const NUMERIC_DRAFT_PATTERN = /^-?(?:\d+\.?\d*|\.\d*)$/;

export function parsePropertiesNumericDraft(value: string): ParsedNumericDraft {
  const trimmed = value.trim();

  if (INTERMEDIATE_NUMERIC_DRAFTS.has(trimmed)) {
    return { kind: "intermediate" };
  }

  if (!NUMERIC_DRAFT_PATTERN.test(trimmed)) {
    return { kind: "invalid" };
  }

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue)
    ? { kind: "number", value: numericValue }
    : { kind: "invalid" };
}

export function clampPropertiesNumericValue(
  property: PropertiesNumericProperty,
  value: number
) {
  if (property === "scale") {
    return Math.max(1, value);
  }

  if (property === "opacity") {
    return Math.min(100, Math.max(0, value));
  }

  return value;
}

export function roundPropertiesNumericValue(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function formatPropertiesNumericValue(
  property: PropertiesNumericProperty,
  value: number
) {
  if (property === "scale" || property === "opacity") {
    return String(Math.round(value));
  }

  if (property === "rotation") {
    return String(roundPropertiesNumericValue(value, 2));
  }

  return String(value);
}

export function getPropertiesNumericInputDescriptor(inputId: PropertiesNumericInputId) {
  const [property, axis] = inputId.split(".") as [
    PropertiesNumericProperty,
    "x" | "y" | "value"
  ];
  return { property, axis };
}

export function applyLinkedScaleInput(
  baseScale: Scale,
  axis: "x" | "y",
  value: number,
  linked: boolean
): Scale {
  const nextScale = { ...baseScale, [axis]: value };

  if (!linked) {
    return nextScale;
  }

  const currentAxisValue = Math.max(1, baseScale[axis]);
  const factor = value / currentAxisValue;
  return {
    x: Math.max(1, baseScale.x * factor),
    y: Math.max(1, baseScale.y * factor),
  };
}

export function applyPositionInput(
  basePosition: Position,
  axis: "x" | "y",
  value: number
): Position {
  return { ...basePosition, [axis]: value };
}

export function hasPropertiesAnchorSemanticChange(
  initialAnchor: Position | null,
  command: { anchor: Position } | null
) {
  return !!initialAnchor && !!command && (
    initialAnchor.x !== command.anchor.x || initialAnchor.y !== command.anchor.y
  );
}

import type {
  LayerModifier,
} from "@/models/layerDocumentModel";

export type KnownLayerModifier = Exclude<
  LayerModifier,
  { type: "unknown" }
>;
export type KnownLayerModifierType = KnownLayerModifier["type"];

export type LayerModifierDefaultContext = {
  readonly layerDocumentId: string;
  readonly durationFrames: number;
};

export type LayerModifierNumberFieldDescriptor = {
  readonly field: "angle" | "frequency" | "amount";
  readonly label: string;
  readonly suffix: string;
  readonly minimum?: number;
};

export type LayerModifierPropertiesDescriptor = {
  readonly editorKind:
    | "number-fields"
    | "mouth-audio"
    | "acceleration";
  readonly fields: readonly LayerModifierNumberFieldDescriptor[];
};

export type LayerModifierTimelineDescriptor = {
  readonly kind: "none" | "formula";
  readonly contentKind?: "mouth-segments" | "acceleration-curve";
};

export type LayerModifierEvaluationKind =
  | "position-wiggle"
  | "position-oscillate"
  | "rotation-swing"
  | "opacity-mouth"
  | "frame-acceleration";

export type LayerModifierValidationIssue = {
  readonly field: string;
  readonly message: string;
};

export type LayerModifierDefinition<
  TModifier extends KnownLayerModifier = KnownLayerModifier,
> = {
  readonly type: TModifier["type"];
  readonly label: string;
  readonly appliesTo:
    | "position"
    | "rotation"
    | "opacity"
    | "multiple";
  readonly allowedKeys: readonly (keyof TModifier)[];
  readonly properties: LayerModifierPropertiesDescriptor;
  readonly timeline: LayerModifierTimelineDescriptor;
  readonly evaluation: LayerModifierEvaluationKind;
  readonly createDefault: (
    context: LayerModifierDefaultContext
  ) => TModifier;
  readonly normalize: (modifier: TModifier) => TModifier;
  readonly validate: (
    modifier: TModifier
  ) => readonly LayerModifierValidationIssue[];
};

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const nonNegative = (value: number) => Math.max(0, finite(value));
const integer = (value: number, fallback = 0) =>
  Math.floor(finite(value, fallback));
const duration = (value: number) => Math.max(1, integer(value, 1));

function baseIssues(modifier: KnownLayerModifier) {
  const issues: LayerModifierValidationIssue[] = [];
  if (!modifier.modifierId) {
    issues.push({ field: "modifierId", message: "Modifier ID must not be empty" });
  }
  return issues;
}

const numberIssues = (
  values: readonly [field: string, value: number, minimum?: number][]
) => values.flatMap(([field, value, minimum]) => {
  if (!Number.isFinite(value)) return [{ field, message: "Expected a finite number" }];
  if (minimum !== undefined && value < minimum) {
    return [{ field, message: `Expected a number greater than or equal to ${minimum}` }];
  }
  return [];
});

const definition = <T extends KnownLayerModifier>(
  value: LayerModifierDefinition<T>
) => value;

export const LAYER_MODIFIER_DEFINITIONS = [
  definition<Extract<KnownLayerModifier, { type: "acceleration" }>>({
    type: "acceleration",
    label: "가속·감속",
    appliesTo: "multiple",
    allowedKeys: ["modifierId", "type", "enabled", "properties", "curve", "startFrame", "durationFrames"],
    properties: { editorKind: "acceleration", fields: [] },
    timeline: { kind: "formula", contentKind: "acceleration-curve" },
    evaluation: "frame-acceleration",
    createDefault: ({ layerDocumentId, durationFrames }) => ({
      modifierId: `acceleration:${layerDocumentId}`,
      type: "acceleration",
      enabled: true,
      properties: ["position"],
      curve: "ease-out-soft",
      startFrame: 0,
      durationFrames: duration(durationFrames),
    }),
    normalize: (modifier) => {
      const allowed = ["position", "scale", "rotation", "opacity"] as const;
      const properties = allowed.filter((property) => modifier.properties.includes(property));
      const curves = ["ease-out-soft", "ease-out-strong", "ease-in-soft", "ease-in-strong"] as const;
      return {
        ...modifier,
        properties: properties.length > 0 ? properties : ["position"],
        curve: curves.includes(modifier.curve) ? modifier.curve : "ease-out-soft",
        startFrame: integer(modifier.startFrame),
        durationFrames: duration(modifier.durationFrames),
      };
    },
    validate: (modifier) => [
      ...baseIssues(modifier),
      ...numberIssues([
        ["startFrame", modifier.startFrame],
        ["durationFrames", modifier.durationFrames, 1],
      ]),
      ...(Number.isInteger(modifier.startFrame) ? [] : [{ field: "startFrame", message: "Expected an integer frame" }]),
      ...(Number.isInteger(modifier.durationFrames) ? [] : [{ field: "durationFrames", message: "Expected an integer frame" }]),
      ...(modifier.properties.length > 0 ? [] : [{ field: "properties", message: "Expected at least one animatable property" }]),
    ],
  }),
  definition<Extract<KnownLayerModifier, { type: "mouth-basic" }>>({
    type: "mouth-basic",
    label: "입뻥긋(기본)",
    appliesTo: "opacity",
    allowedKeys: ["modifierId", "type", "enabled", "audioLayerDocumentId", "inverted", "repetitionsPerSecond", "startFrame", "durationFrames", "transitionFrames"],
    properties: { editorKind: "mouth-audio", fields: [] },
    timeline: { kind: "formula", contentKind: "mouth-segments" },
    evaluation: "opacity-mouth",
    createDefault: ({ layerDocumentId, durationFrames }) => ({
      modifierId: `mouth-basic:${layerDocumentId}`,
      type: "mouth-basic",
      enabled: true,
      audioLayerDocumentId: null,
      inverted: false,
      repetitionsPerSecond: 4,
      startFrame: 0,
      durationFrames: duration(durationFrames),
      transitionFrames: [],
    }),
    normalize: (modifier) => {
      const nextDuration = duration(modifier.durationFrames);
      return {
        ...modifier,
        inverted: modifier.inverted === true,
        repetitionsPerSecond: Math.min(12, Math.max(0.5, finite(modifier.repetitionsPerSecond ?? 4, 4))),
        startFrame: integer(modifier.startFrame),
        durationFrames: nextDuration,
        transitionFrames: [...new Set(modifier.transitionFrames
          .map((frame) => integer(frame))
          .filter((frame) => frame >= 0 && frame < nextDuration))]
          .sort((left, right) => left - right),
      };
    },
    validate: (modifier) => [
      ...baseIssues(modifier),
      ...numberIssues([
        ["repetitionsPerSecond", modifier.repetitionsPerSecond ?? 4, 0.5],
        ["startFrame", modifier.startFrame],
        ["durationFrames", modifier.durationFrames, 1],
      ]),
      ...(Number.isInteger(modifier.startFrame) ? [] : [{ field: "startFrame", message: "Expected an integer frame" }]),
      ...(Number.isInteger(modifier.durationFrames) ? [] : [{ field: "durationFrames", message: "Expected an integer frame" }]),
      ...modifier.transitionFrames.flatMap((frame, index) =>
        Number.isInteger(frame) && frame >= 0 && frame < modifier.durationFrames
          ? []
          : [{ field: `transitionFrames[${index}]`, message: "Transition frame must be an integer inside the clip" }]
      ),
      ...(new Set(modifier.transitionFrames).size === modifier.transitionFrames.length
        ? []
        : [{ field: "transitionFrames", message: "Transition frames must be unique" }]),
      ...(modifier.transitionFrames.every((frame, index, frames) =>
        index === 0 || (frames[index - 1] ?? frame) < frame
      )
        ? []
        : [{ field: "transitionFrames", message: "Transition frames must be sorted" }]),
    ],
  }),
  definition<Extract<KnownLayerModifier, { type: "wiggle" }>>({
    type: "wiggle",
    label: "부들부들",
    appliesTo: "position",
    allowedKeys: ["modifierId", "type", "enabled", "frequency", "amount"],
    properties: { editorKind: "number-fields", fields: [
      { field: "frequency", label: "초당 횟수", suffix: "/s", minimum: 0 },
      { field: "amount", label: "흔들림 정도", suffix: "px", minimum: 0 },
    ] },
    timeline: { kind: "none" },
    evaluation: "position-wiggle",
    createDefault: ({ layerDocumentId }) => ({ modifierId: `wiggle:${layerDocumentId}`, type: "wiggle", enabled: true, frequency: 0, amount: 0 }),
    normalize: (modifier) => ({ ...modifier, frequency: nonNegative(modifier.frequency), amount: nonNegative(modifier.amount) }),
    validate: (modifier) => [...baseIssues(modifier), ...numberIssues([["frequency", modifier.frequency, 0], ["amount", modifier.amount, 0]])],
  }),
  definition<Extract<KnownLayerModifier, { type: "swing" }>>({
    type: "swing",
    label: "흔들흔들",
    appliesTo: "rotation",
    allowedKeys: ["modifierId", "type", "enabled", "frequency", "amount"],
    properties: { editorKind: "number-fields", fields: [
      { field: "frequency", label: "초당 횟수", suffix: "/s", minimum: 0 },
      { field: "amount", label: "회전 각도", suffix: "°", minimum: 0 },
    ] },
    timeline: { kind: "none" },
    evaluation: "rotation-swing",
    createDefault: ({ layerDocumentId }) => ({ modifierId: `swing:${layerDocumentId}`, type: "swing", enabled: true, frequency: 0, amount: 0 }),
    normalize: (modifier) => ({ ...modifier, frequency: nonNegative(modifier.frequency), amount: nonNegative(modifier.amount) }),
    validate: (modifier) => [...baseIssues(modifier), ...numberIssues([["frequency", modifier.frequency, 0], ["amount", modifier.amount, 0]])],
  }),
  definition<Extract<KnownLayerModifier, { type: "oscillate" }>>({
    type: "oscillate",
    label: "왔다갔다",
    appliesTo: "position",
    allowedKeys: ["modifierId", "type", "enabled", "angle", "frequency", "amount"],
    properties: { editorKind: "number-fields", fields: [
      { field: "angle", label: "이동 각도", suffix: "°" },
      { field: "frequency", label: "초당 횟수", suffix: "/s", minimum: 0 },
      { field: "amount", label: "이동 거리", suffix: "px", minimum: 0 },
    ] },
    timeline: { kind: "none" },
    evaluation: "position-oscillate",
    createDefault: ({ layerDocumentId }) => ({ modifierId: `oscillate:${layerDocumentId}`, type: "oscillate", enabled: true, angle: 0, frequency: 0, amount: 0 }),
    normalize: (modifier) => ({ ...modifier, angle: finite(modifier.angle), frequency: nonNegative(modifier.frequency), amount: nonNegative(modifier.amount) }),
    validate: (modifier) => [...baseIssues(modifier), ...numberIssues([["angle", modifier.angle], ["frequency", modifier.frequency, 0], ["amount", modifier.amount, 0]])],
  }),
] as const;

export function getLayerModifierDefinition<T extends KnownLayerModifierType>(
  type: T
): LayerModifierDefinition<Extract<KnownLayerModifier, { type: T }>> {
  return LAYER_MODIFIER_DEFINITIONS.find((candidate) => candidate.type === type) as unknown as
    LayerModifierDefinition<Extract<KnownLayerModifier, { type: T }>>;
}

export function createDefaultLayerModifier(
  type: KnownLayerModifierType,
  context: LayerModifierDefaultContext
): KnownLayerModifier {
  const definition = getLayerModifierDefinition(type);
  return definition.createDefault(context as never) as KnownLayerModifier;
}

export function normalizeKnownLayerModifier(
  modifier: KnownLayerModifier
): KnownLayerModifier {
  const definition = getLayerModifierDefinition(modifier.type);
  return definition.normalize(modifier as never) as KnownLayerModifier;
}

export function validateKnownLayerModifier(
  modifier: KnownLayerModifier
): readonly LayerModifierValidationIssue[] {
  const definition = getLayerModifierDefinition(modifier.type);
  return definition.validate(modifier as never);
}

export function layerModifierEvaluationKind(
  modifier: KnownLayerModifier
) {
  return getLayerModifierDefinition(modifier.type).evaluation;
}

import {
  buildMouthBasicConnectionClip,
  type MouthBasicAudioBuffer,
} from "@/animation";
import type {
  AccelerationCurve,
  AnimatableProperty,
  LayerDocument,
  LayerDocumentProject,
  LayerModifier,
  ModifierType,
} from "@/models";
import { createDefaultLayerModifier } from "@/models";
import {
  findModifierForInput,
  getModifierInputDescriptor,
  normalizeModifierNumber,
} from "@/engines/properties/helpers/propertiesModifierHelpers";
import { parsePropertiesNumericDraft } from "@/engines/properties/helpers/propertiesNumericHelpers";
import type {
  LayerDocumentPropertiesDescriptor,
} from "@/engines/properties/models/layerDocumentPropertiesModel";
import type {
  LayerDocumentPropertiesCommandPort,
} from "@/engines/properties/models/propertiesControllerModel";
import type {
  PropertiesModifierInputId,
} from "@/engines/properties/models/propertiesEngineModel";
import type {
  PropertiesNumericDraftController,
} from "@/engines/properties/models/propertiesNumericDraftModel";

export type ModifierPropertiesControllerPort = {
  readonly readProject?: () => LayerDocumentProject;
  readonly readDecodedAudio?: (
    sourceId: string
  ) => MouthBasicAudioBuffer | null;
  readonly dispatchModifiers?: (
    layerDocumentId: string,
    modifiers: LayerModifier[]
  ) => { readonly ok: boolean };
  readonly dispatchPanel?: LayerDocumentPropertiesCommandPort["dispatchPanel"];
  readonly readDescriptor?: () => LayerDocumentPropertiesDescriptor | null;
  readonly draft?: PropertiesNumericDraftController;
  readonly readScopeIdentity?: () => string;
};

function absoluteLayerStart(
  project: LayerDocumentProject,
  layerDocumentId: string
) {
  let current: LayerDocument | null =
    project.payload.layerDocumentsById[layerDocumentId] ?? null;
  let start = 0;
  const visited = new Set<string>();
  while (current && !visited.has(current.layerDocumentId)) {
    visited.add(current.layerDocumentId);
    start += current.common.placement.startFrame;
    const parentId: string | null =
      current.common.placement.parentLayerDocumentId;
    current = parentId
      ? project.payload.layerDocumentsById[parentId] ?? null
      : null;
  }
  return start;
}

export function createModifierPropertiesController(
  port: ModifierPropertiesControllerPort
) {
  const readEditableDescriptor = () => {
    const descriptor = port.readDescriptor?.() ?? null;
    return descriptor?.capabilities.modifiers.status === "editable"
      ? descriptor
      : null;
  };
  const syncDraftScope = () => {
    const scopeIdentity = port.readScopeIdentity?.();
    if (scopeIdentity !== undefined) port.draft?.syncScope(scopeIdentity);
    return scopeIdentity ?? "none";
  };
  const dispatchModifierList = (
    layerDocumentId: string,
    modifiers: LayerModifier[]
  ) => port.dispatchModifiers
    ? port.dispatchModifiers(layerDocumentId, modifiers)
    : port.dispatchPanel?.({
        kind: "set-modifiers",
        layerDocumentId,
        modifiers,
      }) ?? { ok: false as const };
  const setModifiers = (
    descriptor: LayerDocumentPropertiesDescriptor,
    modifiers: LayerModifier[]
  ) => dispatchModifierList(descriptor.layerDocumentId, modifiers);

  const connectMouthAudio = (
    targetLayerDocumentId: string,
    audioLayerDocumentId: string,
    requestedRepetitionsPerSecond?: number
  ) => {
    const project = port.readProject?.();
    if (!project || !port.readDecodedAudio) {
      return { ok: false as const, reason: "audio-unavailable" as const };
    }
    const target = project.payload.layerDocumentsById[targetLayerDocumentId];
    const audio = project.payload.layerDocumentsById[audioLayerDocumentId];
    if (!target || !audio || target.type === "audio" || audio.type !== "audio") {
      return { ok: false as const, reason: "invalid-layer" as const };
    }
    const sourceId = audio.common.source?.sourceId;
    const decoded = sourceId ? port.readDecodedAudio(sourceId) : null;
    if (!decoded) {
      return { ok: false as const, reason: "audio-unavailable" as const };
    }
    const parent = target.common.placement.parentLayerDocumentId
      ? project.payload.layerDocumentsById[
          target.common.placement.parentLayerDocumentId
        ]
      : null;
    const frameRate = parent?.type === "group" ? parent.data.frameRate : 30;
    const currentMouth = target.common.modifiers.find(
      (modifier) => modifier.type === "mouth-basic"
    );
    const repetitionsPerSecond = Math.min(
      12,
      Math.max(0.5, requestedRepetitionsPerSecond ?? currentMouth?.repetitionsPerSecond ?? 4)
    );
    const clip = buildMouthBasicConnectionClip({
      buffer: decoded,
      frameRate,
      audioSourceOffsetFrames: audio.common.placement.sourceOffsetFrames,
      audioDurationFrames: audio.common.placement.durationFrames,
      audioAbsoluteStartFrame: absoluteLayerStart(project, audioLayerDocumentId),
      targetAbsoluteStartFrame: absoluteLayerStart(project, targetLayerDocumentId),
      targetSourceOffsetFrames: target.common.placement.sourceOffsetFrames,
      repetitionsPerSecond,
    });
    return dispatchModifierList(
      targetLayerDocumentId,
      target.common.modifiers.map((modifier) => modifier.type === "mouth-basic"
        ? { ...modifier, audioLayerDocumentId, repetitionsPerSecond, ...clip }
        : modifier)
    );
  };

  const focusModifierInput = (inputId: PropertiesModifierInputId) => {
    const scopeIdentity = syncDraftScope();
    const descriptor = readEditableDescriptor();
    const modifier = descriptor
      ? findModifierForInput(descriptor, inputId)
      : null;
    if (!descriptor || !modifier || !port.draft) return false;
    const { field } = getModifierInputDescriptor(inputId);
    const value = field === "angle"
      ? modifier.type === "oscillate" ? modifier.angle : 0
      : modifier[field];
    port.draft.begin(inputId, String(value), scopeIdentity);
    return true;
  };

  const changeModifierInput = (
    inputId: PropertiesModifierInputId,
    value: string
  ) => {
    syncDraftScope();
    if (
      !port.draft ||
      port.draft.read().focusedInputId !== inputId ||
      parsePropertiesNumericDraft(value).kind === "invalid"
    ) return false;
    return port.draft.change(inputId, value);
  };

  const commitModifierInput = (inputId: PropertiesModifierInputId) => {
    syncDraftScope();
    const descriptor = readEditableDescriptor();
    const draftState = port.draft?.read();
    const rawValue = draftState?.inputDrafts[inputId];
    const parsed = rawValue === undefined
      ? { kind: "invalid" as const }
      : parsePropertiesNumericDraft(rawValue);
    const modifier = descriptor
      ? findModifierForInput(descriptor, inputId)
      : null;
    if (
      draftState?.focusedInputId !== inputId ||
      !descriptor || !modifier || parsed.kind !== "number"
    ) return null;
    const { field } = getModifierInputDescriptor(inputId);
    const value = normalizeModifierNumber(parsed.value);
    const currentValue = field === "angle"
      ? modifier.type === "oscillate" ? modifier.angle : 0
      : modifier[field];
    if (currentValue === value) {
      port.draft?.finish(inputId);
      return { ok: true as const, committed: false };
    }
    const modifiers = descriptor.modifiers.map((candidate) => {
      if (candidate.modifierId !== modifier.modifierId) return candidate;
      if (field === "angle") {
        return candidate.type === "oscillate"
          ? { ...candidate, angle: value }
          : candidate;
      }
      return { ...candidate, [field]: value };
    });
    const result = setModifiers(descriptor, modifiers);
    if (!result.ok) {
      return { ok: false as const, reason: "dispatch-failed" as const };
    }
    port.draft?.finish(inputId);
    return { ok: true as const, committed: true };
  };

  return {
    readMouthAudioOptions: () => Object.values(
      port.readProject?.().payload.layerDocumentsById ?? {}
    ).flatMap((layer) => layer.type === "audio"
      ? [{
          id: layer.layerDocumentId,
          label: layer.common.placement.alias ?? layer.name,
        }]
      : []),
    connectMouthBasicAudio: connectMouthAudio,
    setMouthBasicAudioLayer: (audioLayerDocumentId: string) => {
      const descriptor = readEditableDescriptor();
      if (!descriptor || !audioLayerDocumentId) return null;
      return connectMouthAudio(descriptor.layerDocumentId, audioLayerDocumentId);
    },
    toggleMouthBasicInverted: () => {
      const descriptor = readEditableDescriptor();
      const modifier = descriptor?.modifiers.find(
        (candidate) => candidate.type === "mouth-basic"
      );
      if (!descriptor || !modifier || modifier.type !== "mouth-basic") return null;
      return setModifiers(
        descriptor,
        descriptor.modifiers.map((candidate) =>
          candidate.modifierId === modifier.modifierId
            ? { ...modifier, inverted: !modifier.inverted }
            : candidate
        )
      );
    },
    setMouthBasicRepetitionsPerSecond: (requestedValue: number) => {
      const descriptor = readEditableDescriptor();
      const modifier = descriptor?.modifiers.find(
        (candidate) => candidate.type === "mouth-basic"
      );
      if (!descriptor || !modifier || modifier.type !== "mouth-basic") return null;
      const repetitionsPerSecond = Math.min(12, Math.max(0.5, requestedValue));
      return modifier.audioLayerDocumentId
        ? connectMouthAudio(
            descriptor.layerDocumentId,
            modifier.audioLayerDocumentId,
            repetitionsPerSecond
          )
        : setModifiers(
            descriptor,
            descriptor.modifiers.map((candidate) =>
              candidate.modifierId === modifier.modifierId
                ? { ...modifier, repetitionsPerSecond }
                : candidate
            )
          );
    },
    toggleModifier: (type: ModifierType) => {
      const descriptor = readEditableDescriptor();
      if (!descriptor) return null;
      const existing = descriptor.modifiers.find(
        (modifier) => modifier.type === type
      );
      const newModifier: Exclude<LayerModifier, { type: "unknown" }> =
        createDefaultLayerModifier(type, {
          layerDocumentId: descriptor.layerDocumentId,
          durationFrames: descriptor.placement.durationFrames,
        });
      return setModifiers(
        descriptor,
        existing
          ? descriptor.modifiers.filter(
              (modifier) => modifier.modifierId !== existing.modifierId
            )
          : [...descriptor.modifiers, newModifier]
      );
    },
    focusModifierInput,
    changeModifierInput,
    blurModifierInput: commitModifierInput,
    keyDownModifierInput: (inputId: PropertiesModifierInputId, key: string) => {
      if (key === "Enter") {
        commitModifierInput(inputId);
        return "blur" as const;
      }
      if (key === "Escape") {
        port.draft?.cancel(inputId);
        return "blur" as const;
      }
      return null;
    },
    toggleAccelerationProperty: (property: AnimatableProperty) => {
      const descriptor = readEditableDescriptor();
      const modifier = descriptor?.modifiers.find(
        (candidate) => candidate.type === "acceleration"
      );
      if (!descriptor || !modifier || modifier.type !== "acceleration") {
        return null;
      }
      const properties = modifier.properties.includes(property)
        ? modifier.properties.filter((candidate) => candidate !== property)
        : [...modifier.properties, property];
      if (properties.length === 0) return null;
      return setModifiers(
        descriptor,
        descriptor.modifiers.map((candidate) =>
          candidate.modifierId === modifier.modifierId
            ? { ...modifier, properties }
            : candidate
        )
      );
    },
    setAccelerationCurve: (curve: AccelerationCurve) => {
      const descriptor = readEditableDescriptor();
      const modifier = descriptor?.modifiers.find(
        (candidate) => candidate.type === "acceleration"
      );
      if (!descriptor || !modifier || modifier.type !== "acceleration") {
        return null;
      }
      return setModifiers(
        descriptor,
        descriptor.modifiers.map((candidate) =>
          candidate.modifierId === modifier.modifierId
            ? { ...modifier, curve }
            : candidate
        )
      );
    },
    setModifiers: (modifiers: LayerModifier[]) => {
      const descriptor = readEditableDescriptor();
      return descriptor ? setModifiers(descriptor, modifiers) : null;
    },
  };
}

import {
  asAudioPropertiesDescriptor,
  readAudioPropertiesValue,
  type AudioPropertiesDescriptor,
} from "@/engines/properties/helpers/audioPropertiesHelpers";
import { readyPropertiesDescriptor } from "@/engines/properties/helpers/propertiesSelectionHelpers";
import type {
  LayerDocumentPropertiesCommandPort,
} from "@/engines/properties/models/propertiesControllerModel";
import type {
  PropertiesAudioInputId,
} from "@/engines/properties/models/propertiesEngineModel";
import type {
  PropertiesNumericDraftController,
} from "@/engines/properties/models/propertiesNumericDraftModel";

export function createAudioPropertiesController(options: {
  port: LayerDocumentPropertiesCommandPort;
  draft: PropertiesNumericDraftController;
  readScopeIdentity: () => string;
}) {
  const readDescriptor = () => asAudioPropertiesDescriptor(
    readyPropertiesDescriptor(options.port.read().descriptor)
  );
  const syncDraftScope = () => {
    const scopeIdentity = options.readScopeIdentity();
    options.draft.syncScope(scopeIdentity);
    return scopeIdentity;
  };
  const dispatch = (
    descriptor: AudioPropertiesDescriptor,
    values: Partial<Record<PropertiesAudioInputId, string>>,
    muted = descriptor.typeData.data.muted
  ) => {
    const value = (inputId: PropertiesAudioInputId) =>
      values[inputId] ?? readAudioPropertiesValue(descriptor, inputId);
    const number = (inputId: PropertiesAudioInputId) => Number(value(inputId));
    return options.port.dispatchPanel({
      kind: "set-audio-properties",
      layerDocumentId: descriptor.layerDocumentId,
      name: value("audio.name"),
      gain: number("audio.gain"),
      muted,
      startFrame: number("audio.startFrame"),
      durationFrames: number("audio.durationFrames"),
      sourceOffsetFrames: number("audio.sourceOffsetFrames"),
      fadeInFrames: number("audio.fadeInFrames"),
      fadeOutFrames: number("audio.fadeOutFrames"),
    });
  };

  const commitAudioInput = (inputId: PropertiesAudioInputId) => {
    syncDraftScope();
    const descriptor = readDescriptor();
    const state = options.draft.read();
    const rawValue = state.inputDrafts[inputId];
    if (
      !descriptor || state.focusedInputId !== inputId || rawValue === undefined
    ) return null;
    if (inputId !== "audio.name" && !Number.isFinite(Number(rawValue))) {
      options.draft.finish(inputId);
      return { ok: true as const, committed: false };
    }
    const result = dispatch(descriptor, state.inputDrafts);
    if (result.ok) options.draft.finish(inputId);
    return result.ok
      ? { ok: true as const, committed: true }
      : { ok: false as const, reason: "dispatch-failed" as const };
  };

  return {
    readDescriptor,
    focusAudioInput: (inputId: PropertiesAudioInputId) => {
      const scopeIdentity = syncDraftScope();
      const descriptor = readDescriptor();
      if (!descriptor) return false;
      options.draft.begin(
        inputId,
        readAudioPropertiesValue(descriptor, inputId),
        scopeIdentity
      );
      return true;
    },
    changeAudioInput: (inputId: PropertiesAudioInputId, value: string) => {
      syncDraftScope();
      return options.draft.change(inputId, value);
    },
    blurAudioInput: commitAudioInput,
    keyDownAudioInput: (inputId: PropertiesAudioInputId, key: string) => {
      if (key === "Escape") {
        options.draft.cancel(inputId);
        return "blur" as const;
      }
      if (key === "Enter") {
        commitAudioInput(inputId);
        return "blur" as const;
      }
      return null;
    },
    toggleAudioMuted: () => {
      const descriptor = readDescriptor();
      return descriptor
        ? dispatch(descriptor, {}, !descriptor.typeData.data.muted)
        : null;
    },
  };
}

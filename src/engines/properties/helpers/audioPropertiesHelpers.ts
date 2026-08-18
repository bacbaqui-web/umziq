import type {
  LayerDocumentPropertiesDescriptor,
} from "@/engines/properties/models/layerDocumentPropertiesModel";
import type {
  PropertiesAudioInputId,
  PropertiesAudioSectionViewModel,
} from "@/engines/properties/models/propertiesEngineModel";

export type AudioPropertiesDescriptor = LayerDocumentPropertiesDescriptor & {
  typeData: Extract<LayerDocumentPropertiesDescriptor["typeData"], { kind: "audio" }>;
};

export function asAudioPropertiesDescriptor(
  descriptor: LayerDocumentPropertiesDescriptor | null
): AudioPropertiesDescriptor | null {
  return descriptor?.typeData.kind === "audio"
    ? descriptor as AudioPropertiesDescriptor
    : null;
}

export function readAudioPropertiesValue(
  descriptor: AudioPropertiesDescriptor,
  inputId: PropertiesAudioInputId
) {
  switch (inputId) {
    case "audio.name": return descriptor.name;
    case "audio.gain": return String(descriptor.typeData.data.gain);
    case "audio.startFrame": return String(descriptor.placement.startFrame);
    case "audio.durationFrames": return String(descriptor.placement.durationFrames);
    case "audio.sourceOffsetFrames": return String(descriptor.placement.sourceOffsetFrames);
    case "audio.fadeInFrames": return String(descriptor.typeData.data.fadeInFrames);
    case "audio.fadeOutFrames": return String(descriptor.typeData.data.fadeOutFrames);
  }
}

export function buildAudioPropertiesSectionViewModel(options: {
  descriptor: LayerDocumentPropertiesDescriptor | null;
  drafts: Partial<Record<PropertiesAudioInputId, string>>;
}): PropertiesAudioSectionViewModel | null {
  const audio = asAudioPropertiesDescriptor(options.descriptor);
  if (!audio) return null;
  const value = (id: PropertiesAudioInputId) =>
    options.drafts[id] ?? readAudioPropertiesValue(audio, id);
  return {
    layerDocumentId: audio.layerDocumentId,
    muted: audio.typeData.data.muted,
    fields: [
      { id: "audio.name", label: "이름", value: value("audio.name"), numeric: false },
      { id: "audio.gain", label: "음량", value: value("audio.gain"), suffix: "x", numeric: true, step: 0.05 },
      { id: "audio.startFrame", label: "시작 프레임", value: value("audio.startFrame"), numeric: true, step: 1 },
      { id: "audio.durationFrames", label: "길이", value: value("audio.durationFrames"), suffix: "f", numeric: true, step: 1 },
      { id: "audio.sourceOffsetFrames", label: "원본 시작", value: value("audio.sourceOffsetFrames"), suffix: "f", numeric: true, step: 1 },
      { id: "audio.fadeInFrames", label: "페이드 인", value: value("audio.fadeInFrames"), suffix: "f", numeric: true, step: 1 },
      { id: "audio.fadeOutFrames", label: "페이드 아웃", value: value("audio.fadeOutFrames"), suffix: "f", numeric: true, step: 1 },
    ],
  };
}

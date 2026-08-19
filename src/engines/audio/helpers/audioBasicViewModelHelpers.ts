import type {
  AudioBasicInputId,
  AudioBasicValue,
  AudioBasicViewProps,
} from "@/engines/audio/models/audioEffectsModel";

export function readAudioBasicValue(
  value: AudioBasicValue,
  id: AudioBasicInputId
) {
  return String(value[id]);
}

export function buildAudioBasicFields(
  value: AudioBasicValue,
  draft: { readonly id: AudioBasicInputId; readonly value: string } | null
): AudioBasicViewProps["readModel"]["fields"] {
  const display = (id: AudioBasicInputId) =>
    draft?.id === id ? draft.value : readAudioBasicValue(value, id);
  return [
    { id: "name", label: "이름", value: display("name"), numeric: false },
    { id: "gain", label: "음량", value: display("gain"), suffix: "x", numeric: true, step: 0.05 },
    { id: "startFrame", label: "시작", value: display("startFrame"), suffix: "f", numeric: true, step: 1 },
    { id: "durationFrames", label: "길이", value: display("durationFrames"), suffix: "f", numeric: true, step: 1 },
    { id: "sourceOffsetFrames", label: "소스 시작", value: display("sourceOffsetFrames"), suffix: "f", numeric: true, step: 1 },
    { id: "fadeInFrames", label: "페이드 인", value: display("fadeInFrames"), suffix: "f", numeric: true, step: 1 },
    { id: "fadeOutFrames", label: "페이드 아웃", value: display("fadeOutFrames"), suffix: "f", numeric: true, step: 1 },
  ];
}

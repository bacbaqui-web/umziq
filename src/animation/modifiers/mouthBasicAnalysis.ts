import type { LayerModifier } from "@/models";

export type MouthBasicAudioBuffer = {
  readonly sampleRate: number;
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly getChannelData: (channel: number) => Float32Array;
};

type LevelPoint = { readonly time: number; readonly level: number };
type SpeechSegment = { readonly start: number; readonly end: number };

const WINDOW_MS = 20;
const HOP_MS = 10;
const SMOOTHING_MS = 80;
const END_HOLD_MS = 80;
const MERGE_GAP_MS = 180;
const MINIMUM_SPEECH_MS = 100;
const TOGGLES_PER_SECOND = 8;

function percentile(values: readonly number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] ?? 0;
}

function extractLevels(buffer: MouthBasicAudioBuffer): LevelPoint[] {
  const windowSamples = Math.max(1, Math.round(WINDOW_MS * buffer.sampleRate / 1000));
  const hopSamples = Math.max(1, Math.round(HOP_MS * buffer.sampleRate / 1000));
  const channels = Array.from({ length: Math.max(1, buffer.numberOfChannels) }, (_, index) => buffer.getChannelData(index));
  const sampleCount = channels[0]?.length ?? 0;
  const raw: LevelPoint[] = [];
  for (let start = 0; start < sampleCount; start += hopSamples) {
    const end = Math.min(sampleCount, start + windowSamples);
    let sum = 0;
    let count = 0;
    for (let sample = start; sample < end; sample += 1) {
      for (const channel of channels) {
        const value = channel[sample] ?? 0;
        sum += value * value;
        count += 1;
      }
    }
    raw.push({ time: start / buffer.sampleRate, level: Math.sqrt(sum / Math.max(1, count)) });
  }
  const radius = Math.max(0, Math.round((SMOOTHING_MS / 2) / HOP_MS));
  return raw.map((point, index) => {
    let sum = 0;
    let weights = 0;
    for (let cursor = Math.max(0, index - radius); cursor <= Math.min(raw.length - 1, index + radius); cursor += 1) {
      const weight = radius + 1 - Math.abs(index - cursor);
      sum += (raw[cursor]?.level ?? 0) * weight;
      weights += weight;
    }
    return { time: point.time, level: sum / Math.max(1, weights) };
  });
}

function detectSpeech(levels: readonly LevelPoint[], duration: number): SpeechSegment[] {
  const values = levels.map((point) => point.level);
  const noise = percentile(values, 0.2);
  const high = percentile(values, 0.9);
  const range = Math.max(0, high - noise);
  const startThreshold = noise + range * 0.35;
  const endThreshold = noise + range * 0.18;
  if (startThreshold <= 0) return [];
  const initial: SpeechSegment[] = [];
  let speaking = false;
  let start = 0;
  let belowSince = -1;
  for (const point of levels) {
    if (!speaking && point.level >= startThreshold) {
      speaking = true;
      start = point.time;
      belowSince = -1;
    } else if (speaking && point.level < endThreshold) {
      if (belowSince < 0) belowSince = point.time;
      if ((point.time - belowSince) * 1000 >= END_HOLD_MS) {
        initial.push({ start, end: belowSince });
        speaking = false;
        belowSince = -1;
      }
    } else if (speaking) {
      belowSince = -1;
    }
  }
  if (speaking) initial.push({ start, end: duration });
  const merged: SpeechSegment[] = [];
  for (const segment of initial) {
    const last = merged[merged.length - 1];
    if (last && (segment.start - last.end) * 1000 <= MERGE_GAP_MS) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, segment.end) };
    } else {
      merged.push(segment);
    }
  }
  return merged.filter((segment) => (segment.end - segment.start) * 1000 >= MINIMUM_SPEECH_MS);
}

export function analyzeMouthBasicTransitions(buffer: MouthBasicAudioBuffer, frameRate: number) {
  const safeFrameRate = Math.max(1, frameRate);
  const durationFrames = Math.max(1, Math.ceil(buffer.duration * safeFrameRate));
  const toggleInterval = Math.max(1, Math.round(safeFrameRate / TOGGLES_PER_SECOND));
  const transitions: number[] = [];
  for (const segment of detectSpeech(extractLevels(buffer), buffer.duration)) {
    const start = Math.max(0, Math.floor(segment.start * safeFrameRate));
    const end = Math.min(durationFrames, Math.max(start + 1, Math.ceil(segment.end * safeFrameRate)));
    transitions.push(start);
    let toggles = 1;
    for (let frame = start + toggleInterval; frame < end; frame += toggleInterval) {
      transitions.push(frame);
      toggles += 1;
    }
    if (toggles % 2 === 1) transitions.push(end);
  }
  return { durationFrames, transitionFrames: [...new Set(transitions)].sort((left, right) => left - right) };
}

export function evaluateMouthBasicOpacity(
  modifier: Extract<LayerModifier, { type: "mouth-basic" }>,
  localFrame: number
) {
  const relativeFrame = localFrame - modifier.startFrame;
  if (!modifier.enabled || relativeFrame < 0 || relativeFrame >= modifier.durationFrames) return 100;
  let toggles = 0;
  for (const frame of modifier.transitionFrames) {
    if (frame > relativeFrame) break;
    toggles += 1;
  }
  return toggles % 2 === 1 ? 0 : 100;
}

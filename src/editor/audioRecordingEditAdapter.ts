import type { LibraryRecordingEditRequest } from "@/engines/library";

function safeFileStem(value: string) {
  const trimmed = value.trim().replace(/[\\/:*?"<>|]/g, "-");
  return trimmed || "움직_녹음";
}

function mergeRanges(
  ranges: readonly { readonly startSeconds: number; readonly endSeconds: number }[],
  start: number,
  end: number
) {
  const normalized = ranges
    .map((range) => ({
      startSeconds: Math.max(start, Math.min(end, range.startSeconds)),
      endSeconds: Math.max(start, Math.min(end, range.endSeconds)),
    }))
    .filter((range) => range.endSeconds - range.startSeconds > 0.001)
    .sort((left, right) => left.startSeconds - right.startSeconds);
  const merged: { startSeconds: number; endSeconds: number }[] = [];
  for (const range of normalized) {
    const previous = merged.at(-1);
    if (previous && range.startSeconds <= previous.endSeconds) {
      previous.endSeconds = Math.max(previous.endSeconds, range.endSeconds);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeWav(
  channels: readonly Float32Array[],
  sampleRate: number,
  gain: number
) {
  const channelCount = channels.length;
  const sampleCount = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const dataLength = sampleCount * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const value = Math.max(
        -1,
        Math.min(1, (channels[channel]?.[sample] ?? 0) * gain)
      );
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function downmixRecordingToMono(
  decoded: AudioBuffer,
  sampleRanges: readonly { readonly from: number; readonly to: number }[],
  totalSamples: number
) {
  const sources = Array.from(
    { length: decoded.numberOfChannels },
    (_, channelIndex) => decoded.getChannelData(channelIndex)
  );
  const energies = sources.map((source) => {
    let sum = 0;
    let count = 0;
    for (const range of sampleRanges) {
      for (let index = range.from; index < range.to; index += 1) {
        const value = source[index] ?? 0;
        sum += value * value;
        count += 1;
      }
    }
    return count > 0 ? Math.sqrt(sum / count) : 0;
  });
  const strongestIndex = energies.reduce(
    (best, energy, index) => energy > energies[best] ? index : best,
    0
  );
  const strongest = energies[strongestIndex] ?? 0;
  const otherEnergy = energies.reduce(
    (sum, energy, index) => index === strongestIndex ? sum : sum + energy,
    0
  );
  const useStrongestOnly = sources.length > 1 && strongest > otherEnergy * 4;
  const output = new Float32Array(totalSamples);
  let outputOffset = 0;
  for (const range of sampleRanges) {
    for (let index = range.from; index < range.to; index += 1) {
      output[outputOffset] = useStrongestOnly
        ? sources[strongestIndex]?.[index] ?? 0
        : sources.reduce((sum, source) => sum + (source[index] ?? 0), 0) / sources.length;
      outputOffset += 1;
    }
  }
  return [output] as const;
}

export async function editRecordedAudioFile(
  file: File,
  request: LibraryRecordingEditRequest
) {
  const Constructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Constructor) throw new Error("이 브라우저에서는 녹음 편집을 사용할 수 없습니다.");
  const context = new Constructor();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    const start = Math.max(0, Math.min(decoded.duration, request.trimStartSeconds));
    const end = Math.max(start, Math.min(decoded.duration, request.trimEndSeconds));
    const removed = mergeRanges(request.removedRanges, start, end);
    const kept: { startSeconds: number; endSeconds: number }[] = [];
    let cursor = start;
    for (const range of removed) {
      if (range.startSeconds > cursor) {
        kept.push({ startSeconds: cursor, endSeconds: range.startSeconds });
      }
      cursor = Math.max(cursor, range.endSeconds);
    }
    if (cursor < end) kept.push({ startSeconds: cursor, endSeconds: end });
    const sampleRanges = kept.map((range) => {
      const from = Math.max(
        0,
        Math.min(decoded.length, Math.round(range.startSeconds * decoded.sampleRate))
      );
      const to = Math.max(
        from,
        Math.min(decoded.length, Math.round(range.endSeconds * decoded.sampleRate))
      );
      return { from, to };
    });
    const totalSamples = sampleRanges.reduce(
      (sum, range) => sum + range.to - range.from,
      0
    );
    if (totalSamples < 1) throw new Error("남아 있는 녹음 구간이 없습니다.");
    const channels = downmixRecordingToMono(decoded, sampleRanges, totalSamples);
    const gain = 10 ** (Math.max(-48, Math.min(24, request.gainDb)) / 20);
    const wav = encodeWav(channels, decoded.sampleRate, gain);
    return new File([wav], `${safeFileStem(request.name)}.wav`, {
      type: "audio/wav",
      lastModified: Date.now(),
    });
  } finally {
    await context.close();
  }
}

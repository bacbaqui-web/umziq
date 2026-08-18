import assert from "node:assert/strict";
import { editRecordedAudioFile } from "@/editor/audioRecordingEditAdapter";

const originalAudioContext = Object.getOwnPropertyDescriptor(
  globalThis,
  "AudioContext"
);
let closes = 0;
const samples = new Float32Array(1_000);
samples.fill(0.5);
let decodedChannels: readonly Float32Array[] = [samples];

class FakeAudioContext {
  async decodeAudioData() {
    return {
      duration: 1,
      numberOfChannels: decodedChannels.length,
      sampleRate: 1_000,
      length: samples.length,
      getChannelData: (channel: number) => decodedChannels[channel],
    } as AudioBuffer;
  }

  async close() {
    closes += 1;
  }
}

Object.defineProperty(globalThis, "AudioContext", {
  configurable: true,
  value: FakeAudioContext,
});

try {
  const edited = await editRecordedAudioFile(
    new File(["temporary recording"], "temporary.webm", {
      type: "audio/webm",
    }),
    {
      name: "움직_녹음_260818_123456",
      trimStartSeconds: 0.1,
      trimEndSeconds: 0.9,
      gainDb: 0,
      removedRanges: [
        { startSeconds: 0.4, endSeconds: 0.6 },
      ],
    }
  );
  assert.equal(edited.name, "움직_녹음_260818_123456.wav");
  assert.equal(edited.type, "audio/wav");
  assert.equal(
    edited.size,
    44 + 600 * 2,
    "0.8 second trim minus 0.2 second deletion leaves 0.6 second PCM"
  );
  const header = new Uint8Array(await edited.arrayBuffer());
  assert.equal(new TextDecoder().decode(header.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(header.slice(8, 12)), "WAVE");
  assert.equal(
    new DataView(header.buffer, header.byteOffset, header.byteLength).getUint16(22, true),
    1,
    "confirmed voice recordings are stored as centered mono WAV files"
  );

  const sanitized = await editRecordedAudioFile(
    new File(["temporary recording"], "temporary.webm", {
      type: "audio/webm",
    }),
    {
      name: "  test/name:*?  ",
      trimStartSeconds: 0,
      trimEndSeconds: 1,
      gainDb: 0,
      removedRanges: [],
    }
  );
  assert.equal(sanitized.name, "test-name---.wav");
  const fractionalBoundary = await editRecordedAudioFile(
    new File(["temporary recording"], "temporary.webm", {
      type: "audio/webm",
    }),
    {
      name: "fractional-boundary",
      trimStartSeconds: 0.0004,
      trimEndSeconds: 0.0016,
      gainDb: 0,
      removedRanges: [],
    }
  );
  assert.equal(
    fractionalBoundary.size,
    44 + 2 * 2,
    "rounded source boundaries allocate the exact copied sample count"
  );
  const amplified = await editRecordedAudioFile(
    new File(["temporary recording"], "temporary.webm", {
      type: "audio/webm",
    }),
    {
      name: "amplified",
      trimStartSeconds: 0,
      trimEndSeconds: 1,
      gainDb: 6.0206,
      removedRanges: [],
    }
  );
  const amplifiedView = new DataView(await amplified.arrayBuffer());
  assert.equal(
    amplifiedView.getInt16(44, true),
    0x7fff,
    "the selected recording gain is baked into the confirmed WAV"
  );
  const silent = new Float32Array(samples.length);
  decodedChannels = [samples, silent];
  const leftOnlyInput = await editRecordedAudioFile(
    new File(["left-only recording"], "left-only.webm", {
      type: "audio/webm",
    }),
    {
      name: "centered-mono",
      trimStartSeconds: 0,
      trimEndSeconds: 1,
      gainDb: 0,
      removedRanges: [],
    }
  );
  const leftOnlyView = new DataView(await leftOnlyInput.arrayBuffer());
  assert.equal(leftOnlyView.getUint16(22, true), 1);
  assert.equal(
    leftOnlyView.getInt16(44, true),
    Math.floor(0.5 * 0x7fff),
    "a one-sided stereo microphone recording keeps its voice level when centered to mono"
  );
  assert.equal(closes, 5, "each edit closes its decode AudioContext");
} finally {
  if (originalAudioContext) {
    Object.defineProperty(globalThis, "AudioContext", originalAudioContext);
  } else {
    delete (globalThis as { AudioContext?: unknown }).AudioContext;
  }
}

console.log("Audio recording edit verification passed");

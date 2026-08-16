import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { LayerEffect } from "@/models";
import { buildEffectChain, createBrowserAudioAuditionBackend } from "@/editor/audio-runtime/browserAudioAuditionBackend";
import { createNoiseGateEnvelope, processNoiseGateChannels, resolveNoiseGateSettings } from "@/editor/audio-runtime/noiseGateDsp";

const effect = (effectId: string, enabled = true, parameters = { strength: 0.5 }): LayerEffect => ({
  effectId, type: "noise-gate", enabled, parameters,
});

assert.deepEqual(resolveNoiseGateSettings(effect("gate", true, {
  strength: 2, thresholdDb: -100, attack: 0, release: 3, floorDb: -120,
})), { thresholdDb: -80, attackSeconds: 0.001, releaseSeconds: 1, floorDb: -96 });

const envelope = createNoiseGateEnvelope({ thresholdDb: -20, attackSeconds: 0.002, releaseSeconds: 0.02, floorDb: -40 }, 1_000);
const quietInput = new Float32Array(40).fill(0.01);
const quietOutput = new Float32Array(40);
processNoiseGateChannels([quietInput], [quietOutput], envelope);
assert.ok(Math.abs(quietOutput.at(-1)!) < 0.00011, "low-level input settles at the floor");
const speechInput = new Float32Array(20).fill(0.5);
const speechOutput = new Float32Array(20);
processNoiseGateChannels([speechInput], [speechOutput], envelope);
assert.ok(speechOutput[0]! > quietOutput.at(-1)!, "attack opens progressively");
assert.ok(speechOutput.at(-1)! > 0.49, "speech above threshold opens the gate");
const tailInput = new Float32Array(4).fill(0.01);
const tailOutput = new Float32Array(4);
processNoiseGateChannels([tailInput], [tailOutput], envelope);
assert.ok(tailOutput[0]! > 0.005, "release prevents an abrupt word-tail cut");
assert.ok(tailOutput[3]! < tailOutput[0]!, "release closes progressively");

type FakeNode = {
  channelCount: number;
  connected: FakeNode[];
  disconnected: boolean;
  onaudioprocess: ((event: AudioProcessingEvent) => void) | null;
  connect(node: FakeNode): FakeNode;
  disconnect(): void;
};
const node = (): FakeNode => ({
  channelCount: 1, connected: [], disconnected: false, onaudioprocess: null,
  connect(target) { this.connected.push(target); return target; },
  disconnect() { this.disconnected = true; },
});
const processors: FakeNode[] = [];
const context = {
  sampleRate: 48_000,
  createScriptProcessor: () => { const processor = node(); processors.push(processor); return processor; },
} as unknown as AudioContext;
const input = node();
const graph = buildEffectChain(context, input as unknown as AudioNode, [effect("first"), effect("bypassed", false), effect("second")]);
assert.equal(processors.length, 2, "bypassed gates create no processing node");
assert.equal(input.connected[0], processors[0], "first enabled gate preserves order");
assert.equal(processors[0]!.connected[0], processors[1], "second gate follows the first");
assert.equal(graph.output, processors[1] as unknown as AudioNode);
assert.equal(typeof processors[0]!.onaudioprocess, "function");
graph.disconnect();
assert.equal(processors[0]!.onaudioprocess, null, "cleanup releases callbacks");
assert.equal(processors[1]!.onaudioprocess, null);
assert.equal(processors.every((processor) => processor.disconnected), true);

const browserBackendSource = readFileSync(new URL("../src/editor/audio-runtime/browserAudioAuditionBackend.ts", import.meta.url), "utf8");
assert.match(browserBackendSource, /audioWorklet\.addModule\(url\)/, "browser path prepares an AudioWorklet module");
assert.match(browserBackendSource, /finally \{\s*URL\.revokeObjectURL\(url\)/, "worklet Blob URL is always released");
assert.match(browserBackendSource, /prepareNoiseGateWorklet\)\(context\)\.then\([\s\S]*\(\) => begin\(undefined, true\)/, "CSP/module failure falls back without stopping playback");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
function backendHarness() {
  const source = Object.assign(node(), {
    buffer: null as unknown,
    onended: null as (() => void) | null,
    starts: [] as number[],
    stops: 0,
    throwOnStart: false,
    start(_when: number, offset: number) {
      if (this.throwOnStart) throw new Error("start failed");
      this.starts.push(offset);
    },
    stop() { this.stops += 1; },
  });
  const gainNode = Object.assign(node(), { gain: { value: 0 } });
  const destination = node();
  const fakeContext = {
    currentTime: 0,
    sampleRate: 48_000,
    destination,
    closeCount: 0,
    createBufferSource: () => source,
    createGain: () => gainNode,
    close() { this.closeCount += 1; return Promise.resolve(); },
  } as unknown as AudioContext & { currentTime: number; closeCount: number };
  return { source, gainNode, context: fakeContext };
}
const gateEffect = effect("deferred-gate");
const fakeResource = {
  sourceId: "audio", fingerprint: "audio:fingerprint", decodedAudio: {},
  metadata: { durationSeconds: 1, channelCount: 1, sampleRate: 48_000 },
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const workletNodeFactory = () => node() as unknown as AudioNode;

{
  const harness = backendHarness();
  const preparation = deferred<((effect: LayerEffect) => AudioNode) | null>();
  let ended = 0;
  const backend = createBrowserAudioAuditionBackend({
    createContext: () => harness.context,
    isAudioBuffer: () => true,
    prepareNoiseGate: () => preparation.promise,
  });
  const handle = backend.start({ resource: fakeResource, offsetSeconds: 0.2, gain: 1, effects: [gateEffect], onEnded: () => { ended += 1; } });
  harness.context.currentTime = 0.3;
  assert.equal(handle.readPositionSeconds(), 0.5, "position advances continuously while Worklet prepares");
  preparation.resolve(workletNodeFactory);
  await flush();
  assert.equal(harness.source.starts[0], 0.5, "deferred start catches up by preparation elapsed time");
  harness.context.currentTime = 0.4;
  assert.ok(Math.abs(handle.readPositionSeconds() - 0.6) < 1e-9, "position remains continuous after source start");
  assert.equal(ended, 0);
  handle.stop();
}

{
  const harness = backendHarness();
  const preparation = deferred<((effect: LayerEffect) => AudioNode) | null>();
  let ended = 0;
  const handle = createBrowserAudioAuditionBackend({
    createContext: () => harness.context, isAudioBuffer: () => true, prepareNoiseGate: () => preparation.promise,
  }).start({ resource: fakeResource, offsetSeconds: 0, gain: 1, effects: [gateEffect], onEnded: () => { ended += 1; } });
  handle.stop();
  preparation.resolve(workletNodeFactory);
  await flush();
  assert.equal(harness.source.starts.length, 0, "stop before Worklet resolution never starts the source");
  assert.equal(harness.context.closeCount, 1);
  assert.equal(ended, 0, "manual stop does not emit ended");
}

{
  const harness = backendHarness();
  const preparation = deferred<((effect: LayerEffect) => AudioNode) | null>();
  let ended = 0;
  createBrowserAudioAuditionBackend({
    createContext: () => harness.context, isAudioBuffer: () => true, prepareNoiseGate: () => preparation.promise,
  }).start({ resource: fakeResource, offsetSeconds: 0.9, gain: 1, effects: [gateEffect], onEnded: () => { ended += 1; } });
  harness.context.currentTime = 0.2;
  preparation.resolve(workletNodeFactory);
  await flush();
  assert.equal(harness.source.starts.length, 0, "elapsed preparation beyond duration does not call source.start");
  assert.equal(ended, 1);
  assert.equal(harness.context.closeCount, 1);
}

{
  const harness = backendHarness();
  harness.source.throwOnStart = true;
  const preparation = deferred<((effect: LayerEffect) => AudioNode) | null>();
  let ended = 0;
  createBrowserAudioAuditionBackend({
    createContext: () => harness.context, isAudioBuffer: () => true, prepareNoiseGate: () => preparation.promise,
  }).start({ resource: fakeResource, offsetSeconds: 0, gain: 1, effects: [gateEffect], onEnded: () => { ended += 1; } });
  preparation.resolve(workletNodeFactory);
  await flush();
  assert.equal(ended, 1, "asynchronous source.start failure ends the handle exactly once");
  assert.equal(harness.context.closeCount, 1);
  assert.equal(harness.source.disconnected, true);
}

console.log("Noise Gate DSP verification passed");

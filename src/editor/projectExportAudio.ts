import type { LayerDocumentProject, LayerEffect } from "@/models";
import { buildEffectChain, prepareNoiseGateWorklet } from "@/editor/audio-runtime/browserAudioAuditionBackend";

export interface ProjectExportAudioResource {
  readonly decodedAudio: unknown;
  readonly metadata: { readonly durationSeconds: number; readonly channelCount: number; readonly sampleRate: number };
}

export interface ProjectExportAudioClip {
  readonly layerDocumentId: string;
  readonly startSeconds: number;
  readonly offsetSeconds: number;
  readonly durationSeconds: number;
  readonly gain: number;
  readonly initialGain: number;
  readonly finalGain: number;
  readonly fadeInEndSeconds: number | null;
  readonly fadeOutStartSeconds: number | null;
  readonly effects: readonly LayerEffect[];
  readonly resource: ProjectExportAudioResource;
}

export function buildProjectExportAudioClips(options: {
  readonly project: LayerDocumentProject;
  readonly exportGroupLayerDocumentId: string;
  readonly durationFrames: number;
  readonly frameRate: number;
  readonly resolveAudioResource: (sourceId: string) => ProjectExportAudioResource | null;
}) {
  const clips: ProjectExportAudioClip[] = [];
  const frameRate = Math.max(1, options.frameRate);
  const exportEnd = Math.max(0, options.durationFrames);
  const visit = (parentId: string, parentStart: number, parentClipStart: number, parentClipEnd: number) => {
    Object.values(options.project.payload.layerDocumentsById)
      .filter((layer) => layer.common.placement.parentLayerDocumentId === parentId)
      .sort((left, right) => left.common.placement.order - right.common.placement.order)
      .forEach((layer) => {
        const placement = layer.common.placement;
        if (!placement.visible) return;
        const absoluteStart = parentStart + placement.startFrame;
        const absoluteEnd = absoluteStart + placement.durationFrames;
        const clipStart = Math.max(0, parentClipStart, absoluteStart);
        const clipEnd = Math.min(exportEnd, parentClipEnd, absoluteEnd);
        if (clipEnd <= clipStart) return;
        if (layer.type === "group") {
          visit(layer.layerDocumentId, absoluteStart, clipStart, clipEnd);
          return;
        }
        if (layer.type !== "audio" || layer.data.muted || layer.data.gain <= 0) return;
        const sourceId = layer.common.source?.sourceId;
        if (!sourceId) throw new Error(`오디오 원본 연결이 없습니다: ${layer.name}`);
        const resource = options.resolveAudioResource(sourceId);
        if (!resource) throw new Error(`오디오 원본을 불러올 수 없습니다: ${layer.name}`);
        const clippedFromStart = clipStart - absoluteStart;
        const offsetSeconds = (placement.sourceOffsetFrames + clippedFromStart) / frameRate;
        const durationSeconds = Math.min(
          (clipEnd - clipStart) / frameRate,
          resource.metadata.durationSeconds - offsetSeconds,
        );
        if (durationSeconds <= 0) return;
        const localStartFrame = clippedFromStart;
        const localEndFrame = localStartFrame + durationSeconds * frameRate;
        const gainAt = (frame: number) => {
          const fadeIn = layer.data.fadeInFrames > 0 ? Math.min(1, frame / layer.data.fadeInFrames) : 1;
          const remaining = Math.max(0, placement.durationFrames - frame);
          const fadeOut = layer.data.fadeOutFrames > 0 ? Math.min(1, remaining / layer.data.fadeOutFrames) : 1;
          return layer.data.gain * Math.min(fadeIn, fadeOut);
        };
        const fadeInEndFrame = layer.data.fadeInFrames;
        const fadeOutStartFrame = placement.durationFrames - layer.data.fadeOutFrames;
        clips.push({
          layerDocumentId: layer.layerDocumentId,
          startSeconds: clipStart / frameRate,
          offsetSeconds,
          durationSeconds,
          gain: layer.data.gain,
          initialGain: gainAt(localStartFrame),
          finalGain: gainAt(localEndFrame),
          fadeInEndSeconds: fadeInEndFrame > localStartFrame && fadeInEndFrame < localEndFrame
            ? (fadeInEndFrame - localStartFrame) / frameRate : null,
          fadeOutStartSeconds: fadeOutStartFrame > localStartFrame && fadeOutStartFrame < localEndFrame
            ? (fadeOutStartFrame - localStartFrame) / frameRate : null,
          effects: structuredClone(layer.common.effects),
          resource,
        });
      });
  };
  visit(options.exportGroupLayerDocumentId, 0, 0, exportEnd);
  return clips;
}

export interface ProjectExportAudioMix {
  readonly stream: MediaStream;
  readonly context: AudioContext;
  readonly schedule: (exportStartTime: number) => void;
  readonly dispose: () => void;
}

export async function createProjectExportAudioMix(
  clips: readonly ProjectExportAudioClip[],
): Promise<ProjectExportAudioMix | null> {
  if (clips.length === 0) return null;
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Context) throw new Error("이 브라우저는 오디오가 포함된 영상 출력을 지원하지 않습니다.");
  if (typeof AudioBuffer === "undefined") throw new Error("오디오 원본을 읽을 수 없습니다.");
  const context = new Context();
  await context.resume();
  const destination = context.createMediaStreamDestination();
  const hasNoiseGate = clips.some((clip) => clip.effects.some((effect) => effect.enabled && effect.type === "noise-gate"));
  const noiseGateFactory = hasNoiseGate ? await prepareNoiseGateWorklet(context).catch(() => null) : null;
  const resources: Array<{ source: AudioBufferSourceNode; gain: GainNode; disconnect: () => void }> = [];
  let disposed = false;
  try {
    clips.forEach((clip) => {
      if (!(clip.resource.decodedAudio instanceof AudioBuffer)) {
        throw new Error(`오디오 원본을 디코딩할 수 없습니다: ${clip.layerDocumentId}`);
      }
      const source = context.createBufferSource();
      source.buffer = clip.resource.decodedAudio;
      const effectGraph = buildEffectChain(context, source, clip.effects, {
        createNoiseGateNode: noiseGateFactory ?? undefined,
      });
      const gain = context.createGain();
      effectGraph.output.connect(gain).connect(destination);
      resources.push({
        source,
        gain,
        disconnect: () => {
          source.onended = null;
          try { source.stop(); } catch { /* not scheduled or already ended */ }
          try { source.disconnect(); } catch { /* best effort */ }
          effectGraph.disconnect();
          try { gain.disconnect(); } catch { /* best effort */ }
        },
      });
    });
  } catch (error) {
    resources.forEach((resource) => resource.disconnect());
    destination.disconnect();
    void context.close();
    throw error;
  }
  return {
    stream: destination.stream,
    context,
    schedule: (exportStartTime) => {
      if (disposed) return;
      clips.forEach((clip, index) => {
        const entry = resources[index]!;
        const when = exportStartTime + clip.startSeconds;
        entry.gain.gain.cancelScheduledValues(when);
        entry.gain.gain.setValueAtTime(clip.initialGain, when);
        if (clip.fadeInEndSeconds !== null) entry.gain.gain.linearRampToValueAtTime(clip.gain, when + clip.fadeInEndSeconds);
        if (clip.fadeOutStartSeconds !== null) entry.gain.gain.setValueAtTime(clip.gain, when + clip.fadeOutStartSeconds);
        entry.gain.gain.linearRampToValueAtTime(clip.finalGain, when + clip.durationSeconds);
        entry.gain.gain.setValueAtTime(0, when + clip.durationSeconds + 1 / context.sampleRate);
        entry.source.start(when, clip.offsetSeconds, clip.durationSeconds);
      });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      resources.forEach((resource) => resource.disconnect());
      destination.disconnect();
      destination.stream.getTracks().forEach((track) => track.stop());
      void context.close();
    },
  };
}

export function combineProjectExportStreams(video: MediaStream, audio: MediaStream | null) {
  return new MediaStream([
    ...video.getVideoTracks(),
    ...(audio?.getAudioTracks() ?? []),
  ]);
}

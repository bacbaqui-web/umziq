import type { AudioLayerDocument, LayerDocumentProject } from "@/models";
import type {
  EditorAudioAuditionBackend,
  EditorAudioAuditionBackendHandle,
  EditorAudioAuditionCommandResult,
  EditorAudioAuditionState,
  EditorAudioRuntimePort,
} from "@/editor/audio-runtime/editorAudioRuntimeModel";
import type { LayerDocumentAudioRuntimePort } from "@/engines/project";

export function createEditorAudioRuntime(options: {
  resources: LayerDocumentAudioRuntimePort;
  backend: EditorAudioAuditionBackend;
}): EditorAudioRuntimePort {
  const listeners = new Set<() => void>();
  let project: LayerDocumentProject | null = null;
  let handle: EditorAudioAuditionBackendHandle | null = null;
  let active: {
    layerDocumentId: string;
    sourceId: string;
    durationSeconds: number;
    gain: number;
    muted: boolean;
  } | null = null;
  let disposed = false;
  let auditionGeneration = 0;
  const timelineHandles = new Map<string, {
    sourceId: string;
    handle: EditorAudioAuditionBackendHandle;
  }>();
  let timelineFrame: number | null = null;
  const waveformCache = new Map<string, readonly number[]>();
  const notify = () => listeners.forEach((listener) => listener());
  const read = (): EditorAudioAuditionState => active && handle
    ? {
        status: "playing",
        ...active,
        positionSeconds: Math.min(
          active.durationSeconds,
          Math.max(0, handle.readPositionSeconds())
        ),
      }
    : { status: "idle" };
  const stop = (): EditorAudioAuditionState => {
    auditionGeneration += 1;
    const previous = handle;
    handle = null;
    active = null;
    try { previous?.stop(); } catch { /* best effort */ }
    if (previous) notify();
    return read();
  };
  const stopTimeline = (layerDocumentId?: string) => {
    const entries = layerDocumentId
      ? [[layerDocumentId, timelineHandles.get(layerDocumentId)] as const]
      : [...timelineHandles.entries()];
    entries.forEach(([id, entry]) => {
      if (!entry) return;
      timelineHandles.delete(id);
      try { entry.handle.stop(); } catch { /* best effort */ }
    });
    if (!layerDocumentId) timelineFrame = null;
  };
  const start = (
    targetProject: LayerDocumentProject,
    layer: AudioLayerDocument,
    offsetSeconds: number
  ): EditorAudioAuditionCommandResult => {
    const sourceId = layer.common.source?.sourceId;
    const resource = sourceId ? options.resources.resolve(sourceId) : null;
    if (!sourceId || !resource) {
      return { ok: false, reason: "source-unavailable", message: "Decoded Audio source is unavailable" };
    }
    stop();
    const gain = layer.data.muted ? 0 : layer.data.gain;
    const clampedOffset = Math.min(resource.metadata.durationSeconds, Math.max(0, offsetSeconds));
    try {
      const generation = auditionGeneration + 1;
      auditionGeneration = generation;
      const nextHandle: EditorAudioAuditionBackendHandle = options.backend.start({
        resource, offsetSeconds: clampedOffset, gain,
        onEnded: () => {
          if (auditionGeneration !== generation) return;
          handle = null;
          active = null;
          notify();
        },
      });
      project = targetProject;
      handle = nextHandle;
      active = {
        layerDocumentId: layer.layerDocumentId,
        sourceId,
        durationSeconds: resource.metadata.durationSeconds,
        gain: layer.data.gain,
        muted: layer.data.muted,
      };
      notify();
      return { ok: true, state: read() };
    } catch (error) {
      return {
        ok: false, reason: "backend-failed",
        message: error instanceof Error ? error.message : "Audio backend failed",
      };
    }
  };
  const play: EditorAudioRuntimePort["play"] = (command) => {
    if (disposed) return { ok: false, reason: "backend-failed", message: "Audio runtime is disposed" };
    const layer = command.project.payload.layerDocumentsById[command.layerDocumentId];
    if (!layer) return { ok: false, reason: "layer-not-found", message: "Audio Layer not found" };
    if (layer.type !== "audio") return { ok: false, reason: "type-mismatch", message: "Layer is not Audio" };
    return start(command.project, layer, command.offsetSeconds ?? 0);
  };
  const reconcileProject = (nextProject: LayerDocumentProject) => {
    project = nextProject;
    [...timelineHandles.entries()].forEach(([id, entry]) => {
      const timelineLayer = nextProject.payload.layerDocumentsById[id];
      if (
        !timelineLayer ||
        timelineLayer.type !== "audio" ||
        timelineLayer.data.muted ||
        !timelineLayer.common.placement.visible ||
        timelineLayer.common.source?.sourceId !== entry.sourceId
      ) stopTimeline(id);
    });
    if (!active || !handle) return;
    const layer = nextProject.payload.layerDocumentsById[active.layerDocumentId];
    const sourceId = layer?.common.source?.sourceId;
    if (!layer || layer.type !== "audio" || sourceId !== active.sourceId || !options.resources.resolve(active.sourceId)) {
      stop();
      return;
    }
    const gain = layer.data.muted ? 0 : layer.data.gain;
    if (gain !== (active.muted ? 0 : active.gain)) handle.setGain(gain);
    active = { ...active, gain: layer.data.gain, muted: layer.data.muted };
    notify();
  };
  return {
    resources: options.resources,
    read,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play,
    stop,
    seek: (seconds) => {
      if (!active || !project) {
        return { ok: false, reason: "layer-not-found", message: "No active Audio audition" };
      }
      const layer = project.payload.layerDocumentsById[active.layerDocumentId];
      if (!layer || layer.type !== "audio") {
        stop();
        return { ok: false, reason: "layer-not-found", message: "Active Audio Layer no longer exists" };
      }
      return start(project, layer, seconds);
    },
    readWaveform: (sourceId, bins) => {
      const resource = options.resources.resolve(sourceId);
      const size = Math.max(1, Math.floor(bins));
      if (!resource) return [];
      const key = `${sourceId}:${resource.fingerprint}:${size}`;
      const cached = waveformCache.get(key);
      if (cached) return cached;
      const decoded = resource.decodedAudio as { numberOfChannels?: number; length?: number; getChannelData?: (channel: number) => Float32Array };
      if (!decoded.getChannelData || !decoded.length || !decoded.numberOfChannels) return [];
      const peaks = Array.from({ length: size }, (_, bin) => {
        const start = Math.floor(bin * decoded.length! / size);
        const end = Math.max(start + 1, Math.floor((bin + 1) * decoded.length! / size));
        let peak = 0;
        for (let channel = 0; channel < decoded.numberOfChannels!; channel += 1) {
          const samples = decoded.getChannelData!(channel);
          for (let index = start; index < Math.min(end, samples.length); index += 1) {
            peak = Math.max(peak, Math.abs(samples[index] ?? 0));
          }
        }
        return peak;
      });
      waveformCache.set(key, peaks);
      return peaks;
    },
    synchronizeTimeline: ({ project: nextProject, activeGroupLayerDocumentId, currentFrame, frameRate, isPlaying }) => {
      project = nextProject;
      if (!isPlaying || disposed) {
        stopTimeline();
        return;
      }
      if (active) stop();
      const discontinuity = timelineFrame !== null && currentFrame !== timelineFrame + 1;
      if (discontinuity) stopTimeline();
      timelineFrame = currentFrame;
      const eligible = Object.values(nextProject.payload.layerDocumentsById).flatMap((layer) => {
        if (layer.type !== "audio" || layer.common.placement.parentLayerDocumentId !== activeGroupLayerDocumentId || !layer.common.placement.visible || layer.data.muted) return [];
        const placement = layer.common.placement;
        if (currentFrame < placement.startFrame || currentFrame >= placement.startFrame + placement.durationFrames) return [];
        const sourceId = placement.sourceOffsetFrames >= 0 ? layer.common.source?.sourceId : null;
        const resource = sourceId ? options.resources.resolve(sourceId) : null;
        if (!sourceId || !resource) return [];
        return [{ layer, sourceId, resource }];
      });
      const eligibleIds = new Set(eligible.map(({ layer }) => layer.layerDocumentId));
      [...timelineHandles.keys()].forEach((id) => {
        if (!eligibleIds.has(id)) stopTimeline(id);
      });
      eligible.forEach(({ layer, sourceId, resource }) => {
        const placement = layer.common.placement;
        const localFrame = currentFrame - placement.startFrame;
        const fadeIn = layer.data.fadeInFrames > 0 ? Math.min(1, localFrame / layer.data.fadeInFrames) : 1;
        const remaining = placement.durationFrames - localFrame;
        const fadeOut = layer.data.fadeOutFrames > 0 ? Math.min(1, remaining / layer.data.fadeOutFrames) : 1;
        const gain = layer.data.gain * fadeIn * fadeOut;
        const existing = timelineHandles.get(layer.layerDocumentId);
        if (existing?.sourceId === sourceId) {
          existing.handle.setGain(gain);
          return;
        }
        if (existing) stopTimeline(layer.layerDocumentId);
        const offsetSeconds = (placement.sourceOffsetFrames + localFrame) / Math.max(1, frameRate);
        try {
          const handle = options.backend.start({
            resource,
            offsetSeconds,
            gain,
            onEnded: () => {
              const activeHandle = timelineHandles.get(layer.layerDocumentId);
              if (activeHandle?.handle === handle) timelineHandles.delete(layer.layerDocumentId);
            },
          });
          timelineHandles.set(layer.layerDocumentId, { sourceId, handle });
        } catch { /* an unavailable source must not stop visual playback */ }
      });
    },
    reconcileProject,
    invalidateSource: (sourceId) => {
      if (active?.sourceId === sourceId) stop();
      [...timelineHandles.entries()].forEach(([id, entry]) => {
        if (entry.sourceId === sourceId) stopTimeline(id);
      });
      [...waveformCache.keys()].forEach((key) => {
        if (key.startsWith(`${sourceId}:`)) waveformCache.delete(key);
      });
      return options.resources.invalidate(sourceId);
    },
    replaceProject: (nextProject) => {
      stop();
      stopTimeline();
      waveformCache.clear();
      options.resources.clear();
      project = nextProject;
    },
    dispose: () => {
      if (disposed) return;
      stop();
      stopTimeline();
      waveformCache.clear();
      disposed = true;
      listeners.clear();
      options.resources.dispose();
      project = null;
    },
  };
}

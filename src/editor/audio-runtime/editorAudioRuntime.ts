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
    reconcileProject,
    invalidateSource: (sourceId) => {
      if (active?.sourceId === sourceId) stop();
      return options.resources.invalidate(sourceId);
    },
    replaceProject: (nextProject) => {
      stop();
      options.resources.clear();
      project = nextProject;
    },
    dispose: () => {
      if (disposed) return;
      stop();
      disposed = true;
      listeners.clear();
      options.resources.dispose();
      project = null;
    },
  };
}

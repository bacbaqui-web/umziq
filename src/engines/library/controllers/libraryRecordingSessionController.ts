import type {
  LayerDocumentAudioProcessingFeature,
  LayerDocumentAudioProcessingSnapshot,
  LayerDocumentAudioRecordingSession,
  PreparedLayerDocumentAudioImport,
} from "@/engines/project";
import type {
  LibraryAudioImportPort,
  LibraryAudioRecordingPort,
  LibraryRecordingAssetStorePort,
} from "@/engines/library/models/libraryEngineModel";
import type {
  LibraryRecordingEditRequest,
  LibraryRecordingSnapshot,
} from "@/engines/library/models/libraryRecordingModel";

type RecordingControllerPorts = {
  audioImport: LibraryAudioImportPort;
  audioRecording: LibraryAudioRecordingPort;
  assetStore: LibraryRecordingAssetStorePort;
};

const IDLE_SNAPSHOT: LibraryRecordingSnapshot = {
  status: "idle",
  name: null,
  preview: null,
  readLiveWaveform: null,
  audioProcessing: null,
  changingAudioProcessing: null,
  audioProcessingError: null,
  error: null,
  canCancel: false,
  canRetry: false,
  canConfirm: false,
};

function createRecordingPreview(file: {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}) {
  return {
    name: file.name,
    mimeType: file.type || null,
    byteLength: file.size,
    read: () => file.arrayBuffer(),
  };
}

const DEFAULT_AUDIO_PROCESSING: LayerDocumentAudioProcessingSnapshot = {
  noiseSuppression: { supported: true, enabled: false, canToggle: true },
  echoCancellation: { supported: true, enabled: false, canToggle: true },
  autoGainControl: { supported: true, enabled: false, canToggle: true },
};

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function createLibraryRecordingSessionController(
  initialPorts: RecordingControllerPorts
) {
  let ports = initialPorts;
  let request = 0;
  let disposed = false;
  let recording: LayerDocumentAudioRecordingSession | null = null;
  let prepared: PreparedLayerDocumentAudioImport | null = null;
  let edited: PreparedLayerDocumentAudioImport | null = null;
  let stored: PreparedLayerDocumentAudioImport | null = null;
  let registrationRetryOnly = false;
  let desiredAudioProcessing = DEFAULT_AUDIO_PROCESSING;
  let selectedAudioInputDeviceId: string | null = null;
  let snapshot = IDLE_SNAPSHOT;
  const listeners = new Set<() => void>();

  const publish = (next: LibraryRecordingSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  const cancelPrepared = (sessionEnd = false) => {
    if (!prepared) return;
    if (sessionEnd) prepared.runtime.disposeForSessionEnd();
    else ports.audioImport.cancel(prepared);
    prepared = null;
    edited = null;
    stored = null;
  };

  const clearRecording = () => {
    if (!recording) return;
    ports.audioRecording.cancel(recording);
    recording = null;
  };

  const publishReady = () => publish({
    ...IDLE_SNAPSHOT,
    status: "ready",
    audioProcessing: desiredAudioProcessing,
    canCancel: true,
  });

  const beginRecording = async (deviceId?: string | null) => {
    if (disposed) return;
    const currentRequest = ++request;
    registrationRetryOnly = false;
    publish({
      ...IDLE_SNAPSHOT,
      status: "requesting",
      audioProcessing: desiredAudioProcessing,
      canCancel: true,
    });
    try {
      selectedAudioInputDeviceId = deviceId ?? selectedAudioInputDeviceId;
      const nextRecording = await ports.audioRecording.start({
        noiseSuppression: desiredAudioProcessing.noiseSuppression.enabled ?? false,
        echoCancellation: desiredAudioProcessing.echoCancellation.enabled ?? false,
        autoGainControl: desiredAudioProcessing.autoGainControl.enabled ?? false,
      }, selectedAudioInputDeviceId);
      if (disposed || currentRequest !== request) {
        ports.audioRecording.cancel(nextRecording);
        return;
      }
      recording = nextRecording;
      ports.audioRecording.begin(nextRecording);
      publish({
        ...IDLE_SNAPSHOT,
        status: "recording",
        readLiveWaveform: nextRecording.recorder?.readWaveform ?? null,
        audioProcessing: nextRecording.recorder.audioProcessing ?? null,
        canCancel: true,
      });
    } catch (reason: unknown) {
      if (disposed || currentRequest !== request) return;
      publish({
        ...IDLE_SNAPSHOT,
        status: "error",
        error: messageOf(reason, "마이크를 시작하지 못했습니다."),
        canCancel: true,
        canRetry: true,
      });
    }
  };

  return {
    read: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    updatePorts: (nextPorts: RecordingControllerPorts) => {
      ports = nextPorts;
    },
    start: () => {
      if (snapshot.status !== "idle") return;
      registrationRetryOnly = false;
      publishReady();
    },
    begin: (deviceId?: string | null) => {
      if (snapshot.status !== "ready") return;
      void beginRecording(deviceId);
    },
    stop: () => {
      const currentRecording = recording;
      if (!currentRecording || snapshot.status !== "recording") return;
      const currentRequest = request;
      recording = null;
      publish({
        ...IDLE_SNAPSHOT,
        status: "preparing",
        canCancel: true,
      });
      void ports.audioRecording.stop(currentRecording).then(
        (nextPrepared) => {
          if (disposed || currentRequest !== request) {
            ports.audioImport.cancel(nextPrepared);
            return;
          }
          prepared = nextPrepared;
          edited = null;
          stored = null;
          const name = nextPrepared.command.layers[0]?.name ?? "움직_녹음";
          publish({
            ...IDLE_SNAPSHOT,
            status: "review",
            name,
            preview: createRecordingPreview(nextPrepared.file),
            readLiveWaveform: null,
            error: null,
            canCancel: true,
            canRetry: true,
            canConfirm: true,
          });
        },
        (reason: unknown) => {
          if (disposed || currentRequest !== request) return;
          publish({
            ...IDLE_SNAPSHOT,
            status: "error",
            error: messageOf(reason, "녹음을 준비하지 못했습니다."),
            canCancel: true,
            canRetry: true,
          });
        }
      );
    },
    setAudioProcessing: (
      feature: LayerDocumentAudioProcessingFeature,
      enabled: boolean
    ) => {
      if (
        snapshot.status !== "ready" ||
        snapshot.changingAudioProcessing
      ) return;
      desiredAudioProcessing = {
        ...desiredAudioProcessing,
        [feature]: {
          ...desiredAudioProcessing[feature],
          enabled,
        },
      };
      publish({
        ...snapshot,
        audioProcessing: desiredAudioProcessing,
        audioProcessingError: null,
      });
    },
    retry: () => {
      if (
        snapshot.status !== "review" &&
        snapshot.status !== "error"
      ) return;
      if (registrationRetryOnly) return;
      request += 1;
      clearRecording();
      cancelPrepared();
      publishReady();
    },
    cancel: () => {
      if (snapshot.status === "saving" || registrationRetryOnly) return;
      request += 1;
      clearRecording();
      cancelPrepared();
      registrationRetryOnly = false;
      publish(IDLE_SNAPSHOT);
    },
    confirm: (editRequest?: LibraryRecordingEditRequest) => {
      if (
        !prepared ||
        (snapshot.status !== "review" && snapshot.status !== "error") ||
        !snapshot.canConfirm
      ) return;
      const currentRequest = ++request;
      const recordingName = snapshot.name;
      const preview = snapshot.preview;
      publish({
        ...IDLE_SNAPSHOT,
        status: "saving",
        name: recordingName,
        preview,
        readLiveWaveform: null,
        error: null,
        canCancel: false,
        canRetry: false,
        canConfirm: false,
      });
      void (async () => {
        let finalPrepared = stored;
        if (!finalPrepared) {
          const editedPrepared = edited ?? (ports.audioRecording.edit
            ? await ports.audioRecording.edit(prepared!, editRequest ?? {
                name: recordingName ?? "움직_녹음",
                trimStartSeconds: 0,
                trimEndSeconds: Number.POSITIVE_INFINITY,
                gainDb: 0,
                removedRanges: [],
              })
            : prepared!);
          if (disposed || currentRequest !== request) {
            ports.audioImport.cancel(editedPrepared);
            return;
          }
          if (!edited && editedPrepared !== prepared) {
            ports.audioImport.cancel(prepared!);
          }
          edited = editedPrepared;
          prepared = editedPrepared;
          finalPrepared = await ports.assetStore.persist(editedPrepared);
          if (disposed || currentRequest !== request) {
            ports.audioImport.cancel(finalPrepared);
            return;
          }
          stored = finalPrepared;
          prepared = finalPrepared;
        }
        const result = ports.audioImport.confirm(finalPrepared);
        if (disposed || currentRequest !== request) return;
        if (result.ok) {
          prepared = null;
          edited = null;
          stored = null;
          registrationRetryOnly = false;
          publish(IDLE_SNAPSHOT);
          return;
        }
        registrationRetryOnly =
          result.recovery === "retry-runtime-registration";
        if (!registrationRetryOnly) {
          prepared = null;
          edited = null;
          stored = null;
        }
        publish({
          ...IDLE_SNAPSHOT,
          status: "error",
          name: recordingName,
          preview,
          readLiveWaveform: null,
          error: result.message ?? "녹음을 추가하지 못했습니다.",
          canCancel: !registrationRetryOnly,
          canRetry: !registrationRetryOnly,
          canConfirm: registrationRetryOnly,
        });
      })().catch((reason: unknown) => {
        if (disposed || currentRequest !== request) return;
        publish({
          ...IDLE_SNAPSHOT,
          status: "error",
          name: recordingName,
          preview,
          readLiveWaveform: null,
          error: messageOf(
            reason,
            "녹음 파일을 프로젝트에 저장하지 못했습니다."
          ),
          canCancel: true,
          canRetry: true,
          canConfirm: true,
        });
      });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      request += 1;
      clearRecording();
      cancelPrepared(true);
      listeners.clear();
      snapshot = IDLE_SNAPSHOT;
    },
  };
}

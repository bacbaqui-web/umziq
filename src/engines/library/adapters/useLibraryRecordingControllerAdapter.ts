import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createLibraryRecordingSessionController,
} from "@/engines/library/controllers/libraryRecordingSessionController";
import type {
  LibraryAudioImportPort,
  LibraryAudioRecordingPort,
  LibraryRecordingAssetStorePort,
} from "@/engines/library/models/libraryEngineModel";

export function useLibraryRecordingControllerAdapter(options: {
  audioImport: LibraryAudioImportPort;
  audioRecording: LibraryAudioRecordingPort;
  assetStore: LibraryRecordingAssetStorePort;
  projectIdentity: string;
}) {
  const controller = useMemo(
    () => createLibraryRecordingSessionController({
      audioImport: options.audioImport,
      audioRecording: options.audioRecording,
      assetStore: options.assetStore,
    }),
    // Project replacement owns a fresh session runtime. Port identities are
    // refreshed below without restarting an active recording.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.projectIdentity]
  );
  controller.updatePorts({
    audioImport: options.audioImport,
    audioRecording: options.audioRecording,
    assetStore: options.assetStore,
  });
  useEffect(() => () => controller.dispose(), [controller]);
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.read,
    controller.read
  );

  return {
    ...snapshot,
    start: controller.start,
    begin: controller.begin,
    stop: controller.stop,
    retry: controller.retry,
    setAudioProcessing: controller.setAudioProcessing,
    cancel: controller.cancel,
    confirm: controller.confirm,
  };
}

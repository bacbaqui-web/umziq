import { useCallback } from "react";
import {
  filesToPsdImportSources,
  getPsdFilePicker,
  isPsdPickerCancellation,
  openPsdSourcesFromPicker,
} from "@/engines/psd-tree/adapters/psdFilePickerAdapter";
import type { PsdTreeProjectCommandPort } from "@/engines/psd-tree/models/psdTreeModel";
import type { PsdTreeState } from "@/engines/psd-tree/state/usePsdTreeState";

type UsePsdPickerControllerOptions = {
  preparePsdSources: (sources: Parameters<PsdTreeProjectCommandPort["preparePsdImport"]>[0]) => Promise<void>;
  refreshWithSource: (
    compId: string,
    source: Parameters<PsdTreeProjectCommandPort["refreshMainComposition"]>[1]
  ) => Promise<"completed" | "needsSource">;
  state: Pick<
    PsdTreeState,
    "fileInputRef" | "pendingPickerMode" | "setPendingPickerMode"
  >;
};

export function usePsdPickerController({
  preparePsdSources,
  refreshWithSource,
  state,
}: UsePsdPickerControllerOptions) {
  const openFallback = useCallback(
    (mode: NonNullable<PsdTreeState["pendingPickerMode"]>) => {
      state.setPendingPickerMode(mode);
      state.fileInputRef.current?.click();
    },
    [state]
  );

  const importFromPicker = useCallback(async () => {
    const picker = getPsdFilePicker();
    if (!picker) {
      openFallback({ type: "import" });
      return;
    }

    try {
      const sources = await openPsdSourcesFromPicker(picker, true);
      if (sources.length > 0) await preparePsdSources(sources);
    } catch (error) {
      if (isPsdPickerCancellation(error)) return;
      openFallback({ type: "import" });
    }
  }, [openFallback, preparePsdSources]);

  const refreshFromPicker = useCallback(
    async (mainCompId: string) => {
      const picker = getPsdFilePicker();
      if (!picker) {
        openFallback({ type: "refresh", mainCompId });
        return;
      }

      try {
        const [source] = await openPsdSourcesFromPicker(picker, false);
        if (source) await refreshWithSource(mainCompId, source);
      } catch (error) {
        if (isPsdPickerCancellation(error)) return;
        openFallback({ type: "refresh", mainCompId });
      }
    },
    [openFallback, refreshWithSource]
  );

  const handleFileInputChange = useCallback(
    (files: FileList | readonly File[]) => {
      const sources = filesToPsdImportSources(files);
      const mode = state.pendingPickerMode;
      state.setPendingPickerMode(null);

      if (sources.length === 0) return;
      if (mode?.type === "refresh") {
        void refreshWithSource(mode.mainCompId, sources[0]);
        return;
      }

      void preparePsdSources(sources);
    },
    [preparePsdSources, refreshWithSource, state]
  );

  return {
    importFromPicker,
    refreshFromPicker,
    handleFileInputChange,
  };
}

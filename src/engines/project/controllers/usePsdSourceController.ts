import { useCallback, useMemo, type MutableRefObject } from "react";
import type {
  PsdImportSource,
  StoredPsdSource,
} from "@/engines/project/models/psdSourceRuntimeModel";

type UsePsdSourceControllerOptions = {
  sourceEntriesRef: MutableRefObject<Record<string, StoredPsdSource>>;
};

export function usePsdSourceController({
  sourceEntriesRef,
}: UsePsdSourceControllerOptions) {
  const resolveLatestSource = useCallback(
    async (
      compId: string,
      overrideSource?: PsdImportSource | null
    ): Promise<PsdImportSource | null> => {
      if (overrideSource) return overrideSource;

      const storedSource = sourceEntriesRef.current[compId];
      if (!storedSource?.fileHandle) return null;

      try {
        return {
          file: await storedSource.fileHandle.getFile(),
          fileHandle: storedSource.fileHandle,
        };
      } catch (error) {
        console.error("PSD SOURCE HANDLE READ ERROR:", storedSource.fileName, error);
        return null;
      }
    },
    [sourceEntriesRef]
  );

  const registerSource = useCallback(
    (compId: string, source: StoredPsdSource) => {
      sourceEntriesRef.current[compId] = source;
    },
    [sourceEntriesRef]
  );

  const removeSource = useCallback(
    (compId: string) => {
      delete sourceEntriesRef.current[compId];
    },
    [sourceEntriesRef]
  );

  return useMemo(
    () => ({ resolveLatestSource, registerSource, removeSource }),
    [registerSource, removeSource, resolveLatestSource]
  );
}

export type PsdSourceController = ReturnType<typeof usePsdSourceController>;

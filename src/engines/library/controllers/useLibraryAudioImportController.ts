import { useCallback, useEffect, useRef, useState } from "react";
import type { PreparedLayerDocumentAudioImport } from "@/engines/project";
import { copyFilesIntoProjectAssets } from "@/editor/projectAssetDirectoryRuntime";
import type {
  LibraryAssetCopyRequestPort,
  LibraryAudioImportPort,
} from "@/engines/library/models/libraryEngineModel";

export function useLibraryAudioImportController(options: {
  audioImport: LibraryAudioImportPort;
  assetCopy: LibraryAssetCopyRequestPort;
  projectIdentity: string;
}) {
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef(0);
  const activePreparedRef = useRef<PreparedLayerDocumentAudioImport[]>([]);
  const audioImportRef = useRef(options.audioImport);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    audioImportRef.current = options.audioImport;
  }, [options.audioImport]);
  useEffect(
    () => () => {
      requestRef.current += 1;
      activePreparedRef.current.forEach(audioImportRef.current.cancel);
      activePreparedRef.current = [];
    },
    [options.projectIdentity]
  );
  useEffect(() => {
    const resetTimer = window.setTimeout(() => setError(null), 0);
    return () => window.clearTimeout(resetTimer);
  }, [options.projectIdentity]);

  const beginImport = useCallback(() => {
    audioFileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    (files: FileList | readonly File[]) => {
      const selectedFiles = Array.from(files);
      if (selectedFiles.length === 0) return;
      const request = ++requestRef.current;
      activePreparedRef.current.forEach(options.audioImport.cancel);
      activePreparedRef.current = [];
      setError(null);
      const preparedImports: PreparedLayerDocumentAudioImport[] = [];
      void (async () => {
        const copy = await options.assetCopy.request(
          "audio",
          selectedFiles.length
        );
        if (copy === null || request !== requestRef.current) return;
        const imports = await copyFilesIntoProjectAssets({
          files: selectedFiles,
          kind: "audio",
          copy,
        });
        let nextOrder: number | undefined;
        for (const entry of imports) {
          const prepared = await options.audioImport.prepare(
            entry.file,
            entry.relativePathHint,
            nextOrder
          );
          if (request !== requestRef.current) {
            options.audioImport.cancel(prepared);
            preparedImports.forEach(options.audioImport.cancel);
            return;
          }
          preparedImports.push(prepared);
          nextOrder = prepared.command.layers[0].common.placement.order + 1;
          activePreparedRef.current = [...preparedImports];
        }
        for (const prepared of preparedImports) {
          const result = options.audioImport.confirm(prepared);
          if (!result.ok) {
            preparedImports
              .filter((candidate) => candidate !== prepared)
              .forEach(options.audioImport.cancel);
            activePreparedRef.current = [];
            setError(
              result.message ??
                `${prepared.file.name} 파일을 추가하지 못했습니다.`
            );
            return;
          }
          activePreparedRef.current = activePreparedRef.current.filter(
            (candidate) => candidate !== prepared
          );
        }
      })().catch((reason: unknown) => {
        preparedImports.forEach(options.audioImport.cancel);
        activePreparedRef.current = activePreparedRef.current.filter(
          (candidate) => !preparedImports.includes(candidate)
        );
        if (request === requestRef.current) {
          setError(
            reason instanceof Error
              ? reason.message
              : "오디오를 분석하지 못했습니다."
          );
        }
      });
    },
    [options.assetCopy, options.audioImport]
  );

  return {
    audioFileInputRef,
    error,
    beginImport,
    onFileInputChange,
  };
}

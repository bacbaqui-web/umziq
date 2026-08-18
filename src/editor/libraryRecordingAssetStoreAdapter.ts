import { copyFilesIntoProjectAssets } from "@/editor/projectAssetDirectoryRuntime";
import type {
  LibraryRecordingAssetStorePort,
} from "@/engines/library";

export function createEditorLibraryRecordingAssetStoreAdapter(
  copyFiles: typeof copyFilesIntoProjectAssets = copyFilesIntoProjectAssets
): LibraryRecordingAssetStorePort {
  return {
    persist: async (prepared) => {
      if (!prepared.command.sources.some((source) => source.kind === "audio")) {
        throw new Error("녹음 Source 저장 정보를 찾지 못했습니다.");
      }
      const stored = (await copyFiles({
        files: [prepared.file],
        kind: "audio",
        copy: true,
      }))[0];
      if (!stored?.relativePathHint) {
        throw new Error(
          "녹음 파일을 프로젝트의 audio 폴더에 저장하지 못했습니다."
        );
      }
      return {
        ...prepared,
        file: stored.file,
        command: {
          ...prepared.command,
          sources: prepared.command.sources.map((source) =>
            source.kind === "audio"
              ? {
                  ...source,
                  locator: {
                    ...source.locator,
                    suggestedFileName: stored.file.name,
                    relativePathHint: stored.relativePathHint,
                  },
                }
              : source
          ),
        },
      };
    },
  };
}

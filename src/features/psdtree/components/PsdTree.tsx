import { useRef, useState } from "react";
import PsdTreeNode from "@/features/psdtree/components/PsdTreeNode";
import type {
  PsdImportSource,
  PsdSourceFileHandle,
} from "@/editor/types/psdSourceTypes";
import type { DropTarget, PsdTreeProps } from "@/features/psdtree/model/psdTreeTypes";

type WindowWithFilePicker = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<PsdSourceFileHandle[]>;
};

const PSD_PICKER_OPTIONS = {
  excludeAcceptAllOption: true,
  types: [
    {
      description: "PSD Files",
      accept: {
        "image/vnd.adobe.photoshop": [".psd"],
      },
    },
  ],
};

export default function PsdTree({
  comps,
  selectedCompId,
  onSelectComp,
  onImportPsdFiles,
  onRefreshMainComp,
  onDeleteMainComp,
  onReorderMainComps,
}: PsdTreeProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draggedMainCompId, setDraggedMainCompId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [pendingRefreshCompId, setPendingRefreshCompId] = useState<string | null>(null);

  const getPickerApi = () => (window as WindowWithFilePicker).showOpenFilePicker;

  const openPsdSourcesFromPicker = async (multiple: boolean): Promise<PsdImportSource[]> => {
    const picker = getPickerApi();

    if (!picker) {
      return [];
    }

    const handles = await picker({
      ...PSD_PICKER_OPTIONS,
      multiple,
    });

    return Promise.all(
      handles.map(async (handle) => ({
        file: await handle.getFile(),
        fileHandle: handle,
      }))
    );
  };

  const handleImportClick = async () => {
    const picker = getPickerApi();

    if (!picker) {
      inputRef.current?.click();
      return;
    }

    try {
      const importSources = await openPsdSourcesFromPicker(true);

      if (importSources.length > 0) {
        await onImportPsdFiles(importSources);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      inputRef.current?.click();
    }
  };

  const handleRefreshRequest = async (compId: string) => {
    const refreshResult = await onRefreshMainComp(compId);

    if (refreshResult !== "needsSource") {
      return;
    }

    const picker = getPickerApi();

    if (picker) {
      try {
        const pickedSources = await openPsdSourcesFromPicker(false);
        const nextSource = pickedSources[0];

        if (nextSource) {
          await onRefreshMainComp(compId, nextSource);
        }
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    setPendingRefreshCompId(compId);
    inputRef.current?.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>PSD Tree</div>

      <button
        onClick={() => {
          void handleImportClick();
        }}
        style={{
          padding: "7px 9px",
          background: "#2d2d2d",
          color: "white",
          border: "1px solid #555",
          borderRadius: 6,
          cursor: "pointer",
          textAlign: "left",
          fontSize: 13,
          lineHeight: 1.2,
        }}
      >
        PSD 불러오기
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".psd"
        multiple
        style={{ display: "none" }}
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            const importSources = Array.from(event.target.files)
              .filter((file) => file.name.toLowerCase().endsWith(".psd"))
              .map((file) => ({
                file,
                fileHandle: null,
              }));

            if (pendingRefreshCompId) {
              const refreshSource = importSources[0];

              if (refreshSource) {
                void onRefreshMainComp(pendingRefreshCompId, refreshSource);
              }
              setPendingRefreshCompId(null);
            } else if (importSources.length > 0) {
              void onImportPsdFiles(importSources);
            }
          }
          event.currentTarget.value = "";
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {comps.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 13 }}>
            아직 불러온 PSD가 없습니다.
          </div>
        )}

        {comps.map((comp, index) => (
          <PsdTreeNode
            key={comp.id}
            comp={comp}
            depth={0}
            isSelected={selectedCompId === comp.id}
            isRoot
            isFirstRoot={index === 0}
            draggedMainCompId={draggedMainCompId}
            dropTarget={dropTarget}
            selectedCompId={selectedCompId}
            onSelectComp={onSelectComp}
            onRefreshMainComp={handleRefreshRequest}
            onDeleteMainComp={onDeleteMainComp}
            onSetDraggedMainCompId={setDraggedMainCompId}
            onSetDropTarget={setDropTarget}
            onReorderMainComps={onReorderMainComps}
          />
        ))}
      </div>
    </div>
  );
}

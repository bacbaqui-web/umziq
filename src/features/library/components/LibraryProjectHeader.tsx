import { useState } from "react";
import type { LibraryNodeViewModel } from "@/engines/library";
import LibraryProjectAddMenu from "@/features/library/components/LibraryProjectAddMenu";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";
import {
  GROUP_HOVER_BACKGROUND,
  GROUP_HOVER_BORDER,
  GROUP_HOVER_GLOW,
  GROUP_SELECTED_BACKGROUND,
  GROUP_SELECTED_BORDER,
  GROUP_SELECTED_GLOW,
} from "@/shared/styles/groupVisualStyles";

export default function LibraryProjectHeader({
  node,
  onSelect,
  onImportPsd,
  onImportAudio,
  onRecordAudio,
  onCreateDrawing,
}: {
  readonly node: LibraryNodeViewModel;
  readonly onSelect: () => void;
  readonly onImportPsd: () => void;
  readonly onImportAudio: () => void;
  readonly onRecordAudio: () => void;
  readonly onCreateDrawing: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        height: 44,
        padding: "0 8px 0 9px",
        display: "flex",
        alignItems: "center",
        gap: 7,
        border: `1px solid ${node.selected ? GROUP_SELECTED_BORDER : hovered ? GROUP_HOVER_BORDER : "#343d45"}`,
        borderRadius: 8,
        background: node.selected
          ? GROUP_SELECTED_BACKGROUND
          : hovered
            ? GROUP_HOVER_BACKGROUND
          : "linear-gradient(145deg, #23292f 0%, #1b2025 100%)",
        boxShadow: node.selected
          ? GROUP_SELECTED_GLOW
          : hovered
            ? GROUP_HOVER_GLOW
          : "0 4px 14px rgba(0, 0, 0, 0.18)",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          minWidth: 0,
          flex: 1,
          alignSelf: "stretch",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: 7,
          border: 0,
          background: "transparent",
          color: "#f3f5f7",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8eb6d8",
            flex: "0 0 auto",
          }}
        >
          <LayerCompositionIcon kind="composition" size={18} />
        </span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 15,
            lineHeight: 1,
            fontWeight: 750,
            letterSpacing: -0.2,
          }}
        >
          프로젝트
        </span>
      </button>
      <LibraryProjectAddMenu
        onImportPsd={onImportPsd}
        onCreateDrawing={onCreateDrawing}
        onImportAudio={onImportAudio}
        onRecordAudio={onRecordAudio}
      />
    </div>
  );
}

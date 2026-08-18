import type { LibraryNodeViewModel } from "@/engines/library";
import LibraryAudioMenu from "@/features/library/components/LibraryAudioMenu";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

export default function LibraryProjectHeader({
  node,
  onSelect,
  onImportPsd,
  onImportAudio,
  onRecordAudio,
}: {
  readonly node: LibraryNodeViewModel;
  readonly onSelect: () => void;
  readonly onImportPsd: () => void;
  readonly onImportAudio: () => void;
  readonly onRecordAudio: () => void;
}) {
  return (
    <div
      style={{
        height: 44,
        padding: "0 8px 0 9px",
        display: "flex",
        alignItems: "center",
        gap: 7,
        border: node.selected ? "1px solid #4b6685" : "1px solid #343d45",
        borderRadius: 8,
        background: node.selected
          ? "linear-gradient(90deg, rgba(47, 79, 127, 0.9), rgba(42, 64, 91, 0.62))"
          : "linear-gradient(145deg, #23292f 0%, #1b2025 100%)",
        boxShadow: node.selected
          ? "0 5px 16px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(111, 157, 204, 0.13)"
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
      <button
        type="button"
        onClick={onImportPsd}
        style={{
          height: 27,
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          border: "1px solid #4f7198",
          borderRadius: 6,
          background: "rgba(48, 85, 126, 0.48)",
          color: "#bcd9f2",
          cursor: "pointer",
          fontSize: 11.5,
          fontWeight: 650,
          whiteSpace: "nowrap",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
          <path d="M6 1.5v9M1.5 6h9" />
        </svg>
        PSD
      </button>
      <LibraryAudioMenu onImport={onImportAudio} onRecord={onRecordAudio} />
    </div>
  );
}

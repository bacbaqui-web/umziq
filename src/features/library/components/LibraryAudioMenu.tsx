import { useState } from "react";

export default function LibraryAudioMenu({
  onImport,
  onRecord,
}: {
  readonly onImport: () => void;
  readonly onRecord: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          height: 27,
          padding: "0 8px",
          border: "1px solid #48765a",
          borderRadius: 6,
          background: "rgba(40, 91, 61, 0.42)",
          color: "#a9e1ba",
          cursor: "pointer",
          fontSize: 11.5,
          fontWeight: 650,
          whiteSpace: "nowrap",
        }}
      >
        + 오디오
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            zIndex: 20,
            top: 31,
            right: 0,
            width: 130,
            padding: 4,
            border: "1px solid #46515b",
            borderRadius: 7,
            background: "#1b2126",
            boxShadow: "0 8px 20px rgba(0,0,0,.4)",
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onImport();
            }}
            style={{ width: "100%", padding: "7px 8px", textAlign: "left" }}
          >
            파일 불러오기
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRecord();
            }}
            style={{ width: "100%", padding: "7px 8px", textAlign: "left" }}
          >
            직접 녹음
          </button>
        </div>
      )}
    </div>
  );
}

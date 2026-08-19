import { useEffect, useRef, useState } from "react";

export default function LibraryProjectAddMenu({
  onImportPsd,
  onCreateDrawing,
  onImportAudio,
  onRecordAudio,
}: {
  readonly onImportPsd: () => void;
  readonly onCreateDrawing: () => void;
  readonly onImportAudio: () => void;
  readonly onRecordAudio: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const run = (command: () => void) => {
    setOpen(false);
    command();
  };
  const items = [
    ["PSD 불러오기", onImportPsd],
    ["드로잉 레이어 만들기", onCreateDrawing],
    ["오디오 불러오기", onImportAudio],
    ["직접 녹음하기", onRecordAudio],
  ] as const;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="프로젝트에 추가"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          width: 29,
          height: 29,
          padding: 0,
          border: "1px solid #4f7198",
          borderRadius: 7,
          background: open ? "rgba(62, 112, 166, 0.72)" : "rgba(48, 85, 126, 0.48)",
          color: "#d7eaff",
          cursor: "pointer",
          fontSize: 20,
          lineHeight: 1,
        }}
      >
        +
      </button>
      {open && (
        <div
          role="menu"
          aria-label="프로젝트 추가 메뉴"
          style={{
            position: "absolute",
            zIndex: 1000,
            top: 34,
            right: 0,
            width: 174,
            padding: 5,
            border: "1px solid #46515b",
            borderRadius: 8,
            background: "#1b2126",
            boxShadow: "0 10px 28px rgba(0,0,0,.45)",
          }}
        >
          {items.map(([label, command]) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => run(command)}
              style={{
                width: "100%",
                padding: "8px 9px",
                border: 0,
                borderRadius: 5,
                background: "transparent",
                color: "#e5edf5",
                cursor: "pointer",
                fontSize: 12,
                textAlign: "left",
              }}
              onPointerEnter={(event) => { event.currentTarget.style.background = "rgba(255,255,255,.08)"; }}
              onPointerLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

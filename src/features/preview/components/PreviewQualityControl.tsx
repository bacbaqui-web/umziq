import { useEffect, useRef, useState } from "react";
import type {
  PreviewQualityControlCommands,
  PreviewQualityControlViewModel,
} from "@/engines/canvas";

type PreviewQualityControlProps = {
  viewModel: PreviewQualityControlViewModel;
  commands: PreviewQualityControlCommands;
};

export default function PreviewQualityControl({
  viewModel,
  commands,
}: PreviewQualityControlProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeMenu = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="ui-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{
          minWidth: 91,
          justifyContent: "space-between",
          border: open
            ? "1px solid rgba(118, 197, 255, 0.28)"
            : "1px solid rgba(255,255,255,0.1)",
          background: open
            ? "rgba(118, 197, 255, 0.12)"
            : "rgba(255,255,255,0.04)",
        }}
      >
        <span>미리보기</span>
        <span aria-hidden="true" style={{ marginLeft: 6, color: "#9fb0bf", fontSize: 8 }}>
          ▼
        </span>
      </button>

      {open && (
        <div
          className="ui-card"
          role="listbox"
          aria-label="미리보기 품질"
          style={{
            position: "absolute",
            left: 0,
            top: "calc(100% + 6px)",
            width: 112,
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 3,
            borderRadius: 8,
            boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
          }}
        >
          {viewModel.options.map((option) => {
            const active = option.preference === viewModel.preference;
            return (
              <button
                key={option.preference}
                type="button"
                role="option"
                aria-selected={active}
                className="ui-button"
                onClick={() => {
                  commands.setPreference(option.preference);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  borderColor: active
                    ? "rgba(118, 197, 255, 0.3)"
                    : "transparent",
                  background: active
                    ? "rgba(118, 197, 255, 0.16)"
                    : "transparent",
                  color: active ? "#d9edff" : "#b9c3cc",
                }}
              >
                <span>{option.label}</span>
                {active && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m2.2 6.2 2.2 2.2 5.3-5.3" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

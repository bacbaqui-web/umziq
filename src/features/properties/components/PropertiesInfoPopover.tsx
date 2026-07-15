import { useState } from "react";
import type { Composition, CompositionMeta } from "@/editor/types/types";

type PropertiesInfoPopoverProps = {
  selectedComp: Composition;
  selectedMeta: CompositionMeta | null;
};

export default function PropertiesInfoPopover({
  selectedComp,
  selectedMeta,
}: PropertiesInfoPopoverProps) {
  const [isInfoHovered, setIsInfoHovered] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: 8,
      }}
    >
      <div
        onMouseEnter={() => setIsInfoHovered(true)}
        onMouseLeave={() => setIsInfoHovered(false)}
        style={{ position: "relative" }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 7px",
            borderRadius: 999,
            border: "1px solid #2f3640",
            background: "#1f2327",
            color: "#8f9ba7",
            fontSize: 11,
            cursor: "default",
            userSelect: "none",
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              border: "1px solid #46505a",
              fontSize: 10,
              color: "#b8c3cd",
            }}
          >
            i
          </span>
          정보
        </div>

        {isInfoHovered && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              zIndex: 20,
              minWidth: 190,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "4px 10px",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #313843",
              background: "rgba(20, 24, 29, 0.98)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
              color: "#aeb8c2",
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: "#d8e1ea" }}>Name</strong>
            <span>{selectedComp.name}</span>
            <strong style={{ color: "#d8e1ea" }}>PSD</strong>
            <span>{selectedMeta?.sourceFileName ?? "-"}</span>
            <strong style={{ color: "#d8e1ea" }}>Canvas</strong>
            <span>{selectedMeta ? `${selectedMeta.width} x ${selectedMeta.height}` : "-"}</span>
            <strong style={{ color: "#d8e1ea" }}>Duration</strong>
            <span>
              {selectedMeta
                ? `${(selectedMeta.durationFrames / selectedMeta.frameRate).toFixed(1)}s`
                : "-"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

import PropertiesInfoPopover from "@/features/properties/components/PropertiesInfoPopover";
import PropertiesKeyframeSection from "@/features/properties/sections/PropertiesKeyframeSection";
import PropertiesTransformSection from "@/features/properties/sections/PropertiesTransformSection";
import type { PropertiesPanelProps } from "@/features/properties/types/propertiesPanelTypes";

export default function PropertiesPanel({ readModel, commands }: PropertiesPanelProps) {
  return (
    <div style={{ borderLeft: "1px solid #333", padding: 12, overflow: "auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #343434",
          background: "#222",
          color: "#fff",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700 }}>Properties</span>
      </div>

      {readModel.hasSelectedComposition ? (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          {readModel.info && <PropertiesInfoPopover info={readModel.info} />}

          {readModel.targetName && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "7px 8px",
                  borderRadius: 7,
                  border: "1px solid #313131",
                  background: "#202020",
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#f3f7fb",
                    fontWeight: 600,
                  }}
                >
                  {readModel.targetName}
                </div>
                <div
                  style={{
                    flex: "0 0 auto",
                    fontSize: 12,
                    color: "#9db0c3",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {readModel.currentTimeText}
                </div>
              </div>

              <PropertiesTransformSection rows={readModel.rows} commands={commands} />
              <PropertiesKeyframeSection viewModel={readModel.keyframe} commands={commands} />
            </div>
          )}

          {readModel.importError && (
            <div style={{ color: "#d08d8d", marginTop: 10 }}>{readModel.importError}</div>
          )}
          {readModel.importNotice && (
            <div style={{ color: "#9bc18a", marginTop: 10 }}>{readModel.importNotice}</div>
          )}
        </div>
      ) : (
        <div style={{ color: "#aaa" }}>선택된 컴포지션이 없습니다.</div>
      )}
    </div>
  );
}

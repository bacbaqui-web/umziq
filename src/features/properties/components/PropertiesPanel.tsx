import PropertiesKeyframeSection from "@/features/properties/sections/PropertiesKeyframeSection";
import PropertiesModifierLibrarySection from "@/features/properties/sections/PropertiesModifierLibrarySection";
import PropertiesModifierSection from "@/features/properties/sections/PropertiesModifierSection";
import PropertiesTransformSection from "@/features/properties/sections/PropertiesTransformSection";
import type { PropertiesPanelProps } from "@/features/properties/types/propertiesPanelTypes";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";
import PropertiesSourceDetails from "@/features/properties/components/PropertiesSourceDetails";
import PropertiesSourceHeader from "@/features/properties/components/PropertiesSourceHeader";

export default function PropertiesPanel({ readModel, commands }: PropertiesPanelProps) {
  return (
    <div className="editor-panel-scroll" style={{ height: "100%" }}>
      {readModel.hasSelectedComposition ? (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          {readModel.targetName && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {readModel.sourceHeader ? (
                <PropertiesSourceHeader
                  source={readModel.sourceHeader}
                  currentTimeText={readModel.currentTimeText}
                />
              ) : (
                <div
                  className="ui-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "7px 8px",
                    borderRadius: 8,
                    boxShadow: "none",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "#f3f7fb",
                      fontWeight: 600,
                    }}
                  >
                    {readModel.targetEntityKind && (
                      <LayerCompositionIcon kind={readModel.targetEntityKind} size={14} />
                    )}
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {readModel.targetName}
                    </span>
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
              )}

              <PropertiesSourceDetails
                detail={readModel.sourceDetail}
                capabilities={readModel.capabilities}
              />
              {readModel.transformSectionVisible && (
                <PropertiesTransformSection
                  rows={readModel.rows}
                  transformOrigin={readModel.transformOrigin}
                  commands={commands}
                />
              )}
              <PropertiesModifierSection modifiers={readModel.modifiers} commands={commands} />
              <PropertiesModifierLibrarySection
                viewModel={readModel.modifierLibrary}
                commands={commands}
              />
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
        <div style={{ color: "#aaa" }}>선택된 그룹이 없습니다.</div>
      )}
    </div>
  );
}

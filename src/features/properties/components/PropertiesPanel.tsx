import PropertiesKeyframeSection from "@/features/properties/sections/PropertiesKeyframeSection";
import PropertiesModifierLibrarySection from "@/features/properties/sections/PropertiesModifierLibrarySection";
import PropertiesModifierSection from "@/features/properties/sections/PropertiesModifierSection";
import PropertiesTransformSection from "@/features/properties/sections/PropertiesTransformSection";
import type {
  PropertiesEngineViewProps,
} from "@/engines/properties";

export default function PropertiesPanel({
  readModel,
  commands,
}: PropertiesEngineViewProps) {
  return (
    <div className="editor-panel-scroll" style={{ height: "100%" }}>
      {readModel.hasSelectedComposition ? (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          {readModel.targetName && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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

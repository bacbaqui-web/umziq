import type {
  PropertiesSourceHeaderViewModel,
} from "@/engines/visual";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

type Props = {
  source: PropertiesSourceHeaderViewModel;
  currentTimeText: string;
};

export default function PropertiesSourceHeader({
  source,
  currentTimeText,
}: Props) {
  return (
    <div className="ui-card" style={{ padding: "8px", borderRadius: 8, boxShadow: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <LayerCompositionIcon kind={source.entityKind} size={14} />
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#f3f7fb", fontWeight: 600 }}>
            {source.displayName}
          </span>
        </div>
        <span style={{ flex: "0 0 auto", color: "#9db0c3", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          {currentTimeText}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: "3px 8px", marginTop: 7, paddingTop: 7, borderTop: "1px solid rgba(255,255,255,0.07)", color: "#9db0c3", fontSize: 11 }}>
        <span>Layer Type</span>
        <span style={{ color: "#d8e3ed" }}>{source.typeLabel}</span>
        <span>Source name</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#d8e3ed" }}>
          {source.sourceName}
        </span>
        <span>Item alias</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: source.itemAlias ? "#d8e3ed" : "#748391" }}>
          {source.itemAlias ?? "없음"}
        </span>
        <span>Source 상태</span>
        <span style={{ color: "#d8e3ed" }}>{source.availabilityLabel}</span>
      </div>
    </div>
  );
}

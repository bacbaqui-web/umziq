import type {
  PropertiesCapabilityStatus,
  PropertiesCapabilityViewModel,
  PropertiesSourceDetailViewModel,
} from "@/engines/visual";

const STATUS_COLOR: Readonly<Record<PropertiesCapabilityStatus, string>> = {
  editable: "#9bcfae",
  "read-only": "#a8bfd4",
  unsupported: "#d2a0a0",
};

type Props = {
  detail: PropertiesSourceDetailViewModel | null;
  capabilities: PropertiesCapabilityViewModel[];
};

export default function PropertiesSourceDetails({
  detail,
  capabilities,
}: Props) {
  if (!detail && capabilities.length === 0) return null;

  return (
    <div className="ui-card" style={{ padding: "8px", borderRadius: 8, boxShadow: "none" }}>
      {detail && (
        <div>
          <div style={{ color: "#e3ebf3", fontWeight: 600 }}>{detail.title}</div>
          <div style={{ marginTop: 2, color: "#8fa0af", fontSize: 11, lineHeight: 1.45 }}>
            {detail.description}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: "3px 8px", marginTop: 7, color: "#9db0c3", fontSize: 11 }}>
            {detail.fields.map((field) => (
              <div key={field.label} style={{ display: "contents" }}>
                <span>{field.label}</span>
                <span style={{ color: "#d8e3ed", overflowWrap: "anywhere" }}>{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: detail ? 9 : 0, paddingTop: detail ? 8 : 0, borderTop: detail ? "1px solid rgba(255,255,255,0.07)" : undefined }}>
        {capabilities.map((capability) => (
          <div key={capability.key} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "1px 8px" }}>
            <span style={{ color: "#cbd7e2", fontSize: 11 }}>{capability.label}</span>
            <span style={{ color: STATUS_COLOR[capability.status], fontSize: 11 }}>
              {capability.statusLabel}
            </span>
            <span style={{ gridColumn: "1 / -1", color: "#788895", fontSize: 10, lineHeight: 1.35 }}>
              {capability.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

type LayerDocumentIconProps = {
  kind: "layer" | "composition" | "audio";
  audioProvenance?: "imported" | "recorded" | null;
  size?: number;
};

export default function LayerDocumentIcon({
  kind,
  audioProvenance = null,
  size = 14,
}: LayerDocumentIconProps) {
  if (kind !== "audio") {
    return <LayerCompositionIcon kind={kind} size={size} />;
  }

  return audioProvenance === "recorded" ? (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" focusable="false" style={{ flex: "0 0 auto" }}>
      <rect x="5" y="1.5" width="6" height="9" rx="3" />
      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5M5.5 14.5h5" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: "0 0 auto" }}>
      <path d="M9.5 11V2.2c2.9.35 4.2 1.65 4.2 3.55-1.05-.85-2.3-1.25-4.2-1.25" />
      <ellipse cx="7" cy="11.5" rx="2.6" ry="2" transform="rotate(-18 7 11.5)" />
    </svg>
  );
}

type LayerCompositionIconProps = {
  kind: "layer" | "composition";
  size?: number;
};

const FRONT_PLANE_PATH = "M12 3.5 21 8 12 12.5 3 8Z";

export default function LayerCompositionIcon({
  kind,
  size = 14,
}: LayerCompositionIconProps) {
  const planeOffsets = kind === "composition" ? [8, 4, 0] : [0];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "0 0 auto" }}
    >
      {planeOffsets.map((offset) => (
        <path
          key={offset}
          d={FRONT_PLANE_PATH}
          transform={offset === 0 ? undefined : `translate(0 ${offset})`}
        />
      ))}
    </svg>
  );
}

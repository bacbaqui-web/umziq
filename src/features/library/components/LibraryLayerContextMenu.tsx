export type LibraryLayerContextMenuPoint = {
  readonly x: number;
  readonly y: number;
};

export default function LibraryLayerContextMenu({
  name,
  point,
  canConvertToDrawing,
  rename,
  duplicate,
  remove,
  convertToDrawing,
}: {
  readonly name: string;
  readonly point: LibraryLayerContextMenuPoint;
  readonly canConvertToDrawing: boolean;
  readonly rename: () => void;
  readonly duplicate: () => void;
  readonly remove: () => void;
  readonly convertToDrawing: () => void;
}) {
  const itemStyle = {
    width: "100%",
    padding: "7px 10px",
    border: 0,
    borderRadius: 5,
    background: "transparent",
    color: "#dce5ef",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left" as const,
  };
  const item = (label: string, command: () => void, danger = false) => (
    <button
      key={label}
      type="button"
      role="menuitem"
      onClick={command}
      style={{ ...itemStyle, color: danger ? "#f19aa3" : itemStyle.color }}
      onPointerEnter={(event) => { event.currentTarget.style.background = danger ? "rgba(198,65,78,.18)" : "rgba(255,255,255,.08)"; }}
      onPointerLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </button>
  );
  return (
    <div
      role="menu"
      aria-label={`${name} 레이어 메뉴`}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: "fixed",
        left: point.x,
        top: point.y,
        zIndex: 1200,
        width: 170,
        padding: 5,
        border: "1px solid rgba(255,255,255,.14)",
        borderRadius: 7,
        background: "#1b1f24",
        boxShadow: "0 10px 28px rgba(0,0,0,.42)",
      }}
    >
      {item("이름 바꾸기", rename)}
      {item("복제", duplicate)}
      {canConvertToDrawing && item("드로잉 레이어로 변환", convertToDrawing)}
      {item("삭제", remove, true)}
    </div>
  );
}

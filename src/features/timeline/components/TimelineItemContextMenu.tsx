import type {
  TimelineInteractionCommands,
} from "@/engines/timeline";

export type TimelineItemContextMenuPoint = {
  readonly x: number;
  readonly y: number;
};

export default function TimelineItemContextMenu({
  itemId,
  itemName,
  point,
  interactions,
  close,
}: {
  itemId: string;
  itemName: string;
  point: TimelineItemContextMenuPoint;
  interactions: TimelineInteractionCommands;
  close: () => void;
}) {
  const itemStyle = {
    width: "100%",
    border: 0,
    borderRadius: 5,
    padding: "7px 10px",
    background: "transparent",
    fontSize: 12,
    textAlign: "left" as const,
    cursor: "pointer",
  };
  return (
    <div
      role="menu"
      aria-label={`${itemName} 타임라인 항목 메뉴`}
      onPointerDown={(event) =>
        event.stopPropagation()
      }
      style={{
        position: "fixed",
        left: point.x,
        top: point.y,
        zIndex: 1000,
        minWidth: 132,
        padding: 5,
        borderRadius: 7,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "#1b1f24",
        boxShadow: "0 10px 28px rgba(0,0,0,0.42)",
      }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          close();
          interactions.duplicateTimelineItem(itemId);
        }}
        style={{ ...itemStyle, color: "#dce5ef" }}
        onPointerEnter={(event) => {
          event.currentTarget.style.background =
            "rgba(255,255,255,0.08)";
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.background =
            "transparent";
        }}
      >
        복제
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          close();
          interactions.deleteTimelineItem(itemId);
        }}
        style={{ ...itemStyle, color: "#f19aa3" }}
        onPointerEnter={(event) => {
          event.currentTarget.style.background =
            "rgba(198, 65, 78, 0.18)";
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.background =
            "transparent";
        }}
      >
        삭제
      </button>
    </div>
  );
}

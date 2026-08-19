import type {
  TimelineInteractionCommands,
} from "@/engines/timeline";

export default function TimelineItemSourceStatus({
  itemId,
  visible,
  interactions,
}: {
  itemId: string;
  visible: boolean;
  interactions: TimelineInteractionCommands;
}) {
  if (!visible) return null;
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        left: 8,
        top: "calc(100% + 4px)",
        zIndex: 10,
        display: "flex",
        gap: 6,
        padding: 6,
        borderRadius: 6,
        background: "#1e1618",
        border: "1px solid rgba(160, 70, 78, 0.78)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
      }}
    >
      <button
        onClick={() =>
          interactions.resolveTimelineSourceDelete(
            itemId,
            "delete"
          )
        }
        style={{ border: "1px solid rgba(192, 95, 105, 0.85)", background: "rgba(111, 34, 40, 0.92)", color: "#f6d9dd", borderRadius: 4, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}
      >
        delete
      </button>
      <button
        onClick={() =>
          interactions.resolveTimelineSourceDelete(
            itemId,
            "keep"
          )
        }
        style={{ border: "1px solid rgba(180, 180, 180, 0.18)", background: "#24282d", color: "#d7dde5", borderRadius: 4, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}
      >
        keep
      </button>
    </div>
  );
}

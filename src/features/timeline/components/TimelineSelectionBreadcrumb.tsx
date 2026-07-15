type TimelineSelectionBreadcrumbProps = {
  path: string | null;
  isOpen?: boolean;
  onClick?: () => void;
};

export default function TimelineSelectionBreadcrumb({
  path,
  isOpen = false,
  onClick,
}: TimelineSelectionBreadcrumbProps) {
  const displayText = path ?? "No selection";

  return (
    <button
      type="button"
      onClick={onClick}
      title={path ?? undefined}
      style={{
        minWidth: 0,
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflow: "hidden",
        padding: 0,
        background: "transparent",
        border: "none",
        color: path ? "#c7d0d9" : "#7f8a95",
        fontSize: 12,
        lineHeight: 1.2,
        letterSpacing: 0.1,
        userSelect: "none",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          textAlign: "left",
        }}
      >
        {displayText}
      </span>
      {onClick && (
        <span
          aria-hidden="true"
          style={{
            flex: "0 0 auto",
            color: isOpen ? "#eef5fc" : "#8e99a4",
            fontSize: 10,
            transform: isOpen ? "rotate(180deg)" : "none",
          }}
        >
          ▾
        </span>
      )}
    </button>
  );
}

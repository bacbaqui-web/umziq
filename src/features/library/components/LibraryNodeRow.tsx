import type { ReactNode } from "react";
import type {
  LibraryHoverPreviewViewModel,
  LibraryNodeViewModel,
} from "@/engines/library";

export default function LibraryNodeRow({
  node,
  isMain,
  editing,
  hasChildren,
  rowIndent,
  rowBackground,
  onHoveredChange,
  onPreviewMove,
  onPreviewEnd,
  children,
}: {
  readonly node: LibraryNodeViewModel;
  readonly isMain: boolean;
  readonly editing: boolean;
  readonly hasChildren: boolean;
  readonly rowIndent: number;
  readonly rowBackground: string;
  readonly onHoveredChange: (hovered: boolean) => void;
  readonly onPreviewMove: (
    preview: LibraryHoverPreviewViewModel,
    clientX: number,
    clientY: number
  ) => void;
  readonly onPreviewEnd: () => void;
  readonly children: ReactNode;
}) {
  return (
    <div
      onMouseEnter={() => onHoveredChange(true)}
      onMouseMove={(event) => {
        if (node.preview && !editing && node.type !== "project") {
          const preview = node.preview();
          if (preview) onPreviewMove(preview, event.clientX, event.clientY);
        }
      }}
      onMouseLeave={() => {
        onHoveredChange(false);
        onPreviewEnd();
      }}
      style={{
        position: "relative",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 2,
        height: isMain ? 35 : 20,
        padding: isMain ? "5px 7px" : "1px 6px",
        paddingLeft: rowIndent,
        borderRadius: isMain ? (hasChildren ? "7px 7px 0 0" : 7) : 4,
        background: rowBackground,
        boxShadow:
          node.selected && isMain
            ? "inset 0 0 0 1px rgba(111, 157, 204, 0.16)"
            : "none",
        transition: "background 140ms ease, box-shadow 140ms ease",
      }}
    >
      {children}
    </div>
  );
}

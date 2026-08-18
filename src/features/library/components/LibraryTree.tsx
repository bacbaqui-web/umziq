import type { LibraryNodeProps, LibraryNodeViewModel } from "@/engines/library";
import LibraryNode from "@/features/library/components/LibraryNode";

type NodeHandlers = Omit<
  LibraryNodeProps,
  "node" | "isFirstRoot"
>;

export default function LibraryTree({
  nodes,
  handlers,
}: {
  readonly nodes: readonly LibraryNodeViewModel[];
  readonly handlers: NodeHandlers;
}) {
  return (
    <div style={{ position: "relative", marginLeft: 18, paddingTop: 7 }}>
      {nodes.length === 0 && (
        <div className="psd-empty-state" style={{ marginLeft: 10 }}>
          아직 불러온 PSD가 없습니다.
        </div>
      )}
      {nodes.map((node, index) => (
        <div
          key={node.id}
          style={{
            position: "relative",
            paddingLeft: 10,
            paddingBottom: index === nodes.length - 1 ? 0 : 6,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: index === 0 ? -20 : -7,
              height:
                index === nodes.length - 1
                  ? index === 0
                    ? 38
                    : 25
                  : index === 0
                    ? "calc(100% + 20px)"
                    : "calc(100% + 7px)",
              borderLeft: "1px solid rgba(142, 182, 216, 0.82)",
              transform: "translateX(-0.5px)",
            }}
          />
          {!(node.contentKind === "audio" && node.type !== "main") && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 18,
                width: 13,
                borderTop: "1px solid rgba(142, 182, 216, 0.82)",
                transform: "translateY(-0.5px)",
              }}
            />
          )}
          <LibraryNode
            node={node}
            isFirstRoot={index === 0}
            isLastSibling={index === nodes.length - 1}
            projectRootChild
            {...handlers}
          />
        </div>
      ))}
    </div>
  );
}

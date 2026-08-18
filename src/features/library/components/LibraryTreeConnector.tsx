export function LibraryTreeConnector({
  isMain,
  usesOuterProjectConnector,
  branchLeft,
  rowIndent,
  hasChildren,
}: {
  readonly isMain: boolean;
  readonly usesOuterProjectConnector: boolean;
  readonly branchLeft: number;
  readonly rowIndent: number;
  readonly hasChildren: boolean;
}) {
  return (
    <>
      {usesOuterProjectConnector && (
        <>
          <span aria-hidden="true" style={{ position: "absolute", left: 0, top: -7, height: 17, borderLeft: "1px solid rgba(142, 182, 216, 0.82)", transform: "translateX(-0.5px)" }} />
          <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 10, width: 3, borderTop: "1px solid rgba(142, 182, 216, 0.82)", transform: "translateY(-0.5px)" }} />
        </>
      )}
      {!isMain && !usesOuterProjectConnector && (
        <span aria-hidden="true" style={{ position: "absolute", left: branchLeft, top: 10, width: rowIndent - branchLeft + (hasChildren ? 1 : 0), borderTop: "1px solid rgba(142, 182, 216, 0.82)", transform: "translateY(-0.5px)" }} />
      )}
    </>
  );
}

export function LibraryTreeBranchGuide({
  isMain,
  usesOuterProjectConnector,
  branchLeft,
  isLastSibling,
}: {
  readonly isMain: boolean;
  readonly usesOuterProjectConnector: boolean;
  readonly branchLeft: number;
  readonly isLastSibling: boolean;
}) {
  if (isMain || usesOuterProjectConnector) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: branchLeft,
        top: 0,
        height: isLastSibling ? 10 : "100%",
        borderLeft: "1px solid rgba(142, 182, 216, 0.82)",
        transform: "translateX(-0.5px)",
      }}
    />
  );
}

export function LibraryDropIndicator({ edge }: { readonly edge: "before" | "after" }) {
  return (
    <span aria-hidden="true" style={{ position: "absolute", zIndex: 2, left: 5, right: 5, [edge === "before" ? "top" : "bottom"]: -4, height: 2, borderRadius: 999, background: "#5d8fcb", boxShadow: "0 0 0 1px rgba(93, 143, 203, 0.18), 0 0 8px rgba(93, 143, 203, 0.35)" }} />
  );
}

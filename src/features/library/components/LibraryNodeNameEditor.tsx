import type { Dispatch, SetStateAction } from "react";

export default function LibraryNodeNameEditor({
  name,
  draft,
  setDraft,
  onRename,
  onFinish,
}: {
  readonly name: string;
  readonly draft: string;
  readonly setDraft: Dispatch<SetStateAction<string>>;
  readonly onRename: (name: string) => void;
  readonly onFinish: () => void;
}) {
  return (
    <input
      autoFocus
      value={draft}
      aria-label={`${name} 이름 수정`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(name);
          onFinish();
        }
      }}
      onBlur={() => {
        const nextName = draft.trim();
        if (nextName) onRename(nextName);
        else setDraft(name);
        onFinish();
      }}
      style={{
        minWidth: 0,
        flex: 1,
        height: 18,
        boxSizing: "border-box",
        padding: "0 4px",
        border: "1px solid #6687a3",
        borderRadius: 3,
        outline: "none",
        background: "#11181e",
        color: "#f2f4f5",
        font: "inherit",
      }}
    />
  );
}

import { useEffect } from "react";

type Options = {
  selectedCompId: string | null;
  undo: (compId: string) => void;
  redo: (compId: string) => void;
};

export function useEditorHistoryShortcuts(options: Options) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isUndoRedoKey = event.code === "KeyZ" || event.key.toLowerCase() === "z";
      if (!(event.metaKey || event.ctrlKey) || event.altKey || !isUndoRedoKey) return;
      const activeElement = document.activeElement;
      const isTypingTarget = activeElement instanceof HTMLInputElement
        || activeElement instanceof HTMLTextAreaElement
        || activeElement instanceof HTMLSelectElement
        || (activeElement instanceof HTMLElement && activeElement.isContentEditable);
      if (isTypingTarget || !options.selectedCompId) return;
      event.preventDefault();
      if (event.shiftKey) options.redo(options.selectedCompId);
      else options.undo(options.selectedCompId);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options]);
}

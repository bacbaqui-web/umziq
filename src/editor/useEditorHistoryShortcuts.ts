import { useEffect } from "react";

type Options = {
  undo: () => void;
  redo: () => void;
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
      if (isTypingTarget) return;
      event.preventDefault();
      if (event.shiftKey) options.redo();
      else options.undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options]);
}

import { useRef, useState } from "react";
import type {
  PsdTreeDropTarget,
  PsdTreePickerMode,
} from "@/engines/psd-tree/models/psdTreeModel";

export function usePsdTreeState() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draggedMainCompId, setDraggedMainCompId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<PsdTreeDropTarget>(null);
  const [pendingPickerMode, setPendingPickerMode] = useState<PsdTreePickerMode>(null);

  return {
    fileInputRef,
    draggedMainCompId,
    setDraggedMainCompId,
    dropTarget,
    setDropTarget,
    pendingPickerMode,
    setPendingPickerMode,
  };
}

export type PsdTreeState = ReturnType<typeof usePsdTreeState>;

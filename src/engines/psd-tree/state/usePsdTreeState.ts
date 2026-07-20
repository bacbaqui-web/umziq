import { useRef, useState } from "react";
import type {
  PsdTreeDropTarget,
  PsdTreePickerMode,
} from "@/engines/psd-tree/models/psdTreeModel";
import type { PsdImportPlan, PsdRefreshSummary } from "@/engines/project";

export function usePsdTreeState() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draggedMainCompId, setDraggedMainCompId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<PsdTreeDropTarget>(null);
  const [pendingPickerMode, setPendingPickerMode] = useState<PsdTreePickerMode>(null);
  const [importPlan, setImportPlan] = useState<PsdImportPlan | null>(null);
  const [importPreviewStatus, setImportPreviewStatus] = useState<
    "idle" | "analyzing" | "review" | "importing"
  >("idle");
  const [importPreviewError, setImportPreviewError] = useState<string | null>(null);
  const [refreshSummary, setRefreshSummary] = useState<PsdRefreshSummary | null>(null);

  return {
    fileInputRef,
    draggedMainCompId,
    setDraggedMainCompId,
    dropTarget,
    setDropTarget,
    pendingPickerMode,
    setPendingPickerMode,
    importPlan,
    setImportPlan,
    importPreviewStatus,
    setImportPreviewStatus,
    importPreviewError,
    setImportPreviewError,
    refreshSummary,
    setRefreshSummary,
  };
}

export type PsdTreeState = ReturnType<typeof usePsdTreeState>;

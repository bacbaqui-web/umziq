import type { RefObject } from "react";
import type {
  PsdImportPlan,
} from "@/engines/project";

export type PsdTreeDropPosition = "before" | "after";

export type PsdTreeDropTarget = {
  targetId: string;
  position: PsdTreeDropPosition;
} | null;

export type PsdTreeNodeViewModel = {
  id: string;
  type: "main" | "sub";
  name: string;
  depth: number;
  selected: boolean;
  sourceSyncStatus:
    | "normal"
    | "updated"
    | "new"
    | "deletePending"
    | "missing";
  canRefresh: boolean;
  canDelete: boolean;
  canReorder: boolean;
  children: PsdTreeNodeViewModel[];
};

export type PsdRefreshSummaryViewModel = {
  compositionName: string;
  hasChanges: boolean;
  problematic: number;
  items: Array<{
    label: string;
    value: number;
    problem: boolean;
  }>;
};

export type PsdTreeViewProps = {
  nodes: PsdTreeNodeViewModel[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  draggedMainCompId: string | null;
  dropTarget: PsdTreeDropTarget;
  importPlan: PsdImportPlan | null;
  importPreviewStatus: "idle" | "analyzing" | "review" | "importing";
  importPreviewError: string | null;
  refreshSummary: PsdRefreshSummaryViewModel | null;
  onImportClick: () => void;
  onFileInputChange: (files: FileList | readonly File[]) => void;
  onSelectNode: (nodeId: string) => void;
  onRefreshMainComp: (compId: string) => void;
  onDeleteMainComp: (compId: string) => void;
  onBeginMainDrag: (compId: string) => void;
  onDragOverMain: (
    targetId: string,
    pointerY: number,
    nodeTop: number,
    nodeHeight: number
  ) => boolean;
  onDropMain: (targetId: string) => void;
  onEndMainDrag: () => void;
  onCancelImport: () => void;
  onConfirmImport: () => void;
  onMoveImportNode: (
    token: string,
    draggedId: string,
    targetId: string | null,
    position: "before" | "inside" | "after"
  ) => void;
  onDismissRefreshSummary: () => void;
};

export type PsdTreeNodeProps = Omit<PsdTreeViewProps, "nodes" | "fileInputRef" | "onImportClick" | "onFileInputChange" | "importPlan" | "importPreviewStatus" | "importPreviewError" | "refreshSummary" | "onCancelImport" | "onConfirmImport" | "onMoveImportNode" | "onDismissRefreshSummary"> & {
  node: PsdTreeNodeViewModel;
  isFirstRoot: boolean;
};

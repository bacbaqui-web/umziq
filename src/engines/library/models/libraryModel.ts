import type { RefObject } from "react";
import type {
  PsdImportPlan,
} from "@/engines/project";

export type LibraryDropPosition = "before" | "after";

export type LibraryDropTarget = {
  targetId: string;
  position: LibraryDropPosition;
} | null;

export type LibraryNodeViewModel = {
  id: string;
  type: "project" | "main" | "sub";
  entityKind: "layer" | "composition" | null;
  name: string;
  depth: number;
  selected: boolean;
  visible: boolean;
  locked: boolean;
  sourceSyncStatus:
    | "normal"
    | "updated"
    | "new"
    | "deletePending"
    | "missing";
  canRefresh: boolean;
  canDelete: boolean;
  canReorder: boolean;
  children: LibraryNodeViewModel[];
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

export type LibraryViewProps = {
  nodes: LibraryNodeViewModel[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  draggedMainCompId: string | null;
  dropTarget: LibraryDropTarget;
  importPlan: PsdImportPlan | null;
  importPreviewStatus: "idle" | "analyzing" | "review" | "importing";
  importPreviewError: string | null;
  refreshSummary: PsdRefreshSummaryViewModel | null;
  onImportClick: () => void;
  onFileInputChange: (files: FileList | readonly File[]) => void;
  onSelectNode: (nodeId: string) => void;
  onToggleNodeVisibility: (nodeId: string) => void;
  onToggleNodeLock: (nodeId: string) => void;
  onRenameNode: (nodeId: string, name: string) => void;
  onDeleteNode: (nodeId: string) => void;
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
  onScaleImport: (
    token: string,
    scalePercent: number
  ) => void;
  onRenameImportNode: (
    token: string,
    layerDocumentId: string,
    name: string
  ) => void;
  onRemoveImportNode: (
    token: string,
    layerDocumentId: string
  ) => void;
  onDismissRefreshSummary: () => void;
};

export type LibraryNodeProps = Omit<LibraryViewProps, "nodes" | "fileInputRef" | "onImportClick" | "onFileInputChange" | "importPlan" | "importPreviewStatus" | "importPreviewError" | "refreshSummary" | "onCancelImport" | "onConfirmImport" | "onMoveImportNode" | "onScaleImport" | "onRenameImportNode" | "onRemoveImportNode" | "onDismissRefreshSummary"> & {
  node: LibraryNodeViewModel;
  isFirstRoot: boolean;
};

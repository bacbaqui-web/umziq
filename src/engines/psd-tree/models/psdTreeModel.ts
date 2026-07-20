import type { RefObject } from "react";
import type { Composition, SourceSyncStatus } from "@/models";
import type {
  PsdImportConfirmResult,
  PsdImportPlan,
  PsdImportSource,
  PsdRefreshCommandResult,
} from "@/engines/project";

export type PsdTreeDropPosition = "before" | "after";

export type PsdTreeDropTarget = {
  targetId: string;
  position: PsdTreeDropPosition;
} | null;

export type PsdTreePickerMode =
  | { type: "import" }
  | { type: "refresh"; mainCompId: string }
  | null;

export type PsdTreeNodeViewModel = {
  id: string;
  type: Composition["type"];
  name: string;
  depth: number;
  selected: boolean;
  sourceSyncStatus: SourceSyncStatus;
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

export type PsdTreeProjectReadPort = {
  rootCompositions: readonly Composition[];
  selectedCompId: string | null;
};

export type PsdTreeProjectCommandPort = {
  preparePsdImport: (sources: PsdImportSource[]) => Promise<PsdImportPlan>;
  confirmPsdImport: (plan: PsdImportPlan) => Promise<PsdImportConfirmResult>;
  cancelPsdImport: (plan: PsdImportPlan) => void;
  refreshMainComposition: (
    compId: string,
    source?: PsdImportSource | null
  ) => Promise<PsdRefreshCommandResult>;
  removeMainComposition: (compId: string) => void;
  reorderMainCompositions: (
    draggedId: string,
    targetId: string,
    position: PsdTreeDropPosition
  ) => void;
};

export type PsdTreeSelectionPort = {
  selectComposition: (compId: string) => void;
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

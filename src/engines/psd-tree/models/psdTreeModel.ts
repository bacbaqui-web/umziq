import type { RefObject } from "react";
import type { Composition, SourceSyncStatus } from "@/models";
import type { PsdImportSource } from "@/engines/project";

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

export type PsdTreeProjectReadPort = {
  rootCompositions: readonly Composition[];
  selectedCompId: string | null;
};

export type PsdTreeProjectCommandPort = {
  importPsdSources: (sources: PsdImportSource[]) => void | Promise<void>;
  refreshMainComposition: (
    compId: string,
    source?: PsdImportSource | null
  ) => Promise<"completed" | "needsSource">;
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
};

export type PsdTreeNodeProps = Omit<PsdTreeViewProps, "nodes" | "fileInputRef" | "onImportClick" | "onFileInputChange"> & {
  node: PsdTreeNodeViewModel;
  isFirstRoot: boolean;
};

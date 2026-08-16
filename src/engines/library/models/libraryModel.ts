import type { RefObject } from "react";
import type {
  PsdImportPlan,
} from "@/engines/project";

export type LibraryDropPosition = "before" | "inside" | "after";

export type LibraryDropTarget = {
  targetId: string;
  position: LibraryDropPosition;
} | null;

export type LibraryNodeViewModel = {
  id: string;
  type: "project" | "main" | "sub";
  entityKind: "layer" | "composition" | null;
  contentKind: "visual" | "audio";
  audioProvenance: "imported" | "recorded" | null;
  playing: boolean;
  muted: boolean;
  sourceId: string | null;
  layerDocumentId: string | null;
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
  audioFileInputRef: RefObject<HTMLInputElement | null>;
  draggedMainCompId: string | null;
  dropTarget: LibraryDropTarget;
  importPlan: PsdImportPlan | null;
  importPreviewStatus: "idle" | "analyzing" | "review" | "importing";
  importPreviewError: string | null;
  audioRecordingStatus: "idle" | "requesting" | "recording" | "preparing" | "review";
  audioRecordingName: string | null;
  refreshSummary: PsdRefreshSummaryViewModel | null;
  onImportClick: () => void;
  onFileInputChange: (files: FileList | readonly File[]) => void;
  onAudioImportClick: () => void;
  onAudioFileInputChange: (files: FileList | readonly File[]) => void;
  onStartAudioRecording: () => void;
  onStopAudioRecording: () => void;
  onCancelAudioRecording: () => void;
  onConfirmAudioRecording: () => void;
  onSelectNode: (nodeId: string) => void;
  onToggleNodeVisibility: (nodeId: string) => void;
  onToggleNodeLock: (nodeId: string) => void;
  onToggleNodePlayback: (nodeId: string) => void;
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
  onMoveNodeKeyboard: (nodeId: string, direction: -1 | 1) => void;
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

export type LibraryNodeProps = Omit<LibraryViewProps, "nodes" | "fileInputRef" | "audioFileInputRef" | "onImportClick" | "onFileInputChange" | "onAudioImportClick" | "onAudioFileInputChange" | "audioRecordingStatus" | "audioRecordingName" | "onStartAudioRecording" | "onStopAudioRecording" | "onCancelAudioRecording" | "onConfirmAudioRecording" | "importPlan" | "importPreviewStatus" | "importPreviewError" | "refreshSummary" | "onCancelImport" | "onConfirmImport" | "onMoveImportNode" | "onScaleImport" | "onRenameImportNode" | "onRemoveImportNode" | "onDismissRefreshSummary"> & {
  node: LibraryNodeViewModel;
  isFirstRoot: boolean;
};

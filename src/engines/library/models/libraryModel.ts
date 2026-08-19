import type { RefObject } from "react";
import type {
  PsdImportPlan,
} from "@/engines/project";
import type {
  SourceResourceReference,
} from "@/gateway/contracts/sourceAccessGateway";
import type {
  LibraryRecordingPreview,
} from "@/engines/library/models/libraryRecordingModel";
import type { MicrophoneDevice } from "@/gateway/contracts/microphoneCaptureGateway";
import type {
  LibraryRecordingEditRequest,
  LibraryRecordingStatus,
} from "@/engines/library/models/libraryRecordingModel";
import type {
  LayerDocumentAudioProcessingFeature,
  LayerDocumentAudioProcessingSnapshot,
  LayerDocumentProjectReconnectReadItem,
} from "@/engines/project";

export type LibraryDropPosition = "before" | "inside" | "after";

export type LibraryDropTarget = {
  targetId: string;
  position: LibraryDropPosition;
} | null;

export type LibraryNodeViewModel = {
  id: string;
  type: "project" | "main" | "sub";
  entityKind: "layer" | "composition" | "drawing" | null;
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
  preview: (() => LibraryHoverPreviewViewModel | null) | null;
  children: LibraryNodeViewModel[];
};

export type LibraryHoverPreviewViewModel =
  | {
      kind: "visual";
      name: string;
      width: number | null;
      height: number | null;
      surface: CanvasImageSource | null;
      status: "ready" | "empty" | "missing";
    }
  | {
      kind: "audio";
      name: string;
      durationSeconds: number | null;
      channelCount: number | null;
      sampleRate: number | null;
      waveform: readonly number[];
      status: "ready" | "empty" | "missing";
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
  projectIdentity?: string;
  nodes: LibraryNodeViewModel[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  audioFileInputRef: RefObject<HTMLInputElement | null>;
  draggedMainCompId: string | null;
  dropTarget: LibraryDropTarget;
  importPlan: PsdImportPlan | null;
  importPreviewStatus: "idle" | "analyzing" | "review" | "importing";
  importPreviewError: string | null;
  audioRecordingStatus: LibraryRecordingStatus;
  audioRecordingName: string | null;
  audioRecordingPreview: LibraryRecordingPreview | null;
  audioRecordingLiveWaveform: ((target: Float32Array) => void) | null;
  audioRecordingProcessing: LayerDocumentAudioProcessingSnapshot | null;
  audioRecordingChangingProcessing: LayerDocumentAudioProcessingFeature | null;
  audioRecordingProcessingError: string | null;
  audioRecordingError: string | null;
  audioRecordingCanCancel: boolean;
  audioRecordingCanRetry: boolean;
  audioRecordingCanConfirm: boolean;
  enumerateMicrophoneDevices: () => Promise<readonly MicrophoneDevice[]>;
  subscribeMicrophoneDevices: (listener: () => void) => () => void;
  assetCopyPrompt: { readonly kind: "psd" | "audio"; readonly fileCount: number } | null;
  hoverPreview: {
    readonly preview: LibraryHoverPreviewViewModel;
    readonly x: number;
    readonly y: number;
  } | null;
  refreshSummary: PsdRefreshSummaryViewModel | null;
  missingSources: readonly LayerDocumentProjectReconnectReadItem[];
  onReconnectSource: (sourceId: string) => void;
  onImportClick: () => void;
  onFileInputChange: (sources: readonly SourceResourceReference[]) => void;
  onAudioImportClick: () => void;
  onAudioFileInputChange: (sources: readonly SourceResourceReference[]) => void;
  onStartAudioRecording: () => void;
  onCreateDrawingLayer: () => void;
  onBeginAudioRecording: (deviceId?: string | null) => void;
  onStopAudioRecording: () => void;
  onSetAudioRecordingProcessing: (
    feature: LayerDocumentAudioProcessingFeature,
    enabled: boolean
  ) => void;
  onRetryAudioRecording: () => void;
  onCancelAudioRecording: () => void;
  onConfirmAudioRecording: (request: LibraryRecordingEditRequest) => void;
  onResolveAssetCopy: (copy: boolean) => void;
  onPreviewMove: (
    preview: LibraryHoverPreviewViewModel,
    clientX: number,
    clientY: number
  ) => void;
  onPreviewEnd: () => void;
  onSelectNode: (nodeId: string) => void;
  onSelectNodeForContextMenu: (nodeId: string) => void;
  onToggleNodeVisibility: (nodeId: string) => void;
  onToggleNodeLock: (nodeId: string) => void;
  onToggleNodePlayback: (nodeId: string) => void;
  onRenameNode: (nodeId: string, name: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onConvertNodeToDrawing: (nodeId: string) => void;
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

export type LibraryNodeProps = Omit<LibraryViewProps, "nodes" | "fileInputRef" | "audioFileInputRef" | "onImportClick" | "onFileInputChange" | "onAudioImportClick" | "onAudioFileInputChange" | "audioRecordingStatus" | "audioRecordingName" | "audioRecordingPreview" | "audioRecordingLiveWaveform" | "audioRecordingProcessing" | "audioRecordingChangingProcessing" | "audioRecordingProcessingError" | "audioRecordingError" | "audioRecordingCanCancel" | "audioRecordingCanRetry" | "audioRecordingCanConfirm" | "enumerateMicrophoneDevices" | "subscribeMicrophoneDevices" | "assetCopyPrompt" | "hoverPreview" | "onStartAudioRecording" | "onCreateDrawingLayer" | "onBeginAudioRecording" | "onStopAudioRecording" | "onSetAudioRecordingProcessing" | "onRetryAudioRecording" | "onCancelAudioRecording" | "onConfirmAudioRecording" | "onResolveAssetCopy" | "importPlan" | "importPreviewStatus" | "importPreviewError" | "refreshSummary" | "missingSources" | "onReconnectSource" | "onCancelImport" | "onConfirmImport" | "onMoveImportNode" | "onScaleImport" | "onRenameImportNode" | "onRemoveImportNode" | "onDismissRefreshSummary"> & {
  node: LibraryNodeViewModel;
  isFirstRoot: boolean;
  onPreviewMove: (
    preview: LibraryHoverPreviewViewModel,
    clientX: number,
    clientY: number
  ) => void;
  onPreviewEnd: () => void;
};

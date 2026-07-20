import type {
  EvaluatedSceneSize,
  EvaluatedSceneTransform,
  PreviewScene,
} from "@/engines/playback-render";

export const DIRTY_KINDS = [
  "transform",
  "opacity",
  "visibility",
  "hierarchy",
  "order",
  "source",
  "frame",
  "logicalSize",
  "composition",
] as const;

export type DirtyKind = (typeof DIRTY_KINDS)[number];

export type DirtyTargetKind = "layer" | "composition" | "scene";

export type DirtyNodeSnapshot = {
  readonly id: string;
  readonly kind: Exclude<DirtyTargetKind, "scene">;
  readonly parentId: string | null;
  readonly childrenIds: readonly string[];
  readonly sourceId: string;
  readonly sourceFingerprint?: string | null;
  readonly transform: EvaluatedSceneTransform;
  readonly opacity: number;
  readonly visible: boolean;
  readonly order: number;
  readonly localFrame: number;
  readonly globalFrame: number;
  readonly logicalSize: EvaluatedSceneSize;
  readonly children: readonly DirtyNodeSnapshot[];
};

export type DirtySceneSnapshot = {
  readonly id: string;
  readonly kind: "scene";
  readonly globalFrame: number;
  readonly logicalSize: EvaluatedSceneSize;
  readonly childrenIds: readonly string[];
  readonly nodes: readonly DirtyNodeSnapshot[];
};

export type DirtyNodeRecord = {
  readonly id: string;
  readonly kind: DirtyTargetKind;
  readonly dirtyKinds: readonly DirtyKind[];
};

export type DirtySummary = Readonly<Record<DirtyKind, number>> & {
  readonly dirtyNodeCount: number;
};

export type DirtyStateSnapshot = {
  readonly current: DirtySceneSnapshot | null;
  readonly dirtyNodes: readonly DirtyNodeRecord[];
  readonly summary: DirtySummary;
};

export type DirtyStateResource = {
  readonly updateDirtyState: (next: DirtySceneSnapshot | null) => DirtyStateSnapshot;
  readonly clearDirtyState: () => DirtyStateSnapshot;
  readonly resetDirtyState: () => DirtyStateSnapshot;
  readonly isDirty: () => boolean;
  readonly getDirtyNodes: () => readonly DirtyNodeRecord[];
  readonly getDirtySummary: () => DirtySummary;
  readonly getSnapshot: () => DirtyStateSnapshot;
};

export type PreviewSceneDirtySnapshotOptions = {
  readonly sourceFingerprintBySourceId?: ReadonlyMap<string, string | null>;
};

export type PreviewSceneDirtySnapshotInput = {
  readonly previewScene: PreviewScene | null;
  readonly options?: PreviewSceneDirtySnapshotOptions;
};

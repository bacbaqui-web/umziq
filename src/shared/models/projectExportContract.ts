export type ProjectExportFormat =
  | "mp4"
  | "webm-alpha"
  | "gif"
  | "webp";

export type ProjectExportProgress = {
  readonly completedFrames: number;
  readonly totalFrames: number;
};

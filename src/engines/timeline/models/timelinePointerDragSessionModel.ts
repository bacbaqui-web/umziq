export type TimelinePointerDragCommitReason =
  | "pointer-up"
  | "buttons-zero"
  | "window-blur"
  | "document-leave"
  | "visibility-hidden"
  | "lost-pointer-capture";

export type TimelinePointerDragCancelReason =
  | "pointer-cancel"
  | "explicit"
  | "replaced"
  | "dispose";

export interface TimelinePointerDragEventLike {
  readonly pointerId?: number;
  readonly clientX?: number;
  readonly buttons?: number;
}

export interface TimelinePointerDragEventTarget {
  addEventListener(
    type: string,
    listener: (event: TimelinePointerDragEventLike) => void,
    options?: boolean
  ): void;
  removeEventListener(
    type: string,
    listener: (event: TimelinePointerDragEventLike) => void,
    options?: boolean
  ): void;
}

export interface TimelinePointerCaptureTarget
  extends TimelinePointerDragEventTarget {
  setPointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
  releasePointerCapture(pointerId: number): void;
}

export type TimelinePointerDragEnvironment = {
  readonly windowTarget: TimelinePointerDragEventTarget;
  readonly documentTarget: TimelinePointerDragEventTarget;
  readonly documentRootTarget: TimelinePointerDragEventTarget;
  readonly readVisibilityState: () => DocumentVisibilityState;
};

export type TimelinePointerDragBeginInput = {
  readonly pointerId: number;
  readonly clientX: number;
  readonly captureTarget: TimelinePointerCaptureTarget;
};

export type TimelinePointerDragCompletion<
  TSession,
> = {
  readonly session: TSession;
  readonly didMove: boolean;
};

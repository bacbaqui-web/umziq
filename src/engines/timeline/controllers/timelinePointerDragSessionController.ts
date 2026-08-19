import type {
  TimelinePointerDragBeginInput,
  TimelinePointerDragCancelReason,
  TimelinePointerDragCommitReason,
  TimelinePointerDragEnvironment,
  TimelinePointerDragEventLike,
  TimelinePointerDragCompletion,
} from "@/engines/timeline/models/timelinePointerDragSessionModel";

type PointerSession = {
  readonly type: string;
};

type Options<TSession extends PointerSession> = {
  readonly environment: TimelinePointerDragEnvironment;
  readonly move: (
    session: TSession,
    clientX: number
  ) => TSession | void;
  readonly commit: (
    session: TSession,
    reason: TimelinePointerDragCommitReason,
    completion: TimelinePointerDragCompletion<TSession>
  ) => void;
  readonly cancel: (
    session: TSession,
    reason: TimelinePointerDragCancelReason
  ) => void;
};

export function createTimelinePointerDragSessionController<
  TSession extends PointerSession,
>(options: Options<TSession>) {
  let active: {
    session: TSession;
    input: TimelinePointerDragBeginInput;
    didMove: boolean;
  } | null = null;

  const matchesPointer = (event: TimelinePointerDragEventLike) =>
    event.pointerId === undefined ||
    event.pointerId === active?.input.pointerId;

  const detach = (
    value: NonNullable<typeof active>
  ) => {
    const { environment } = options;
    environment.windowTarget.removeEventListener(
      "pointermove",
      handleMove,
      true
    );
    environment.documentTarget.removeEventListener(
      "pointerup",
      handlePointerUp,
      true
    );
    environment.documentTarget.removeEventListener(
      "pointercancel",
      handlePointerCancel,
      true
    );
    environment.windowTarget.removeEventListener(
      "blur",
      handleWindowBlur
    );
    environment.documentRootTarget.removeEventListener(
      "mouseleave",
      handleDocumentLeave
    );
    environment.documentTarget.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    value.input.captureTarget.removeEventListener(
      "lostpointercapture",
      handleLostPointerCapture
    );
    if (
      value.input.captureTarget.hasPointerCapture(
        value.input.pointerId
      )
    ) {
      value.input.captureTarget.releasePointerCapture(
        value.input.pointerId
      );
    }
  };

  const commit = (
    reason: TimelinePointerDragCommitReason
  ) => {
    const value = active;
    if (!value) return;
    active = null;
    detach(value);
    options.commit(value.session, reason, {
      session: value.session,
      didMove: value.didMove,
    });
  };

  const cancel = (
    reason: TimelinePointerDragCancelReason
  ) => {
    const value = active;
    if (!value) return;
    active = null;
    detach(value);
    options.cancel(value.session, reason);
  };

  function handleMove(
    event: TimelinePointerDragEventLike
  ) {
    if (!active || !matchesPointer(event)) return;
    if (event.buttons === 0) {
      commit("buttons-zero");
      return;
    }
    if (event.clientX === undefined) return;
    if (event.clientX !== active.input.clientX) {
      active.didMove = true;
    }
    const next = options.move(
      active.session,
      event.clientX
    );
    if (next && active) active.session = next;
  }

  function handlePointerUp(
    event: TimelinePointerDragEventLike
  ) {
    if (matchesPointer(event)) commit("pointer-up");
  }

  function handlePointerCancel(
    event: TimelinePointerDragEventLike
  ) {
    if (matchesPointer(event)) cancel("pointer-cancel");
  }

  function handleWindowBlur() {
    commit("window-blur");
  }

  function handleDocumentLeave() {
    commit("document-leave");
  }

  function handleVisibilityChange() {
    if (
      options.environment.readVisibilityState() ===
      "hidden"
    ) {
      commit("visibility-hidden");
    }
  }

  function handleLostPointerCapture(
    event: TimelinePointerDragEventLike
  ) {
    if (matchesPointer(event)) {
      commit("lost-pointer-capture");
    }
  }

  return {
    begin: (
      session: TSession,
      input: TimelinePointerDragBeginInput
    ) => {
      cancel("replaced");
      active = { session, input, didMove: false };
      const { environment } = options;
      environment.windowTarget.addEventListener(
        "pointermove",
        handleMove,
        true
      );
      environment.documentTarget.addEventListener(
        "pointerup",
        handlePointerUp,
        true
      );
      environment.documentTarget.addEventListener(
        "pointercancel",
        handlePointerCancel,
        true
      );
      environment.windowTarget.addEventListener(
        "blur",
        handleWindowBlur
      );
      environment.documentRootTarget.addEventListener(
        "mouseleave",
        handleDocumentLeave
      );
      environment.documentTarget.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      input.captureTarget.addEventListener(
        "lostpointercapture",
        handleLostPointerCapture
      );
      input.captureTarget.setPointerCapture(
        input.pointerId
      );
    },
    cancel: () => cancel("explicit"),
    dispose: () => cancel("dispose"),
    readSession: () => active?.session ?? null,
  };
}

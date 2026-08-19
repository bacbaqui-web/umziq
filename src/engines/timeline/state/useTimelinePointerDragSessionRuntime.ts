import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  createTimelinePointerDragSessionController,
} from "@/engines/timeline/controllers/timelinePointerDragSessionController";
import type {
  TimelinePointerDragBeginInput,
  TimelinePointerDragCompletion,
  TimelinePointerDragEnvironment,
} from "@/engines/timeline/models/timelinePointerDragSessionModel";

type PointerSession = {
  readonly type: string;
};

type Options<TSession extends PointerSession> = {
  move: (
    session: TSession,
    clientX: number
  ) => TSession | void;
  commit: (session: TSession) => void;
  cancel: (session: TSession) => void;
};

function createBrowserPointerDragEnvironment():
  TimelinePointerDragEnvironment {
  return {
    windowTarget: window,
    documentTarget: document,
    documentRootTarget: document.documentElement,
    readVisibilityState: () =>
      document.visibilityState,
  };
}

export function useTimelinePointerDragSessionRuntime<
  TSession extends PointerSession,
>(options: Options<TSession>) {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  }, [options]);
  const completionRef = useRef<
    TimelinePointerDragCompletion<TSession> | null
  >(null);
  const mountedRef = useRef(true);
  const [activeType, setActiveType] =
    useState<TSession["type"] | null>(null);
  const controllerRef = useRef<
    ReturnType<
      typeof createTimelinePointerDragSessionController<TSession>
    > | null
  >(null);

  useEffect(() => {
    const controller =
      createTimelinePointerDragSessionController<TSession>({
        environment:
          createBrowserPointerDragEnvironment(),
        move: (session, clientX) =>
          optionsRef.current.move(session, clientX),
        commit: (session, _reason, completion) => {
          completionRef.current = completion;
          if (mountedRef.current) {
            setActiveType(null);
          }
          optionsRef.current.commit(session);
        },
        cancel: (session) => {
          completionRef.current = null;
          if (mountedRef.current) {
            setActiveType(null);
          }
          optionsRef.current.cancel(session);
        },
      });
    controllerRef.current = controller;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (activeType !== "move-keyframe") return;
    const body = document.body.style.cursor;
    const root = document.documentElement.style.cursor;
    document.body.style.cursor = "none";
    document.documentElement.style.cursor = "none";
    return () => {
      document.body.style.cursor = body;
      document.documentElement.style.cursor = root;
    };
  }, [activeType]);

  const begin = useCallback((
    session: TSession,
    input: TimelinePointerDragBeginInput
  ) => {
    completionRef.current = null;
    controllerRef.current?.begin(session, input);
    setActiveType(session.type);
  }, []);
  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
  }, []);
  const consumeCompletion = useCallback(() => {
    const completion = completionRef.current;
    completionRef.current = null;
    return completion;
  }, []);

  return {
    begin,
    cancel,
    activeType,
    consumeCompletion,
  };
}

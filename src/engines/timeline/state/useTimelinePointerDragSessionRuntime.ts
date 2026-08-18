import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  createTimelinePointerDragSessionController,
} from "@/engines/timeline/controllers/timelinePointerDragSessionController";
import {
  resolveTimelineAutoScroll,
} from "@/engines/timeline/helpers/timelineInteractionHelpers";
import type {
  TimelinePointerDragBeginInput,
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
  scrollContainerRef?:
    RefObject<HTMLElement | null>;
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
  const scrollStartLeftRef = useRef(0);
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
        move: (session, rawClientX) => {
          const currentOptions = optionsRef.current;
          const scrollContainer =
            currentOptions.scrollContainerRef?.current;
          if (scrollContainer) {
            const bounds =
              scrollContainer.getBoundingClientRect();
            const scrollDelta =
              resolveTimelineAutoScroll(
                rawClientX,
                bounds.left,
                bounds.right,
                36,
                18
              );
            if (scrollDelta !== 0) {
              scrollContainer.scrollTo({
                left:
                  scrollContainer.scrollLeft +
                  scrollDelta,
              });
            }
          }
          const clientX =
            rawClientX +
            (scrollContainer?.scrollLeft ?? 0) -
            scrollStartLeftRef.current;
          return currentOptions.move(
            session,
            clientX
          );
        },
        commit: (session) => {
          if (mountedRef.current) {
            setActiveType(null);
          }
          optionsRef.current.commit(session);
        },
        cancel: (session) => {
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
    scrollStartLeftRef.current =
      optionsRef.current.scrollContainerRef
        ?.current?.scrollLeft ?? 0;
    controllerRef.current?.begin(session, input);
    setActiveType(session.type);
  }, []);
  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
  }, []);

  return { begin, cancel, activeType };
}

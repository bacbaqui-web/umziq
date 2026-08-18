import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { resolveTimelineAutoScroll } from "@/engines/timeline/helpers/timelineInteractionHelpers";

type PointerSession = {
  readonly type: string;
};

type Options<TSession extends PointerSession> = {
  move: (
    session: TSession,
    clientX: number
  ) => TSession | void;
  end: (session: TSession) => void;
  scrollContainerRef: RefObject<HTMLElement | null>;
};

export function useTimelinePointerController<
  TSession extends PointerSession,
>(options: Options<TSession>) {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  }, [options]);
  const sessionRef = useRef<TSession | null>(null);
  const scrollStartLeftRef = useRef(0);
  const [activeType, setActiveType] =
    useState<TSession["type"] | null>(null);
  const begin = useCallback((session: TSession) => {
    sessionRef.current = session;
    scrollStartLeftRef.current = optionsRef.current.scrollContainerRef.current?.scrollLeft ?? 0;
    setActiveType(session.type);
  }, []);
  const cancel = useCallback(() => {
    sessionRef.current = null;
    setActiveType(null);
  }, []);

  useEffect(() => {
    const finish = () => {
      const session = sessionRef.current;
      if (!session) return;
      optionsRef.current.end(session);
      sessionRef.current = null;
      setActiveType(null);
    };
    const move = (event: MouseEvent) => {
      if (sessionRef.current) {
        if (event.buttons === 0) {
          finish();
          return;
        }
        const currentOptions = optionsRef.current;
        const scrollContainer = currentOptions.scrollContainerRef.current;
        if (scrollContainer) {
          const bounds = scrollContainer.getBoundingClientRect();
          scrollContainer.scrollLeft += resolveTimelineAutoScroll(
            event.clientX,
            bounds.left,
            bounds.right,
            36,
            18
          );
        }
        const clientX = event.clientX
          + (scrollContainer?.scrollLeft ?? 0)
          - scrollStartLeftRef.current;
        const next = currentOptions.move(sessionRef.current, clientX);
        if (next) sessionRef.current = next;
      }
    };
    const visibility = () => { if (document.visibilityState === "hidden") finish(); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", finish, true);
    window.addEventListener("blur", finish);
    document.documentElement.addEventListener("mouseleave", finish);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", finish, true);
      window.removeEventListener("blur", finish);
      document.documentElement.removeEventListener("mouseleave", finish);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (activeType !== "move-keyframe") return;
    const body = document.body.style.cursor;
    const root = document.documentElement.style.cursor;
    document.body.style.cursor = "none";
    document.documentElement.style.cursor = "none";
    return () => { document.body.style.cursor = body; document.documentElement.style.cursor = root; };
  }, [activeType]);
  return { begin, cancel, activeType };
}

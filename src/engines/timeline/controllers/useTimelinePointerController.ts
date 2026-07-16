import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { TimelinePointerSession } from "@/engines/timeline/models/timelineInteractionModel";
import { resolveTimelineAutoScroll } from "@/engines/timeline/helpers/timelineInteractionHelpers";

type Options = {
  move: (session: TimelinePointerSession, clientX: number) => TimelinePointerSession | void;
  end: (session: TimelinePointerSession) => void;
  scrollContainerRef: RefObject<HTMLElement | null>;
};

export function useTimelinePointerController(options: Options) {
  const sessionRef = useRef<TimelinePointerSession | null>(null);
  const scrollStartLeftRef = useRef(0);
  const [activeType, setActiveType] = useState<TimelinePointerSession["type"] | null>(null);
  const begin = useCallback((session: TimelinePointerSession) => {
    sessionRef.current = session;
    scrollStartLeftRef.current = options.scrollContainerRef.current?.scrollLeft ?? 0;
    setActiveType(session.type);
  }, [options]);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (sessionRef.current) {
        const scrollContainer = options.scrollContainerRef.current;
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
        const next = options.move(sessionRef.current, clientX);
        if (next) sessionRef.current = next;
      }
    };
    const finish = () => {
      const session = sessionRef.current;
      if (!session) return;
      options.end(session);
      sessionRef.current = null;
      setActiveType(null);
    };
    const visibility = () => { if (document.visibilityState === "hidden") finish(); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", finish, true);
    window.addEventListener("blur", finish);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", finish, true);
      window.removeEventListener("blur", finish);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [options]);

  useEffect(() => {
    if (activeType !== "move-keyframe") return;
    const body = document.body.style.cursor;
    const root = document.documentElement.style.cursor;
    document.body.style.cursor = "none";
    document.documentElement.style.cursor = "none";
    return () => { document.body.style.cursor = body; document.documentElement.style.cursor = root; };
  }, [activeType]);
  return { begin, activeType };
}

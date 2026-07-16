import { useCallback, useEffect, useRef, useState } from "react";
import type { Composition, Layer } from "@/models";
import {
  buildTimelineBreadcrumbPath,
  buildTimelineCompositionSwitcherViewModel,
} from "@/engines/timeline/helpers/timelineBreadcrumbHelpers";
import type { TimelineSelection } from "@/engines/timeline/models/timelineViewModel";

type Options = {
  selectedComposition: Composition | null;
  selectedTimelineTarget: TimelineSelection;
  allLayersById: Map<string, Layer>;
  allCompositionsById: Map<string, Composition>;
  selectComposition: (compId: string) => void;
};

export function useTimelineNavigationController(options: Options) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement | null>(null);
  const breadcrumbPath = buildTimelineBreadcrumbPath(
    options.selectedComposition,
    options.selectedTimelineTarget,
    options.allLayersById,
    options.allCompositionsById
  );
  const switcher = buildTimelineCompositionSwitcherViewModel(
    options.selectedComposition,
    options.allCompositionsById,
    isSwitcherOpen
  );

  useEffect(() => {
    if (!isSwitcherOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) setIsSwitcherOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isSwitcherOpen]);

  const toggleCompositionSwitcher = useCallback(() => {
    setIsSwitcherOpen((current) => !current);
  }, []);
  const selectComposition = useCallback((compId: string) => {
    options.selectComposition(compId);
    setIsSwitcherOpen(false);
  }, [options]);

  return { switcherRef, breadcrumbPath, switcher, toggleCompositionSwitcher, selectComposition };
}

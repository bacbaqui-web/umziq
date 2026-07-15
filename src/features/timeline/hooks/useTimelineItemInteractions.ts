import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";
import {
  reorderCompositionState,
} from "@/editor/actions/editorActions";
import type {
  Composition,
  CompositionMeta,
  RenderItem,
  TimelineItem,
} from "@/editor/types/types";
import type { TimelineSelection } from "@/editor/types/editorViewTypes";
import { flattenRenderItemsToDrawables } from "@/editor/preview/previewEngine";
import {
  findCompositionById,
  findMainComp,
  reorderItems,
  reorderRenderItems,
  visitCompositionTree,
} from "@/editor/models/projectModelHelpers";
import type { TimelineInteraction } from "@/features/timeline/types/timelineInteractionTypes";

type UseTimelineItemInteractionsOptions = {
  masterCompId: string;
  timelinePxPerFrame: number;
  selectedComp: Composition;
  selectedMeta: CompositionMeta | null;
  currentFrame: number;
  comps: Composition[];
  draggedTimelineItemId: string | null;
  selectedTimelineTarget: TimelineSelection;
  selectedTimelineItems: TimelineItem[];
  renderItemsByCompId: Record<string, RenderItem[]>;
  timelineInteractionRef: MutableRefObject<TimelineInteraction | null>;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setTimelineItemsByCompId: Dispatch<
    SetStateAction<Record<string, TimelineItem[]>>
  >;
  setRenderItemsByCompId: Dispatch<
    SetStateAction<Record<string, RenderItem[]>>
  >;
  setSelectedCompId: Dispatch<SetStateAction<string>>;
  setDraggedTimelineItemId: Dispatch<SetStateAction<string | null>>;
  pushCompositionHistorySnapshot: (compId: string) => void;
  beginCompositionHistoryCapture: (compId: string) => void;
  markCompositionHistoryCaptureDirty: (compId: string) => void;
  commitCompositionHistoryCapture: (compId: string) => void;
  applySelectionForComposition: (
    compId: string,
    nextSelection: TimelineSelection
  ) => void;
};

export function useTimelineItemInteractions({
  masterCompId,
  timelinePxPerFrame,
  selectedComp,
  selectedMeta,
  currentFrame,
  comps,
  draggedTimelineItemId,
  selectedTimelineTarget,
  selectedTimelineItems,
  renderItemsByCompId,
  timelineInteractionRef,
  setComps,
  setTimelineItemsByCompId,
  setRenderItemsByCompId,
  setSelectedCompId,
  setDraggedTimelineItemId,
  pushCompositionHistorySnapshot,
  beginCompositionHistoryCapture,
  markCompositionHistoryCaptureDirty,
  commitCompositionHistoryCapture,
  applySelectionForComposition,
}: UseTimelineItemInteractionsOptions) {
  const createTimelineItemId = useCallback((baseId: string) => {
    return `${baseId}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
  }, []);

  const updateTimelineItemTiming = useCallback(
    (compId: string, itemId: string, updater: (item: TimelineItem) => TimelineItem) => {
      setTimelineItemsByCompId((prev) => {
        const currentItems = prev[compId] ?? [];
        return {
          ...prev,
          [compId]: currentItems.map((item) => (item.id === itemId ? updater(item) : item)),
        };
      });
    },
    [setTimelineItemsByCompId]
  );

  const handleTimelineReorder = useCallback(
    (targetItemId: string) => {
      if (!draggedTimelineItemId || draggedTimelineItemId === targetItemId) {
        return;
      }

      const reorderedTimelineItems = reorderItems(
        selectedTimelineItems,
        draggedTimelineItemId,
        targetItemId
      );

      if (reorderedTimelineItems === selectedTimelineItems) {
        return;
      }

      pushCompositionHistorySnapshot(selectedComp.id);

      if (selectedComp.id === masterCompId) {
        const reorderedMainComps = reorderedTimelineItems
          .map((item) => comps.find((comp) => comp.id === item.sourceId))
          .filter((comp): comp is Composition => !!comp);

        setComps(reorderedMainComps);
        setTimelineItemsByCompId((prev) => ({
          ...prev,
          [masterCompId]: reorderedTimelineItems,
        }));
        setDraggedTimelineItemId(null);
        return;
      }

      const currentRenderItems = renderItemsByCompId[selectedComp.id] ?? [];
      const reorderedRenderItems = reorderRenderItems(
        currentRenderItems,
        reorderedTimelineItems
      );
      const nextComps = reorderCompositionState(
        comps,
        selectedComp.id,
        reorderedTimelineItems
      );
      const nextSelectedComp = findCompositionById(nextComps, selectedComp.id);
      const nextRenderItemsByCompId = {
        ...renderItemsByCompId,
        [selectedComp.id]: reorderedRenderItems,
      };

      if (selectedComp.type === "sub" && selectedComp.parentId) {
        const mainComp = findMainComp(nextComps, nextSelectedComp ?? selectedComp);

        if (mainComp) {
          visitCompositionTree(mainComp, (target) => {
            nextRenderItemsByCompId[target.id] = (nextRenderItemsByCompId[target.id] ?? []).map(
              (item) =>
                item.kind === "subComp" && item.targetCompId
                  ? {
                      ...item,
                      drawables: flattenRenderItemsToDrawables(
                        nextRenderItemsByCompId,
                        item.targetCompId
                      ),
                    }
                  : item
            );
          });
        }
      }

      setTimelineItemsByCompId((prev) => ({
        ...prev,
        [selectedComp.id]: reorderedTimelineItems,
      }));
      setRenderItemsByCompId(nextRenderItemsByCompId);
      setComps(nextComps);
      setSelectedCompId(nextSelectedComp?.id ?? masterCompId);
      setDraggedTimelineItemId(null);
    },
    [
      comps,
      draggedTimelineItemId,
      masterCompId,
      renderItemsByCompId,
      selectedComp,
      selectedTimelineItems,
      pushCompositionHistorySnapshot,
      setComps,
      setDraggedTimelineItemId,
      setRenderItemsByCompId,
      setSelectedCompId,
      setTimelineItemsByCompId,
    ]
  );

  const beginMoveTimelineItem = useCallback((event: ReactMouseEvent, item: TimelineItem) => {
    event.preventDefault();
    event.stopPropagation();
    beginCompositionHistoryCapture(selectedComp.id);

    timelineInteractionRef.current = {
      type: "move-item",
      itemId: item.id,
      startClientX: event.clientX,
      initialStartFrame: item.startFrame,
    };
  }, [beginCompositionHistoryCapture, selectedComp.id, timelineInteractionRef]);

  const beginResizeTimelineItemStart = useCallback(
    (event: ReactMouseEvent, item: TimelineItem) => {
      event.preventDefault();
      event.stopPropagation();
      beginCompositionHistoryCapture(selectedComp.id);

      timelineInteractionRef.current = {
        type: "resize-start",
        itemId: item.id,
        startClientX: event.clientX,
        initialStartFrame: item.startFrame,
        initialDurationFrames: item.durationFrames,
      };
    },
    [beginCompositionHistoryCapture, selectedComp.id, timelineInteractionRef]
  );

  const beginResizeTimelineItemEnd = useCallback(
    (event: ReactMouseEvent, item: TimelineItem) => {
      event.preventDefault();
      event.stopPropagation();
      beginCompositionHistoryCapture(selectedComp.id);

      timelineInteractionRef.current = {
        type: "resize-end",
        itemId: item.id,
        startClientX: event.clientX,
        initialDurationFrames: item.durationFrames,
      };
    },
    [beginCompositionHistoryCapture, selectedComp.id, timelineInteractionRef]
  );

  const handleSelectTimelineItem = useCallback(
    (item: TimelineItem) => {
      applySelectionForComposition(selectedComp.id, {
        itemId: item.id,
        sourceId: item.sourceId,
        kind: item.kind,
      });
    },
    [applySelectionForComposition, selectedComp.id]
  );

  const duplicateSelectedTimelineItem = useCallback(() => {
    if (!selectedTimelineTarget) {
      return;
    }

    const selectedItemIndex = selectedTimelineItems.findIndex((item) =>
      selectedTimelineTarget.itemId
        ? item.id === selectedTimelineTarget.itemId
        : item.sourceId === selectedTimelineTarget.sourceId &&
          item.kind === selectedTimelineTarget.kind
    );

    if (selectedItemIndex === -1) {
      return;
    }

    const selectedItem = selectedTimelineItems[selectedItemIndex];
    const duplicatedItemId = `${selectedItem.id}-copy-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const duplicatedItem: TimelineItem = {
      ...selectedItem,
      id: duplicatedItemId,
    };

    pushCompositionHistorySnapshot(selectedComp.id);

    setTimelineItemsByCompId((prev) => {
      const currentItems = prev[selectedComp.id] ?? [];
      const insertIndex = currentItems.findIndex((item) => item.id === selectedItem.id);

      if (insertIndex === -1) {
        return prev;
      }

      return {
        ...prev,
        [selectedComp.id]: [
          ...currentItems.slice(0, insertIndex + 1),
          duplicatedItem,
          ...currentItems.slice(insertIndex + 1),
        ],
      };
    });

    setRenderItemsByCompId((prev) => {
      const currentRenderItems = prev[selectedComp.id];

      if (!currentRenderItems || currentRenderItems.length === 0) {
        return prev;
      }

      const sourceRenderItem =
        currentRenderItems[selectedItemIndex] ??
        currentRenderItems.find(
          (item) =>
            item.sourceId === selectedItem.sourceId && item.kind === selectedItem.kind
        );

      if (!sourceRenderItem) {
        return prev;
      }

      const duplicatedRenderItem: RenderItem = {
        ...sourceRenderItem,
        id: `${sourceRenderItem.id}-copy-${duplicatedItemId}`,
      };
      const insertIndex = Math.min(selectedItemIndex + 1, currentRenderItems.length);

      return {
        ...prev,
        [selectedComp.id]: [
          ...currentRenderItems.slice(0, insertIndex),
          duplicatedRenderItem,
          ...currentRenderItems.slice(insertIndex),
        ],
      };
    });

    applySelectionForComposition(selectedComp.id, {
      itemId: duplicatedItem.id,
      sourceId: duplicatedItem.sourceId,
      kind: duplicatedItem.kind,
    });
  }, [
    applySelectionForComposition,
    selectedComp.id,
    selectedTimelineItems,
    selectedTimelineTarget,
    pushCompositionHistorySnapshot,
    setRenderItemsByCompId,
    setTimelineItemsByCompId,
  ]);

  const renameTimelineItem = useCallback(
    (itemId: string, nextName: string) => {
      const trimmedName = nextName.trim();

      if (!trimmedName) {
        return;
      }

      const currentItem = selectedTimelineItems.find((item) => item.id === itemId);

      if (!currentItem || currentItem.name === trimmedName) {
        return;
      }

      pushCompositionHistorySnapshot(selectedComp.id);

      setTimelineItemsByCompId((prev) => {
        const currentItems = prev[selectedComp.id] ?? [];
        return {
          ...prev,
          [selectedComp.id]: currentItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  name: trimmedName,
                }
              : item
          ),
        };
      });
    },
    [pushCompositionHistorySnapshot, selectedComp.id, selectedTimelineItems, setTimelineItemsByCompId]
  );

  const splitSelectedTimelineItemAtPlayhead = useCallback(() => {
    if (!selectedTimelineTarget) {
      return;
    }

    const selectedItemIndex = selectedTimelineItems.findIndex((item) =>
      selectedTimelineTarget.itemId
        ? item.id === selectedTimelineTarget.itemId
        : item.sourceId === selectedTimelineTarget.sourceId &&
          item.kind === selectedTimelineTarget.kind
    );

    if (selectedItemIndex === -1) {
      return;
    }

    const selectedItem = selectedTimelineItems[selectedItemIndex];
    const itemStartFrame = selectedItem.startFrame;
    const itemEndFrame = selectedItem.startFrame + selectedItem.durationFrames;

    if (currentFrame <= itemStartFrame || currentFrame >= itemEndFrame) {
      return;
    }

    const leftDurationFrames = currentFrame - itemStartFrame;
    const rightDurationFrames = itemEndFrame - currentFrame;

    if (leftDurationFrames <= 0 || rightDurationFrames <= 0) {
      return;
    }

    const rightItemId = createTimelineItemId(`${selectedItem.id}-split`);
    const leftItem: TimelineItem = {
      ...selectedItem,
      durationFrames: leftDurationFrames,
    };
    const rightItem: TimelineItem = {
      ...selectedItem,
      id: rightItemId,
      startFrame: currentFrame,
      durationFrames: rightDurationFrames,
    };

    pushCompositionHistorySnapshot(selectedComp.id);

    setTimelineItemsByCompId((prev) => {
      const currentItems = prev[selectedComp.id] ?? [];
      const insertIndex = currentItems.findIndex((item) => item.id === selectedItem.id);

      if (insertIndex === -1) {
        return prev;
      }

      return {
        ...prev,
        [selectedComp.id]: [
          ...currentItems.slice(0, insertIndex),
          rightItem,
          leftItem,
          ...currentItems.slice(insertIndex + 1),
        ],
      };
    });

    applySelectionForComposition(selectedComp.id, {
      itemId: rightItem.id,
      sourceId: rightItem.sourceId,
      kind: rightItem.kind,
    });
  }, [
    applySelectionForComposition,
    createTimelineItemId,
    currentFrame,
    pushCompositionHistorySnapshot,
    selectedComp.id,
    selectedTimelineItems,
    selectedTimelineTarget,
    setTimelineItemsByCompId,
  ]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const interaction = timelineInteractionRef.current;

      if (
        !interaction ||
        (interaction.type !== "move-item" &&
          interaction.type !== "resize-start" &&
          interaction.type !== "resize-end")
      ) {
        return;
      }

      const deltaFrames = Math.round(
        (event.clientX - interaction.startClientX) / timelinePxPerFrame
      );

      if (interaction.type === "move-item") {
        const maxStartFrame = Math.max(0, (selectedMeta?.durationFrames ?? 1) - 1);
        let didChange = false;
        flushSync(() => {
          updateTimelineItemTiming(selectedComp.id, interaction.itemId, (item) => {
            const nextStartFrame = Math.min(
              maxStartFrame,
              Math.max(0, interaction.initialStartFrame + deltaFrames)
            );

            if (nextStartFrame === item.startFrame) {
              return item;
            }

            didChange = true;
            return {
              ...item,
              startFrame: nextStartFrame,
            };
          });
        });
        if (didChange) {
          markCompositionHistoryCaptureDirty(selectedComp.id);
        }
        return;
      }

      if (interaction.type === "resize-start") {
        const nextStartFrame = Math.max(0, interaction.initialStartFrame + deltaFrames);
        const maxStartFrame =
          interaction.initialStartFrame + interaction.initialDurationFrames - 1;
        const clampedStartFrame = Math.min(nextStartFrame, maxStartFrame);
        const nextDurationFrames = Math.max(
          1,
          interaction.initialDurationFrames -
            (clampedStartFrame - interaction.initialStartFrame)
        );
        const clampedDurationFrames = Math.min(
          nextDurationFrames,
          Math.max(1, (selectedMeta?.durationFrames ?? nextDurationFrames) - clampedStartFrame)
        );
        let didChange = false;

        updateTimelineItemTiming(selectedComp.id, interaction.itemId, (item) => {
          if (
            item.startFrame === clampedStartFrame &&
            item.durationFrames === clampedDurationFrames
          ) {
            return item;
          }

          didChange = true;
          return {
            ...item,
            startFrame: clampedStartFrame,
            durationFrames: clampedDurationFrames,
          };
        });
        if (didChange) {
          markCompositionHistoryCaptureDirty(selectedComp.id);
        }
        return;
      }

      const nextDurationFrames = Math.max(1, interaction.initialDurationFrames + deltaFrames);
      const currentItem = selectedTimelineItems.find((item) => item.id === interaction.itemId);
      const maxDurationFrames = currentItem
        ? Math.max(1, (selectedMeta?.durationFrames ?? nextDurationFrames) - currentItem.startFrame)
        : nextDurationFrames;
      let didChange = false;

      updateTimelineItemTiming(selectedComp.id, interaction.itemId, (item) => {
        const clampedDurationFrames = Math.min(nextDurationFrames, maxDurationFrames);

        if (item.durationFrames === clampedDurationFrames) {
          return item;
        }

        didChange = true;
        return {
          ...item,
          durationFrames: clampedDurationFrames,
        };
      });
      if (didChange) {
        markCompositionHistoryCaptureDirty(selectedComp.id);
      }
    };

    const handleMouseUp = () => {
      const interaction = timelineInteractionRef.current;

      if (
        interaction?.type === "move-item" ||
        interaction?.type === "resize-start" ||
        interaction?.type === "resize-end"
      ) {
        timelineInteractionRef.current = null;
        commitCompositionHistoryCapture(selectedComp.id);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    selectedComp.id,
    selectedMeta,
    selectedTimelineItems,
    commitCompositionHistoryCapture,
    markCompositionHistoryCaptureDirty,
    timelineInteractionRef,
    timelinePxPerFrame,
    updateTimelineItemTiming,
  ]);

  return {
    handleTimelineReorder,
    beginMoveTimelineItem,
    beginResizeTimelineItemStart,
    beginResizeTimelineItemEnd,
    handleSelectTimelineItem,
    duplicateSelectedTimelineItem,
    renameTimelineItem,
    splitSelectedTimelineItemAtPlayhead,
  };
}

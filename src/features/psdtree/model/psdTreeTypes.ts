import type { PsdImportSource } from "@/editor/types/psdSourceTypes";
import type { Composition } from "@/editor/types/types";

export type DropPosition = "before" | "after";

export type DropTarget = {
  targetId: string;
  position: DropPosition;
} | null;

export type PsdTreeProps = {
  comps: Composition[];
  selectedCompId: string | null;
  onSelectComp: (comp: Composition) => void;
  onImportPsdFiles: (sources: PsdImportSource[]) => void | Promise<void>;
  onRefreshMainComp: (
    compId: string,
    source?: PsdImportSource | null
  ) => Promise<"completed" | "needsSource">;
  onDeleteMainComp: (compId: string) => void;
  onReorderMainComps: (
    draggedId: string,
    targetId: string,
    position: DropPosition
  ) => void;
};

export type PsdTreeNodeProps = {
  comp: Composition;
  depth: number;
  isSelected: boolean;
  isRoot: boolean;
  isFirstRoot: boolean;
  draggedMainCompId: string | null;
  dropTarget: DropTarget;
  selectedCompId: string | null;
  onSelectComp: (comp: Composition) => void;
  onRefreshMainComp: (compId: string) => void;
  onDeleteMainComp: (compId: string) => void;
  onSetDraggedMainCompId: (compId: string | null) => void;
  onSetDropTarget: (target: DropTarget) => void;
  onReorderMainComps: (
    draggedId: string,
    targetId: string,
    position: DropPosition
  ) => void;
};

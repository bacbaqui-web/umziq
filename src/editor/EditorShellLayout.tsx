import type { ComponentProps } from "react";
import LibraryPanel
  from "@/features/library/components/LibraryPanel";
import PreviewWorkspacePane from "@/features/preview/components/PreviewWorkspacePane";
import VisualPanel
  from "@/features/visual/components/VisualPanel";
import AudioPanel from "@/features/audio/components/AudioPanel";
import TimelinePanel
  from "@/features/timeline/components/TimelinePanel";
import { MenuBar } from "@/engines/menu";

export type EditorShellLayoutProps = {
  leftPanelWidth: number;
  rightPanelWidth: number;
  timelinePanelHeight: number;
  activePanelResize: "left" | "right" | "bottom" | null;
  onStartLeftResize: (clientX: number, clientY: number) => void;
  onStartRightResize: (clientX: number, clientY: number) => void;
  onStartBottomResize: (clientX: number, clientY: number) => void;
  libraryProps: ComponentProps<typeof LibraryPanel>;
  previewPaneProps: ComponentProps<typeof PreviewWorkspacePane>;
  visualPanelProps: ComponentProps<typeof VisualPanel>;
  audioPanelProps: ComponentProps<typeof AudioPanel>;
  timelinePanelProps: ComponentProps<typeof TimelinePanel>;
  menuProps:
    ComponentProps<typeof MenuBar>;
};

export function EditorShellLayout({
  leftPanelWidth,
  rightPanelWidth,
  timelinePanelHeight,
  activePanelResize,
  onStartLeftResize,
  onStartRightResize,
  onStartBottomResize,
  libraryProps,
  previewPaneProps,
  visualPanelProps,
  audioPanelProps,
  timelinePanelProps,
  menuProps,
}: EditorShellLayoutProps) {
  return (
    <div
      className="editor-shell"
      style={{
        display: "grid",
        gridTemplateColumns: `${leftPanelWidth}px 6px minmax(0, 1fr) 6px ${rightPanelWidth}px`,
        gridTemplateRows: `42px minmax(0, 1fr) 6px ${timelinePanelHeight}px`,
        height: "100vh",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          gridColumn: "1 / -1",
          gridRow: "1",
          minWidth: 0,
          zIndex:
            menuProps.viewModel
              .projectCreated
              ? 10
              : "auto",
        }}
      >
        <MenuBar
          {...menuProps}
        />
      </div>
      <div
        className="editor-panel editor-panel-scroll"
        style={{
          gridColumn: "1",
          gridRow: "2",
          minHeight: 0,
          borderRight: "1px solid #2a2e33",
        }}
      >
        <LibraryPanel {...libraryProps} />
      </div>

      <div
        className="editor-resizer"
        onMouseDown={(event) => {
          event.preventDefault();
          onStartLeftResize(event.clientX, event.clientY);
        }}
        style={{
          gridColumn: "2",
          gridRow: "2",
          background: activePanelResize === "left" ? "#3d78a8" : undefined,
          cursor: "col-resize",
        }}
      />

      <div
        style={{
          gridColumn: "3",
          gridRow: "2",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <PreviewWorkspacePane {...previewPaneProps} />
      </div>

      <div
        className="editor-resizer"
        onMouseDown={(event) => {
          event.preventDefault();
          onStartRightResize(event.clientX, event.clientY);
        }}
        style={{
          gridColumn: "4",
          gridRow: "2",
          background: activePanelResize === "right" ? "#3d78a8" : undefined,
          cursor: "col-resize",
        }}
      />

      <div
        className="editor-panel"
        style={{
          gridColumn: "5",
          gridRow: "2",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ height: "100%", minHeight: 0 }}>
          {audioPanelProps.effects.readModel.visible
            ? <AudioPanel {...audioPanelProps} />
            : <VisualPanel {...visualPanelProps} />}
        </div>
      </div>

      <div
        className="editor-resizer"
        onMouseDown={(event) => {
          event.preventDefault();
          onStartBottomResize(event.clientX, event.clientY);
        }}
        style={{
          gridColumn: "1 / -1",
          gridRow: "3",
          background: activePanelResize === "bottom" ? "#3d78a8" : undefined,
          cursor: "row-resize",
        }}
      />

      <div
        className="editor-panel"
        style={{
          gridColumn: "1 / -1",
          gridRow: "4",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <TimelinePanel {...timelinePanelProps} />
      </div>
    </div>
  );
}

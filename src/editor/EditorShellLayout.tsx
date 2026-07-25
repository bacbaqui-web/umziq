import type { ComponentProps } from "react";
import { PsdTree } from "@/engines/psd-tree";
import PreviewWorkspacePane from "@/features/preview/components/PreviewWorkspacePane";
import { PropertiesPanel } from "@/engines/properties";
import { TimelinePanel } from "@/engines/timeline";

export type EditorShellLayoutProps = {
  leftPanelWidth: number;
  rightPanelWidth: number;
  timelinePanelHeight: number;
  activePanelResize: "left" | "right" | "bottom" | null;
  onStartLeftResize: (clientX: number, clientY: number) => void;
  onStartRightResize: (clientX: number, clientY: number) => void;
  onStartBottomResize: (clientX: number, clientY: number) => void;
  psdTreeProps: ComponentProps<typeof PsdTree>;
  previewPaneProps: ComponentProps<typeof PreviewWorkspacePane>;
  propertiesPanelProps: ComponentProps<typeof PropertiesPanel>;
  timelinePanelProps: ComponentProps<typeof TimelinePanel>;
};

export function EditorShellLayout({
  leftPanelWidth,
  rightPanelWidth,
  timelinePanelHeight,
  activePanelResize,
  onStartLeftResize,
  onStartRightResize,
  onStartBottomResize,
  psdTreeProps,
  previewPaneProps,
  propertiesPanelProps,
  timelinePanelProps,
}: EditorShellLayoutProps) {
  return (
    <div
      className="editor-shell"
      style={{
        display: "grid",
        gridTemplateColumns: `${leftPanelWidth}px 6px minmax(0, 1fr) 6px ${rightPanelWidth}px`,
        gridTemplateRows: `minmax(0, 1fr) 6px ${timelinePanelHeight}px`,
        height: "100vh",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        className="editor-panel editor-panel-scroll"
        style={{
          gridColumn: "1",
          gridRow: "1",
          minHeight: 0,
          borderRight: "1px solid #2a2e33",
        }}
      >
        <PsdTree {...psdTreeProps} />
      </div>

      <div
        className="editor-resizer"
        onMouseDown={(event) => {
          event.preventDefault();
          onStartLeftResize(event.clientX, event.clientY);
        }}
        style={{
          gridColumn: "2",
          gridRow: "1",
          background: activePanelResize === "left" ? "#3d78a8" : undefined,
          cursor: "col-resize",
        }}
      />

      <PreviewWorkspacePane {...previewPaneProps} />

      <div
        className="editor-resizer"
        onMouseDown={(event) => {
          event.preventDefault();
          onStartRightResize(event.clientX, event.clientY);
        }}
        style={{
          gridColumn: "4",
          gridRow: "1",
          background: activePanelResize === "right" ? "#3d78a8" : undefined,
          cursor: "col-resize",
        }}
      />

      <div
        className="editor-panel"
        style={{
          gridColumn: "5",
          gridRow: "1",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <PropertiesPanel {...propertiesPanelProps} />
      </div>

      <div
        className="editor-resizer"
        onMouseDown={(event) => {
          event.preventDefault();
          onStartBottomResize(event.clientX, event.clientY);
        }}
        style={{
          gridColumn: "1 / -1",
          gridRow: "2",
          background: activePanelResize === "bottom" ? "#3d78a8" : undefined,
          cursor: "row-resize",
        }}
      />

      <div
        className="editor-panel"
        style={{
          gridColumn: "1 / -1",
          gridRow: "3",
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

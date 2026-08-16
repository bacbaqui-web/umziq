import type { ComponentProps } from "react";
import LibraryPanel
  from "@/features/library/components/LibraryPanel";
import PreviewWorkspacePane from "@/features/preview/components/PreviewWorkspacePane";
import PropertiesPanel
  from "@/features/properties/components/PropertiesPanel";
import AudioEffectsPanel from "@/features/audio-effects/components/AudioEffectsPanel";
import TimelinePanel
  from "@/features/timeline/components/TimelinePanel";
import {
  ProjectLifecycleBar,
} from "@/editor/ProjectLifecycleBar";

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
  propertiesPanelProps: ComponentProps<typeof PropertiesPanel>;
  audioEffectsPanelProps: ComponentProps<typeof AudioEffectsPanel>;
  timelinePanelProps: ComponentProps<typeof TimelinePanel>;
  projectLifecycleProps:
    ComponentProps<typeof ProjectLifecycleBar>;
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
  propertiesPanelProps,
  audioEffectsPanelProps,
  timelinePanelProps,
  projectLifecycleProps,
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
          zIndex: 10,
        }}
      >
        <ProjectLifecycleBar
          {...projectLifecycleProps}
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
        <div style={{ height: "100%", display: "grid", gridTemplateRows: audioEffectsPanelProps.readModel.visible ? "minmax(0, 1fr) minmax(150px, 1fr)" : "minmax(0, 1fr)", minHeight: 0 }}>
          <div style={{ minHeight: 0, overflow: "hidden" }}><PropertiesPanel {...propertiesPanelProps} /></div>
          {audioEffectsPanelProps.readModel.visible && (
            <div style={{ minHeight: 0, overflow: "hidden" }}><AudioEffectsPanel {...audioEffectsPanelProps} /></div>
          )}
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

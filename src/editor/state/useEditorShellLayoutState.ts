import { useState } from "react";
import {
  SHELL_DEFAULT_LEFT_PANEL_WIDTH,
  SHELL_DEFAULT_RIGHT_PANEL_WIDTH,
  SHELL_DEFAULT_TIMELINE_PANEL_HEIGHT,
} from "@/editor/editorShellLayoutConstants";

export function useEditorShellLayoutState() {
  const [leftPanelWidth, setLeftPanelWidth] = useState(SHELL_DEFAULT_LEFT_PANEL_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(SHELL_DEFAULT_RIGHT_PANEL_WIDTH);
  const [timelinePanelHeight, setTimelinePanelHeight] = useState(
    SHELL_DEFAULT_TIMELINE_PANEL_HEIGHT
  );
  const [activePanelResize, setActivePanelResize] = useState<
    "left" | "right" | "bottom" | null
  >(null);

  return {
    leftPanelWidth,
    setLeftPanelWidth,
    rightPanelWidth,
    setRightPanelWidth,
    timelinePanelHeight,
    setTimelinePanelHeight,
    activePanelResize,
    setActivePanelResize,
  };
}

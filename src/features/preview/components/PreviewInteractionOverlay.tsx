import type { RefObject } from "react";
import type {
  CanvasGizmoViewModel,
  CanvasInteractionCommands,
  CanvasSelectionHighlightViewModel,
} from "@/engines/canvas";
import PreviewOverlay from "@/features/preview/components/PreviewOverlay";

type PreviewInteractionOverlayProps = {
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  previewViewportWidth: number;
  previewViewportHeight: number;
  viewModel: CanvasGizmoViewModel;
  selectionHighlight: CanvasSelectionHighlightViewModel;
  commands: CanvasInteractionCommands;
};

export default function PreviewInteractionOverlay({
  previewOverlayRef,
  previewViewportWidth,
  previewViewportHeight,
  viewModel,
  selectionHighlight,
  commands,
}: PreviewInteractionOverlayProps) {
  return (
    <PreviewOverlay
      overlayRef={previewOverlayRef}
      viewportSize={{ width: previewViewportWidth, height: previewViewportHeight }}
      selectionHighlight={selectionHighlight}
      viewModel={viewModel}
      commands={commands}
    />
  );
}

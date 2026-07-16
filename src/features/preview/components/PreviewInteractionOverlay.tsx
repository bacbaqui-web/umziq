import type { RefObject } from "react";
import type {
  CanvasGizmoViewModel,
  CanvasInteractionCommands,
} from "@/engines/canvas";
import PreviewOverlay from "@/features/preview/components/PreviewOverlay";

type PreviewInteractionOverlayProps = {
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  previewViewportWidth: number;
  previewViewportHeight: number;
  viewModel: CanvasGizmoViewModel;
  commands: CanvasInteractionCommands;
};

export default function PreviewInteractionOverlay({
  previewOverlayRef,
  previewViewportWidth,
  previewViewportHeight,
  viewModel,
  commands,
}: PreviewInteractionOverlayProps) {
  return (
    <PreviewOverlay
      overlayRef={previewOverlayRef}
      viewportSize={{ width: previewViewportWidth, height: previewViewportHeight }}
      viewModel={viewModel}
      commands={commands}
    />
  );
}

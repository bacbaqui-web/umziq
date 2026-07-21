import type { RefObject } from "react";
import type {
  CanvasGizmoViewModel,
  CanvasInteractionCommands,
  CanvasSelectionGlowViewModel,
} from "@/engines/canvas";
import PreviewOverlay from "@/features/preview/components/PreviewOverlay";

type PreviewInteractionOverlayProps = {
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  previewViewportWidth: number;
  previewViewportHeight: number;
  viewModel: CanvasGizmoViewModel;
  selectionGlow: CanvasSelectionGlowViewModel;
  commands: CanvasInteractionCommands;
};

export default function PreviewInteractionOverlay({
  previewOverlayRef,
  previewViewportWidth,
  previewViewportHeight,
  viewModel,
  selectionGlow,
  commands,
}: PreviewInteractionOverlayProps) {
  return (
    <PreviewOverlay
      overlayRef={previewOverlayRef}
      viewportSize={{ width: previewViewportWidth, height: previewViewportHeight }}
      selectionGlow={selectionGlow}
      viewModel={viewModel}
      commands={commands}
    />
  );
}

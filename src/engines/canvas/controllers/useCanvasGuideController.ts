import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import { buildCanvasGuideViewModel } from "@/engines/canvas/helpers/canvasGuideHelpers";
import type {
  CanvasGuideCommands,
  CanvasGuideViewModel,
  CanvasSize,
} from "@/engines/canvas/models/canvasEngineModel";

export function useCanvasGuideController({
  previewSize,
  zoom,
  shortformFrameWidth,
  shortformFrameHeight,
  showShortformFrame,
  setShowShortformFrame,
  showSafeZoneGuides,
  setShowSafeZoneGuides,
}: {
  previewSize: CanvasSize;
  zoom: number;
  shortformFrameWidth: number;
  shortformFrameHeight: number;
  showShortformFrame: boolean;
  setShowShortformFrame: Dispatch<SetStateAction<boolean>>;
  showSafeZoneGuides: boolean;
  setShowSafeZoneGuides: Dispatch<SetStateAction<boolean>>;
}) {
  const viewModel: CanvasGuideViewModel = useMemo(
    () =>
      buildCanvasGuideViewModel({
        previewSize,
        shortformFrameWidth,
        shortformFrameHeight,
        zoom,
        showShortformFrame,
        showSafeZoneGuides,
      }),
    [
      previewSize,
      shortformFrameHeight,
      shortformFrameWidth,
      showSafeZoneGuides,
      showShortformFrame,
      zoom,
    ]
  );
  const toggleShortformFrame = useCallback(
    () => setShowShortformFrame((current) => !current),
    [setShowShortformFrame]
  );
  const toggleSafeZone = useCallback(
    () => setShowSafeZoneGuides((current) => !current),
    [setShowSafeZoneGuides]
  );
  const commands: CanvasGuideCommands = { toggleShortformFrame, toggleSafeZone };

  return { viewModel, commands };
}

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
  cameraScalePercent,
  cameraDimOpacityPercent,
  setCameraScalePercent,
  commitCameraScalePercent,
}: {
  previewSize: CanvasSize;
  zoom: number;
  shortformFrameWidth: number;
  shortformFrameHeight: number;
  showShortformFrame: boolean;
  setShowShortformFrame: Dispatch<SetStateAction<boolean>>;
  showSafeZoneGuides: boolean;
  setShowSafeZoneGuides: Dispatch<SetStateAction<boolean>>;
  cameraScalePercent: number;
  cameraDimOpacityPercent: number;
  setCameraScalePercent: (percent: number) => void;
  commitCameraScalePercent: (percent: number) => void;
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
        cameraScalePercent,
        cameraDimOpacityPercent,
      }),
    [
      previewSize,
      shortformFrameHeight,
      shortformFrameWidth,
      showSafeZoneGuides,
      showShortformFrame,
      zoom,
      cameraScalePercent,
      cameraDimOpacityPercent,
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
  const commands: CanvasGuideCommands = {
    toggleShortformFrame,
    toggleSafeZone,
    setCameraScalePercent,
    commitCameraScalePercent,
  };

  return { viewModel, commands };
}

import type { Layer as PsdLayer } from "ag-psd";
import {
  hashBytes,
  hashString,
  normalizePsdOpacity,
} from "@/engines/project/import/psdImportHelpers";

export function buildLayerSourceFingerprint(layer: PsdLayer) {
  const canvas = layer.canvas;
  let pixelHash = "empty";

  if (canvas) {
    const context = canvas.getContext("2d");
    const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);

    if (imageData) {
      pixelHash = hashBytes(imageData.data);
    }
  }

  return hashString(
    JSON.stringify({
      left: layer.left ?? 0,
      top: layer.top ?? 0,
      width: canvas?.width ?? 0,
      height: canvas?.height ?? 0,
      hidden: !!layer.hidden,
      opacity: normalizePsdOpacity(layer.opacity),
      pixels: pixelHash,
    })
  );
}

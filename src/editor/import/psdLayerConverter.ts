import type { Layer as PsdLayer } from "ag-psd";
import type { Layer, RenderDrawable } from "@/editor/types/types";
import { createPropertyTrackState as buildPropertyTrackState } from "@/editor/types/types";
import {
  hashBytes,
  hashString,
  normalizePsdOpacity,
  sanitizeName,
  slugify,
  toLayerId,
} from "@/editor/import/psdImportHelpers";

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

export function createLayer(
  parentId: string,
  layer: PsdLayer,
  index: number,
  fallbackName: string,
  sourcePath?: string
): Layer {
  const name = sanitizeName(layer.name, fallbackName);
  const anchorWidth = layer.canvas?.width ?? 0;
  const anchorHeight = layer.canvas?.height ?? 0;
  const center = {
    x: anchorWidth / 2,
    y: anchorHeight / 2,
  };

  return {
    id: toLayerId(parentId, index, name),
    name,
    visible: !layer.hidden,
    sourcePath,
    sourceFingerprint: buildLayerSourceFingerprint(layer),
    sourceSyncStatus: "normal",
    position: {
      x: (layer.left ?? 0) + center.x,
      y: (layer.top ?? 0) + center.y,
    },
    transformOffset: {
      x: 0,
      y: 0,
    },
    anchor: {
      x: center.x,
      y: center.y,
    },
    positionKeyframes: [],
    scale: {
      x: 100,
      y: 100,
    },
    scaleKeyframes: [],
    scaleLinked: true,
    rotation: 0,
    rotationKeyframes: [],
    opacity: normalizePsdOpacity(layer.opacity),
    opacityKeyframes: [],
    enabledProperties: buildPropertyTrackState(),
  };
}

export function createDrawable(layer: PsdLayer, index: number, fallbackName: string): RenderDrawable {
  const name = sanitizeName(layer.name, fallbackName);

  return {
    id: `${slugify(name) || "drawable"}-${index}`,
    left: layer.left ?? 0,
    top: layer.top ?? 0,
    visible: !layer.hidden,
    canvas: layer.canvas,
  };
}

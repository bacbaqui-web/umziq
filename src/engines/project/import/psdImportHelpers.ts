import type { Layer as PsdLayer } from "ag-psd";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";

export function normalizeStackingOrder<T>(items: T[]) {
  return [...items].reverse();
}

export function sanitizeName(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function joinPsdSourcePath(parentPath: string | undefined, segment: string) {
  return parentPath ? `${parentPath}/${segment}` : segment;
}

export function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function hashBytes(bytes: Uint8ClampedArray) {
  let hash = 2166136261;

  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index] ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function toCompId(fileBaseName: string, index: number) {
  return `main-${index}-${slugify(fileBaseName) || "psd"}`;
}

export function toLayerId(parentId: string, index: number, layerName: string) {
  return `${parentId}-layer-${index}-${slugify(layerName) || "untitled"}`;
}

export function isGroupLayer(layer: PsdLayer) {
  return Array.isArray(layer.children);
}

export function normalizePsdOpacity(opacity: number | undefined) {
  if (opacity === undefined || opacity === null || Number.isNaN(opacity)) {
    return 100;
  }

  if (opacity <= 0) {
    return opacity === 0 ? 0 : 100;
  }

  if (opacity <= 1) {
    return Math.round(opacity * 100);
  }

  if (opacity <= 100) {
    return Math.round(opacity);
  }

  return Math.round((opacity / 255) * 100);
}

export function flattenRenderDrawables(renderItems: RenderItem[]) {
  return renderItems.flatMap((item) => item.drawables);
}

import type { PsdImportSettings } from "@/models";

export function createDefaultPsdImportSettings(
  compositionName: string
): PsdImportSettings {
  return {
    compositionName,
    hiddenLayerMode: "preserve",
  };
}

export function normalizePsdImportSettings(
  settings: unknown,
  fallbackCompositionName: string
): PsdImportSettings {
  if (!settings || typeof settings !== "object") {
    return createDefaultPsdImportSettings(fallbackCompositionName);
  }

  const candidate = settings as Partial<PsdImportSettings>;
  const compositionName =
    typeof candidate.compositionName === "string" && candidate.compositionName.trim()
      ? candidate.compositionName.trim()
      : fallbackCompositionName;

  return {
    compositionName,
    hiddenLayerMode: candidate.hiddenLayerMode === "omit" ? "omit" : "preserve",
  };
}

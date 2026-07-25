import type {
  SourceRegistryRecord,
} from "@/models/layerDocumentModel";

export function layerDocumentSourceDescriptorPath(
  source: SourceRegistryRecord
): string | null {
  switch (source.kind) {
    case "psd-document":
    case "audio":
    case "video":
      return (
        source.locator.relativePathHint ??
        source.locator.suggestedFileName
      );
    case "psd-node":
      return source.data.sourcePath;
    case "unknown":
      return null;
  }
}

export function layerDocumentSourceVisualFingerprint(
  source: SourceRegistryRecord
): string | null {
  switch (source.kind) {
    case "psd-document":
    case "audio":
    case "video":
      return source.contentFingerprint?.digestHex ?? null;
    case "psd-node":
      return source.data.visualFingerprint;
    case "unknown":
      return null;
  }
}

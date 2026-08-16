import {
  findNonPlainDataPath,
} from "@/models/plainDataModel";

type UnknownRecord = Record<string, unknown>;

export type LayerDocumentSchemaMigrationResult =
  | {
      readonly ok: true;
      readonly value: unknown;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          | "non-plain-data"
          | "unsupported-schema-version"
          | "invalid-schema-1"
          | "invalid-schema-2";
        readonly path: string;
        readonly message: string;
      };
    };

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function clonePlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

function migratedRefresh(value: unknown) {
  const status = isRecord(value)
    ? value.status
    : null;
  return {
    status:
      status === "updated" ||
      status === "new" ||
      status === "deletePending"
        ? status
        : "normal",
  };
}

function suggestedFileName(source: UnknownRecord): string {
  const data = isRecord(source.data) ? source.data : {};
  const refresh = isRecord(source.refresh) ? source.refresh : {};
  const reconnectHint = isRecord(refresh.reconnectHint)
    ? refresh.reconnectHint
    : {};
  return (
    stringValue(reconnectHint.fileName) ??
    stringValue(data.fileName) ??
    stringValue(source.displayName) ??
    "linked-source"
  );
}

function relativePathHint(
  source: UnknownRecord,
  fileName: string
): string | null {
  const path = stringValue(source.path);
  if (
    !path ||
    path === fileName ||
    path.startsWith("/") ||
    /^[a-zA-Z]:[\\/]/.test(path) ||
    path.startsWith("\\\\")
  ) {
    return null;
  }
  return path;
}

function migratedLinkedDescriptor(source: UnknownRecord) {
  const fileName = suggestedFileName(source);
  const sourceId = stringValue(source.sourceId) ?? "invalid-source";
  return {
    locator: {
      locatorId: `linked:${sourceId}`,
      kind: "linked-file" as const,
      suggestedFileName: fileName,
      relativePathHint: relativePathHint(source, fileName),
    },
    // Schema 1 fingerprints were not strong content hashes. Reconnect must
    // calculate SHA-256 from the actual external file before filling this.
    contentFingerprint: null,
  };
}

function migrateSource(source: unknown): unknown {
  if (!isRecord(source)) return source;
  const data = isRecord(source.data)
    ? source.data
    : source.data;
  const base = {
    sourceId: source.sourceId,
    kind: source.kind,
    displayName: source.displayName,
    version: source.version,
    refresh: migratedRefresh(source.refresh),
  };

  switch (source.kind) {
    case "psd-document":
      return {
        ...base,
        ...migratedLinkedDescriptor(source),
        data: {
          importSettings: isRecord(data)
            ? data.importSettings
            : null,
        },
      };
    case "psd-node":
      return {
        ...base,
        data: {
          documentSourceId: isRecord(data)
            ? data.documentSourceId
            : null,
          sourceKey: isRecord(data)
            ? data.sourceKey
            : null,
          sourcePath: isRecord(data)
            ? data.sourcePath
            : null,
          visualFingerprint:
            typeof source.fingerprint === "string"
              ? source.fingerprint
              : null,
        },
      };
    case "audio":
      return {
        ...base,
        ...migratedLinkedDescriptor(source),
        data: {
          mimeType: isRecord(data) ? data.mimeType : null,
          durationFrames: isRecord(data)
            ? data.durationFrames
            : null,
        },
      };
    case "video":
      return {
        ...base,
        ...migratedLinkedDescriptor(source),
        data: {
          mimeType: isRecord(data) ? data.mimeType : null,
          durationFrames: isRecord(data)
            ? data.durationFrames
            : null,
          width: isRecord(data) ? data.width : null,
          height: isRecord(data) ? data.height : null,
        },
      };
    default:
      return {
        ...base,
        data,
      };
  }
}

/**
 * Pure schema migration. It neither reads external files nor creates runtime
 * resolution state, so a schema 1 "available" value never becomes trusted
 * runtime availability.
 */
export function migrateLayerDocumentProjectSchema1To2(
  value: unknown
): LayerDocumentSchemaMigrationResult {
  const nonPlainDataPath = findNonPlainDataPath(value);
  if (nonPlainDataPath) {
    return {
      ok: false,
      error: {
        code: "non-plain-data",
        path: nonPlainDataPath,
        message: "Schema migration accepts Plain Data only",
      },
    };
  }
  const project = clonePlainData(value);
  if (!isRecord(project)) {
    return {
      ok: false,
      error: {
        code: "invalid-schema-1",
        path: "$",
        message: "Schema 1 Project must be an object",
      },
    };
  }
  const metadata = isRecord(project.metadata)
    ? project.metadata
    : null;
  if (metadata?.schemaVersion !== 1) {
    return {
      ok: false,
      error: {
        code: "unsupported-schema-version",
        path: "$.metadata.schemaVersion",
        message: "Expected Layer Document schema version 1",
      },
    };
  }
  const payload = isRecord(project.payload)
    ? project.payload
    : null;
  const sourceRegistry = payload &&
    isRecord(payload.sourceRegistry)
    ? payload.sourceRegistry
    : null;
  const sourcesById = sourceRegistry &&
    isRecord(sourceRegistry.sourcesById)
    ? sourceRegistry.sourcesById
    : null;
  if (!payload || !sourceRegistry || !sourcesById) {
    return {
      ok: false,
      error: {
        code: "invalid-schema-1",
        path: "$.payload.sourceRegistry.sourcesById",
        message: "Schema 1 Project requires a Source Registry",
      },
    };
  }
  metadata.schemaVersion = 2;
  sourceRegistry.sourcesById = Object.fromEntries(
    Object.entries(sourcesById).map(([sourceId, source]) => [
      sourceId,
      migrateSource(source),
    ])
  );
  return { ok: true, value: project };
}

/** Adds the first persistent Audio editing contract with neutral defaults. */
export function migrateLayerDocumentProjectSchema2To3(
  value: unknown
): LayerDocumentSchemaMigrationResult {
  const nonPlainDataPath = findNonPlainDataPath(value);
  if (nonPlainDataPath) {
    return {
      ok: false,
      error: {
        code: "non-plain-data",
        path: nonPlainDataPath,
        message: "Schema migration accepts Plain Data only",
      },
    };
  }
  const project = clonePlainData(value);
  if (!isRecord(project)) {
    return {
      ok: false,
      error: {
        code: "invalid-schema-2",
        path: "$",
        message: "Schema 2 Project must be an object",
      },
    };
  }
  const metadata = isRecord(project.metadata) ? project.metadata : null;
  const payload = isRecord(project.payload) ? project.payload : null;
  const registry = payload && isRecord(payload.sourceRegistry)
    ? payload.sourceRegistry
    : null;
  const sources = registry && isRecord(registry.sourcesById)
    ? registry.sourcesById
    : null;
  const layers = payload && isRecord(payload.layerDocumentsById)
    ? payload.layerDocumentsById
    : null;
  if (metadata?.schemaVersion !== 2 || !sources || !layers) {
    return {
      ok: false,
      error: {
        code: "invalid-schema-2",
        path: "$.metadata.schemaVersion",
        message: "Expected Layer Document schema version 2",
      },
    };
  }
  Object.values(sources).forEach((source) => {
    if (!isRecord(source) || source.kind !== "audio") return;
    const data = isRecord(source.data) ? source.data : {};
    source.data = {
      mimeType: data.mimeType ?? null,
      durationFrames: data.durationFrames ?? null,
      channelCount: null,
      sampleRate: null,
      provenance: "imported",
    };
  });
  Object.values(layers).forEach((layer) => {
    if (!isRecord(layer) || layer.type !== "audio") return;
    layer.data = {
      gain: 1,
      muted: false,
      fadeInFrames: 0,
      fadeOutFrames: 0,
    };
  });
  metadata.schemaVersion = 3;
  return { ok: true, value: project };
}

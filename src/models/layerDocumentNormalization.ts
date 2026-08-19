import {
  DEFAULT_LAYER_DOCUMENT_PROJECT_CANVAS_SETTINGS,
  type LayerDocumentProject,
} from "@/models/layerDocumentModel";
import {
  validateLayerDocumentProject,
  type LayerDocumentValidationIssue,
} from "@/models/layerDocumentValidation";
import {
  findNonPlainDataPath,
  type PlainDataObject,
  type PlainDataValue,
} from "@/models/plainDataModel";
import {
  migrateLayerDocumentProjectSchema1To2,
  migrateLayerDocumentProjectSchema2To3,
} from "@/models/layerDocumentSchemaMigration";

const KNOWN_LAYER_TYPES = new Set([
  "psd",
  "drawing",
  "text",
  "audio",
  "video",
  "shape",
  "group",
  "unknown",
]);

const KNOWN_SOURCE_KINDS = new Set([
  "psd-document",
  "psd-node",
  "audio",
  "video",
  "unknown",
]);

type UnknownRecord = Record<string, unknown>;

export type LayerDocumentNormalizationResult =
  | {
      ok: true;
      project: LayerDocumentProject;
    }
  | {
      ok: false;
      issues: LayerDocumentValidationIssue[];
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

function preserveUnknownData(value: unknown): PlainDataObject {
  if (isRecord(value)) return value as PlainDataObject;
  return { value: value as PlainDataValue };
}

function normalizeFutureLayerDocuments(project: UnknownRecord) {
  const payload = isRecord(project.payload) ? project.payload : null;
  const layers = payload && isRecord(payload.layerDocumentsById)
    ? payload.layerDocumentsById
    : null;
  if (!layers) return;

  Object.values(layers).forEach((value) => {
    if (!isRecord(value)) return;
    if (
      typeof value.type === "string" &&
      !KNOWN_LAYER_TYPES.has(value.type)
    ) {
      const originalType = value.type;
      value.type = "unknown";
      value.data = {
        originalType,
        rawData: preserveUnknownData(value.data),
      };
    }
    if (typeof value.name === "string") {
      value.name = value.name.trim();
    }
    const common = isRecord(value.common) ? value.common : null;
    const placement = common && isRecord(common.placement)
      ? common.placement
      : null;
    if (placement && typeof placement.alias === "string") {
      placement.alias = placement.alias.trim() || null;
    }
  });
}

function normalizeFutureSources(project: UnknownRecord) {
  const payload = isRecord(project.payload) ? project.payload : null;
  const registry = payload && isRecord(payload.sourceRegistry)
    ? payload.sourceRegistry
    : null;
  const sources = registry && isRecord(registry.sourcesById)
    ? registry.sourcesById
    : null;
  if (!sources) return;

  Object.values(sources).forEach((value) => {
    if (!isRecord(value)) return;
    if (
      typeof value.kind === "string" &&
      !KNOWN_SOURCE_KINDS.has(value.kind)
    ) {
      const originalKind = value.kind;
      value.kind = "unknown";
      value.data = {
        originalKind,
        rawData: preserveUnknownData(value.data),
      };
      delete value.locator;
      delete value.contentFingerprint;
    }
  });
}

/**
 * Normalizes only the Layer Document schema itself.
 * Legacy Composition, ProjectSource, Timeline Item, and Render data are not
 * accepted or migrated by this boundary.
 */
export function normalizeLayerDocumentProject(
  value: unknown
): LayerDocumentNormalizationResult {
  const nonPlainDataPath = findNonPlainDataPath(value);
  if (nonPlainDataPath) {
    return {
      ok: false,
      issues: [
        {
          code: "non-plain-data",
          path: nonPlainDataPath,
          message: "Project schema accepts Plain Data only",
        },
      ],
    };
  }

  const cloned = clonePlainData(value);
  const schemaVersion = isRecord(cloned) &&
    isRecord(cloned.metadata)
    ? cloned.metadata.schemaVersion
    : null;
  const migratedTo2 = schemaVersion === 1
    ? migrateLayerDocumentProjectSchema1To2(cloned)
    : { ok: true as const, value: cloned };
  const migrated = migratedTo2.ok &&
    (schemaVersion === 1 || schemaVersion === 2)
    ? migrateLayerDocumentProjectSchema2To3(migratedTo2.value)
    : migratedTo2;
  if (!migrated.ok) {
    return {
      ok: false,
      issues: [{
        code: migrated.error.code === "non-plain-data"
          ? "non-plain-data"
          : "invalid-shape",
        path: migrated.error.path,
        message: migrated.error.message,
      }],
    };
  }
  const normalized = migrated.value;
  if (isRecord(normalized)) {
    normalizeFutureLayerDocuments(normalized);
    normalizeFutureSources(normalized);
    const metadata = isRecord(normalized.metadata)
      ? normalized.metadata
      : null;
    if (metadata && typeof metadata.name === "string") {
      metadata.name = metadata.name.trim();
    }
    const payload = isRecord(normalized.payload) ? normalized.payload : null;
    if (payload && payload.canvasSettings === undefined) {
      payload.canvasSettings = { ...DEFAULT_LAYER_DOCUMENT_PROJECT_CANVAS_SETTINGS };
    }
  }
  const issues = validateLayerDocumentProject(normalized);
  return issues.length === 0
    ? { ok: true, project: normalized as LayerDocumentProject }
    : { ok: false, issues };
}

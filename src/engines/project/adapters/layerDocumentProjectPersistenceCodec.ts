import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  findNonPlainDataPath,
  migrateLayerDocumentProjectSchema1To2,
  normalizeLayerDocumentProject,
  validateLayerDocumentProject,
  type LayerDocumentProject,
  type PlainDataValue,
} from "@/models";
import {
  LAYER_DOCUMENT_PROJECT_CONTAINER_VERSION,
  LAYER_DOCUMENT_PROJECT_FILE_FORMAT,
  LAYER_DOCUMENT_PROJECT_MAX_JSON_BYTES,
  LAYER_DOCUMENT_PROJECT_MAX_JSON_NESTING,
  LAYER_DOCUMENT_PROJECT_MAX_LAYER_COUNT,
  LAYER_DOCUMENT_PROJECT_MAX_SOURCE_COUNT,
  type LayerDocumentProjectFileEnvelope,
  type LayerDocumentProjectLoadCandidate,
  type LayerDocumentProjectPersistenceError,
  type LayerDocumentProjectPersistenceResult,
} from "@/engines/project/models/layerDocumentProjectPersistenceModel";

type UnknownRecord = Record<string, unknown>;

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

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function failure<T>(
  error: LayerDocumentProjectPersistenceError
): LayerDocumentProjectPersistenceResult<T> {
  return { ok: false, error };
}

function compareKeys(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalize(value: PlainDataValue): PlainDataValue {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareKeys)
        .map((key) => [
          key,
          canonicalize(value[key] as PlainDataValue),
        ])
    );
  }
  return value;
}

function checkNesting(
  value: unknown
): LayerDocumentProjectPersistenceError | null {
  const pending: Array<{
    readonly value: unknown;
    readonly depth: number;
    readonly path: string;
  }> = [{ value, depth: 0, path: "$" }];
  while (pending.length > 0) {
    const entry = pending.pop();
    if (!entry) break;
    if (entry.depth > LAYER_DOCUMENT_PROJECT_MAX_JSON_NESTING) {
      return {
        code: "nesting-limit-exceeded",
        path: entry.path,
        message:
          `JSON nesting exceeds ${LAYER_DOCUMENT_PROJECT_MAX_JSON_NESTING}`,
      };
    }
    if (Array.isArray(entry.value)) {
      entry.value.forEach((child, index) => {
        pending.push({
          value: child,
          depth: entry.depth + 1,
          path: `${entry.path}[${index}]`,
        });
      });
    } else if (isRecord(entry.value)) {
      Object.entries(entry.value).forEach(([key, child]) => {
        pending.push({
          value: child,
          depth: entry.depth + 1,
          path: `${entry.path}.${key}`,
        });
      });
    }
  }
  return null;
}

function readEntityMaps(project: unknown) {
  if (!isRecord(project) || !isRecord(project.payload)) {
    return {
      layers: null,
      sources: null,
    };
  }
  const layers = isRecord(
    project.payload.layerDocumentsById
  )
    ? project.payload.layerDocumentsById
    : null;
  const sourceRegistry = isRecord(
    project.payload.sourceRegistry
  )
    ? project.payload.sourceRegistry
    : null;
  const sources = sourceRegistry &&
    isRecord(sourceRegistry.sourcesById)
    ? sourceRegistry.sourcesById
    : null;
  return { layers, sources };
}

function checkEntityCounts(
  project: unknown
): LayerDocumentProjectPersistenceError | null {
  const { layers, sources } = readEntityMaps(project);
  const layerCount = layers
    ? Object.keys(layers).length
    : 0;
  if (
    layerCount >
    LAYER_DOCUMENT_PROJECT_MAX_LAYER_COUNT
  ) {
    return {
      code: "entity-limit-exceeded",
      path: "$.project.payload.layerDocumentsById",
      message:
        `Layer Document count exceeds ${LAYER_DOCUMENT_PROJECT_MAX_LAYER_COUNT}`,
    };
  }
  const sourceCount = sources
    ? Object.keys(sources).length
    : 0;
  if (
    sourceCount >
    LAYER_DOCUMENT_PROJECT_MAX_SOURCE_COUNT
  ) {
    return {
      code: "entity-limit-exceeded",
      path:
        "$.project.payload.sourceRegistry.sourcesById",
      message:
        `Source count exceeds ${LAYER_DOCUMENT_PROJECT_MAX_SOURCE_COUNT}`,
    };
  }
  return null;
}

function unknownEntityTypeError(
  project: unknown
): LayerDocumentProjectPersistenceError | null {
  const { layers, sources } = readEntityMaps(project);
  if (layers) {
    for (const [layerId, layer] of Object.entries(layers)) {
      if (
        isRecord(layer) &&
        typeof layer.type === "string" &&
        !KNOWN_LAYER_TYPES.has(layer.type)
      ) {
        return {
          code: "unknown-entity-type",
          path:
            `$.project.payload.layerDocumentsById.${layerId}.type`,
          message:
            `Unsupported Layer Document type: ${layer.type}`,
        };
      }
    }
  }
  if (sources) {
    for (
      const [sourceId, source]
      of Object.entries(sources)
    ) {
      if (
        isRecord(source) &&
        typeof source.kind === "string" &&
        !KNOWN_SOURCE_KINDS.has(source.kind)
      ) {
        return {
          code: "unknown-entity-type",
          path:
            `$.project.payload.sourceRegistry.sourcesById.${sourceId}.kind`,
          message:
            `Unsupported Source kind: ${source.kind}`,
        };
      }
    }
  }
  return null;
}

function schemaVersion(
  project: unknown
): unknown {
  return isRecord(project) &&
    isRecord(project.metadata)
    ? project.metadata.schemaVersion
    : null;
}

function migrateProjectForLoad(
  project: unknown
): LayerDocumentProjectPersistenceResult<{
  readonly project: unknown;
  readonly migratedFromSchemaVersion: 1 | null;
}> {
  const version = schemaVersion(project);
  if (version === 1) {
    const migrated =
      migrateLayerDocumentProjectSchema1To2(project);
    return migrated.ok
      ? {
          ok: true,
          value: {
            project: migrated.value,
            migratedFromSchemaVersion: 1,
          },
        }
      : failure({
          code: "invalid-project",
          path: migrated.error.path,
          message: migrated.error.message,
        });
  }
  if (
    typeof version === "number" &&
    version > LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION
  ) {
    return failure({
      code: "unsupported-project-schema",
      path: "$.project.metadata.schemaVersion",
      message: `Unsupported Project schema version: ${version}`,
    });
  }
  if (version !== LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION) {
    return failure({
      code: "invalid-project",
      path: "$.project.metadata.schemaVersion",
      message: "Project schema version is missing or invalid",
    });
  }
  return {
    ok: true,
    value: {
      project,
      migratedFromSchemaVersion: null,
    },
  };
}

function parseContainer(
  value: unknown
): LayerDocumentProjectPersistenceResult<unknown> {
  if (!isRecord(value)) {
    return failure({
      code: "invalid-container",
      path: "$",
      message: "Project file container must be an object",
    });
  }
  const keys = Object.keys(value).sort(compareKeys);
  if (
    keys.length !== 3 ||
    keys[0] !== "containerVersion" ||
    keys[1] !== "format" ||
    keys[2] !== "project"
  ) {
    return failure({
      code: "invalid-container",
      path: "$",
      message:
        "Project file container must contain only format, containerVersion, and project",
    });
  }
  if (value.format !== LAYER_DOCUMENT_PROJECT_FILE_FORMAT) {
    return failure({
      code: "invalid-container",
      path: "$.format",
      message: "Unrecognized Project file format",
    });
  }
  switch (value.containerVersion) {
    case LAYER_DOCUMENT_PROJECT_CONTAINER_VERSION:
      return { ok: true, value: value.project };
    default:
      return failure({
        code: "unsupported-container-version",
        path: "$.containerVersion",
        message:
          `Unsupported container version: ${String(value.containerVersion)}`,
      });
  }
}

export function saveLayerDocumentProjectToSfep(
  project: LayerDocumentProject
): LayerDocumentProjectPersistenceResult<Uint8Array> {
  const nonPlainDataPath = findNonPlainDataPath(project);
  if (nonPlainDataPath) {
    return failure({
      code: "non-serializable-project",
      path: nonPlainDataPath,
      message:
        "Project file accepts Plain Data only; runtime values cannot be serialized",
    });
  }
  const issues = validateLayerDocumentProject(project);
  if (issues.length > 0) {
    return failure({
      code: "invalid-project",
      path: issues[0].path,
      message: issues[0].message,
      validationIssues: issues,
    });
  }
  const envelope: LayerDocumentProjectFileEnvelope = {
    format: LAYER_DOCUMENT_PROJECT_FILE_FORMAT,
    containerVersion:
      LAYER_DOCUMENT_PROJECT_CONTAINER_VERSION,
    project,
  };
  const nestingError = checkNesting(envelope);
  if (nestingError) return failure(nestingError);
  const entityCountError = checkEntityCounts(project);
  if (entityCountError) return failure(entityCountError);
  const text = `${JSON.stringify(
    canonicalize(
      envelope as unknown as PlainDataValue
    ),
    null,
    2
  )}\n`;
  const bytes = new TextEncoder().encode(text);
  if (
    bytes.byteLength >
    LAYER_DOCUMENT_PROJECT_MAX_JSON_BYTES
  ) {
    return failure({
      code: "file-too-large",
      path: "$",
      message:
        `Project file exceeds ${LAYER_DOCUMENT_PROJECT_MAX_JSON_BYTES} bytes`,
    });
  }
  return { ok: true, value: bytes };
}

export function loadLayerDocumentProjectFromSfep(
  bytes: Uint8Array
): LayerDocumentProjectPersistenceResult<
  LayerDocumentProjectLoadCandidate
> {
  if (bytes.byteLength === 0) {
    return failure({
      code: "empty-file",
      path: "$",
      message: "Project file is empty",
    });
  }
  if (
    bytes.byteLength >
    LAYER_DOCUMENT_PROJECT_MAX_JSON_BYTES
  ) {
    return failure({
      code: "file-too-large",
      path: "$",
      message:
        `Project file exceeds ${LAYER_DOCUMENT_PROJECT_MAX_JSON_BYTES} bytes`,
    });
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", {
      fatal: true,
    }).decode(bytes);
  } catch {
    return failure({
      code: "invalid-utf8",
      path: "$",
      message: "Project file is not valid UTF-8",
    });
  }
  if (text.trim().length === 0) {
    return failure({
      code: "empty-file",
      path: "$",
      message: "Project file is empty",
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failure({
      code: "invalid-json",
      path: "$",
      message: "Project file contains invalid JSON",
    });
  }
  const nestingError = checkNesting(parsed);
  if (nestingError) return failure(nestingError);
  const container = parseContainer(parsed);
  if (!container.ok) return container;
  const entityCountError =
    checkEntityCounts(container.value);
  if (entityCountError) return failure(entityCountError);

  // Container dispatch is complete before schema migration. Normalization
  // and validation run only after the schema has reached the current version.
  const migrated = migrateProjectForLoad(container.value);
  if (!migrated.ok) return migrated;
  const unknownTypeError =
    unknownEntityTypeError(migrated.value.project);
  if (unknownTypeError) return failure(unknownTypeError);
  const normalized =
    normalizeLayerDocumentProject(
      migrated.value.project
    );
  if (!normalized.ok) {
    return failure({
      code: "invalid-project",
      path: normalized.issues[0]?.path ?? "$.project",
      message:
        normalized.issues[0]?.message ??
        "Project validation failed",
      validationIssues: normalized.issues,
    });
  }
  return {
    ok: true,
    value: {
      project: normalized.project,
      sourceByteLength: bytes.byteLength,
      migratedFromSchemaVersion:
        migrated.value.migratedFromSchemaVersion,
    },
  };
}

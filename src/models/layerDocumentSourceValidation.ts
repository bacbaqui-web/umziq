export type LayerDocumentValidationIssueCode =
  | "non-plain-data"
  | "invalid-shape"
  | "unknown-field"
  | "invalid-schema-version"
  | "invalid-id"
  | "key-id-mismatch"
  | "duplicate-id"
  | "invalid-type-data"
  | "invalid-number"
  | "invalid-timing"
  | "invalid-transform"
  | "invalid-source-reference"
  | "invalid-source-kind"
  | "invalid-parent"
  | "invalid-root-count"
  | "parent-cycle"
  | "invalid-sibling-order";

export interface LayerDocumentValidationIssue {
  code: LayerDocumentValidationIssueCode;
  path: string;
  message: string;
}

export type UnknownRecord = Record<string, unknown>;

const SOURCE_KINDS = new Set([
  "psd-document",
  "psd-node",
  "audio",
  "video",
  "unknown",
]);

export function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function addIssue(
  issues: LayerDocumentValidationIssue[],
  code: LayerDocumentValidationIssueCode,
  path: string,
  message: string
) {
  issues.push({ code, path, message });
}

export function requireRecord(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
): UnknownRecord | null {
  if (isRecord(value)) return value;
  addIssue(issues, "invalid-shape", path, "Expected an object");
  return null;
}

export function validateExactKeys(
  value: UnknownRecord,
  allowedKeys: readonly string[],
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const allowed = new Set(allowedKeys);
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      addIssue(
        issues,
        "unknown-field",
        `${path}.${key}`,
        `Field is not part of the schema: ${key}`
      );
    }
  });
  allowedKeys.forEach((key) => {
    if (!(key in value)) {
      addIssue(
        issues,
        "invalid-shape",
        `${path}.${key}`,
        `Missing required field: ${key}`
      );
    }
  });
}

export function validateString(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[],
  options: { nullable?: boolean; nonEmpty?: boolean } = {}
) {
  if (options.nullable && value === null) return;
  if (typeof value !== "string") {
    addIssue(issues, "invalid-shape", path, "Expected a string");
    return;
  }
  if (options.nonEmpty && value.trim().length === 0) {
    addIssue(issues, "invalid-id", path, "Expected a non-empty string");
  }
}

export function validateBoolean(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  if (typeof value !== "boolean") {
    addIssue(issues, "invalid-shape", path, "Expected a boolean");
  }
}

export function validateNumber(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[],
  options: {
    integer?: boolean;
    minimum?: number;
    maximum?: number;
    nullable?: boolean;
    code?: LayerDocumentValidationIssueCode;
  } = {}
) {
  if (options.nullable && value === null) return;
  const invalid =
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (options.integer && !Number.isInteger(value)) ||
    (options.minimum !== undefined &&
      typeof value === "number" &&
      value < options.minimum) ||
    (options.maximum !== undefined &&
      typeof value === "number" &&
      value > options.maximum);
  if (invalid) {
    addIssue(
      issues,
      options.code ?? "invalid-number",
      path,
      "Number is outside the schema contract"
    );
  }
}

export function validatePosition(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[],
  code: LayerDocumentValidationIssueCode = "invalid-transform"
) {
  const record = requireRecord(value, path, issues);
  if (!record) return;
  validateExactKeys(record, ["x", "y"], path, issues);
  validateNumber(record.x, `${path}.x`, issues, { code });
  validateNumber(record.y, `${path}.y`, issues, { code });
}

function validateStringOrNull(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  validateString(value, path, issues, { nullable: true });
}

export function validateStringArrayObjects(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  if (!Array.isArray(value)) {
    addIssue(issues, "invalid-shape", path, "Expected an array");
    return;
  }
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      addIssue(
        issues,
        "invalid-shape",
        `${path}[${index}]`,
        "Expected a Plain Data object"
      );
    }
  });
}

function validateRefresh(
  value: unknown,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const record = requireRecord(value, path, issues);
  if (!record) return;
  validateExactKeys(record, ["status", "reconnectHint"], path, issues);
  if (
    typeof record.status !== "string" ||
    !["normal", "updated", "new", "deletePending", "missing"].includes(
      record.status
    )
  ) {
    addIssue(issues, "invalid-shape", `${path}.status`, "Invalid refresh status");
  }
  if (record.reconnectHint === null) return;
  const reconnectHint = requireRecord(
    record.reconnectHint,
    `${path}.reconnectHint`,
    issues
  );
  if (!reconnectHint) return;
  validateExactKeys(
    reconnectHint,
    ["fileName", "path"],
    `${path}.reconnectHint`,
    issues
  );
  validateString(
    reconnectHint.fileName,
    `${path}.reconnectHint.fileName`,
    issues,
    { nonEmpty: true }
  );
  validateStringOrNull(
    reconnectHint.path,
    `${path}.reconnectHint.path`,
    issues
  );
}

function validateSourceData(
  source: UnknownRecord,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const dataPath = `${path}.data`;
  const data = requireRecord(source.data, dataPath, issues);
  if (!data || typeof source.kind !== "string") return;

  switch (source.kind) {
    case "psd-document": {
      validateExactKeys(data, ["fileName", "importSettings"], dataPath, issues);
      validateString(data.fileName, `${dataPath}.fileName`, issues, {
        nonEmpty: true,
      });
      const settings = requireRecord(
        data.importSettings,
        `${dataPath}.importSettings`,
        issues
      );
      if (!settings) return;
      validateExactKeys(
        settings,
        ["compositionName", "hiddenLayerMode"],
        `${dataPath}.importSettings`,
        issues
      );
      validateString(
        settings.compositionName,
        `${dataPath}.importSettings.compositionName`,
        issues,
        { nonEmpty: true }
      );
      if (
        settings.hiddenLayerMode !== "preserve" &&
        settings.hiddenLayerMode !== "omit"
      ) {
        addIssue(
          issues,
          "invalid-type-data",
          `${dataPath}.importSettings.hiddenLayerMode`,
          "Invalid PSD hidden layer mode"
        );
      }
      return;
    }
    case "psd-node":
      validateExactKeys(
        data,
        ["documentSourceId", "sourceKey", "sourcePath", "nativeVisible"],
        dataPath,
        issues
      );
      validateString(
        data.documentSourceId,
        `${dataPath}.documentSourceId`,
        issues,
        { nonEmpty: true }
      );
      validateString(data.sourceKey, `${dataPath}.sourceKey`, issues, {
        nonEmpty: true,
      });
      validateString(data.sourcePath, `${dataPath}.sourcePath`, issues, {
        nonEmpty: true,
      });
      if (data.nativeVisible !== null) {
        validateBoolean(data.nativeVisible, `${dataPath}.nativeVisible`, issues);
      }
      return;
    case "audio":
      validateExactKeys(
        data,
        ["fileName", "mimeType", "durationFrames"],
        dataPath,
        issues
      );
      validateString(data.fileName, `${dataPath}.fileName`, issues, {
        nonEmpty: true,
      });
      validateStringOrNull(data.mimeType, `${dataPath}.mimeType`, issues);
      validateNumber(data.durationFrames, `${dataPath}.durationFrames`, issues, {
        integer: true,
        minimum: 1,
        nullable: true,
      });
      return;
    case "video":
      validateExactKeys(
        data,
        ["fileName", "mimeType", "durationFrames", "width", "height"],
        dataPath,
        issues
      );
      validateString(data.fileName, `${dataPath}.fileName`, issues, {
        nonEmpty: true,
      });
      validateStringOrNull(data.mimeType, `${dataPath}.mimeType`, issues);
      validateNumber(data.durationFrames, `${dataPath}.durationFrames`, issues, {
        integer: true,
        minimum: 1,
        nullable: true,
      });
      validateNumber(data.width, `${dataPath}.width`, issues, {
        minimum: 1,
        nullable: true,
      });
      validateNumber(data.height, `${dataPath}.height`, issues, {
        minimum: 1,
        nullable: true,
      });
      return;
    case "unknown":
      validateExactKeys(data, ["originalKind", "rawData"], dataPath, issues);
      validateString(data.originalKind, `${dataPath}.originalKind`, issues, {
        nonEmpty: true,
      });
      requireRecord(data.rawData, `${dataPath}.rawData`, issues);
      return;
    default:
      addIssue(
        issues,
        "invalid-type-data",
        `${path}.kind`,
        "Source kind and data are not a supported discriminated union member"
      );
  }
}

export function validateSourceRecord(
  source: unknown,
  sourceKey: string,
  path: string,
  issues: LayerDocumentValidationIssue[]
) {
  const record = requireRecord(source, path, issues);
  if (!record) return;
  validateExactKeys(
    record,
    [
      "sourceId",
      "kind",
      "displayName",
      "path",
      "fingerprint",
      "version",
      "availability",
      "refresh",
      "data",
    ],
    path,
    issues
  );
  validateString(record.sourceId, `${path}.sourceId`, issues, {
    nonEmpty: true,
  });
  if (record.sourceId !== sourceKey) {
    addIssue(
      issues,
      "key-id-mismatch",
      `${path}.sourceId`,
      "Source dictionary key and sourceId differ"
    );
  }
  if (typeof record.kind !== "string" || !SOURCE_KINDS.has(record.kind)) {
    addIssue(
      issues,
      "invalid-type-data",
      `${path}.kind`,
      "Unknown source kind must be normalized to kind=unknown"
    );
  }
  validateString(record.displayName, `${path}.displayName`, issues, {
    nonEmpty: true,
  });
  validateStringOrNull(record.path, `${path}.path`, issues);
  validateStringOrNull(record.fingerprint, `${path}.fingerprint`, issues);
  validateNumber(record.version, `${path}.version`, issues, {
    integer: true,
    minimum: 1,
  });
  if (record.availability !== "available" && record.availability !== "missing") {
    addIssue(
      issues,
      "invalid-shape",
      `${path}.availability`,
      "Invalid source availability"
    );
  }
  validateRefresh(record.refresh, `${path}.refresh`, issues);
  validateSourceData(record, path, issues);
}

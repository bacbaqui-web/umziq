import { LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION, type LayerDocumentProject } from "@/models/layerDocumentModel";
import { findNonPlainDataPath } from "@/models/plainDataModel";
import { addIssue, isRecord, requireRecord, validateExactKeys, validateSourceRecord, validateString, type LayerDocumentValidationIssue, type UnknownRecord } from "@/models/layerDocumentSourceValidation";
import { validateLayerDocument } from "@/models/layerDocumentStructureValidation";
import { validateCrossReferences } from "@/models/layerDocumentGraphValidation";

export type { LayerDocumentValidationIssue, LayerDocumentValidationIssueCode } from "@/models/layerDocumentSourceValidation";

export function validateLayerDocumentProject(
  value: unknown
): LayerDocumentValidationIssue[] {
  const nonPlainDataPath = findNonPlainDataPath(value);
  if (nonPlainDataPath) {
    return [
      {
        code: "non-plain-data",
        path: nonPlainDataPath,
        message: "Project schema accepts Plain Data only",
      },
    ];
  }

  const issues: LayerDocumentValidationIssue[] = [];
  const project = requireRecord(value, "$", issues);
  if (!project) return issues;
  validateExactKeys(project, ["metadata", "payload"], "$", issues);

  const metadata = requireRecord(project.metadata, "$.metadata", issues);
  if (metadata) {
    validateExactKeys(
      metadata,
      ["schemaVersion", "projectId", "name"],
      "$.metadata",
      issues
    );
    if (metadata.schemaVersion !== LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION) {
      addIssue(
        issues,
        "invalid-schema-version",
        "$.metadata.schemaVersion",
        `Expected schema version ${LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION}`
      );
    }
    validateString(metadata.projectId, "$.metadata.projectId", issues, {
      nonEmpty: true,
    });
    validateString(metadata.name, "$.metadata.name", issues, {
      nonEmpty: true,
    });
  }

  const payload = requireRecord(project.payload, "$.payload", issues);
  if (!payload) return issues;
  validateExactKeys(
    payload,
    ["layerDocumentsById", "sourceRegistry"],
    "$.payload",
    issues,
    ["canvasSettings"]
  );
  if (payload.canvasSettings !== undefined) {
    const settings = requireRecord(
      payload.canvasSettings, "$.payload.canvasSettings", issues
    );
    if (settings) {
      validateExactKeys(settings, [
        "showShortformFrameOverlay", "showSafeZoneGuides",
        "showSelectionHighlight", "cameraScalePercent",
        "cameraDimOpacityPercent", "showWhiteBackground",
      ], "$.payload.canvasSettings", issues);
      ["showShortformFrameOverlay", "showSafeZoneGuides",
        "showSelectionHighlight", "showWhiteBackground"].forEach((key) => {
        if (typeof settings[key] !== "boolean") addIssue(
          issues, "invalid-type-data", `$.payload.canvasSettings.${key}`,
          "Canvas setting must be a boolean"
        );
      });
      if (typeof settings.cameraScalePercent !== "number" ||
          !Number.isFinite(settings.cameraScalePercent) ||
          settings.cameraScalePercent < 1 || settings.cameraScalePercent > 1000) {
        addIssue(issues, "invalid-type-data",
          "$.payload.canvasSettings.cameraScalePercent",
          "Camera scale percent must be between 1 and 1000");
      }
      if (typeof settings.cameraDimOpacityPercent !== "number" ||
          !Number.isFinite(settings.cameraDimOpacityPercent) ||
          settings.cameraDimOpacityPercent < 0 || settings.cameraDimOpacityPercent > 100) {
        addIssue(issues, "invalid-type-data",
          "$.payload.canvasSettings.cameraDimOpacityPercent",
          "Camera dim opacity percent must be between 0 and 100");
      }
    }
  }
  const layers = requireRecord(
    payload.layerDocumentsById,
    "$.payload.layerDocumentsById",
    issues
  );
  const sourceRegistry = requireRecord(
    payload.sourceRegistry,
    "$.payload.sourceRegistry",
    issues
  );
  let sources: UnknownRecord | null = null;
  if (sourceRegistry) {
    validateExactKeys(
      sourceRegistry,
      ["sourcesById"],
      "$.payload.sourceRegistry",
      issues
    );
    sources = requireRecord(
      sourceRegistry.sourcesById,
      "$.payload.sourceRegistry.sourcesById",
      issues
    );
  }

  if (sources) {
    const sourceIds = new Set<string>();
    Object.entries(sources).forEach(([sourceId, source]) => {
      validateSourceRecord(
        source,
        sourceId,
        `$.payload.sourceRegistry.sourcesById.${sourceId}`,
        issues
      );
      if (isRecord(source) && typeof source.sourceId === "string") {
        if (sourceIds.has(source.sourceId)) {
          addIssue(
            issues,
            "duplicate-id",
            `$.payload.sourceRegistry.sourcesById.${sourceId}.sourceId`,
            "Source IDs must be unique"
          );
        }
        sourceIds.add(source.sourceId);
      }
    });
  }
  if (layers) {
    const layerIds = new Set<string>();
    Object.entries(layers).forEach(([layerId, layer]) => {
      validateLayerDocument(
        layer,
        layerId,
        `$.payload.layerDocumentsById.${layerId}`,
        issues
      );
      if (isRecord(layer) && typeof layer.layerDocumentId === "string") {
        if (layerIds.has(layer.layerDocumentId)) {
          addIssue(
            issues,
            "duplicate-id",
            `$.payload.layerDocumentsById.${layerId}.layerDocumentId`,
            "Layer Document IDs must be unique"
          );
        }
        layerIds.add(layer.layerDocumentId);
      }
    });
  }

  if (
    issues.every(
      (issue) =>
        issue.code !== "invalid-shape" &&
        issue.code !== "invalid-type-data" &&
        issue.code !== "key-id-mismatch" &&
        issue.code !== "invalid-schema-version"
    )
  ) {
    validateCrossReferences(value as LayerDocumentProject, issues);
  }
  return issues;
}

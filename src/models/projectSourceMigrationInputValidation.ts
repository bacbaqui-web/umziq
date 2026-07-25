import { findNonPlainDataPath } from "@/models/plainDataModel";
import { PROJECT_SOURCE_SCHEMA_VERSION } from "@/models/projectSourceModel";
import { validateProjectSourceDocument } from "@/models/projectSourceValidation";
import type { ProjectSourceLayerMigrationIssue, ProjectSourceToLayerDocumentMigrationInput } from "@/models/projectSourceMigrationIdentity";

export function inputIssues(
  input: ProjectSourceToLayerDocumentMigrationInput
): ProjectSourceLayerMigrationIssue[] {
  const nonPlainDataPath = findNonPlainDataPath({
    document: input.document,
    projectId: input.projectId,
    name: input.name,
  });
  if (nonPlainDataPath) {
    return [{
      code: "non-plain-input",
      path: nonPlainDataPath,
      message: "Migration input must be Plain Data",
    }];
  }
  const issues: ProjectSourceLayerMigrationIssue[] = [];
  if (input.document.schemaVersion !== PROJECT_SOURCE_SCHEMA_VERSION) {
    issues.push({
      code: "invalid-input-schema",
      path: "$.document.schemaVersion",
      message: `Expected ProjectSource schema ${PROJECT_SOURCE_SCHEMA_VERSION}`,
    });
  }
  if (!input.projectId.trim() || !input.name.trim()) {
    issues.push({
      code: "invalid-project-metadata",
      path: "$",
      message: "projectId and name must be non-empty",
    });
  }
  const integrityIssues = validateProjectSourceDocument(input.document);
  if (integrityIssues.length > 0) {
    issues.push({
      code: "invalid-project-source",
      path: "$.document",
      message: `ProjectSource integrity issue: ${integrityIssues[0].type}`,
    });
  }
  if (
    input.document.rootSourceIds.length !== 1 ||
    input.document.sourcesById[input.document.rootSourceIds[0]]?.type !==
      "group"
  ) {
    issues.push({
      code: "invalid-root-source",
      path: "$.document.rootSourceIds",
      message: "Migration requires exactly one root Group Source",
    });
  }
  return issues;
}

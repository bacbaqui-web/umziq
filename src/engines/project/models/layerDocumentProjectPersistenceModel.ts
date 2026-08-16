import type {
  LayerDocumentProject,
  LayerDocumentValidationIssue,
} from "@/models";

export const LAYER_DOCUMENT_PROJECT_FILE_FORMAT =
  "umziq-project" as const;
export const LAYER_DOCUMENT_PROJECT_CONTAINER_VERSION =
  1 as const;
export const LAYER_DOCUMENT_PROJECT_MAX_JSON_BYTES =
  64 * 1024 * 1024;
export const LAYER_DOCUMENT_PROJECT_MAX_JSON_NESTING =
  256;
export const LAYER_DOCUMENT_PROJECT_MAX_LAYER_COUNT =
  10_000;
export const LAYER_DOCUMENT_PROJECT_MAX_SOURCE_COUNT =
  10_000;

export interface LayerDocumentProjectFileEnvelope {
  readonly format:
    typeof LAYER_DOCUMENT_PROJECT_FILE_FORMAT;
  readonly containerVersion:
    typeof LAYER_DOCUMENT_PROJECT_CONTAINER_VERSION;
  readonly project: LayerDocumentProject;
}

export interface LayerDocumentProjectLoadCandidate {
  readonly project: LayerDocumentProject;
  readonly sourceByteLength: number;
  readonly migratedFromSchemaVersion: 1 | 2 | null;
}

export type LayerDocumentProjectPersistenceErrorCode =
  | "empty-file"
  | "file-too-large"
  | "invalid-utf8"
  | "invalid-json"
  | "nesting-limit-exceeded"
  | "entity-limit-exceeded"
  | "invalid-container"
  | "unsupported-container-version"
  | "unsupported-project-schema"
  | "unknown-entity-type"
  | "invalid-project"
  | "non-serializable-project";

export interface LayerDocumentProjectPersistenceError {
  readonly code:
    LayerDocumentProjectPersistenceErrorCode;
  readonly path: string;
  readonly message: string;
  readonly validationIssues?:
    readonly LayerDocumentValidationIssue[];
}

export type LayerDocumentProjectPersistenceResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error:
        LayerDocumentProjectPersistenceError;
    };

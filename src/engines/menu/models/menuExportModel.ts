import type {
  ExportDestination,
  ExportDestinationPort,
} from "@/gateway";
import type {
  ProjectExportFormat,
  ProjectExportProgress,
} from "@/shared/models/projectExportContract";

export type MenuExportFormat = ProjectExportFormat;

export type MenuExportProgress = ProjectExportProgress;

export type MenuExportRuntimePort = {
  readonly run: (
    format: MenuExportFormat,
    destination: ExportDestination | null,
    onProgress: (progress: MenuExportProgress) => void,
    signal: AbortSignal
  ) => Promise<void>;
  readonly isFormatSupported: (
    format: MenuExportFormat
  ) => boolean;
};

export type MenuExportControllerPorts = {
  readonly destination: ExportDestinationPort;
  readonly runtime: MenuExportRuntimePort;
  readonly close: () => void;
};

export type MenuExportControllerSnapshot = {
  readonly destination: ExportDestination | null;
  readonly progress: MenuExportProgress | null;
  readonly error: string | null;
  readonly busy: boolean;
};

export type MenuExportController = {
  readonly read: () => MenuExportControllerSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly updatePorts: (ports: MenuExportControllerPorts) => void;
  readonly chooseDestination: () => Promise<void>;
  readonly run: (format: MenuExportFormat) => Promise<void>;
  readonly cancel: () => void;
  readonly isFormatSupported: (format: MenuExportFormat) => boolean;
  readonly dispose: () => void;
};

export function menuExportExtension(format: MenuExportFormat) {
  if (format === "mp4") return "mp4";
  if (format === "gif") return "gif";
  return format === "webp" ? "webp" : "webm";
}

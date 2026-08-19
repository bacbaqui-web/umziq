export type {
  ProjectReadPort,
  ProjectReadSelection,
  ProjectStorageCapability,
  ProjectStorageErrorCode,
  ProjectStorageGateway,
  ProjectStorageResult,
  ProjectStorageTarget,
  ProjectWritePort,
} from "@/gateway/contracts/projectStorageGateway";
export {
  createWebProjectStorageGateway,
  registerWebProjectStorageTarget,
} from "@/gateway/platforms/web/createWebProjectStorageGateway";
export { createFakeProjectStorageGateway } from "@/gateway/testing/createFakeProjectStorageGateway";
export {
  createWebMenuPlatformPorts,
} from "@/gateway/platforms/web/createWebMenuPlatformPorts";
export type {
  SourceAccessPort,
  SourceAccessResult,
  SourceKind,
  SourceResourceReference,
} from "@/gateway/contracts/sourceAccessGateway";
export {
  createWebSourceAccessGateway,
} from "@/gateway/platforms/web/createWebSourceAccessGateway";
export {
  createFakeSourceAccessGateway,
} from "@/gateway/testing/createFakeSourceAccessGateway";
export type {
  MicrophoneCapturePort,
  MicrophoneCaptureSession,
  MicrophoneDevice,
  MicrophoneProcessingFeature,
  MicrophoneProcessingSnapshot,
} from "@/gateway/contracts/microphoneCaptureGateway";
export { createWebMicrophoneCaptureGateway } from "@/gateway/platforms/web/createWebMicrophoneCaptureGateway";
export { createFakeMicrophoneCaptureGateway } from "@/gateway/testing/createFakeMicrophoneCaptureGateway";
export type { ExportDestination, ExportDestinationPort, ExportDestinationResult } from "@/gateway/contracts/exportDestinationGateway";
export { createWebExportDestinationGateway } from "@/gateway/platforms/web/createWebExportDestinationGateway";
export { createFakeExportDestinationGateway } from "@/gateway/testing/createFakeExportDestinationGateway";
export { createLayerDocumentProjectBrowserOpenAdapter, createLayerDocumentProjectBrowserOpenEnvironment } from "@/gateway/platforms/web/adapters/layerDocumentProjectBrowserOpenAdapter";
export { createLayerDocumentProjectBrowserWriteAdapter } from "@/gateway/platforms/web/adapters/layerDocumentProjectBrowserWriteAdapter";

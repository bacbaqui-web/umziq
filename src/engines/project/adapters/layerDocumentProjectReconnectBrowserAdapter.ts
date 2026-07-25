import {
  createLayerDocumentProjectBrowserOpenEnvironment,
  createLayerDocumentProjectBrowserOpenAdapter,
} from "@/engines/project/adapters/layerDocumentProjectBrowserOpenAdapter";
import type {
  LayerDocumentProjectReconnectBrowserEnvironment,
  LayerDocumentProjectReconnectBrowserPort,
} from "@/engines/project/models/layerDocumentProjectReconnectModel";

function extension(fileName: string) {
  const match = /\.[a-z0-9]+$/i.exec(fileName.trim());
  return match?.[0].toLowerCase() ?? "";
}

export function createLayerDocumentProjectReconnectBrowserAdapter(
  environment:
    LayerDocumentProjectReconnectBrowserEnvironment =
      createLayerDocumentProjectBrowserOpenEnvironment()
): LayerDocumentProjectReconnectBrowserPort {
  return {
    capability: environment.showOpenFilePicker
      ? "native-file-system"
      : "file-input",
    chooseLinkedSourceFile: (source) => {
      const suggestedFileName =
        "locator" in source
          ? source.locator.suggestedFileName
          : source.displayName;
      const acceptedExtension =
        extension(suggestedFileName);
      return createLayerDocumentProjectBrowserOpenAdapter({
        showOpenFilePicker:
          environment.showOpenFilePicker
            ? () =>
                environment.showOpenFilePicker!({
                  multiple: false,
                  types: [{
                    description:
                      "Linked Source",
                    accept: {
                      "application/octet-stream":
                        acceptedExtension
                          ? [acceptedExtension]
                          : [],
                    },
                  }],
                })
            : undefined,
        chooseFileWithHiddenInput: () =>
          environment.chooseFileWithHiddenInput(
            acceptedExtension
          ),
      }).chooseProjectFile();
    },
  };
}

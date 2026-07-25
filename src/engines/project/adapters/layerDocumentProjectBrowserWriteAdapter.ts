import type {
  LayerDocumentProjectBrowserWriteEnvironment,
  LayerDocumentProjectBrowserWritePort,
  LayerDocumentProjectWriteErrorCode,
  LayerDocumentProjectWriteResult,
  LayerDocumentProjectWritableStream,
} from "@/engines/project/models/layerDocumentProjectBrowserWriteModel";

function failure<T>(
  code: LayerDocumentProjectWriteErrorCode,
  message: string
): LayerDocumentProjectWriteResult<T> {
  return {
    ok: false,
    error: { code, message },
  };
}

function errorName(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  )
    ? error.name
    : "";
}

function browserError<T>(
  error: unknown,
  fallbackCode:
    LayerDocumentProjectWriteErrorCode,
  fallbackMessage: string
): LayerDocumentProjectWriteResult<T> {
  const name = errorName(error);
  if (name === "AbortError") {
    return failure("cancelled", "Project save was cancelled");
  }
  if (
    name === "NotAllowedError" ||
    name === "SecurityError"
  ) {
    return failure(
      "permission-denied",
      "Permission to write the Project file was denied"
    );
  }
  return failure(fallbackCode, fallbackMessage);
}

function defaultEnvironment():
LayerDocumentProjectBrowserWriteEnvironment {
  const browserWindow = window as unknown as {
    showSaveFilePicker?:
      LayerDocumentProjectBrowserWriteEnvironment[
        "showSaveFilePicker"
      ];
  };
  return {
    showSaveFilePicker:
      browserWindow.showSaveFilePicker?.bind(window),
    createObjectURL: (blob) =>
      URL.createObjectURL(blob),
    revokeObjectURL: (url) =>
      URL.revokeObjectURL(url),
    createDownloadAnchor: () =>
      document.createElement("a"),
  };
}

export function createLayerDocumentProjectBrowserWriteAdapter(
  environment:
    LayerDocumentProjectBrowserWriteEnvironment =
      defaultEnvironment()
): LayerDocumentProjectBrowserWritePort {
  const capability = environment.showSaveFilePicker
    ? "native-file-system"
    : "blob-download";
  return {
    capability,
    chooseTarget: async (suggestedFileName) => {
      if (!environment.showSaveFilePicker) {
        return {
          ok: true,
          value: {
            kind: "blob-download",
            fileName: suggestedFileName,
          },
        };
      }
      try {
        const handle =
          await environment.showSaveFilePicker({
            suggestedName: suggestedFileName,
            types: [{
              description:
                "Shortform Editor Project",
              accept: {
                "application/json": [".sfep"],
              },
            }],
          });
        return {
          ok: true,
          value: {
            kind: "native-file-system",
            fileName:
              handle.name || suggestedFileName,
            handle,
          },
        };
      } catch (error) {
        return browserError(
          error,
          "write-failed",
          "Could not choose a Project save target"
        );
      }
    },
    write: async ({ target, bytes, shouldCommit }) => {
      if (!shouldCommit()) {
        return failure(
          "stale-write",
          "A newer Project save superseded this write"
        );
      }
      if (target.kind === "blob-download") {
        let url: string | null = null;
        try {
          const blob = new Blob(
            [bytes.slice().buffer],
            {
              type:
                "application/json;charset=utf-8",
            }
          );
          if (!shouldCommit()) {
            return failure(
              "stale-write",
              "A newer Project save superseded this download"
            );
          }
          url = environment.createObjectURL(blob);
          const anchor =
            environment.createDownloadAnchor();
          anchor.href = url;
          anchor.download = target.fileName;
          anchor.click();
          anchor.remove?.();
          return { ok: true, value: undefined };
        } catch (error) {
          return browserError(
            error,
            "download-failed",
            "Could not download the Project file"
          );
        } finally {
          if (url) environment.revokeObjectURL(url);
        }
      }

      let writable:
        LayerDocumentProjectWritableStream | null =
          null;
      try {
        writable =
          await target.handle.createWritable();
        if (!shouldCommit()) {
          await writable.abort?.();
          return failure(
            "stale-write",
            "A newer Project save superseded this write"
          );
        }
        await writable.write(bytes);
        if (!shouldCommit()) {
          await writable.abort?.();
          return failure(
            "stale-write",
            "A newer Project save superseded this write"
          );
        }
        await writable.close();
        return { ok: true, value: undefined };
      } catch (error) {
        try {
          await writable?.abort?.();
        } catch {
          // Preserve the original write failure.
        }
        return browserError(
          error,
          "write-failed",
          "Could not write the Project file"
        );
      }
    },
  };
}

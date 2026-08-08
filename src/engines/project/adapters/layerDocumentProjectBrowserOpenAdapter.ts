import type {
  LayerDocumentProjectBrowserOpenEnvironment,
  LayerDocumentProjectBrowserOpenPort,
  LayerDocumentProjectOpenAdapterResult,
} from "@/engines/project/models/layerDocumentProjectOpenModel";

function failure(
  code:
    | "cancelled"
    | "permission-denied"
    | "read-failed",
  message: string
): LayerDocumentProjectOpenAdapterResult {
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

function browserFailure(
  error: unknown,
  message: string
) {
  const name = errorName(error);
  if (name === "AbortError") {
    return failure(
      "cancelled",
      "Project open was cancelled"
    );
  }
  if (
    name === "NotAllowedError" ||
    name === "SecurityError"
  ) {
    return failure(
      "permission-denied",
      "Permission to open the Project file was denied"
    );
  }
  return failure("read-failed", message);
}

function chooseWithHiddenInput(
  accept: string
): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.hidden = true;
    let settled = false;
    const onWindowFocus = () => {
      window.setTimeout(
        () => finish(input.files?.[0] ?? null),
        0
      );
    };
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener(
        "focus",
        onWindowFocus
      );
      input.remove();
      resolve(file);
    };
    input.addEventListener(
      "change",
      () => finish(input.files?.[0] ?? null),
      { once: true }
    );
    input.addEventListener(
      "cancel",
      () => finish(null),
      { once: true }
    );
    document.body.append(input);
    window.addEventListener(
      "focus",
      onWindowFocus,
      { once: true }
    );
    input.click();
  });
}

export function createLayerDocumentProjectBrowserOpenEnvironment():
LayerDocumentProjectBrowserOpenEnvironment {
  const browserWindow = window as unknown as {
    showOpenFilePicker?:
      LayerDocumentProjectBrowserOpenEnvironment[
        "showOpenFilePicker"
      ];
  };
  return {
    showOpenFilePicker:
      browserWindow.showOpenFilePicker?.bind(window),
    chooseFileWithHiddenInput:
      chooseWithHiddenInput,
  };
}

export function createLayerDocumentProjectBrowserOpenAdapter(
  environment:
    LayerDocumentProjectBrowserOpenEnvironment =
      createLayerDocumentProjectBrowserOpenEnvironment()
): LayerDocumentProjectBrowserOpenPort {
  const capability = environment.showOpenFilePicker
    ? "native-file-system"
    : "file-input";
  return {
    capability,
    chooseProjectFile: async () => {
      if (!environment.showOpenFilePicker) {
        try {
          const file =
            await environment
              .chooseFileWithHiddenInput(".ziq");
          if (!file) {
            return failure(
                "cancelled",
                "Project open was cancelled"
            );
          }
          const bytes = new Uint8Array(
            await file.arrayBuffer()
          );
          return {
            ok: true,
            value: {
              file,
              bytes,
              handle: null,
            },
          };
        } catch (error) {
          return browserFailure(
            error,
            "Could not read the selected Project file"
          );
        }
      }
      try {
        const handles =
          await environment.showOpenFilePicker({
            multiple: false,
            types: [{
              description:
                "UMZIQ Project",
              accept: {
                "application/json": [".ziq"],
              },
            }],
          });
        const handle = handles[0];
        if (!handle) {
          return failure(
            "cancelled",
            "Project open was cancelled"
          );
        }
        const file = await handle.getFile();
        const bytes = new Uint8Array(
          await file.arrayBuffer()
        );
        return {
          ok: true,
          value: { file, bytes, handle },
        };
      } catch (error) {
        return browserFailure(
          error,
          "Could not read the selected Project file"
        );
      }
    },
  };
}

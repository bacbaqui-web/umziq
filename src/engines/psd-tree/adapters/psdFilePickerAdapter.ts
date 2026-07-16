import type {
  PsdImportSource,
  PsdSourceFileHandle,
} from "@/engines/project";

export type PsdFilePicker = (options?: {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<PsdSourceFileHandle[]>;

type WindowWithPsdFilePicker = Window & {
  showOpenFilePicker?: PsdFilePicker;
};

const PSD_PICKER_OPTIONS = {
  excludeAcceptAllOption: true,
  types: [
    {
      description: "PSD Files",
      accept: {
        "image/vnd.adobe.photoshop": [".psd"],
      },
    },
  ],
};

export function getPsdFilePicker(
  browserWindow: Window | undefined = typeof window === "undefined" ? undefined : window
) {
  return (browserWindow as WindowWithPsdFilePicker | undefined)?.showOpenFilePicker;
}

export function isPsdPickerCancellation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function filesToPsdImportSources(
  files: FileList | readonly File[]
): PsdImportSource[] {
  return Array.from(files)
    .filter((file) => file.name.toLowerCase().endsWith(".psd"))
    .map((file) => ({ file, fileHandle: null }));
}

export async function handlesToPsdImportSources(
  handles: readonly PsdSourceFileHandle[]
): Promise<PsdImportSource[]> {
  return Promise.all(
    handles.map(async (fileHandle) => ({
      file: await fileHandle.getFile(),
      fileHandle,
    }))
  );
}

export async function openPsdSourcesFromPicker(
  picker: PsdFilePicker,
  multiple: boolean
) {
  const handles = await picker({ ...PSD_PICKER_OPTIONS, multiple });
  return handlesToPsdImportSources(handles);
}

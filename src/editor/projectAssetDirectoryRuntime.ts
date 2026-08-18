export type ProjectAssetFileHandle = {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: Blob | Uint8Array): Promise<void>;
    close(): Promise<void>;
    abort?(): Promise<void>;
  }>;
};

export type ProjectAssetDirectoryHandle = {
  readonly name: string;
  getDirectoryHandle(
    name: string,
    options: { readonly create: boolean }
  ): Promise<ProjectAssetDirectoryHandle>;
  getFileHandle(
    name: string,
    options: { readonly create: boolean }
  ): Promise<ProjectAssetFileHandle>;
  removeEntry?(name: string): Promise<void>;
  values?(): AsyncIterableIterator<{
    readonly kind: "file" | "directory";
    readonly name: string;
    getFile?: () => Promise<File>;
  }>;
};

let projectDirectory: ProjectAssetDirectoryHandle | null = null;
let projectDirectoryLookupDeclined = false;
let pendingProjectOpenSelection:
  LayerDocumentProjectOpenSelection | null = null;

export function queueProjectOpenSelection(
  selection: LayerDocumentProjectOpenSelection
) {
  pendingProjectOpenSelection = selection;
  return () => {
    if (pendingProjectOpenSelection === selection) {
      pendingProjectOpenSelection = null;
    }
  };
}

export function takeProjectOpenSelection() {
  const selection = pendingProjectOpenSelection;
  pendingProjectOpenSelection = null;
  return selection;
}

async function requireProjectAssetDirectory() {
  if (projectDirectory) return projectDirectory;
  const picker = (window as Window & {
    showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<ProjectAssetDirectoryHandle>;
  }).showDirectoryPicker;
  if (!picker) throw new Error("이 브라우저에서는 프로젝트 폴더 관리를 지원하지 않습니다.");
  projectDirectory = await picker({ mode: "readwrite" });
  return projectDirectory;
}

export function setProjectAssetDirectory(
  directory: ProjectAssetDirectoryHandle | null
) {
  projectDirectory = directory;
  projectDirectoryLookupDeclined = false;
}

export function readProjectAssetDirectory() {
  return projectDirectory;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function chooseProjectAssetDirectoryForLookup() {
  if (projectDirectory) return projectDirectory;
  if (projectDirectoryLookupDeclined) return null;
  const picker = (window as Window & {
    showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<ProjectAssetDirectoryHandle>;
  }).showDirectoryPicker;
  if (!picker) return null;
  try {
    projectDirectory = await picker({ mode: "readwrite" });
    return projectDirectory;
  } catch (error) {
    if (isAbortError(error)) {
      projectDirectoryLookupDeclined = true;
      return null;
    }
    throw error;
  }
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function fileMatchesFingerprint(
  file: File,
  fingerprint: { readonly digestHex: string; readonly byteLength: number } | null
) {
  if (!fingerprint) return true;
  if (file.size !== fingerprint.byteLength) return false;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return bytesToHex(new Uint8Array(digest)) === fingerprint.digestHex;
}

async function readableFile(
  directory: ProjectAssetDirectoryHandle,
  name: string
) {
  try {
    const handle = await directory.getFileHandle(name, { create: false });
    return { handle, file: await handle.getFile() };
  } catch {
    return null;
  }
}

export async function findLinkedSourceInProjectAssets(options: {
  readonly kind: "psd-document" | "audio" | "video";
  readonly suggestedFileName: string;
  readonly relativePathHint: string | null;
  readonly contentFingerprint: {
    readonly digestHex: string;
    readonly byteLength: number;
  } | null;
}): Promise<{ readonly file: File; readonly handle: ProjectAssetFileHandle } | null> {
  const folderName = options.kind === "psd-document"
    ? "psd"
    : options.kind === "audio"
      ? "audio"
      : null;
  if (!folderName) return null;
  const root = await chooseProjectAssetDirectoryForLookup();
  if (!root) return null;
  let assetDirectory: ProjectAssetDirectoryHandle;
  try {
    assetDirectory = await root.getDirectoryHandle(folderName, { create: false });
  } catch {
    return null;
  }

  const relativeParts = options.relativePathHint?.split("/") ?? [];
  const exactName =
    relativeParts.length === 2 && relativeParts[0] === folderName
      ? relativeParts[1]
      : null;
  for (const name of new Set(
    [exactName, options.suggestedFileName].filter(
      (value): value is string => Boolean(value)
    )
  )) {
    const candidate = await readableFile(assetDirectory, name);
    if (
      candidate &&
      await fileMatchesFingerprint(candidate.file, options.contentFingerprint)
    ) return candidate;
  }

  if (!assetDirectory.values) return null;
  for await (const entry of assetDirectory.values()) {
    if (entry.kind !== "file" || !entry.getFile) continue;
    const file = await entry.getFile();
    if (await fileMatchesFingerprint(file, options.contentFingerprint)) {
      const handle = await assetDirectory.getFileHandle(entry.name, {
        create: false,
      });
      return { file, handle };
    }
  }
  return null;
}

export async function copyFilesIntoProjectAssets(options: {
  readonly files: readonly File[];
  readonly kind: "psd" | "audio";
  readonly copy: boolean;
}): Promise<readonly { file: File; relativePathHint: string | null }[]> {
  if (options.files.length === 0) return [];
  if (!options.copy) {
    return options.files.map((file) => ({ file, relativePathHint: null }));
  }
  const directory = await requireProjectAssetDirectory();
  const assetDirectory = await directory.getDirectoryHandle(options.kind, { create: true });
  const copied = [];
  for (const file of options.files) {
    const extensionIndex = file.name.lastIndexOf(".");
    const stem = extensionIndex > 0
      ? file.name.slice(0, extensionIndex)
      : file.name;
    const extension = extensionIndex > 0
      ? file.name.slice(extensionIndex)
      : "";
    let availableName: string | null = null;
    for (let suffix = 1; suffix <= 10_000; suffix += 1) {
      const candidate = suffix === 1
        ? file.name
        : `${stem} (${suffix})${extension}`;
      try {
        await assetDirectory.getFileHandle(candidate, { create: false });
      } catch {
        availableName = candidate;
        break;
      }
    }
    if (!availableName) {
      throw new Error(`프로젝트 asset 이름을 만들 수 없습니다: ${file.name}`);
    }
    const handle = await assetDirectory.getFileHandle(availableName, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(file);
      await writable.close();
    } catch (error) {
      await writable.abort?.();
      try {
        await assetDirectory.removeEntry?.(availableName);
      } catch {
        // The failed write remains the primary error. Cleanup is best effort.
      }
      throw error;
    }
    copied.push({
      file: await handle.getFile(),
      relativePathHint: `${options.kind}/${availableName}`,
    });
  }
  return copied;
}

import type {
  LayerDocumentProjectOpenSelection,
} from "@/engines/project";

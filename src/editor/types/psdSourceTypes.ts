export type PsdSourceFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};

export type PsdImportSource = {
  file: File;
  fileHandle: PsdSourceFileHandle | null;
};

export type StoredPsdSource = {
  fileName: string;
  fileHandle: PsdSourceFileHandle | null;
};

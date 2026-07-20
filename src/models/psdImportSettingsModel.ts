export type PsdHiddenLayerMode = "preserve" | "omit";

export type PsdImportSettings = {
  compositionName: string;
  hiddenLayerMode: PsdHiddenLayerMode;
};

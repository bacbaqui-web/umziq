import type { Layer as PsdLayer, Psd } from "ag-psd";
import type { PsdImportSource } from "@/engines/project/models/psdSourceRuntimeModel";
import type { PsdImportSettings } from "@/models";

export type PsdImportPlanNode = {
  id: string;
  sourceKey: string;
  kind: "group" | "layer";
  originalName: string;
  displayName: string;
  autoRenamed: boolean;
  children: PsdImportPlanNode[];
};

export type PsdImportPlanEntry = {
  token: string;
  analysis: {
    fileName: string;
    width: number;
    height: number;
    groupCount: number;
    layerCount: number;
    hiddenLayerCount: number;
    warnings: string[];
    conflict: null;
  };
  settings: PsdImportSettings;
  tree: PsdImportPlanNode[];
};

export type PsdImportPlan = {
  entries: PsdImportPlanEntry[];
};

export type PreparedPsdImport = {
  token: string;
  source: PsdImportSource;
  parsedPsd: Psd;
  sourceNodeByKey: Map<string, PsdLayer>;
};

export type PreparedPsdImportStore = {
  register: (prepared: PreparedPsdImport) => void;
  get: (token: string) => PreparedPsdImport | undefined;
  discard: (tokens: readonly string[]) => void;
  clear: () => void;
  size: () => number;
};

export type PsdImportConfirmResult = {
  importedCount: number;
  failedFiles: string[];
};

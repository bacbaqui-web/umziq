import type {
  PreparedPsdImport,
  PreparedPsdImportStore,
} from "@/engines/project/models/psdImportPlanModel";

export function createPreparedPsdImportStore(): PreparedPsdImportStore {
  const entries = new Map<string, PreparedPsdImport>();
  return {
    register: (prepared) => entries.set(prepared.token, prepared),
    get: (token) => entries.get(token),
    discard: (tokens) => tokens.forEach((token) => entries.delete(token)),
    clear: () => entries.clear(),
    size: () => entries.size,
  };
}

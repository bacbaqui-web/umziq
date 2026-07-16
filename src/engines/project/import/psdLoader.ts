import { parsePsdToComposition, type ParsedPsdDocument } from "@/engines/project/import/psdCompositionBuilder";
import { parsePsdFile } from "@/engines/project/import/psdParser";

export type { ParsedPsdDocument } from "@/engines/project/import/psdCompositionBuilder";

export async function loadPsd(file: File, index = 0): Promise<ParsedPsdDocument> {
  const psd = await parsePsdFile(file);

  return parsePsdToComposition(psd, file.name, index);
}

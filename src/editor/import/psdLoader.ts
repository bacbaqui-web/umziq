import { parsePsdToComposition, type ParsedPsdDocument } from "@/editor/import/psdCompositionBuilder";
import { parsePsdFile } from "@/editor/import/psdParser";

export type { ParsedPsdDocument } from "@/editor/import/psdCompositionBuilder";

export async function loadPsd(file: File, index = 0): Promise<ParsedPsdDocument> {
  const psd = await parsePsdFile(file);

  return parsePsdToComposition(psd, file.name, index);
}

import { readPsd, type Psd } from "ag-psd";

export async function parsePsdFile(file: File): Promise<Psd> {
  const buffer = await file.arrayBuffer();

  return readPsd(buffer, {
    skipCompositeImageData: true,
    skipThumbnail: true,
  });
}

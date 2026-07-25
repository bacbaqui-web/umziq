import { readPsd, type Psd } from "ag-psd";

export function parsePsdArrayBuffer(buffer: ArrayBuffer): Psd {
  return readPsd(buffer, {
    skipCompositeImageData: true,
    skipThumbnail: true,
  });
}

export async function parsePsdFile(file: File): Promise<Psd> {
  const buffer = await file.arrayBuffer();
  return parsePsdArrayBuffer(buffer);
}

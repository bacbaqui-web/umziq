import type { ExportDestination, ExportDestinationPort } from "@/gateway/contracts/exportDestinationGateway";

type DirectoryHandle = { readonly name: string; getFileHandle(name: string, options: { create: true }): Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }> };
const directories = new Map<string, DirectoryHandle>();
let sequence = 0;

export function createWebExportDestinationGateway(): ExportDestinationPort {
  return {
    choose: async () => {
      const picker = (window as Window & { showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<DirectoryHandle> }).showDirectoryPicker;
      if (!picker) return { ok: false, code: "unsupported", message: "이 브라우저에서는 출력 폴더를 직접 선택할 수 없습니다." };
      try {
        const directory = await picker({ mode: "readwrite" });
        const value: ExportDestination = { destinationId: `web-export:${++sequence}`, name: directory.name };
        directories.set(value.destinationId, directory);
        return { ok: true, value };
      } catch (reason) {
        return reason instanceof DOMException && reason.name === "AbortError"
          ? { ok: false, code: "cancelled", message: "출력 폴더 선택을 취소했습니다." }
          : { ok: false, code: "write-failed", message: "출력 폴더를 선택할 수 없습니다." };
      }
    },
    write: async (destination, file) => {
      try {
        const blob = new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.mimeType });
        if (destination) {
          const directory = directories.get(destination.destinationId);
          if (!directory) return { ok: false, code: "write-failed", message: "출력 폴더 연결이 만료되었습니다." };
          const handle = await directory.getFileHandle(file.fileName, { create: true });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } else {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = file.fileName;
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
        }
        return { ok: true, value: undefined };
      } catch (reason) {
        return { ok: false, code: "write-failed", message: reason instanceof Error ? reason.message : "출력 파일을 저장하지 못했습니다." };
      }
    },
  };
}

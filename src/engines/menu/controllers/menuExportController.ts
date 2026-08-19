import type {
  MenuExportController,
  MenuExportControllerPorts,
} from "@/engines/menu/models/menuExportModel";

export function createMenuExportController(
  initialPorts: MenuExportControllerPorts
): MenuExportController {
  let ports = initialPorts;
  let state = {
    destination: null,
    progress: null,
    error: null,
    busy: false,
  } as ReturnType<MenuExportController["read"]>;
  let abort: AbortController | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    read: () => state,
    updatePorts: (next) => { if (!disposed) ports = next; },
    chooseDestination: async () => { if (disposed) return; const result = await ports.destination.choose(); if (disposed) return; if (result.ok) state = { ...state, destination: result.value, error: null }; else if (result.code !== "cancelled") state = { ...state, error: result.message }; publish(); },
    run: async (format) => {
      if (disposed || state.busy) return;
      abort = new AbortController(); state = { ...state, error: null, progress: { completedFrames: 0, totalFrames: 1 }, busy: true }; publish();
      try { await ports.runtime.run(format, state.destination, (next) => { if (disposed) return; state = { ...state, progress: next }; publish(); }, abort.signal); if (!disposed) { state = { ...state, busy: false }; ports.close(); } }
      catch (reason) { if (disposed) return; state = { ...state, progress: null, busy: false }; if (reason instanceof DOMException && reason.name === "AbortError") ports.close(); else state = { ...state, error: reason instanceof Error ? reason.message : "출력에 실패했습니다." }; publish(); }
      finally { abort = null; }
    },
    cancel: () => { if (abort) abort.abort(); else ports.close(); },
    isFormatSupported: (format) => ports.runtime.isFormatSupported(format),
    dispose: () => {
      disposed = true;
      abort?.abort();
      abort = null;
      listeners.clear();
    },
  };
}

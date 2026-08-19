import assert from "node:assert/strict";
import {
  createMenuExportController,
} from "@/engines/menu/controllers/menuExportController";
import type {
  MenuExportControllerPorts,
} from "@/engines/menu/models/menuExportModel";

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

{
  let finish: (() => void) | null = null;
  let firstClose = 0;
  let updatedClose = 0;
  let activeSignal: AbortSignal | null = null;
  const ports: MenuExportControllerPorts = {
    destination: {
      choose: async () => ({
        ok: true,
        value: { destinationId: "folder", name: "Output" },
      }),
      write: async () => ({ ok: true, value: undefined }),
    },
    runtime: {
      isFormatSupported: () => true,
      run: (_format, destination, onProgress, signal) => {
        assert.equal(destination?.destinationId, "folder");
        activeSignal = signal;
        onProgress({ completedFrames: 5, totalFrames: 10 });
        return new Promise<void>((resolve) => { finish = resolve; });
      },
    },
    close: () => { firstClose += 1; },
  };
  const controller = createMenuExportController(ports);
  await controller.chooseDestination();
  assert.equal(controller.read().destination?.name, "Output");
  const running = controller.run("mp4");
  assert.equal(controller.read().busy, true);
  assert.deepEqual(controller.read().progress, {
    completedFrames: 5,
    totalFrames: 10,
  });

  controller.updatePorts({
    ...ports,
    close: () => { updatedClose += 1; },
  });
  assert.equal(controller.read().busy, true, "dependency refresh preserves the active controller snapshot");
  assert.equal(activeSignal?.aborted, false);
  finish?.();
  await running;
  assert.equal(firstClose, 0);
  assert.equal(updatedClose, 1, "completion uses the current close port without replacing the controller");
  controller.dispose();
}

{
  let closeCount = 0;
  let observedSignal: AbortSignal | null = null;
  const controller = createMenuExportController({
    destination: {
      choose: async () => ({ ok: false, code: "cancelled", message: "cancel" }),
      write: async () => ({ ok: true, value: undefined }),
    },
    runtime: {
      isFormatSupported: (format) => format !== "webm-alpha",
      run: (_format, _destination, _progress, signal) => {
        observedSignal = signal;
        return new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("cancel", "AbortError")), { once: true });
        });
      },
    },
    close: () => { closeCount += 1; },
  });
  await controller.chooseDestination();
  assert.equal(controller.read().error, null, "picker cancellation is silent");
  assert.equal(controller.isFormatSupported("webm-alpha"), false);
  const running = controller.run("mp4");
  controller.cancel();
  assert.equal(observedSignal?.aborted, true);
  await running;
  assert.equal(closeCount, 1, "AbortError closes the dialog exactly once");
  assert.equal(controller.read().busy, false);
}

{
  const controller = createMenuExportController({
    destination: {
      choose: async () => ({ ok: false, code: "write-failed", message: "폴더 실패" }),
      write: async () => ({ ok: true, value: undefined }),
    },
    runtime: {
      isFormatSupported: () => true,
      run: async () => { throw new Error("출력 실패"); },
    },
    close: () => assert.fail("ordinary errors must keep the dialog open"),
  });
  await controller.chooseDestination();
  assert.equal(controller.read().error, "폴더 실패");
  await controller.run("gif");
  await flush();
  assert.equal(controller.read().busy, false);
  assert.equal(controller.read().progress, null);
  assert.equal(controller.read().error, "출력 실패");
}

{
  let closeCount = 0;
  let finish: (() => void) | null = null;
  const controller = createMenuExportController({
    destination: {
      choose: async () => ({ ok: false, code: "cancelled", message: "cancel" }),
      write: async () => ({ ok: true, value: undefined }),
    },
    runtime: {
      isFormatSupported: () => true,
      run: () => new Promise<void>((resolve) => { finish = resolve; }),
    },
    close: () => { closeCount += 1; },
  });
  const running = controller.run("webp");
  controller.dispose();
  finish?.();
  await running;
  assert.equal(closeCount, 0, "disposed controller ignores stale async completion");
}

console.log("Menu Export Controller verification passed");

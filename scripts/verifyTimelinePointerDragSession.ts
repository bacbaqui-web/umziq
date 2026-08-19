import assert from "node:assert/strict";
import {
  createTimelinePointerDragSessionController,
  type TimelinePointerDragEnvironment,
} from "@/engines/timeline";
import type {
  TimelinePointerCaptureTarget,
  TimelinePointerDragEventLike,
} from "@/engines/timeline/models/timelinePointerDragSessionModel";

class FakeEventTarget {
  private readonly listeners = new Map<
    string,
    Set<(event: TimelinePointerDragEventLike) => void>
  >();

  addEventListener(
    type: string,
    listener: (event: TimelinePointerDragEventLike) => void
  ) {
    const values = this.listeners.get(type) ?? new Set();
    values.add(listener);
    this.listeners.set(type, values);
  }

  removeEventListener(
    type: string,
    listener: (event: TimelinePointerDragEventLike) => void
  ) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(
    type: string,
    event: TimelinePointerDragEventLike = {}
  ) {
    for (const listener of [
      ...(this.listeners.get(type) ?? []),
    ]) {
      listener(event);
    }
  }

  count(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeCaptureTarget
  extends FakeEventTarget
  implements TimelinePointerCaptureTarget {
  private readonly captured = new Set<number>();
  readonly captureCalls: number[] = [];
  readonly releaseCalls: number[] = [];

  setPointerCapture(pointerId: number) {
    this.captureCalls.push(pointerId);
    this.captured.add(pointerId);
  }

  hasPointerCapture(pointerId: number) {
    return this.captured.has(pointerId);
  }

  releasePointerCapture(pointerId: number) {
    this.releaseCalls.push(pointerId);
    this.captured.delete(pointerId);
  }
}

type Session = {
  readonly type: "test";
  readonly value: number;
};

function createHarness() {
  const windowTarget = new FakeEventTarget();
  const documentTarget = new FakeEventTarget();
  const documentRootTarget = new FakeEventTarget();
  const captureTarget = new FakeCaptureTarget();
  let visibility: DocumentVisibilityState = "visible";
  const commits: Array<{
    value: number;
    reason: string;
    didMove: boolean;
  }> = [];
  const cancels: Array<{ value: number; reason: string }> = [];
  const environment: TimelinePointerDragEnvironment = {
    windowTarget,
    documentTarget,
    documentRootTarget,
    readVisibilityState: () => visibility,
  };
  const controller =
    createTimelinePointerDragSessionController<Session>({
      environment,
      move: (session, clientX) => ({
        ...session,
        value: clientX,
      }),
      commit: (session, reason, completion) => {
        commits.push({
          value: session.value,
          reason,
          didMove: completion.didMove,
        });
      },
      cancel: (session, reason) => {
        cancels.push({ value: session.value, reason });
      },
    });
  const begin = (
    value = 0,
    pointerId = 7
  ) => controller.begin(
    { type: "test", value },
    { pointerId, clientX: value, captureTarget }
  );
  const assertDetached = () => {
    assert.equal(windowTarget.count("pointermove"), 0);
    assert.equal(documentTarget.count("pointerup"), 0);
    assert.equal(documentTarget.count("pointercancel"), 0);
    assert.equal(windowTarget.count("blur"), 0);
    assert.equal(documentRootTarget.count("mouseleave"), 0);
    assert.equal(documentTarget.count("visibilitychange"), 0);
    assert.equal(captureTarget.count("lostpointercapture"), 0);
  };
  return {
    windowTarget,
    documentTarget,
    documentRootTarget,
    captureTarget,
    commits,
    cancels,
    controller,
    begin,
    setVisibility: (value: DocumentVisibilityState) => {
      visibility = value;
    },
    assertDetached,
  };
}

{
  const harness = createHarness();
  harness.begin();
  assert.deepEqual(harness.captureTarget.captureCalls, [7]);
  harness.windowTarget.dispatch("pointermove", {
    pointerId: 8,
    clientX: 11,
    buttons: 1,
  });
  harness.windowTarget.dispatch("pointermove", {
    pointerId: 7,
    clientX: 24,
    buttons: 1,
  });
  harness.documentTarget.dispatch("pointerup", {
    pointerId: 7,
  });
  assert.deepEqual(harness.commits, [
    {
      value: 24,
      reason: "pointer-up",
      didMove: true,
    },
  ]);
  assert.deepEqual(harness.cancels, []);
  assert.deepEqual(harness.captureTarget.releaseCalls, [7]);
  harness.assertDetached();
  harness.windowTarget.dispatch("pointermove", {
    pointerId: 7,
    clientX: 99,
    buttons: 1,
  });
  harness.documentTarget.dispatch("pointerup", {
    pointerId: 7,
  });
  assert.equal(harness.commits.length, 1,
    "outside pointer-up is terminal exactly once");
}

for (const scenario of [
  {
    reason: "buttons-zero",
    fire: (harness: ReturnType<typeof createHarness>) =>
      harness.windowTarget.dispatch("pointermove", {
        pointerId: 7,
        clientX: 20,
        buttons: 0,
      }),
  },
  {
    reason: "window-blur",
    fire: (harness: ReturnType<typeof createHarness>) =>
      harness.windowTarget.dispatch("blur"),
  },
  {
    reason: "document-leave",
    fire: (harness: ReturnType<typeof createHarness>) =>
      harness.documentRootTarget.dispatch("mouseleave"),
  },
  {
    reason: "visibility-hidden",
    fire: (harness: ReturnType<typeof createHarness>) => {
      harness.setVisibility("hidden");
      harness.documentTarget.dispatch("visibilitychange");
    },
  },
  {
    reason: "lost-pointer-capture",
    fire: (harness: ReturnType<typeof createHarness>) =>
      harness.captureTarget.dispatch("lostpointercapture", {
        pointerId: 7,
      }),
  },
] as const) {
  const harness = createHarness();
  harness.begin(3);
  scenario.fire(harness);
  assert.equal(harness.commits.length, 1, scenario.reason);
  assert.equal(harness.commits[0]?.reason, scenario.reason);
  assert.equal(harness.cancels.length, 0);
  harness.assertDetached();
}

{
  const harness = createHarness();
  harness.begin(12);
  harness.documentTarget.dispatch("pointerup", {
    pointerId: 7,
  });
  assert.equal(
    harness.commits[0]?.didMove,
    false,
    "pointer session reports a click when clientX never changes"
  );
}

{
  const harness = createHarness();
  harness.begin(1);
  harness.documentTarget.dispatch("pointercancel", {
    pointerId: 7,
  });
  assert.deepEqual(harness.commits, []);
  assert.deepEqual(harness.cancels, [
    { value: 1, reason: "pointer-cancel" },
  ]);
  harness.assertDetached();
}

{
  const harness = createHarness();
  harness.begin(1);
  harness.begin(2);
  assert.deepEqual(harness.cancels, [
    { value: 1, reason: "replaced" },
  ]);
  harness.controller.cancel();
  assert.equal(harness.cancels[1]?.reason, "explicit");
  harness.begin(3);
  harness.controller.dispose();
  assert.equal(harness.cancels[2]?.reason, "dispose");
  assert.equal(harness.commits.length, 0);
  harness.assertDetached();
}

{
  const harness = createHarness();
  harness.begin();
  harness.setVisibility("visible");
  harness.documentTarget.dispatch("visibilitychange");
  assert.equal(harness.commits.length, 0,
    "visible visibilitychange is not terminal");
  harness.controller.cancel();
}

console.log(
  "Timeline Pointer Drag Session verification passed"
);

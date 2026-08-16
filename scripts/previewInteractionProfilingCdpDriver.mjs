#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { SourceMap } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROFILING_ENVIRONMENT_FREEZE,
  PROFILING_FIXTURES,
  PROFILING_SCENARIOS,
} from "./previewInteractionProfilingManifest.ts";

export const CDP_DRIVER_METADATA = Object.freeze({
  id: "preview-interaction-profiling-cdp-driver",
  lane: "browser-performance-production",
  pilotScenarioId: "D-seed-flat-off-fast",
  defaultRuns: 3,
  rawArtifactPolicy: "temporary-directory-only",
  productInstrumentation: false,
  requiredMethods: [
    "Target.createTarget",
    "Target.attachToTarget",
    "Page.setInterceptFileChooserDialog",
    "DOM.setFileInputFiles",
    "Input.dispatchMouseEvent",
    "Tracing.start",
    "Tracing.end",
  ],
});

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function parseArguments(argv) {
  const options = {
    cdpHttp: "http://127.0.0.1:9224",
    productionUrl: PROFILING_ENVIRONMENT_FREEZE.productionUrl,
    fixtureId: "flat",
    runs: CDP_DRIVER_METADATA.defaultRuns,
    traceDirectory: null,
    keepPage: false,
    matrix: false,
    scenarioId: null,
    resultFile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--keep-page") {
      options.keepPage = true;
      continue;
    }
    if (argument === "--matrix") {
      options.matrix = true;
      continue;
    }
    if (argument === "--matrix-2b") {
      options.matrix = "2b";
      continue;
    }
    if (argument === "--matrix-hf") {
      options.matrix = "hf";
      continue;
    }
    if (argument === "--cpu-profile") {
      options.matrix = "cpu";
      continue;
    }
    if (argument === "--matrix-wh") {
      options.matrix = "wh";
      continue;
    }
    if (argument === "--cpu-profile-wh") {
      options.matrix = "cpu-wh";
      continue;
    }
    if (argument === "--wh-residual-attribution") {
      options.matrix = "wh-residual";
      continue;
    }
    if (argument === "--candidate1-after-position") {
      options.matrix = "candidate1-after-hf";
      continue;
    }
    if (argument === "--candidate1-after-wh") {
      options.matrix = "candidate1-after-wh";
      continue;
    }
    if (argument === "--candidate1-after-cpu-position") {
      options.matrix = "candidate1-after-cpu";
      continue;
    }
    if (argument === "--candidate1-after-cpu-wh") {
      options.matrix = "candidate1-after-cpu-wh";
      continue;
    }
    if (argument === "--candidate2-after-position") {
      options.matrix = "candidate2-after-hf";
      continue;
    }
    if (argument === "--candidate2-after-wh") {
      options.matrix = "candidate2-after-wh";
      continue;
    }
    if (argument === "--candidate2-after-raster") {
      options.matrix = "candidate2-after-wh-residual";
      continue;
    }
    const [name, inlineValue] = argument.split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined && value !== undefined) index += 1;
    if (name === "--cdp") options.cdpHttp = value;
    else if (name === "--url") options.productionUrl = value;
    else if (name === "--fixture") options.fixtureId = value;
    else if (name === "--runs") options.runs = Number(value);
    else if (name === "--trace-dir") options.traceDirectory = resolve(value);
    else if (name === "--scenario") options.scenarioId = value;
    else if (name === "--result-file") options.resultFile = resolve(value);
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 10) {
    throw new Error("--runs must be an integer between 1 and 10");
  }
  if (options.fixtureId !== "flat") {
    throw new Error("Task 1C pilot currently accepts only the manifest flat fixture");
  }
  return options;
}

async function readProductionAssetIdentity() {
  const assetDirectory = resolve(projectRoot, "dist", "assets");
  const assetFiles = (await readdir(assetDirectory))
    .filter((file) => file.endsWith(".js") && !file.endsWith(".js.map"));
  if (assetFiles.length !== 1) {
    throw new Error(`Expected one production JavaScript asset, found ${assetFiles.length}`);
  }
  const file = assetFiles[0];
  const bytes = await readFile(join(assetDirectory, file));
  const sourceMapFile = `${file}.map`;
  const sourceMapPresent = (await readdir(assetDirectory)).includes(sourceMapFile);
  const identity = {
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sourceMap: sourceMapPresent,
  };
  if (!sourceMapPresent) return identity;
  const sourceMapBytes = await readFile(join(assetDirectory, sourceMapFile));
  return {
    ...identity,
    sourceMapFile,
    sourceMapSha256: createHash("sha256").update(sourceMapBytes).digest("hex"),
  };
}

class CdpClient {
  constructor(webSocket) {
    this.webSocket = webSocket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    webSocket.addEventListener("message", (event) => this.handleMessage(event));
    webSocket.addEventListener("close", () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error("CDP WebSocket closed"));
      }
      this.pending.clear();
    });
  }

  static async connect(url, timeoutMs = 10_000) {
    const webSocket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      const timeout = setTimeout(
        () => rejectOpen(new Error(`CDP WebSocket open timeout after ${timeoutMs} ms`)),
        timeoutMs
      );
      webSocket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolveOpen();
      }, { once: true });
      webSocket.addEventListener("error", () => {
        clearTimeout(timeout);
        rejectOpen(new Error(`CDP WebSocket failed: ${url}`));
      }, { once: true });
    });
    return new CdpClient(webSocket);
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) {
        request.reject(
          new Error(`${request.method}: ${message.error.code} ${message.error.message}`)
        );
      } else {
        request.resolve(message.result ?? {});
      }
      return;
    }
    const callbacks = this.listeners.get(message.method) ?? [];
    for (const callback of callbacks) callback(message);
  }

  send(method, params = {}, sessionId, timeoutMs = 15_000) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolveResult, rejectResult) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectResult(new Error(`${method}: timeout after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, { method, resolve: resolveResult, reject: rejectResult, timeout });
      this.webSocket.send(JSON.stringify(payload));
    });
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) ?? [];
    callbacks.push(callback);
    this.listeners.set(method, callbacks);
    return () => {
      const current = this.listeners.get(method) ?? [];
      this.listeners.set(method, current.filter((item) => item !== callback));
    };
  }

  waitForEvent(method, { sessionId, predicate = () => true, timeoutMs = 15_000 } = {}) {
    return new Promise((resolveEvent, rejectEvent) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        rejectEvent(new Error(`${method}: event timeout after ${timeoutMs} ms`));
      }, timeoutMs);
      const unsubscribe = this.on(method, (message) => {
        if (sessionId !== undefined && message.sessionId !== sessionId) return;
        if (!predicate(message.params ?? {})) return;
        clearTimeout(timeout);
        unsubscribe();
        resolveEvent(message.params ?? {});
      });
    });
  }

  close() {
    this.webSocket.close();
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url}: ${response.status}`);
  return response.json();
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function evaluate(client, sessionId, expression, options = {}) {
  const result = await client.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: options.userGesture ?? false,
    },
    sessionId,
    options.timeoutMs ?? 15_000
  );
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description
      ?? result.exceptionDetails.text;
    throw new Error(`Runtime.evaluate: ${description}`);
  }
  return result.result?.value;
}

async function waitForCondition(client, sessionId, expression, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, sessionId, expression)) return;
    await delay(100);
  }
  throw new Error(`${label}: condition timeout after ${timeoutMs} ms`);
}

async function createProductionPage(client, productionUrl) {
  const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
  process.stderr.write(`[page] created ${targetId}\n`);
  const frozen = PROFILING_ENVIRONMENT_FREEZE.frozenValues;
  const { windowId } = await client.send("Browser.getWindowForTarget", { targetId });
  await client.send("Browser.setWindowBounds", {
    windowId,
    bounds: {
      width: frozen.windowOuterCss.width,
      height: frozen.windowOuterCss.height,
      windowState: "normal",
    },
  });
  const { sessionId } = await client.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await Promise.all([
    client.send("Page.enable", {}, sessionId),
    client.send("DOM.enable", {}, sessionId),
    client.send("Runtime.enable", {}, sessionId),
    client.send("Emulation.setDeviceMetricsOverride", {
      width: frozen.windowInnerCss.width,
      height: frozen.windowInnerCss.height,
      deviceScaleFactor: frozen.devicePixelRatio,
      mobile: false,
    }, sessionId),
  ]);
  const loaded = client.waitForEvent("Page.loadEventFired", { sessionId });
  const navigation = await client.send("Page.navigate", { url: productionUrl }, sessionId);
  await loaded;
  await waitForCondition(
    client,
    sessionId,
    `document.readyState === "complete" && [...document.querySelectorAll("button")].some((button) => button.textContent.includes("PSD 불러오기"))`,
    "production root ready"
  );
  return { targetId, sessionId, frameId: navigation.frameId };
}

async function importFixture(client, sessionId, fixturePath, fixture = PROFILING_FIXTURES.flat) {
  await client.send(
    "Page.setInterceptFileChooserDialog",
    { enabled: true, cancel: false },
    sessionId
  );
  const chooserOpened = client.waitForEvent("Page.fileChooserOpened", {
    sessionId,
    timeoutMs: 10_000,
  });
  const clicked = await evaluate(
    client,
    sessionId,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.includes("PSD 불러오기"));
      if (!button) return false;
      button.click();
      return true;
    })()`,
    { userGesture: true }
  );
  if (!clicked) throw new Error("Product PSD picker button was not found");

  const chooser = await chooserOpened;
  let fileInputTarget = chooser.backendNodeId
    ? { backendNodeId: chooser.backendNodeId }
    : null;
  if (!fileInputTarget) {
    const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
    const { nodeId } = await client.send(
      "DOM.querySelector",
      { nodeId: root.nodeId, selector: 'input[type="file"]' },
      sessionId
    );
    if (!nodeId) {
      throw new Error(
        `Page.fileChooserOpened omitted backendNodeId and DOM.querySelector found no file input; event=${JSON.stringify(chooser)}`
      );
    }
    fileInputTarget = { nodeId };
  }
  await client.send(
    "DOM.setFileInputFiles",
    { files: [fixturePath], ...fileInputTarget },
    sessionId
  );
  process.stderr.write(`[import] ${fixture.id}: file assigned\n`);
  // DOM.setFileInputFiles dispatches the input/change sequence. Dispatching a
  // second synthetic change races two PSD analyses for the larger fixtures.
  await waitForCondition(
    client,
    sessionId,
    `document.body.innerText.includes("PSD 미리보기") && [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "불러오기" && !button.disabled)`,
    "product Import Preview"
  );
  process.stderr.write(`[import] ${fixture.id}: preview ready\n`);
  const confirmed = await evaluate(
    client,
    sessionId,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === "불러오기");
      if (!button) return false;
      button.click();
      return true;
    })()`,
    { userGesture: true }
  );
  if (!confirmed) throw new Error("Product Import Preview confirm button was not found");
  process.stderr.write(`[import] ${fixture.id}: confirmed\n`);
  await waitForCondition(
    client,
    sessionId,
    `(() => {
      const importDialog = document.querySelector('[aria-label="PSD Import Preview"]');
      const sourceCard = [...document.querySelectorAll("button")]
        .some((button) => button.textContent.trim() === ${JSON.stringify(`PSD${fixture.file}PSD`)});
      const currentGroup = document.querySelector(
        '[aria-label="현재 그룹 위치"] button[aria-current="page"]'
      );
      const targetRow = [...document.querySelectorAll(
        '[data-layer-document-id][draggable="true"]'
      )].some((row) => row.textContent.trim() === ${JSON.stringify(fixture.target.name)});
      return !importDialog
        && sourceCard
        && currentGroup?.title === ${JSON.stringify(fixture.import.compositionName)}
        && targetRow;
    })()`,
    `${fixture.id} fixture import completion`,
    fixture.id === "flat" ? 30_000 : 120_000
  );
  process.stderr.write(`[import] ${fixture.id}: project ready\n`);
  return {
    mode: chooser.mode,
    backendNodeIdProvided: Boolean(chooser.backendNodeId),
    fileInputTarget: Object.keys(fileInputTarget)[0],
  };
}

async function enterImportedCompositionTarget(client, sessionId, fixture) {
  process.stderr.write(`[composition] ${fixture.id}: resolving imported group\n`);
  const before = await evaluate(
    client,
    sessionId,
    `(() => {
      const current = document.querySelector(
        '[aria-label="현재 그룹 위치"] button[aria-current="page"]'
      );
      if (current?.title === ${JSON.stringify(fixture.import.compositionName)}) {
        return {
          ok: true,
          alreadyCurrent: true,
          breadcrumb: {
            title: current.title,
            text: current.textContent.trim(),
            disabled: current.disabled,
          },
        };
      }
      const trigger = [...document.querySelectorAll(
        '[aria-label="현재 그룹 위치"] button'
      )].find((button) =>
        button.title === ${JSON.stringify(fixture.import.compositionName)}
        || button.getAttribute("aria-current") === "page"
      );
      if (!trigger) return { ok: false, reason: "timeline-breadcrumb-missing" };
      const evidence = {
        title: trigger.title,
        text: trigger.textContent.trim(),
        disabled: trigger.disabled,
      };
      trigger.click();
      return { ok: true, alreadyCurrent: false, breadcrumb: evidence };
    })()`,
    { userGesture: true }
  );
  if (!before?.ok) throw new Error(`Composition breadcrumb open failed: ${before?.reason}`);
  let selected = {
    ok: true,
    entry: {
      title: fixture.import.compositionName,
      text: fixture.import.compositionName,
      disabled: false,
      navigation: "already-current",
    },
  };
  if (!before.alreadyCurrent) {
    await waitForCondition(
      client,
      sessionId,
      `(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="그룹 전환"]');
        const entries = [...(dialog?.querySelectorAll("button") ?? [])];
        return entries.some((button) =>
          button.title === ${JSON.stringify(fixture.import.compositionName)}
          && !button.disabled
        );
      })()`,
      "Composition switcher entry"
    );
    process.stderr.write(`[composition] ${fixture.id}: switcher ready\n`);
    selected = await evaluate(
      client,
      sessionId,
      `(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="그룹 전환"]');
        const button = [...(dialog?.querySelectorAll("button") ?? [])]
          .find((candidate) =>
            candidate.title === ${JSON.stringify(fixture.import.compositionName)}
            && !candidate.disabled
          );
        if (!button) return { ok: false, reason: "enabled-switcher-child-missing" };
        const evidence = {
          title: button.title,
          text: button.textContent.trim(),
          disabled: button.disabled,
          navigation: "switcher",
        };
        button.click();
        return { ok: true, entry: evidence };
      })()`,
      { userGesture: true }
    );
    if (!selected?.ok) throw new Error(`Composition switcher selection failed: ${JSON.stringify(selected)}`);
  }
  await waitForCondition(
    client,
    sessionId,
    `(() => {
      const current = document.querySelector(
        '[aria-label="현재 그룹 위치"] button[aria-current="page"]'
      );
      return current?.title === ${JSON.stringify(fixture.import.compositionName)}
        && [...document.querySelectorAll(
          '[data-layer-document-id][draggable="true"]'
        )].some((row) =>
          row.textContent.trim() === ${JSON.stringify(fixture.target.name)}
        );
    })()`,
    "Imported composition Timeline"
  );
  process.stderr.write(`[composition] ${fixture.id}: timeline ready\n`);
  return {
    ...before,
    ...selected,
    compositionBreadcrumb: fixture.import.compositionName,
    expectedBreadcrumb: fixture.import.compositionName,
  };
}

async function selectTimelineTarget(client, sessionId, fixture) {
  const selected = await evaluate(client, sessionId, `(() => {
    const rows = [...document.querySelectorAll('div[draggable="true"]')];
    const row = rows.find((candidate) => candidate.textContent.trim() === ${JSON.stringify(fixture.target.name)});
    if (!row) return { ok: false, reason: "timeline-target-row-missing", rowCount: rows.length };
    row.click();
    return { ok: true, name: ${JSON.stringify(fixture.target.name)}, kind: ${JSON.stringify(fixture.target.kind)} };
  })()`, { userGesture: true });
  if (!selected?.ok) throw new Error(`Timeline target selection failed: ${JSON.stringify(selected)}`);
  const expectedBreadcrumb = fixture.import.compositionName;
  const expectedSelectionLabel = fixture.target.name;
  await waitForCondition(client, sessionId, `(() => {
    const breadcrumb = document.querySelector(
      '[aria-label="현재 그룹 위치"] button[aria-current="page"]'
    );
    const selectionLabel = [...document.querySelectorAll(
      '[aria-label="현재 그룹 위치"] span[title]'
    )].find((element) => element.title === ${JSON.stringify(expectedSelectionLabel)});
    const timelineRow = document.querySelector(
      '[data-timeline-selected="true"][data-layer-document-id]'
    );
    const canvas = document.querySelector(
      'canvas[data-selected-layer-document-id]'
    );
    return Boolean(
      breadcrumb?.title === ${JSON.stringify(expectedBreadcrumb)}
      && selectionLabel
      && timelineRow
      && canvas
      && timelineRow.getAttribute("data-layer-document-id")
        === canvas.getAttribute("data-selected-layer-document-id")
      && document.querySelectorAll('button[aria-label="위치 이동"]').length === 1
    );
  })()`, "exact Timeline target selection");
  return {
    ...selected,
    expectedBreadcrumb,
    expectedSelectionLabel,
  };
}

async function applyPilotSetup(client, sessionId, fixture, _rendererPath = "preview", glowMode = "off") {
  const setupResult = await evaluate(
    client,
    sessionId,
    `(() => {
      const select = document.querySelector("#preview-quality");
      if (!(select instanceof HTMLSelectElement)) return { ok: false, reason: "quality-select-missing" };
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      valueSetter.call(select, "medium");
      select.dispatchEvent(new Event("change", { bubbles: true }));

      const glow = [...document.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === "선택 강조");
      const desiredGlow = ${JSON.stringify(glowMode)} === "on";
      if ((glow?.getAttribute("aria-pressed") === "true") !== desiredGlow) glow?.click();

      const oneToOne = [...document.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === "100%");
      oneToOne?.click();
      return { ok: Boolean(oneToOne) };
    })()`
  );
  if (!setupResult?.ok) throw new Error(`Pilot setup failed: ${setupResult?.reason ?? "controls"}`);
  await waitForCondition(
    client,
    sessionId,
    `(() => {
      const canvas = document.querySelector("canvas");
      const rect = canvas?.getBoundingClientRect();
      return Boolean(rect
        && Math.abs(rect.width - ${JSON.stringify(fixture.documentSize.width)}) < 0.1
        && Math.abs(rect.height - ${JSON.stringify(fixture.documentSize.height)}) < 0.1);
    })()`,
    "one-to-one Preview zoom"
  );
  if (fixture.viewport.previewZoom !== 1) {
    const viewportCenter = await evaluate(client, sessionId, `(() => {
      const rect = document.querySelector("canvas")?.parentElement?.parentElement?.getBoundingClientRect();
      return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
    })()`);
    if (!viewportCenter) throw new Error("Preview viewport geometry unavailable for 20% zoom");
    const deltaY = -Math.log(fixture.viewport.previewZoom) / 0.00075;
    await client.send("Input.dispatchMouseEvent", { type: "mouseWheel", ...viewportCenter, deltaX: 0, deltaY }, sessionId);
    await waitForCondition(client, sessionId, `(() => {
      const rect = document.querySelector("canvas")?.getBoundingClientRect();
      return Boolean(rect
        && Math.abs(rect.width - ${JSON.stringify(fixture.documentSize.width * fixture.viewport.previewZoom)}) < 0.2
        && Math.abs(rect.height - ${JSON.stringify(fixture.documentSize.height * fixture.viewport.previewZoom)}) < 0.2);
    })()`, "manifest Preview zoom");
  }
  const centered = await evaluate(
    client,
    sessionId,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === "리셋");
      button?.click();
      return Boolean(button);
    })()`
  );
  if (!centered) throw new Error("Preview center button was not found");
  await waitForCondition(
    client,
    sessionId,
    `document.querySelector("#preview-quality")?.value === "medium" && [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "선택 강조")?.getAttribute("aria-pressed") === ${JSON.stringify(glowMode === "on" ? "true" : "false")} && !document.body.innerText.includes("생성 중...")`,
    "medium Preview setup",
    30_000
  );
  await waitForCondition(
    client,
    sessionId,
    `(() => {
      const viewport = document.querySelector("canvas")?.parentElement?.parentElement?.getBoundingClientRect();
      const handle = document.querySelector('button[aria-label="위치 이동"]')?.getBoundingClientRect();
      return Boolean(viewport && handle
        && handle.x >= viewport.x && handle.y >= viewport.y
        && handle.right <= viewport.right && handle.bottom <= viewport.bottom);
    })()`,
    "centered Position ring in Preview viewport"
  );
  await delay(2_000);
}

async function readPilotState(client, sessionId, fixture) {
  return evaluate(
    client,
    sessionId,
    `(() => {
      const canvas = document.querySelector("canvas");
      const canvasRect = canvas?.getBoundingClientRect();
      const viewportRect = canvas?.parentElement?.parentElement?.getBoundingClientRect();
      const handle = document.querySelector('button[aria-label="위치 이동"]');
      const handleRect = handle?.getBoundingClientRect();
      const whScaleHandle = document.querySelector('button[aria-label="WH (비율/전체 크기)"]');
      const whScaleHandleRect = whScaleHandle?.getBoundingClientRect();
      const whScaleReadoutText = [...document.querySelectorAll("div")]
        .map((element) => element.textContent.trim())
        .find((text) => text.startsWith("X ") && text.includes("% / Y ") && text.endsWith("%")) ?? null;
      const positionReadoutText = [...document.querySelectorAll("div")]
        .map((element) => element.textContent.trim())
        .find((text) => text.startsWith("ΔX ") && text.includes(" / ΔY ")) ?? null;
      const fields = [...document.querySelectorAll("input")].map((input) => ({
        ariaLabel: input.getAttribute("aria-label"),
        name: input.getAttribute("name"),
        type: input.getAttribute("type"),
        value: input.value,
        checked: input.checked,
        title: input.title,
        parentText: input.parentElement?.innerText ?? "",
      }));
      const readRow = (label) => {
        const row = [...document.querySelectorAll("div")]
          .filter((element) => [...element.children].some((child) => child.tagName === "SPAN" && child.textContent.trim() === label))
          .sort((left, right) => left.querySelectorAll("div").length - right.querySelectorAll("div").length)[0];
        return row ? [...row.querySelectorAll('input[type="text"]')].map((input) => Number(input.value)) : [];
      };
      const anchorFields = readRow("기준");
      const positionFields = readRow("위치");
      const scaleFields = readRow("크기");
      const rotationFields = readRow("회전");
      const opacityFields = readRow("투명");
      const breadcrumb = document.querySelector(
        '[aria-label="현재 그룹 위치"] button[aria-current="page"]'
      );
      const selectionLabel = [...document.querySelectorAll(
        '[aria-label="현재 그룹 위치"] span[title]'
      )].find((element) =>
        element.title === ${JSON.stringify(fixture.target.name)}
      );
      const selectedTimelineRow = document.querySelector(
        '[data-timeline-selected="true"][data-layer-document-id]'
      );
      const buttons = [...document.querySelectorAll("button")]
        .map((button) => ({ text: button.textContent.trim(), ariaLabel: button.getAttribute("aria-label") }))
        .filter((button) => button.text || button.ariaLabel);
      const rectValue = (rect) => rect ? ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }) : null;
      return {
        url: location.href,
        title: document.title,
        viewport: {
          innerWidth,
          innerHeight,
          outerWidth,
          outerHeight,
          devicePixelRatio,
          canvasDomRect: rectValue(canvasRect),
          previewDomRect: rectValue(viewportRect),
        },
        fixtureCardPresent: buttons.some((button) => button.text === ${JSON.stringify(`PSD${fixture.file}PSD`)}),
        fixtureCardCount: buttons.filter((button) => button.text === ${JSON.stringify(`PSD${fixture.file}PSD`)}).length,
        target: {
          expectedName: ${JSON.stringify(fixture.target.name)},
          expectedLayerDocumentIdPrefix: ${JSON.stringify(fixture.target.identity.layerDocumentIdPrefix)},
          expectedSourceIdPrefix: ${JSON.stringify(fixture.target.identity.sourceIdPrefix)},
          observedLayerDocumentId:
            canvas?.getAttribute("data-selected-layer-document-id") ?? null,
          observedTimelineLayerDocumentId:
            selectedTimelineRow?.getAttribute("data-layer-document-id") ?? null,
          observedSourceId:
            canvas?.getAttribute("data-selected-source-id") ?? null,
          positionHandleRect: rectValue(handleRect),
          positionHandleCount: document.querySelectorAll('button[aria-label="위치 이동"]').length,
          whScaleHandleRect: rectValue(whScaleHandleRect),
          whScaleHandleCount: document.querySelectorAll('button[aria-label="WH (비율/전체 크기)"]').length,
          whScaleHandleTitle: whScaleHandle?.title ?? null,
          whScaleReadoutText,
          positionReadoutText,
          positionFields: positionFields.length >= 2
            ? { x: positionFields[0], y: positionFields[1] }
            : null,
          transformFields: {
            anchor: anchorFields.length >= 2 ? { x: anchorFields[0], y: anchorFields[1] } : null,
            position: positionFields.length >= 2 ? { x: positionFields[0], y: positionFields[1] } : null,
            scale: scaleFields.length >= 2 ? { x: scaleFields[0], y: scaleFields[1] } : null,
            rotation: rotationFields[0] ?? null,
            opacity: opacityFields[0] ?? null,
          },
          breadcrumb: breadcrumb ? { title: breadcrumb.title, text: breadcrumb.textContent.trim() } : null,
          selectionLabel: selectionLabel?.title ?? null,
          layerDocumentIdentityExposedInDom:
            Boolean(selectedTimelineRow?.getAttribute("data-layer-document-id")),
          sourceIdentityExposedInDom:
            Boolean(canvas?.getAttribute("data-selected-source-id")),
          fields,
          relevantButtons: buttons.filter((button) => button.text.includes("drag_test") || button.ariaLabel === "위치 이동"),
        },
        setup: {
          quality: document.querySelector("#preview-quality")?.value ?? null,
          rendererPath: "preview",
          glow: [...document.querySelectorAll("button")]
            .find((button) => button.textContent.trim() === "선택 강조")?.getAttribute("aria-pressed") ?? null,
          zoomText: [...document.querySelectorAll("div")]
            .map((element) => element.textContent.trim())
            .find((text) => text === ${JSON.stringify(`${Math.round(fixture.viewport.previewZoom * 100)}%`)}) ?? null,
        },
      };
    })()`
  );
}

function validateLivePositionDraft(initialState, draftState) {
  const initialPosition = initialState.target.transformFields.position;
  const draftPosition = draftState.target.transformFields.position;
  const initialRect = initialState.target.positionHandleRect;
  const draftRect = draftState.target.positionHandleRect;
  const invalidReasons = [];
  if (!initialPosition || !draftPosition || !initialRect || !draftRect) {
    invalidReasons.push("Position live Draft fields or Gizmo rect unavailable");
    return { valid: false, invalidReasons };
  }
  const propertyDelta = {
    x: draftPosition.x - initialPosition.x,
    y: draftPosition.y - initialPosition.y,
  };
  const gizmoDelta = {
    x: draftRect.x - initialRect.x,
    y: draftRect.y - initialRect.y,
  };
  const expectedReadout = `ΔX ${propertyDelta.x >= 0 ? "+" : ""}${Math.round(propertyDelta.x)} / ΔY ${propertyDelta.y >= 0 ? "+" : ""}${Math.round(propertyDelta.y)}`;
  if (Math.abs(propertyDelta.x) < 0.001 && Math.abs(propertyDelta.y) < 0.001) {
    invalidReasons.push(`Position Properties did not update during PointerMove: ${JSON.stringify(propertyDelta)}`);
  }
  if (Math.abs(gizmoDelta.x) < 0.5 && Math.abs(gizmoDelta.y) < 0.5) {
    invalidReasons.push(`Position Gizmo/layer did not update during PointerMove: ${JSON.stringify(gizmoDelta)}`);
  }
  if (Math.sign(propertyDelta.x) !== Math.sign(gizmoDelta.x)
    || Math.sign(propertyDelta.y) !== Math.sign(gizmoDelta.y)) {
    invalidReasons.push(`Position Properties and Gizmo direction differ: properties=${JSON.stringify(propertyDelta)} gizmo=${JSON.stringify(gizmoDelta)}`);
  }
  if (draftState.target.positionReadoutText !== expectedReadout) {
    invalidReasons.push(`Position live readout mismatch: expected=${expectedReadout} actual=${draftState.target.positionReadoutText}`);
  }
  return {
    valid: invalidReasons.length === 0,
    invalidReasons,
    initialPosition,
    draftPosition,
    propertyDelta,
    initialHandleRect: initialRect,
    draftHandleRect: draftRect,
    gizmoDelta,
    expectedReadout,
    actualReadout: draftState.target.positionReadoutText,
    propertiesGizmoLayerSynchronized: invalidReasons.length === 0,
  };
}

async function findVerifiedPositionRingPoint(client, sessionId) {
  const result = await evaluate(
    client,
    sessionId,
    `(() => {
      const button = document.querySelector('button[aria-label="위치 이동"]');
      if (!(button instanceof HTMLButtonElement)) return { ok: false, reason: "position-button-missing" };
      const rect = button.getBoundingClientRect();
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const preferredOffsets = [
        [16, 0], [17, 0], [15, 0], [18, 0],
        [-16, 0], [0, 16], [0, -16],
        [12, 12], [12, -12], [-12, 12], [-12, -12],
      ];
      const searchedOffsets = [];
      for (let dy = -19; dy <= 19; dy += 2) {
        for (let dx = -19; dx <= 19; dx += 2) {
          const radius = Math.hypot(dx, dy);
          if (radius >= 7 && radius <= 19) searchedOffsets.push([dx, dy]);
        }
      }
      const offsets = [...preferredOffsets, ...searchedOffsets];
      const candidates = offsets.map(([dx, dy]) => {
        const x = center.x + dx;
        const y = center.y + dy;
        const hit = document.elementFromPoint(x, y);
        const matchesPositionButton = hit === button || (hit instanceof Element && button.contains(hit));
        return {
          x, y, dx, dy, matchesPositionButton,
          hit: hit ? {
            tagName: hit.tagName,
            ariaLabel: hit.getAttribute("aria-label"),
            title: hit.getAttribute("title"),
            className: typeof hit.className === "string" ? hit.className : null,
            pointerEvents: getComputedStyle(hit).pointerEvents,
            cursorKind: getComputedStyle(hit).cursor === "grabbing"
              ? "grabbing"
              : getComputedStyle(hit).cursor.startsWith("url(") ? "custom-cursor" : getComputedStyle(hit).cursor,
          } : null,
        };
      });
      const selected = candidates.find((candidate) => candidate.matchesPositionButton);
      const describeElement = (element) => {
        const elementRect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tagName: element.tagName,
          ariaLabel: element.getAttribute("aria-label"),
          text: element.textContent.trim().slice(0, 80),
          rect: { x: elementRect.x, y: elementRect.y, width: elementRect.width, height: elementRect.height },
          overflow: style.overflow,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          pointerEvents: style.pointerEvents,
          zIndex: style.zIndex,
          scrollTop: element.scrollTop,
          scrollLeft: element.scrollLeft,
        };
      };
      return {
        ok: Boolean(selected),
        reason: selected ? null : "no-ring-perimeter-candidate-hit-position-button",
        buttonRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        centerHit: (() => {
          const hit = document.elementFromPoint(center.x, center.y);
          return hit ? { tagName: hit.tagName, ariaLabel: hit.getAttribute("aria-label"), title: hit.getAttribute("title") } : null;
        })(),
        selected,
        candidates: candidates.slice(0, 11),
        buttonAncestors: [button, ...[...document.querySelectorAll("*")].filter((element) => element.contains(button))]
          .slice(-8)
          .map(describeElement),
        centerHitElement: (() => {
          const hit = document.elementFromPoint(center.x, center.y);
          return hit ? describeElement(hit) : null;
        })(),
        cursorBeforePressKind: getComputedStyle(button).cursor.startsWith("url(")
          ? "custom-cursor"
          : getComputedStyle(button).cursor,
      };
    })()`
  );
  if (!result?.ok || !result.selected) {
    throw new Error(`Position ring hit-test failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function readPositionDragActiveEvidence(client, sessionId, point) {
  return evaluate(
    client,
    sessionId,
    `(() => {
      const button = document.querySelector('button[aria-label="위치 이동"]');
      const hit = document.elementFromPoint(${JSON.stringify(point.x)}, ${JSON.stringify(point.y)});
      return {
        buttonPresent: button instanceof HTMLButtonElement,
        computedCursorKind: button
          ? (getComputedStyle(button).cursor.startsWith("url(") ? "custom-cursor" : getComputedStyle(button).cursor)
          : null,
        inlineCursorKind: button instanceof HTMLElement
          ? (button.style.cursor.startsWith("url(") ? "custom-cursor" : button.style.cursor)
          : null,
        perimeterHitIsPositionButton: Boolean(button && (hit === button || (hit instanceof Element && button.contains(hit)))),
        activeElement: document.activeElement ? {
          tagName: document.activeElement.tagName,
          ariaLabel: document.activeElement.getAttribute("aria-label"),
        } : null,
      };
    })()`
  );
}

async function waitForTwoAnimationFrames(client, sessionId) {
  await evaluate(
    client,
    sessionId,
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))`,
    { timeoutMs: 5_000 }
  );
}

function compareFrozenViewport(actual) {
  const frozen = PROFILING_ENVIRONMENT_FREEZE.frozenValues;
  if (!frozen) return { matches: false, differences: ["manifest frozenValues is null"] };
  const differences = [];
  const comparisons = [
    ["innerWidth", actual.innerWidth, frozen.windowInnerCss.width],
    ["innerHeight", actual.innerHeight, frozen.windowInnerCss.height],
    ["outerWidth", actual.outerWidth, frozen.windowOuterCss.width],
    ["outerHeight", actual.outerHeight, frozen.windowOuterCss.height],
    ["devicePixelRatio", actual.devicePixelRatio, frozen.devicePixelRatio],
    ["preview.x", actual.previewDomRect?.x, frozen.previewViewportDomRectCss.x],
    ["preview.y", actual.previewDomRect?.y, frozen.previewViewportDomRectCss.y],
    ["preview.width", actual.previewDomRect?.width, frozen.previewViewportDomRectCss.width],
    ["preview.height", actual.previewDomRect?.height, frozen.previewViewportDomRectCss.height],
  ];
  for (const [field, observed, expected] of comparisons) {
    if (observed !== expected) differences.push(`${field}: observed=${observed} frozen=${expected}`);
  }
  return { matches: differences.length === 0, differences };
}

function summarizeTrace(traceEvents, targetFrameId) {
  const targetRendererProcessIds = new Set(traceEvents
    .filter((event) => event.args?.data?.frame === targetFrameId)
    .map((event) => event.pid));
  const rendererMainThreads = new Set();
  for (const event of traceEvents) {
    if (event.ph === "M"
      && event.name === "thread_name"
      && event.args?.name === "CrRendererMain"
      && targetRendererProcessIds.has(event.pid)) {
      rendererMainThreads.add(`${event.pid}:${event.tid}`);
    }
  }
  const isMainThread = (event) => rendererMainThreads.has(`${event.pid}:${event.tid}`);
  const isTargetProcess = (event) => targetRendererProcessIds.has(event.pid);
  const durationFor = (names) => traceEvents
    .filter((event) => isMainThread(event) && event.ph === "X" && names.has(event.name))
    .reduce((total, event) => total + (event.dur ?? 0), 0) / 1_000;
  const completeEventTimestamps = traceEvents
    .filter((event) => isTargetProcess(event) && event.ph === "X")
    .map((event) => event.ts)
    .filter((timestamp) => Number.isFinite(timestamp));
  const eventDispatchTypes = traceEvents
    .filter((event) => isMainThread(event) && event.name === "EventDispatch")
    .map((event) => event.args?.data?.type)
    .filter((type) => ["mousedown", "mousemove", "mouseup"].includes(type));
  const presentationTimestamps = traceEvents
    .filter((event) => isMainThread(event) && event.name === "AnimationFrame::Presentation")
    .map((event) => event.ts)
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((left, right) => left - right);
  const presentationIntervalsMs = presentationTimestamps
    .slice(1)
    .map((timestamp, index) => (timestamp - presentationTimestamps[index]) / 1_000);
  const sortedPresentationIntervals = [...presentationIntervalsMs].sort((left, right) => left - right);
  const p95PresentationIntervalMs = sortedPresentationIntervals.length > 0
    ? sortedPresentationIntervals[Math.ceil(sortedPresentationIntervals.length * 0.95) - 1]
    : null;
  const aggregate = (events, keyFor) => [...events.reduce((map, event) => {
    const key = keyFor(event);
    if (!key) return map;
    const current = map.get(key) ?? { key, count: 0, durationMs: 0 };
    current.count += 1;
    current.durationMs += (event.dur ?? 0) / 1_000;
    map.set(key, current);
    return map;
  }, new Map()).values()].sort((left, right) => right.durationMs - left.durationMs).slice(0, 10);
  const targetCompleteEvents = traceEvents.filter((event) => isMainThread(event) && event.ph === "X");
  return {
    traceEventCount: traceEvents.length,
    targetFrameId,
    targetRendererProcessIds: [...targetRendererProcessIds],
    completeEventTimestampRangeMs: completeEventTimestamps.length > 1
      ? (Math.max(...completeEventTimestamps) - Math.min(...completeEventTimestamps)) / 1_000
      : null,
    rendererMainThreadCount: rendererMainThreads.size,
    rendererMainThreadEventCount: traceEvents.filter(isMainThread).length,
    runTaskDurationMs: durationFor(new Set(["RunTask", "ThreadControllerImpl::RunTask"])),
    scriptingDurationMs: durationFor(new Set(["FunctionCall"])),
    layoutDurationMs: durationFor(new Set(["Layout", "UpdateLayoutTree"])),
    paintDurationMs: durationFor(new Set(["Paint", "PrePaint"])),
    compositeDurationMs: durationFor(new Set(["CompositeLayers"])),
    gcDurationMs: durationFor(new Set(["MinorGC", "MajorGC", "V8.GCScavenger", "V8.GCCompactor", "V8.GCIncrementalMarking"])),
    drawFrameCount: traceEvents.filter((event) => isTargetProcess(event) && event.name === "DrawFrame").length,
    presentedFrameCount: presentationTimestamps.length,
    presentedFrameIntervalsMs: presentationIntervalsMs,
    p95PresentedFrameIntervalMs: p95PresentationIntervalMs,
    traceIdentifiablePointerEvents: {
      total: eventDispatchTypes.length,
      mousedown: eventDispatchTypes.filter((type) => type === "mousedown").length,
      mousemove: eventDispatchTypes.filter((type) => type === "mousemove").length,
      mouseup: eventDispatchTypes.filter((type) => type === "mouseup").length,
    },
    topMainThreadEvents: aggregate(targetCompleteEvents, (event) => event.name),
    topFunctionContributors: aggregate(
      targetCompleteEvents.filter((event) => event.name === "FunctionCall"),
      (event) => event.args?.data?.url
        ? `${event.args.data.url}:${(event.args.data.lineNumber ?? 0) + 1}:${event.args.data.functionName || "<anonymous>"}`
        : null
    ),
  };
}

async function startTraceCapture(client, { residualAttribution = false } = {}) {
  const traceEvents = [];
  const unsubscribe = client.on("Tracing.dataCollected", (message) => {
    traceEvents.push(...(message.params?.value ?? []));
  });
  const complete = client.waitForEvent("Tracing.tracingComplete", { timeoutMs: 30_000 });
  const startedAt = performance.now();
  await client.send("Tracing.start", {
    categories: residualAttribution
      ? "devtools.timeline,toplevel,blink.user_timing,disabled-by-default-devtools.timeline.frame,v8,cc,gpu,viz,disabled-by-default-cc.debug,disabled-by-default-gpu.debug,disabled-by-default-devtools.timeline.layers,disabled-by-default-skia"
      : "devtools.timeline,toplevel,blink.user_timing,disabled-by-default-devtools.timeline.frame,v8",
    options: "sampling-frequency=10000",
    transferMode: "ReportEvents",
  });
  return { traceEvents, unsubscribe, complete, startedAt };
}

async function readResidualRenderSurfaceState(client, sessionId) {
  return evaluate(client, sessionId, `(() => {
    const canvas = document.querySelector("canvas");
    const canvasRect = canvas?.getBoundingClientRect();
    const viewportRect = canvas?.parentElement?.parentElement?.getBoundingClientRect();
    if (!(canvas instanceof HTMLCanvasElement) || !canvasRect || !viewportRect) return null;
    return {
      canvasBackingPixels: {
        width: canvas.width,
        height: canvas.height,
        area: canvas.width * canvas.height,
      },
      canvasDomRectCss: {
        x: canvasRect.x,
        y: canvasRect.y,
        width: canvasRect.width,
        height: canvasRect.height,
        area: canvasRect.width * canvasRect.height,
      },
      previewViewportDomRectCss: {
        x: viewportRect.x,
        y: viewportRect.y,
        width: viewportRect.width,
        height: viewportRect.height,
        area: viewportRect.width * viewportRect.height,
      },
      devicePixelRatio,
    };
  })()`);
}

function validateCandidate2RenderSurface(fixture, state, phase) {
  const expectedBacking = fixture.id === "flat"
    ? { width: 540, height: 960 }
    : { width: 1600, height: 1600 };
  const expectedDom = fixture.id === "flat"
    ? { width: 1080, height: 1920 }
    : { width: 800, height: 800 };
  const reasons = [];
  if (!state) return [`${phase} render surface state missing`];
  if (state.canvasBackingPixels.width !== expectedBacking.width
    || state.canvasBackingPixels.height !== expectedBacking.height) {
    reasons.push(`${phase} backing mismatch: expected=${JSON.stringify(expectedBacking)} actual=${JSON.stringify(state.canvasBackingPixels)}`);
  }
  if (Math.abs(state.canvasDomRectCss.width - expectedDom.width) >= 0.5
    || Math.abs(state.canvasDomRectCss.height - expectedDom.height) >= 0.5) {
    reasons.push(`${phase} canvas DOM mismatch: expected=${JSON.stringify(expectedDom)} actual=${JSON.stringify(state.canvasDomRectCss)}`);
  }
  const expectedViewport = PROFILING_ENVIRONMENT_FREEZE.frozenValues.previewViewportDomRectCss;
  if (Math.abs(state.previewViewportDomRectCss.width - expectedViewport.width) >= 0.5
    || Math.abs(state.previewViewportDomRectCss.height - expectedViewport.height) >= 0.5) {
    reasons.push(`${phase} preview viewport DOM mismatch: expected=${JSON.stringify(expectedViewport)} actual=${JSON.stringify(state.previewViewportDomRectCss)}`);
  }
  if (state.devicePixelRatio !== PROFILING_ENVIRONMENT_FREEZE.frozenValues.devicePixelRatio) {
    reasons.push(`${phase} DPR mismatch: expected=${PROFILING_ENVIRONMENT_FREEZE.frozenValues.devicePixelRatio} actual=${state.devicePixelRatio}`);
  }
  return reasons;
}

async function stopTraceCapture(client, capture, frameId) {
  await client.send("Tracing.end");
  await capture.complete;
  capture.unsubscribe();
  return {
    wallCaptureDurationMs: performance.now() - capture.startedAt,
    traceEvents: capture.traceEvents,
    trace: summarizeTrace(capture.traceEvents, frameId),
  };
}

async function clickButtonByAria(client, sessionId, ariaLabel) {
  const clicked = await evaluate(client, sessionId, `(() => {
    const button = document.querySelector('button[aria-label=${JSON.stringify(ariaLabel)}]');
    button?.click();
    return Boolean(button);
  })()`, { userGesture: true });
  if (!clicked) throw new Error(`button missing: ${ariaLabel}`);
}

async function readTimelineFrame(client, sessionId) {
  return evaluate(client, sessionId, `(() => {
    const ruler = [...document.querySelectorAll("div")].find((element) => getComputedStyle(element).cursor === "crosshair");
    if (!ruler) return null;
    const content = [...ruler.children].find((element) => getComputedStyle(element).display === "flex");
    const indicator = [...ruler.children].find((element) => element !== content && getComputedStyle(element).pointerEvents === "none" && element.style.zIndex === "8" && element.style.width === "2px");
    const pxPerFrame = content?.firstElementChild?.getBoundingClientRect().width;
    if (!indicator || !pxPerFrame) return null;
    return Math.round((parseFloat(indicator.style.left) + 1) / pxPerFrame);
  })()`);
}

async function seekTimelineFrame(client, sessionId, frame, eventLog) {
  const point = await evaluate(client, sessionId, `(() => {
    const ruler = [...document.querySelectorAll("div")].find((element) => getComputedStyle(element).cursor === "crosshair");
    const content = ruler && [...ruler.children].find((element) => getComputedStyle(element).display === "flex");
    const pxPerFrame = content?.firstElementChild?.getBoundingClientRect().width;
    const rect = ruler?.getBoundingClientRect();
    return rect && pxPerFrame ? { x: rect.x + ${JSON.stringify(frame)} * pxPerFrame, y: rect.y + rect.height / 2 } : null;
  })()`);
  if (!point) throw new Error("Timeline ruler geometry unavailable");
  const timestampMs = performance.now();
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", buttons: 1, clickCount: 1 }, sessionId);
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", buttons: 0, clickCount: 1 }, sessionId);
  eventLog?.push({ frame, timestampMs });
  await waitForCondition(client, sessionId, `(async () => true)()`, "seek dispatch", 500);
  await delay(30);
}

async function waitForFrameAtLeast(client, sessionId, frame, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  let current = await readTimelineFrame(client, sessionId);
  while ((current ?? -1) < frame && performance.now() < deadline) {
    await delay(10);
    current = await readTimelineFrame(client, sessionId);
  }
  return current;
}

async function undoAndWait(client, sessionId, fixture, initialState) {
  for (const type of ["keyDown", "keyUp"]) {
    await client.send("Input.dispatchKeyEvent", { type, modifiers: 4, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 6 }, sessionId);
  }
  await waitForCondition(client, sessionId, `(() => {
    const button = document.querySelector('button[aria-label="위치 이동"]');
    const rect = button?.getBoundingClientRect();
    return Boolean(rect && Math.abs(rect.x - ${JSON.stringify(initialState.target.positionHandleRect.x)}) < 0.5 && Math.abs(rect.y - ${JSON.stringify(initialState.target.positionHandleRect.y)}) < 0.5);
  })()`, "Undo restore", 5_000);
  return readPilotState(client, sessionId, fixture);
}

async function beginPositionDrag(client, sessionId, dispatchLog) {
  const hitTest = await findVerifiedPositionRingPoint(client, sessionId);
  const start = { x: hitTest.selected.x, y: hitTest.selected.y };
  const activation = { x: start.x + 4, y: start.y };
  const dispatch = async (params) => {
    dispatchLog.push({ type: params.type, x: params.x, y: params.y, timestampMs: performance.now() });
    await client.send("Input.dispatchMouseEvent", params, sessionId);
  };
  await dispatch({ type: "mouseMoved", ...start, button: "none" });
  await dispatch({ type: "mousePressed", ...start, button: "left", buttons: 1, clickCount: 1 });
  await dispatch({ type: "mouseMoved", ...activation, button: "left", buttons: 1 });
  await waitForCondition(client, sessionId, `getComputedStyle(document.querySelector('button[aria-label="위치 이동"]')).cursor === "grabbing"`, "Position drag activation", 2_000);
  return { hitTest, start, activation, dispatch };
}

async function finishPositionDrag(client, sessionId, point, dispatchLog) {
  dispatchLog.push({ type: "mouseReleased", x: point.x, y: point.y, timestampMs: performance.now() });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", buttons: 0, clickCount: 1 }, sessionId);
}

async function findVerifiedWhScalePoint(client, sessionId) {
  const result = await evaluate(client, sessionId, `(() => {
    const wh = document.querySelector('button[aria-label="WH (비율/전체 크기)"]');
    const position = document.querySelector('button[aria-label="위치 이동"]');
    if (!(wh instanceof HTMLButtonElement) || !(position instanceof HTMLButtonElement)) {
      return { ok: false, reason: "WH-or-position-handle-missing" };
    }
    const whRect = wh.getBoundingClientRect();
    const positionRect = position.getBoundingClientRect();
    const whCenter = { x: whRect.x + whRect.width / 2, y: whRect.y + whRect.height / 2 };
    const radialOrigin = { x: positionRect.x + positionRect.width / 2, y: positionRect.y + positionRect.height / 2 };
    const candidates = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]
      .map(([dx, dy]) => {
        const x = whCenter.x + dx;
        const y = whCenter.y + dy;
        const hit = document.elementFromPoint(x, y);
        return {
          x, y, dx, dy,
          matchesWhButton: hit === wh || (hit instanceof Element && wh.contains(hit)),
          hit: hit ? { tagName: hit.tagName, ariaLabel: hit.getAttribute("aria-label"), title: hit.getAttribute("title") } : null,
        };
      });
    const selected = candidates.find((candidate) => candidate.matchesWhButton);
    const vector = selected ? { x: selected.x - radialOrigin.x, y: selected.y - radialOrigin.y } : null;
    const length = vector ? Math.hypot(vector.x, vector.y) : 0;
    return {
      ok: Boolean(selected && length > 0),
      reason: selected && length > 0 ? null : "WH-center-hit-or-radial-vector-invalid",
      ariaLabel: wh.getAttribute("aria-label"),
      title: wh.title,
      whRect: { x: whRect.x, y: whRect.y, width: whRect.width, height: whRect.height },
      positionRect: { x: positionRect.x, y: positionRect.y, width: positionRect.width, height: positionRect.height },
      radialOrigin,
      selected,
      radialUnit: length > 0 ? { x: vector.x / length, y: vector.y / length } : null,
      candidates,
    };
  })()`);
  if (!result?.ok || !result.selected || !result.radialUnit) {
    throw new Error(`WH Scale hit-test failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function beginWhScaleDrag(client, sessionId, dispatchLog) {
  const hitTest = await findVerifiedWhScalePoint(client, sessionId);
  const start = { x: hitTest.selected.x, y: hitTest.selected.y };
  const dispatch = async (params) => {
    dispatchLog.push({ type: params.type, x: params.x, y: params.y, timestampMs: performance.now() });
    await client.send("Input.dispatchMouseEvent", params, sessionId);
  };
  await dispatch({ type: "mouseMoved", ...start, button: "none" });
  await dispatch({ type: "mousePressed", ...start, button: "left", buttons: 1, clickCount: 1 });
  return { hitTest, start, radialUnit: hitTest.radialUnit, dispatch };
}

async function undoWhScaleAndWait(client, sessionId, fixture, initialState) {
  for (const type of ["keyDown", "keyUp"]) {
    await client.send("Input.dispatchKeyEvent", { type, modifiers: 4, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 6 }, sessionId);
  }
  await waitForCondition(client, sessionId, `(() => {
    const inputsFor = (label) => {
      const row = [...document.querySelectorAll("div")]
        .filter((element) => [...element.children].some((child) => child.tagName === "SPAN" && child.textContent.trim() === label))
        .sort((left, right) => left.querySelectorAll("div").length - right.querySelectorAll("div").length)[0];
      return row ? [...row.querySelectorAll('input[type="text"]')].map((input) => Number(input.value)) : [];
    };
    const scale = inputsFor("크기");
    const rect = document.querySelector('button[aria-label="WH (비율/전체 크기)"]')?.getBoundingClientRect();
    return Boolean(scale.length >= 2 && scale[0] === 100 && scale[1] === 100 && rect
      && Math.abs(rect.x - ${JSON.stringify(initialState.target.whScaleHandleRect.x)}) < 0.5
      && Math.abs(rect.y - ${JSON.stringify(initialState.target.whScaleHandleRect.y)}) < 0.5);
  })()`, "WH Scale Undo restore", 5_000);
  return readPilotState(client, sessionId, fixture);
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function dispatchHighFrequencyPath(drag, seed, pathDelta) {
  const sampleCount = 100;
  const intendedDurationMs = 1_000;
  const intervalMs = intendedDurationMs / sampleCount;
  const scheduleStartedAtMs = performance.now();
  const samples = [];
  const pendingDispatches = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const intendedOffsetMs = (index + 1) * intervalMs;
    const targetTimestampMs = scheduleStartedAtMs + intendedOffsetMs;
    const remainingMs = targetTimestampMs - performance.now();
    if (remainingMs > 0) await delay(remainingMs);
    const actualTimestampMs = performance.now();
    const point = {
      x: seed.x + (pathDelta.x * (index + 1)) / sampleCount,
      y: seed.y + (pathDelta.y * (index + 1)) / sampleCount,
    };
    pendingDispatches.push(drag.dispatch({ type: "mouseMoved", ...point, button: "left", buttons: 1 }));
    samples.push({
      index: index + 1,
      intendedOffsetMs,
      actualOffsetMs: actualTimestampMs - scheduleStartedAtMs,
      scheduleDriftMs: actualTimestampMs - targetTimestampMs,
      dispatchTimestampMs: actualTimestampMs,
      x: point.x,
      y: point.y,
    });
  }
  await Promise.all(pendingDispatches);
  const scheduleDrifts = samples.map((sample) => sample.scheduleDriftMs);
  return {
    sampleCount,
    intervalMs,
    intendedDurationMs,
    actualDurationMs: samples.at(-1).actualOffsetMs,
    firstToLastDispatchMs: samples.at(-1).dispatchTimestampMs - samples[0].dispatchTimestampMs,
    maxScheduleDriftMs: Math.max(...scheduleDrifts),
    medianScheduleDriftMs: median(scheduleDrifts),
    samples,
    point: { x: samples.at(-1).x, y: samples.at(-1).y },
  };
}

async function runScenarioCapture({ client, page, scenario, fixture, initialState, traceDirectory, run, highFrequency = false, recordRenderSurfaceIdentity = false }) {
  const { sessionId, frameId } = page;
  const dispatchLog = [];
  const eventTimestamps = [];
  let terminalFrame = await readTimelineFrame(client, sessionId);
  let capture;
  let captured;
  let undoState = null;
  let highFrequencyReplay = null;
  let livePositionValidation = null;
  const renderSurfaceBefore = recordRenderSurfaceIdentity
    ? await readResidualRenderSurfaceState(client, sessionId)
    : null;
  let renderSurfaceAfter = null;
  if (scenario.family === "I") {
    capture = await startTraceCapture(client);
    await delay(3_000);
    captured = await stopTraceCapture(client, capture, frameId);
  } else if (scenario.family === "S") {
    capture = await startTraceCapture(client);
    for (const frame of [75, 0, 75, 0, 75, 0, 75, 0, 75]) {
      await seekTimelineFrame(client, sessionId, frame, eventTimestamps);
      await delay(220);
    }
    captured = await stopTraceCapture(client, capture, frameId);
    terminalFrame = await readTimelineFrame(client, sessionId);
  } else if (scenario.family === "P") {
    await clickButtonByAria(client, sessionId, "처음으로");
    await clickButtonByAria(client, sessionId, "재생");
    await waitForFrameAtLeast(client, sessionId, 30, 2_000);
    await clickButtonByAria(client, sessionId, "일시정지");
    capture = await startTraceCapture(client);
    await clickButtonByAria(client, sessionId, "재생");
    terminalFrame = await waitForFrameAtLeast(client, sessionId, 119, 3_000);
    const playing = await evaluate(client, sessionId, `Boolean(document.querySelector('button[aria-label="일시정지"]'))`);
    if (playing) await clickButtonByAria(client, sessionId, "일시정지");
    captured = await stopTraceCapture(client, capture, frameId);
    terminalFrame = await readTimelineFrame(client, sessionId);
  } else {
    let drag;
    let point;
    if (scenario.family === "D-seed") {
      capture = await startTraceCapture(client);
      drag = await beginPositionDrag(client, sessionId, dispatchLog);
      point = { x: drag.activation.x + 8, y: drag.activation.y };
      await drag.dispatch({ type: "mouseMoved", ...point, button: "left", buttons: 1 });
      await waitForTwoAnimationFrames(client, sessionId);
      captured = await stopTraceCapture(client, capture, frameId);
    } else {
      drag = await beginPositionDrag(client, sessionId, dispatchLog);
      const seedDistance = fixture.id === "flat" ? 8 : 4;
      const pathDelta = fixture.id === "flat" ? { x: 120, y: 80 } : { x: 60, y: 40 };
      const seed = { x: drag.activation.x + seedDistance, y: drag.activation.y };
      await drag.dispatch({ type: "mouseMoved", ...seed, button: "left", buttons: 1 });
      await waitForTwoAnimationFrames(client, sessionId);
      if (scenario.family === "D-steady") capture = await startTraceCapture(client);
      if (highFrequency && scenario.family === "D-steady") {
        highFrequencyReplay = await dispatchHighFrequencyPath(drag, seed, pathDelta);
        point = highFrequencyReplay.point;
      } else {
        const path = Array.from({ length: 20 }, (_, index) => ({
          x: seed.x + (pathDelta.x * (index + 1)) / 20,
          y: seed.y + (pathDelta.y * (index + 1)) / 20,
        }));
        for (const sample of path) {
          await drag.dispatch({ type: "mouseMoved", ...sample, button: "left", buttons: 1 });
          await delay(50);
        }
        point = path.at(-1);
      }
      if (scenario.family === "D-steady") captured = await stopTraceCapture(client, capture, frameId);
      else {
        capture = await startTraceCapture(client);
        await finishPositionDrag(client, sessionId, point, dispatchLog);
        await delay(500);
        captured = await stopTraceCapture(client, capture, frameId);
      }
    }
    if (highFrequency && scenario.family === "D-steady") {
      const draftState = await readPilotState(client, sessionId, fixture);
      livePositionValidation = validateLivePositionDraft(initialState, draftState);
      if (recordRenderSurfaceIdentity) renderSurfaceAfter = await readResidualRenderSurfaceState(client, sessionId);
    }
    if (scenario.family !== "D-commit") await finishPositionDrag(client, sessionId, point, dispatchLog);
    undoState = await undoAndWait(client, sessionId, fixture, initialState);
  }
  const rawTracePath = join(traceDirectory, `${scenario.id}-run-${run}.json`);
  await writeFile(rawTracePath, JSON.stringify({ metadata: { scenarioId: scenario.id, run }, traceEvents: captured.traceEvents }));
  const actualState = await readPilotState(client, sessionId, fixture);
  const invalidReasons = [];
  if (!captured.traceEvents.length) invalidReasons.push("trace has no events");
  if (scenario.family === "I" && Math.abs(captured.wallCaptureDurationMs - 3_000) > 250) invalidReasons.push(`idle capture duration ${captured.wallCaptureDurationMs}`);
  if (scenario.family === "P" && (terminalFrame ?? -1) < 119) invalidReasons.push(`playback terminal frame ${terminalFrame}`);
  if (scenario.family === "S" && eventTimestamps.length !== 9) invalidReasons.push(`seek event count ${eventTimestamps.length}`);
  if (highFrequency && scenario.family === "D-steady") {
    if (highFrequencyReplay?.sampleCount !== 100) invalidReasons.push(`high-frequency dispatch count ${highFrequencyReplay?.sampleCount}/100`);
    if (!highFrequencyReplay || Math.abs(highFrequencyReplay.actualDurationMs - 1_000) > 100) {
      invalidReasons.push(`high-frequency actual duration ${highFrequencyReplay?.actualDurationMs}`);
    }
    invalidReasons.push(...(livePositionValidation?.invalidReasons ?? [
      "Position live Properties/Gizmo/layer validation missing",
    ]));
    if (recordRenderSurfaceIdentity) {
      invalidReasons.push(...validateCandidate2RenderSurface(fixture, renderSurfaceBefore, "before"));
      invalidReasons.push(...validateCandidate2RenderSurface(fixture, renderSurfaceAfter, "draft"));
    }
  }
  if (undoState && JSON.stringify(undoState.target.transformFields) !== JSON.stringify(initialState.target.transformFields)) {
    invalidReasons.push("Undo did not restore the exact initial Transform fields");
  }
  return {
    run, valid: invalidReasons.length === 0, invalidReasons, terminalFrame,
    captureWindow: scenario.captureWindow, wallCaptureDurationMs: captured.wallCaptureDurationMs,
    actualDispatchEvents: dispatchLog, actualSeekEvents: eventTimestamps,
    presentedFrameCount: captured.trace.presentedFrameCount,
    rawPointerEventCount: captured.trace.traceIdentifiablePointerEvents.total,
    msPerRawPointerEvent: captured.trace.traceIdentifiablePointerEvents.total > 0
      ? captured.trace.runTaskDurationMs / captured.trace.traceIdentifiablePointerEvents.total
      : null,
    highFrequencyReplay,
    livePositionValidation,
    renderSurfaceIdentity: recordRenderSurfaceIdentity ? { renderSurfaceBefore, renderSurfaceAfter } : null,
    acceptedDraftCount: null, runtimeMetrics: null, rawTracePath,
    trace: captured.trace,
    finalSetup: actualState.setup,
    undoRestored: undoState ? invalidReasons.every((reason) => !reason.startsWith("Undo")) : null,
  };
}

function whHandleRadialDistance(state) {
  const wh = state.target.whScaleHandleRect;
  const position = state.target.positionHandleRect;
  if (!wh || !position) return null;
  return Math.hypot(
    wh.x + wh.width / 2 - (position.x + position.width / 2),
    wh.y + wh.height / 2 - (position.y + position.height / 2)
  );
}

async function prepareWhScaleDrag(client, sessionId, fixture, initialState, dispatchLog) {
  const initialScale = initialState.target.transformFields.scale;
  if (initialScale?.x !== 100 || initialScale?.y !== 100) {
    throw new Error(`WH initial linked Scale is not 100/100: ${JSON.stringify(initialScale)}`);
  }
  if (initialState.target.whScaleHandleCount !== 1
    || initialState.target.whScaleHandleTitle !== "WH (비율/전체 크기)") {
    throw new Error(`WH handle identity invalid: ${JSON.stringify({
      count: initialState.target.whScaleHandleCount,
      title: initialState.target.whScaleHandleTitle,
    })}`);
  }
  const drag = await beginWhScaleDrag(client, sessionId, dispatchLog);
  const seed = {
    x: drag.start.x + drag.radialUnit.x * 4,
    y: drag.start.y + drag.radialUnit.y * 4,
  };
  await drag.dispatch({ type: "mouseMoved", ...seed, button: "left", buttons: 1 });
  await waitForTwoAnimationFrames(client, sessionId);
  const afterSeed = await readPilotState(client, sessionId, fixture);
  const seedScale = afterSeed.target.transformFields.scale;
  const firstMoveBaselineValidated = Boolean(seedScale
    && seedScale.x >= 100 && seedScale.y >= 100
    && Math.abs(seedScale.x - seedScale.y) < 0.001
    && seedScale.x > 75 && seedScale.y > 75
    && afterSeed.target.whScaleReadoutText === "X 100% / Y 100%");
  if (!firstMoveBaselineValidated) {
    await finishPositionDrag(client, sessionId, seed, dispatchLog);
    throw new Error(`WH first move did not derive from linked 100/100 Scale: ${JSON.stringify(seedScale)}`);
  }
  return { drag, seed, afterSeed, firstMoveBaselineValidated };
}

async function finishAndValidateWhScale(client, sessionId, fixture, initialState, prepared, replay, dispatchLog) {
  const draftState = await readPilotState(client, sessionId, fixture);
  await finishPositionDrag(client, sessionId, replay.point, dispatchLog);
  await delay(100);
  const committedState = await readPilotState(client, sessionId, fixture);
  const undoState = await undoWhScaleAndWait(client, sessionId, fixture, initialState);
  const initialScale = initialState.target.transformFields.scale;
  const seedScale = prepared.afterSeed.target.transformFields.scale;
  const draftScale = draftState.target.transformFields.scale;
  const committedScale = committedState.target.transformFields.scale;
  const undoScale = undoState.target.transformFields.scale;
  const initialDistance = whHandleRadialDistance(initialState);
  const draftDistance = whHandleRadialDistance(draftState);
  const expectedDraftReadout = draftScale
    ? `X ${Math.round(draftScale.x)}% / Y ${Math.round(draftScale.y)}%`
    : null;
  const invalidReasons = [];
  if (!prepared.firstMoveBaselineValidated) invalidReasons.push("WH first move 100/100 baseline evidence missing");
  if (!draftScale || Math.abs(draftScale.x - draftScale.y) >= 0.001 || draftScale.x <= seedScale.x) {
    invalidReasons.push(`WH linked Draft Scale invalid: seed=${JSON.stringify(seedScale)} draft=${JSON.stringify(draftScale)}`);
  }
  if (!draftState.target.whScaleHandleRect
    || draftState.target.whScaleHandleCount !== 1
    || draftState.target.whScaleReadoutText !== expectedDraftReadout) {
    invalidReasons.push(`WH Gizmo/readout did not update with Properties Scale: expected=${expectedDraftReadout} actual=${draftState.target.whScaleReadoutText}`);
  }
  if (!committedScale || !draftScale
    || Math.abs(committedScale.x - draftScale.x) > 0.001
    || Math.abs(committedScale.y - draftScale.y) > 0.001) {
    invalidReasons.push(`WH committed Scale differs from Draft: draft=${JSON.stringify(draftScale)} committed=${JSON.stringify(committedScale)}`);
  }
  if (JSON.stringify(undoScale) !== JSON.stringify(initialScale)) {
    invalidReasons.push(`WH Undo Scale differs from initial: initial=${JSON.stringify(initialScale)} undo=${JSON.stringify(undoScale)}`);
  }
  const initialRect = initialState.target.whScaleHandleRect;
  const undoRect = undoState.target.whScaleHandleRect;
  if (!initialRect || !undoRect || Math.abs(initialRect.x - undoRect.x) >= 0.5 || Math.abs(initialRect.y - undoRect.y) >= 0.5) {
    invalidReasons.push(`WH Undo handle rect differs from initial: initial=${JSON.stringify(initialRect)} undo=${JSON.stringify(undoRect)}`);
  }
  return {
    invalidReasons,
    initialScale,
    seedScale,
    draftScale,
    committedScale,
    undoScale,
    initialWhHandleRect: initialRect,
    draftWhHandleRect: draftState.target.whScaleHandleRect,
    committedWhHandleRect: committedState.target.whScaleHandleRect,
    undoWhHandleRect: undoRect,
    initialRadialDistance: initialDistance,
    draftRadialDistance: draftDistance,
    seedWhReadoutText: prepared.afterSeed.target.whScaleReadoutText,
    draftWhReadoutText: draftState.target.whScaleReadoutText,
    firstMoveBaselineValidated: prepared.firstMoveBaselineValidated,
    linkedScaleValidated: invalidReasons.every((reason) => !reason.startsWith("WH linked")),
    commitValidated: invalidReasons.every((reason) => !reason.startsWith("WH committed")),
    undoRestored: invalidReasons.every((reason) => !reason.startsWith("WH Undo")),
  };
}

async function runWhScaleCapture({
  client,
  page,
  scenario,
  fixture,
  initialState,
  traceDirectory,
  run,
  residualAttribution = false,
  recordRenderSurfaceIdentity = false,
}) {
  const { sessionId, frameId } = page;
  const dispatchLog = [];
  const prepared = await prepareWhScaleDrag(client, sessionId, fixture, initialState, dispatchLog);
  const renderSurfaceBefore = residualAttribution || recordRenderSurfaceIdentity
    ? await readResidualRenderSurfaceState(client, sessionId)
    : null;
  const capture = await startTraceCapture(client, { residualAttribution });
  const replay = await dispatchHighFrequencyPath(prepared.drag, prepared.seed, {
    x: prepared.drag.radialUnit.x * 60,
    y: prepared.drag.radialUnit.y * 60,
  });
  const captured = await stopTraceCapture(client, capture, frameId);
  const renderSurfaceAfter = residualAttribution || recordRenderSurfaceIdentity
    ? await readResidualRenderSurfaceState(client, sessionId)
    : null;
  const scaleValidation = await finishAndValidateWhScale(
    client, sessionId, fixture, initialState, prepared, replay, dispatchLog
  );
  const invalidReasons = [...scaleValidation.invalidReasons];
  if (replay.sampleCount !== 100) invalidReasons.push(`WH high-frequency dispatch count ${replay.sampleCount}/100`);
  if (Math.abs(replay.actualDurationMs - 1_000) > 100) invalidReasons.push(`WH actual duration ${replay.actualDurationMs}`);
  if (!captured.traceEvents.length) invalidReasons.push("WH trace has no events");
  if (recordRenderSurfaceIdentity) {
    invalidReasons.push(...validateCandidate2RenderSurface(fixture, renderSurfaceBefore, "before"));
    invalidReasons.push(...validateCandidate2RenderSurface(fixture, renderSurfaceAfter, "draft"));
  }
  const rawTracePath = join(traceDirectory, `${scenario.id}-run-${run}.json`);
  await writeFile(rawTracePath, JSON.stringify({
    metadata: {
      scenarioId: scenario.id,
      run,
      handle: "WH (비율/전체 크기)",
      replay,
      scaleValidation,
      residualAttribution,
      renderSurfaceBefore,
      renderSurfaceAfter,
    },
    traceEvents: captured.traceEvents,
  }));
  return {
    run,
    valid: invalidReasons.length === 0,
    invalidReasons,
    captureWindow: scenario.captureWindow,
    wallCaptureDurationMs: captured.wallCaptureDurationMs,
    actualDispatchEvents: dispatchLog,
    presentedFrameCount: captured.trace.presentedFrameCount,
    rawPointerEventCount: captured.trace.traceIdentifiablePointerEvents.total,
    msPerRawPointerEvent: captured.trace.traceIdentifiablePointerEvents.total > 0
      ? captured.trace.runTaskDurationMs / captured.trace.traceIdentifiablePointerEvents.total
      : null,
    highFrequencyReplay: replay,
    whScaleValidation: scaleValidation,
    acceptedDraftCount: null,
    runtimeMetrics: null,
    renderSurfaceIdentity: recordRenderSurfaceIdentity ? { renderSurfaceBefore, renderSurfaceAfter } : null,
    residualAttribution: residualAttribution ? {
      traceCategories: "timeline+frame+cc+gpu+viz+cc.debug+gpu.debug+layers+skia",
      renderSurfaceBefore,
      renderSurfaceAfter,
    } : null,
    rawTracePath,
    trace: captured.trace,
    undoRestored: scaleValidation.undoRestored,
  };
}

async function loadCpuSourceMap(profile) {
  const assetFrame = profile.nodes
    .map((node) => node.callFrame)
    .find((frame) => frame.url?.includes("/assets/") && frame.url.endsWith(".js"));
  if (!assetFrame) return { status: "unavailable", blocker: "CPU profile exposed no production JavaScript asset URL" };
  const assetFile = basename(new URL(assetFrame.url).pathname);
  const assetPath = resolve(projectRoot, "dist", "assets", assetFile);
  const sourceMapPath = `${assetPath}.map`;
  try {
    const [assetBytes, sourceMapBytes] = await Promise.all([readFile(assetPath), readFile(sourceMapPath)]);
    const payload = JSON.parse(sourceMapBytes.toString("utf8"));
    return {
      status: "available",
      assetFile,
      assetSha256: createHash("sha256").update(assetBytes).digest("hex"),
      sourceMapFile: basename(sourceMapPath),
      sourceMapSha256: createHash("sha256").update(sourceMapBytes).digest("hex"),
      sourceMap: new SourceMap(payload),
    };
  } catch (error) {
    return {
      status: "unavailable",
      assetFile,
      blocker: `matching external source map unavailable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function summarizeCpuProfile(profile, sourceMapInfo) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) parents.set(child, node.id);
  }
  const mappedFrame = (frame) => {
    const minified = {
      url: frame.url || null,
      line: (frame.lineNumber ?? 0) + 1,
      column: (frame.columnNumber ?? 0) + 1,
      functionName: frame.functionName || "<anonymous>",
    };
    if (sourceMapInfo.status !== "available" || !frame.url?.endsWith(sourceMapInfo.assetFile)) {
      return { minified, original: null };
    }
    const entry = sourceMapInfo.sourceMap.findEntry(frame.lineNumber ?? 0, frame.columnNumber ?? 0);
    return {
      minified,
      original: entry?.originalSource ? {
        source: entry.originalSource,
        line: (entry.originalLine ?? 0) + 1,
        column: (entry.originalColumn ?? 0) + 1,
        name: entry.name || frame.functionName || "<anonymous>",
      } : null,
    };
  };
  const keyFor = (mapped) => mapped.original
    ? `${mapped.original.source}:${mapped.original.line}:${mapped.original.name}`
    : `${mapped.minified.url}:${mapped.minified.line}:${mapped.minified.column}:${mapped.minified.functionName}`;
  const contributors = new Map();
  const ensure = (nodeId) => {
    const node = nodes.get(nodeId);
    if (!node) return null;
    const mapped = mappedFrame(node.callFrame);
    const key = keyFor(mapped);
    const current = contributors.get(key) ?? {
      key, mappedFrame: mapped, selfSamples: 0, totalSamples: 0, selfTimeMs: 0, totalTimeMs: 0,
    };
    contributors.set(key, current);
    return current;
  };
  const applicationStacks = [];
  for (let index = 0; index < (profile.samples?.length ?? 0); index += 1) {
    const sampledNodeId = profile.samples[index];
    const durationMs = (profile.timeDeltas?.[index] ?? 0) / 1_000;
    const self = ensure(sampledNodeId);
    if (self) {
      self.selfSamples += 1;
      self.selfTimeMs += durationMs;
    }
    const stack = [];
    let currentId = sampledNodeId;
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const total = ensure(currentId);
      if (total) {
        total.totalSamples += 1;
        total.totalTimeMs += durationMs;
      }
      const node = nodes.get(currentId);
      if (node) stack.push(mappedFrame(node.callFrame));
      currentId = parents.get(currentId);
    }
    if (applicationStacks.length < 5 && stack.some((frame) => frame.original?.source?.includes("src/"))) {
      applicationStacks.push(stack.slice(0, 12));
    }
  }
  const normalized = [...contributors.values()].map((item) => ({
    ...item,
    selfTimeMs: Math.round(item.selfTimeMs * 1_000) / 1_000,
    totalTimeMs: Math.round(item.totalTimeMs * 1_000) / 1_000,
  }));
  const topSelfContributors = [...normalized]
    .filter((item) => item.selfSamples > 0)
    .sort((left, right) => right.selfTimeMs - left.selfTimeMs)
    .slice(0, 20);
  const topTotalContributors = [...normalized]
    .filter((item) => item.totalSamples > 0)
    .sort((left, right) => right.totalTimeMs - left.totalTimeMs)
    .slice(0, 20);
  const mappedApplicationFrames = normalized.filter((item) => item.mappedFrame.original?.source?.includes("src/"));
  const focusedApplicationContributors = mappedApplicationFrames.filter((item) => {
    const source = item.mappedFrame.original?.source ?? "";
    const name = item.mappedFrame.original?.name ?? "";
    return /EditorShell|EditorDraftBoundary|useEditorCompositionRoot|useEditorState|useProperties|useCanvas/.test(
      `${source}:${name}`
    );
  });
  return {
    sampleCount: profile.samples?.length ?? 0,
    timeDeltaCount: profile.timeDeltas?.length ?? 0,
    profileDurationMs: (profile.endTime - profile.startTime) / 1_000,
    sourceMapping: sourceMapInfo.status === "available" ? {
      status: mappedApplicationFrames.length ? "mapped-original-application-sources" : "source-map-loaded-no-application-frame-mapped",
      assetFile: sourceMapInfo.assetFile,
      assetSha256: sourceMapInfo.assetSha256,
      sourceMapFile: sourceMapInfo.sourceMapFile,
      sourceMapSha256: sourceMapInfo.sourceMapSha256,
      blocker: mappedApplicationFrames.length ? null : "No sampled frame mapped to an original src/ path",
    } : sourceMapInfo,
    topSelfContributors,
    topTotalContributors,
    focusedApplicationContributors,
    applicationStacks,
    schedulerWrapperInspection: {
      schedulerNamedFrames: normalized.filter((item) => /schedul/i.test(item.key)).slice(0, 10),
      originalApplicationFramesVisible: mappedApplicationFrames.length > 0,
    },
  };
}

async function runCpuProfileCapture({ client, page, scenario, fixture, initialState, traceDirectory, run }) {
  const { sessionId } = page;
  const dispatchLog = [];
  const drag = await beginPositionDrag(client, sessionId, dispatchLog);
  const seedDistance = fixture.id === "flat" ? 8 : 4;
  const pathDelta = fixture.id === "flat" ? { x: 120, y: 80 } : { x: 60, y: 40 };
  const seed = { x: drag.activation.x + seedDistance, y: drag.activation.y };
  await drag.dispatch({ type: "mouseMoved", ...seed, button: "left", buttons: 1 });
  await waitForTwoAnimationFrames(client, sessionId);
  await client.send("Profiler.enable", {}, sessionId);
  await client.send("Profiler.setSamplingInterval", { interval: 100 }, sessionId);
  await client.send("Profiler.start", {}, sessionId);
  const replay = await dispatchHighFrequencyPath(drag, seed, pathDelta);
  const { profile } = await client.send("Profiler.stop", {}, sessionId, 30_000);
  await client.send("Profiler.disable", {}, sessionId);
  const draftState = await readPilotState(client, sessionId, fixture);
  const livePositionValidation = validateLivePositionDraft(initialState, draftState);
  await finishPositionDrag(client, sessionId, replay.point, dispatchLog);
  const undoState = await undoAndWait(client, sessionId, fixture, initialState);
  const sourceMapInfo = await loadCpuSourceMap(profile);
  const summary = summarizeCpuProfile(profile, sourceMapInfo);
  const rawProfilePath = join(traceDirectory, `${scenario.id}-cpu-profile-run-${run}.json`);
  await writeFile(rawProfilePath, JSON.stringify({
    metadata: { scenarioId: scenario.id, run, lane: "cpu-profile-production-sourcemap", replay },
    profile,
  }));
  const invalidReasons = [];
  if (replay.sampleCount !== 100) invalidReasons.push(`CPU replay dispatch count ${replay.sampleCount}/100`);
  if (!profile.samples?.length) invalidReasons.push("CPU profile contains no samples");
  invalidReasons.push(...livePositionValidation.invalidReasons);
  if (JSON.stringify(undoState.target.transformFields) !== JSON.stringify(initialState.target.transformFields)) {
    invalidReasons.push("Undo did not restore the exact initial Transform fields");
  }
  return {
    run,
    valid: invalidReasons.length === 0,
    invalidReasons,
    lane: "cpu-profile-production-sourcemap",
    excludedFromTimingStatistics: true,
    highFrequencyReplay: replay,
    livePositionValidation,
    cpuProfile: summary,
    rawProfilePath,
    acceptedDraftCount: null,
    runtimeMetrics: null,
    undoRestored: !invalidReasons.some((reason) => reason.startsWith("Undo")),
  };
}

async function runWhCpuProfileCapture({ client, page, scenario, fixture, initialState, traceDirectory, run }) {
  const { sessionId } = page;
  const dispatchLog = [];
  const prepared = await prepareWhScaleDrag(client, sessionId, fixture, initialState, dispatchLog);
  await client.send("Profiler.enable", {}, sessionId);
  await client.send("Profiler.setSamplingInterval", { interval: 100 }, sessionId);
  await client.send("Profiler.start", {}, sessionId);
  const replay = await dispatchHighFrequencyPath(prepared.drag, prepared.seed, {
    x: prepared.drag.radialUnit.x * 60,
    y: prepared.drag.radialUnit.y * 60,
  });
  const { profile } = await client.send("Profiler.stop", {}, sessionId, 30_000);
  await client.send("Profiler.disable", {}, sessionId);
  const scaleValidation = await finishAndValidateWhScale(
    client, sessionId, fixture, initialState, prepared, replay, dispatchLog
  );
  const sourceMapInfo = await loadCpuSourceMap(profile);
  const summary = summarizeCpuProfile(profile, sourceMapInfo);
  const rawProfilePath = join(traceDirectory, `${scenario.id}-cpu-profile-run-${run}.json`);
  await writeFile(rawProfilePath, JSON.stringify({
    metadata: { scenarioId: scenario.id, run, lane: "wh-scale-cpu-profile-production-sourcemap", replay, scaleValidation },
    profile,
  }));
  const invalidReasons = [...scaleValidation.invalidReasons];
  if (replay.sampleCount !== 100) invalidReasons.push(`WH CPU replay dispatch count ${replay.sampleCount}/100`);
  if (!profile.samples?.length) invalidReasons.push("WH CPU profile contains no samples");
  return {
    run,
    valid: invalidReasons.length === 0,
    invalidReasons,
    lane: "wh-scale-cpu-profile-production-sourcemap",
    excludedFromTimingStatistics: true,
    highFrequencyReplay: replay,
    whScaleValidation: scaleValidation,
    cpuProfile: summary,
    rawProfilePath,
    acceptedDraftCount: null,
    runtimeMetrics: null,
    undoRestored: scaleValidation.undoRestored,
  };
}

function statistics(values) {
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[1];
  const deviations = values.map((value) => Math.abs(value - median)).sort((a, b) => a - b);
  return { median, min: sorted[0], max: sorted[2], mad: deviations[1] };
}

async function runFlatMatrix(options, matrixKind = "flat") {
  const highFrequencyScenarioIds = new Set([
    "D-steady-flat-off-fast",
    "D-steady-flat-off-full",
    "D-steady-nested-off-fast",
    "D-steady-glow-off-fast",
    "D-steady-glow-on-fast",
  ]);
  const candidate1After = matrixKind.startsWith("candidate1-after-");
  const candidate2After = matrixKind.startsWith("candidate2-after-");
  const candidatePrefix = candidate1After
    ? "candidate1-after-"
    : candidate2After ? "candidate2-after-" : "";
  const effectiveMatrixKind = candidatePrefix
    ? matrixKind.slice(candidatePrefix.length)
    : matrixKind;
  const matrix2b = effectiveMatrixKind === "2b";
  const highFrequency = effectiveMatrixKind === "hf";
  const whScale = effectiveMatrixKind === "wh";
  const whResidual = effectiveMatrixKind === "wh-residual";
  const cpuWh = effectiveMatrixKind === "cpu-wh";
  const cpuProfile = effectiveMatrixKind === "cpu" || cpuWh;
  const scenarios = PROFILING_SCENARIOS.filter((scenario) => {
    if (options.scenarioId && scenario.id !== options.scenarioId) return false;
    if (matrix2b) return scenario.family === "D-steady" && ["nested", "glow"].includes(scenario.fixture);
    if (highFrequency) return highFrequencyScenarioIds.has(scenario.id);
    if (whResidual) return [
      "D-wh-scale-flat-off-fast",
      "D-wh-scale-glow-off-fast",
    ].includes(scenario.id);
    if (whScale) return scenario.family === "D-wh-scale";
    if (cpuWh) return scenario.id === "D-wh-scale-flat-off-fast";
    if (cpuProfile) return scenario.id === "D-steady-flat-off-fast";
    return scenario.fixture === "flat";
  });
  const traceDirectory = options.traceDirectory
    ?? await mkdtemp(join(tmpdir(), matrix2b
      ? "shortform-cdp-nested-glow-matrix-"
      : highFrequency
        ? "shortform-cdp-high-frequency-steady-"
        : whScale
          ? "shortform-cdp-wh-scale-high-frequency-"
          : whResidual
            ? "shortform-cdp-wh-scale-residual-"
          : cpuWh
            ? "shortform-cdp-wh-scale-cpu-profile-"
            : cpuProfile
          ? candidate1After
            ? "shortform-candidate1-after-cpu-profile-"
            : "shortform-cdp-cpu-profile-"
          : "shortform-cdp-flat-matrix-"));
  await mkdir(traceDirectory, { recursive: true });
  const productionAsset = await readProductionAssetIdentity();
  const version = await fetchJson(`${options.cdpHttp}/json/version`);
  const client = await CdpClient.connect(version.webSocketDebuggerUrl);
  const result = {
    schemaVersion: 2,
    scope: candidate1After
      ? `Task 4 Candidate 1 React Draft Boundary After ${effectiveMatrixKind} lane`
      : candidate2After
        ? `Task 6 Candidate 2 displayed-pixel backing After ${effectiveMatrixKind} lane`
      : matrix2b
      ? "Task 2B nested/glow Browser Performance production CDP matrix"
      : highFrequency
        ? "Task 2C 100-sample high-frequency steady Browser Performance production CDP matrix"
        : whScale
          ? "Task 2D WH Scale 100-sample high-frequency Browser Performance production CDP matrix"
          : whResidual
            ? "Task 4R WH Scale flat/large raster-compositor residual attribution"
          : cpuWh
            ? "Task 2D separate WH Scale production CPU profile attribution lane"
            : cpuProfile
          ? "Task 2C separate production CPU profile attribution lane"
          : "Task 2A flat Browser Performance production CDP matrix",
    lane: cpuWh
      ? "wh-scale-cpu-profile-production-sourcemap"
      : cpuProfile ? "cpu-profile-production-sourcemap" : "browser-performance-production",
    excludedFromTimingStatistics: cpuProfile,
    rawArtifactPolicy: "temporary-directory-only",
    candidate: candidate1After
      ? "candidate1-react-draft-boundary-after"
      : candidate2After ? "candidate2-displayed-pixel-preview-backing-after" : null,
    productionAsset,
    environment: {
      browser: version.Browser,
      protocolVersion: version["Protocol-Version"],
      productionUrl: options.productionUrl,
      frozenValues: PROFILING_ENVIRONMENT_FREEZE.frozenValues,
      traceDirectory,
    },
    fixtures: [...new Set(scenarios.map((scenario) => scenario.fixture))],
    historicalManualRuns: {
      status: "historical/manual-invalid-for-CDP-comparison",
      source: "scripts/previewInteractionProfilingBaseline.json",
      pooledWithCdp: false,
    },
    scenarioResults: {},
    captureMatrix: [],
    valid: false,
  };
  try {
    for (const scenario of scenarios) {
      const fixture = PROFILING_FIXTURES[scenario.fixture];
      const fixturePath = resolve(projectRoot, fixture.file);
      const fixtureSha256 = createHash("sha256").update(await readFile(fixturePath)).digest("hex");
      const runs = [];
      let attempt = 0;
      while (runs.filter((item) => item.valid).length < options.runs && attempt < options.runs + 3) {
        attempt += 1;
        const run = attempt;
        let page = null;
        try {
          page = await createProductionPage(client, options.productionUrl);
          const fileChooser = await importFixture(client, page.sessionId, fixturePath, fixture);
          const navigation = await enterImportedCompositionTarget(client, page.sessionId, fixture);
          const targetSelection = await selectTimelineTarget(client, page.sessionId, fixture);
          await applyPilotSetup(client, page.sessionId, fixture, scenario.mode, scenario.glow);
          const initialState = await readPilotState(client, page.sessionId, fixture);
          const viewportComparison = compareFrozenViewport(initialState.viewport);
          const transform = initialState.target.transformFields;
          const expected = fixture.target.initialTransform;
          const identityValid = fixtureSha256 === fixture.sha256
            && fixture.import.fileIndex === 0
            && navigation.entry?.disabled === false
            && initialState.target.breadcrumb?.title === targetSelection.expectedBreadcrumb
            && initialState.target.selectionLabel === targetSelection.expectedSelectionLabel
            && initialState.target.positionHandleCount === 1
            && JSON.stringify(transform) === JSON.stringify({
              anchor: expected.anchor, position: expected.position, scale: expected.scale,
              rotation: expected.rotation, opacity: expected.opacity,
            });
          const frame = await readTimelineFrame(client, page.sessionId);
          const setupValid = viewportComparison.matches
            && identityValid
            && initialState.setup.quality === "medium"
            && initialState.setup.rendererPath === scenario.mode
            && initialState.setup.glow === String(scenario.glow === "on")
            && initialState.setup.zoomText === `${Math.round(fixture.viewport.previewZoom * 100)}%`
            && frame === 0;
          if (!setupValid) throw new Error(`run setup invalid: ${JSON.stringify({ viewportComparison, identityValid, setup: initialState.setup, frame })}`);
          const captured = cpuWh
            ? await runWhCpuProfileCapture({ client, page, scenario, fixture, initialState, traceDirectory, run })
            : cpuProfile
              ? await runCpuProfileCapture({ client, page, scenario, fixture, initialState, traceDirectory, run })
              : whScale || whResidual
                ? await runWhScaleCapture({
                    client,
                    page,
                    scenario,
                    fixture,
                    initialState,
                    traceDirectory,
                    run,
                    residualAttribution: whResidual,
                    recordRenderSurfaceIdentity: candidate2After,
                  })
                : await runScenarioCapture({
                client, page, scenario, fixture, initialState, traceDirectory, run, highFrequency,
                recordRenderSurfaceIdentity: candidate2After,
              });
          runs.push({
            ...captured,
            setupEvidence: {
              fileChooser, navigation, targetSelection, identityValid, viewportMatches: true, frame,
              fixtureSha256, importFileIndex: fixture.import.fileIndex, target: fixture.target,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          runs.push({ run, valid: false, invalidReasons: [message] });
          process.stderr.write(`[matrix-invalid] ${scenario.id} attempt ${run}: ${message}\n`);
        } finally {
          if (page?.targetId) await client.send("Target.closeTarget", { targetId: page.targetId }).catch(() => {});
        }
      }
      const validRuns = runs.filter((run) => run.valid);
      const metricStats = !cpuProfile && validRuns.length === options.runs ? {
        wallCaptureDurationMs: statistics(validRuns.map((run) => run.wallCaptureDurationMs)),
        runTaskDurationMs: statistics(validRuns.map((run) => run.trace.runTaskDurationMs)),
        scriptingDurationMs: statistics(validRuns.map((run) => run.trace.scriptingDurationMs)),
        layoutDurationMs: statistics(validRuns.map((run) => run.trace.layoutDurationMs)),
        paintDurationMs: statistics(validRuns.map((run) => run.trace.paintDurationMs)),
        compositeDurationMs: statistics(validRuns.map((run) => run.trace.compositeDurationMs)),
        gcDurationMs: statistics(validRuns.map((run) => run.trace.gcDurationMs)),
        p95PresentedFrameIntervalMs: statistics(validRuns.map((run) => run.trace.p95PresentedFrameIntervalMs)),
        presentedFrameCount: statistics(validRuns.map((run) => run.trace.presentedFrameCount)),
        rawPointerEventCount: statistics(validRuns.map((run) => run.rawPointerEventCount)),
        msPerRawPointerEvent: statistics(validRuns.map((run) => run.msPerRawPointerEvent)),
        ...(highFrequency || whScale || whResidual ? {
          actualDurationMs: statistics(validRuns.map((run) => run.highFrequencyReplay.actualDurationMs)),
          maxScheduleDriftMs: statistics(validRuns.map((run) => run.highFrequencyReplay.maxScheduleDriftMs)),
          medianScheduleDriftMs: statistics(validRuns.map((run) => run.highFrequencyReplay.medianScheduleDriftMs)),
        } : {}),
      } : null;
      result.scenarioResults[scenario.id] = {
        status: validRuns.length === options.runs ? `complete-${options.runs}-of-${options.runs}` : `incomplete-${validRuns.length}-of-${options.runs}`,
        family: scenario.family, fixture: scenario.fixture, mode: scenario.mode, glow: scenario.glow,
        captureWindow: scenario.captureWindow, rawRuns: runs, statistics: metricStats,
        cadence: highFrequency || whScale || whResidual ? {
          scheduler: "absolute monotonic deadline",
          sampleCount: 100,
          intervalMs: 10,
          intendedDurationMs: 1_000,
        } : null,
        excludedFromTimingStatistics: cpuProfile,
        runtimeMetrics: null, acceptedDraftCount: null,
      };
      result.captureMatrix.push({ scenarioId: scenario.id, validRuns: validRuns.length, requiredRuns: options.runs });
      process.stderr.write(`[matrix] ${scenario.id}: ${validRuns.length}/${options.runs}\n`);
    }
  } finally {
    client.close();
  }
  result.valid = result.captureMatrix.every((item) => item.validRuns === item.requiredRuns);
  const serializedResult = `${JSON.stringify(result, null, 2)}\n`;
  if (options.resultFile) {
    await writeFile(options.resultFile, serializedResult);
    process.stderr.write(`[result] ${options.resultFile}\n`);
  } else {
    process.stdout.write(serializedResult);
  }
  if (!result.valid) process.exitCode = 2;
}

async function capturePointerPilot({ client, sessionId, frameId, traceDirectory, run, initialState }) {
  const handleRect = initialState.target.positionHandleRect;
  if (!handleRect || handleRect.width <= 0 || handleRect.height <= 0) {
    return {
      run,
      valid: false,
      invalidReasons: ["position handle DOMRect is unavailable"],
      dispatchCount: 0,
      acceptedDraftCount: null,
      rawTracePath: null,
    };
  }
  const hitTest = await findVerifiedPositionRingPoint(client, sessionId);
  const start = { x: hitTest.selected.x, y: hitTest.selected.y };
  const activation = { x: start.x + 4, y: start.y };
  const end = { x: activation.x + 8, y: activation.y };
  const traceEvents = [];
  const unsubscribeData = client.on("Tracing.dataCollected", (message) => {
    traceEvents.push(...(message.params?.value ?? []));
  });
  const tracingComplete = client.waitForEvent("Tracing.tracingComplete", {
    timeoutMs: 30_000,
  });
  const wallStartedAt = performance.now();
  let dispatchCount = 0;
  let dispatchCompleted = false;
  let traceEnded = false;
  let traceError = null;
  let postMouseDownEvidence = null;
  let activeEvidence = null;

  try {
    await client.send("Tracing.start", {
      categories: "devtools.timeline,toplevel,blink.user_timing,disabled-by-default-devtools.timeline.frame",
      options: "sampling-frequency=10000",
      transferMode: "ReportEvents",
    });
    const dispatch = async (params) => {
      await client.send("Input.dispatchMouseEvent", params, sessionId);
      dispatchCount += 1;
    };
    await dispatch({ type: "mouseMoved", x: start.x, y: start.y, button: "none" });
    await dispatch({ type: "mousePressed", x: start.x, y: start.y, button: "left", buttons: 1, clickCount: 1 });
    postMouseDownEvidence = await readPositionDragActiveEvidence(client, sessionId, start);
    await dispatch({ type: "mouseMoved", x: activation.x, y: activation.y, button: "left", buttons: 1 });
    try {
      await waitForCondition(
        client,
        sessionId,
        `getComputedStyle(document.querySelector('button[aria-label="위치 이동"]')).cursor === "grabbing"`,
        "position drag active evidence",
        2_000
      );
    } finally {
      activeEvidence = await readPositionDragActiveEvidence(client, sessionId, activation);
    }
    await dispatch({ type: "mouseMoved", x: end.x, y: end.y, button: "left", buttons: 1 });
    await waitForTwoAnimationFrames(client, sessionId);
    await waitForCondition(
      client,
      sessionId,
      `(() => {
        const rect = document.querySelector('button[aria-label="위치 이동"]')?.getBoundingClientRect();
        return Boolean(rect && rect.x > ${JSON.stringify(handleRect.x + 0.5)});
      })()`,
      "position Draft movement",
      2_000
    );
    await dispatch({ type: "mouseReleased", x: end.x, y: end.y, button: "left", buttons: 0, clickCount: 1 });
    dispatchCompleted = true;
  } catch (error) {
    traceError = error instanceof Error ? error.message : String(error);
  } finally {
    try {
      await client.send("Tracing.end");
      await tracingComplete;
      traceEnded = true;
    } catch (error) {
      traceError ??= error instanceof Error ? error.message : String(error);
    }
    unsubscribeData();
  }
  const wallCaptureDurationMs = performance.now() - wallStartedAt;
  const rawTracePath = join(traceDirectory, `D-seed-flat-off-fast-run-${run}.json`);
  await writeFile(rawTracePath, JSON.stringify({
    metadata: {
      scenarioId: CDP_DRIVER_METADATA.pilotScenarioId,
      run,
      dispatchCount,
      dispatchCompleted,
      wallCaptureDurationMs,
    },
    traceEvents,
  }));

  const afterDrag = await readPilotState(client, sessionId, PROFILING_FIXTURES.flat);
  await client.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    modifiers: 4,
    key: "z",
    code: "KeyZ",
    windowsVirtualKeyCode: 90,
    nativeVirtualKeyCode: 6,
  }, sessionId);
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    modifiers: 4,
    key: "z",
    code: "KeyZ",
    windowsVirtualKeyCode: 90,
    nativeVirtualKeyCode: 6,
  }, sessionId);
  await delay(100);
  const afterUndo = await readPilotState(client, sessionId, PROFILING_FIXTURES.flat);
  const undoDelta = afterUndo.target.positionHandleRect && initialState.target.positionHandleRect
    ? {
        x: afterUndo.target.positionHandleRect.x - initialState.target.positionHandleRect.x,
        y: afterUndo.target.positionHandleRect.y - initialState.target.positionHandleRect.y,
      }
    : null;
  const dragDelta = afterDrag.target.positionHandleRect && initialState.target.positionHandleRect
    ? {
        x: afterDrag.target.positionHandleRect.x - initialState.target.positionHandleRect.x,
        y: afterDrag.target.positionHandleRect.y - initialState.target.positionHandleRect.y,
      }
    : null;
  const positionFieldDelta = afterDrag.target.positionFields && initialState.target.positionFields
    ? {
        x: afterDrag.target.positionFields.x - initialState.target.positionFields.x,
        y: afterDrag.target.positionFields.y - initialState.target.positionFields.y,
      }
    : null;
  const undoPositionFieldDelta = afterUndo.target.positionFields && initialState.target.positionFields
    ? {
        x: afterUndo.target.positionFields.x - initialState.target.positionFields.x,
        y: afterUndo.target.positionFields.y - initialState.target.positionFields.y,
      }
    : null;
  const invalidReasons = [];
  if (!dispatchCompleted || dispatchCount !== 5) invalidReasons.push(`dispatch sequence incomplete: ${dispatchCount}/5`);
  if (!traceEnded || traceEvents.length === 0) invalidReasons.push("trace did not complete with events");
  if (traceError) invalidReasons.push(`trace/input error: ${traceError}`);
  if (activeEvidence?.computedCursorKind !== "grabbing") {
    invalidReasons.push(`position drag active evidence missing: ${JSON.stringify(activeEvidence)}`);
  }
  if (!dragDelta || (Math.abs(dragDelta.x) < 0.5 && Math.abs(dragDelta.y) < 0.5)) {
    invalidReasons.push(`no observable handle movement after pointer dispatch: ${JSON.stringify(dragDelta)}`);
  }
  if (!positionFieldDelta || dragDelta?.x <= 0 || positionFieldDelta.x <= 0
    || Math.abs(dragDelta.y) > 0.5 || Math.abs(positionFieldDelta.y) > 0.5) {
    invalidReasons.push(`Position fields/ring did not move in the same +x direction: fields=${JSON.stringify(positionFieldDelta)} ring=${JSON.stringify(dragDelta)}`);
  }
  if (!undoDelta || Math.abs(undoDelta.x) > 0.5 || Math.abs(undoDelta.y) > 0.5) {
    invalidReasons.push(`undo did not restore handle DOMRect: ${JSON.stringify(undoDelta)}`);
  }
  if (!undoPositionFieldDelta || Math.abs(undoPositionFieldDelta.x) > 0.001 || Math.abs(undoPositionFieldDelta.y) > 0.001) {
    invalidReasons.push(`undo did not restore Position fields: ${JSON.stringify(undoPositionFieldDelta)}`);
  }
  return {
    run,
    valid: invalidReasons.length === 0,
    blockedAt: hitTest.selected.matchesPositionButton && activeEvidence?.computedCursorKind !== "grabbing"
      ? "post-mousedown-position-drag-active-evidence"
      : null,
    invalidReasons,
    pointerPathCss: { start, activation, end, draftDelta: { x: 8, y: 0 } },
    hitTest,
    postMouseDownEvidence,
    activeEvidence,
    dispatchCount,
    acceptedDraftCount: null,
    wallCaptureDurationMs,
    beforeHandleRect: initialState.target.positionHandleRect,
    afterDragHandleRect: afterDrag.target.positionHandleRect,
    afterUndoHandleRect: afterUndo.target.positionHandleRect,
    dragDelta,
    positionFieldDelta,
    undoDelta,
    undoPositionFieldDelta,
    rawTracePath,
    trace: summarizeTrace(traceEvents, frameId),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.matrix) {
    await runFlatMatrix(options, options.matrix === true ? "flat" : options.matrix);
    return;
  }
  const fixture = PROFILING_FIXTURES[options.fixtureId];
  const pilotScenario = PROFILING_SCENARIOS.find(
    (scenario) => scenario.id === CDP_DRIVER_METADATA.pilotScenarioId
  );
  if (!pilotScenario) throw new Error("Pilot scenario is missing from the manifest");
  const fixturePath = resolve(projectRoot, fixture.file);
  const fixtureSha256 = createHash("sha256").update(await readFile(fixturePath)).digest("hex");
  const traceDirectory = options.traceDirectory
    ?? await mkdtemp(join(tmpdir(), "shortform-cdp-pilot-"));
  await mkdir(traceDirectory, { recursive: true });

  const version = await fetchJson(`${options.cdpHttp}/json/version`);
  const client = await CdpClient.connect(version.webSocketDebuggerUrl);
  let targetId = null;
  const result = {
    schemaVersion: 1,
    metadata: CDP_DRIVER_METADATA,
    environment: {
      cdpHttp: options.cdpHttp,
      browser: version.Browser,
      protocolVersion: version["Protocol-Version"],
      productionUrl: options.productionUrl,
      targetId: null,
      traceDirectory,
    },
    importPilot: null,
    pointerPilot: {
      requestedRuns: options.runs,
      runs: [],
      repeatable: false,
    },
    valid: false,
    invalidReasons: [],
  };

  try {
    const page = await createProductionPage(client, options.productionUrl);
    targetId = page.targetId;
    result.environment.targetId = targetId;
    const fileChooser = await importFixture(client, page.sessionId, fixturePath, fixture);
    const compositionNavigation = await enterImportedCompositionTarget(
      client,
      page.sessionId,
      fixture
    );
    const targetSelection = await selectTimelineTarget(
      client,
      page.sessionId,
      fixture
    );
    await applyPilotSetup(client, page.sessionId, fixture);
    const initialState = await readPilotState(client, page.sessionId, fixture);
    const viewportComparison = compareFrozenViewport(initialState.viewport);
    const expectedInitialTransform = fixture.target.initialTransform;
    const observedInitialTransform = initialState.target.transformFields;
    const numericMatch = (actual, expected) => Number.isFinite(actual)
      && Math.abs(actual - expected) <= 0.01;
    const initialTransformFieldsMatch = Boolean(observedInitialTransform
      && observedInitialTransform.position
      && observedInitialTransform.anchor
      && observedInitialTransform.scale
      && numericMatch(observedInitialTransform.position.x, expectedInitialTransform.position.x)
      && numericMatch(observedInitialTransform.position.y, expectedInitialTransform.position.y)
      && numericMatch(observedInitialTransform.anchor.x, expectedInitialTransform.anchor.x)
      && numericMatch(observedInitialTransform.anchor.y, expectedInitialTransform.anchor.y)
      && numericMatch(observedInitialTransform.scale.x, expectedInitialTransform.scale.x)
      && numericMatch(observedInitialTransform.scale.y, expectedInitialTransform.scale.y)
      && numericMatch(observedInitialTransform.rotation, expectedInitialTransform.rotation)
      && numericMatch(observedInitialTransform.opacity, expectedInitialTransform.opacity));
    const expectedBreadcrumb = targetSelection.expectedBreadcrumb;
    const breadcrumbMatches = initialState.target.breadcrumb?.title === expectedBreadcrumb;
    const selectionLabelMatches =
      initialState.target.selectionLabel ===
      targetSelection.expectedSelectionLabel;
    const targetIdentityEvidence = {
      freshEmptyProject: true,
      fixtureSha256,
      fixtureSha256MatchesManifest: fixtureSha256 === fixture.sha256,
      importIndex: fixture.import.fileIndex,
      identityContractVerifiedBy: "verifyLayerDocumentRenderObservationBaseline.ts",
      expectedIdentity: fixture.target.identity,
      observedLayerDocumentId:
        initialState.target.observedLayerDocumentId,
      observedSourceId:
        initialState.target.observedSourceId,
      observedTimelineLayerDocumentId:
        initialState.target.observedTimelineLayerDocumentId,
      layerDocumentIdentityMatches:
        initialState.target.observedLayerDocumentId?.startsWith(
          fixture.target.identity.layerDocumentIdPrefix
        ) === true,
      sourceIdentityMatches:
        initialState.target.observedSourceId?.startsWith(
          fixture.target.identity.sourceIdPrefix
        ) === true,
      timelineAndCanvasLayerIdentityMatch:
        initialState.target.observedTimelineLayerDocumentId ===
        initialState.target.observedLayerDocumentId,
      compositionNavigation,
      targetSelection,
      expectedBreadcrumb,
      observedBreadcrumb: initialState.target.breadcrumb,
      breadcrumbMatches,
      selectionLabelMatches,
      singleSelectedPositionTarget: initialState.target.positionHandleCount === 1,
      expectedInitialTransform,
      observedInitialTransform,
      initialTransformFieldsMatch,
    };
    const targetIdentityVerified = targetIdentityEvidence.freshEmptyProject
      && targetIdentityEvidence.fixtureSha256MatchesManifest
      && targetIdentityEvidence.importIndex === 0
      && targetIdentityEvidence.layerDocumentIdentityMatches
      && targetIdentityEvidence.sourceIdentityMatches
      && targetIdentityEvidence.timelineAndCanvasLayerIdentityMatch
      && targetIdentityEvidence.compositionNavigation.entry?.disabled === false
      && targetIdentityEvidence.breadcrumbMatches
      && targetIdentityEvidence.selectionLabelMatches
      && targetIdentityEvidence.singleSelectedPositionTarget
      && targetIdentityEvidence.initialTransformFieldsMatch;
    result.importPilot = {
      success: initialState.fixtureCardPresent && Boolean(initialState.target.positionHandleRect),
      fixture: {
        id: fixture.id,
        file: fixture.file,
        path: fixturePath,
        sha256: fixture.sha256,
      },
      fileChooser,
      compositionNavigation,
      expectedTarget: fixture.target,
      observed: initialState,
      viewportComparison,
      targetIdentityVerified,
      targetIdentityEvidence,
    };

    if (targetIdentityVerified) {
      for (let run = 1; run <= options.runs; run += 1) {
        const runState = await readPilotState(client, page.sessionId, fixture);
        const runResult = await capturePointerPilot({
          client,
          sessionId: page.sessionId,
          frameId: page.frameId,
          traceDirectory,
          run,
          initialState: runState,
        });
        result.pointerPilot.runs.push(runResult);
        if (runResult.blockedAt) break;
      }
    }
    result.pointerPilot.repeatable = result.pointerPilot.runs.length === options.runs
      && result.pointerPilot.runs.every((run) => run.dispatchCount === 5 && run.rawTracePath);
    result.pointerPilot.dispatchAndTraceRepeatable = result.pointerPilot.repeatable;
    result.pointerPilot.validRunCount = result.pointerPilot.runs.filter((run) => run.valid).length;
    if (!result.importPilot.success) result.invalidReasons.push("fixture import/position target evidence is incomplete");
    if (!result.importPilot.targetIdentityVerified) {
      result.invalidReasons.push("composite manifest target identity evidence did not match the single selected target/initial Transform fields");
    }
    if (!viewportComparison.matches) {
      result.invalidReasons.push(...viewportComparison.differences.map(
        (difference) => `frozen viewport mismatch: ${difference}`
      ));
    }
    if (!result.pointerPilot.repeatable) result.invalidReasons.push("three-run pointer/trace repeatability failed");
    for (const run of result.pointerPilot.runs) {
      result.invalidReasons.push(...run.invalidReasons.map((reason) => `run ${run.run}: ${reason}`));
    }
    result.valid = result.invalidReasons.length === 0;
  } finally {
    if (targetId && !options.keepPage) {
      await client.send("Target.closeTarget", { targetId }).catch(() => {});
    }
    client.close();
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.pointerPilot.repeatable || !result.importPilot?.success) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    valid: false,
    stage: "driver-fatal",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2)}\n`);
  process.exitCode = 1;
});

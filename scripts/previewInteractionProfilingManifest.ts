export type ProfilingRendererMode = "fast-render" | "full-render";
export type ProfilingLane = "browser-performance-production" | "react-profiler-dev";
export type ProfilingScenarioFamily =
  | "P"
  | "I"
  | "S"
  | "D-seed"
  | "D-steady"
  | "D-commit"
  | "D-wh-scale";

export type ProfilingTransform = {
  readonly position: { readonly x: number; readonly y: number };
  readonly transformOffset: { readonly x: number; readonly y: number };
  readonly anchor: { readonly x: number; readonly y: number };
  readonly scale: { readonly x: number; readonly y: number };
  readonly rotation: number;
  readonly opacity: number;
};

export type ProfilingFixtureProfile = {
  readonly id: "flat" | "nested" | "glow";
  readonly file: "drag_test.psd" | "layer_test.psd";
  readonly sha256: string;
  readonly byteLength: number;
  readonly documentSize: { readonly width: number; readonly height: number };
  readonly import: {
    readonly projectState: "fresh-empty-project";
    readonly fileIndex: 0;
    readonly layerDocumentIdPrefix: "layer-document:";
    readonly compositionName: string;
  };
  readonly target: {
    readonly kind: "layer" | "subComp";
    readonly name: string;
    readonly identity: {
      readonly layerDocumentIdPrefix: "layer-document:";
      readonly sourceIdPrefix: "psd-source:";
    };
    readonly frame: 0;
    readonly startFrame: 0;
    readonly durationFrames: 150;
    readonly logicalSize: { readonly width: number; readonly height: number };
    readonly initialTransform: ProfilingTransform;
    readonly handle: "position";
  };
  readonly viewport: {
    readonly browserZoomPercent: 100;
    readonly previewZoom: number;
    readonly previewPan: { readonly x: number; readonly y: number };
    readonly setup: readonly string[];
  };
  readonly previewQuality: "medium";
};

export const PROFILING_FIXTURES = {
  flat: {
    id: "flat",
    file: "drag_test.psd",
    sha256: "fe2136123843db826f5c3da01ab77230899355c3eace7c1df30afafc2546f00b",
    byteLength: 444_532,
    documentSize: { width: 1080, height: 1920 },
    import: {
      projectState: "fresh-empty-project",
      fileIndex: 0,
      layerDocumentIdPrefix: "layer-document:",
      compositionName: "drag_test",
    },
    target: {
      kind: "layer",
      name: "drag_test",
      identity: {
        layerDocumentIdPrefix: "layer-document:",
        sourceIdPrefix: "psd-source:",
      },
      frame: 0,
      startFrame: 0,
      durationFrames: 150,
      logicalSize: { width: 337, height: 320 },
      initialTransform: {
        position: { x: 534.5, y: 939 },
        transformOffset: { x: 0, y: 0 },
        anchor: { x: 168.5, y: 160 },
        scale: { x: 100, y: 100 },
        rotation: 0,
        opacity: 100,
      },
      handle: "position",
    },
    viewport: {
      browserZoomPercent: 100,
      previewZoom: 1,
      previewPan: { x: 0, y: 0 },
      setup: ["click 1:1", "click center", "verify zoom label is 100%"],
    },
    previewQuality: "medium",
  },
  nested: {
    id: "nested",
    file: "layer_test.psd",
    sha256: "4dc983360076ac8d41f09a3e31b7b289455f6df21f2fcbcbfc7e36a972562f5e",
    byteLength: 42_886_163,
    documentSize: { width: 4000, height: 4000 },
    import: {
      projectState: "fresh-empty-project",
      fileIndex: 0,
      layerDocumentIdPrefix: "layer-document:",
      compositionName: "layer_test",
    },
    target: {
      kind: "subComp",
      name: "아빠",
      identity: {
        layerDocumentIdPrefix: "layer-document:",
        sourceIdPrefix: "psd-source:",
      },
      frame: 0,
      startFrame: 0,
      durationFrames: 150,
      logicalSize: { width: 4000, height: 4000 },
      initialTransform: {
        position: { x: 2000, y: 2000 },
        transformOffset: { x: 0, y: 0 },
        anchor: { x: 2000, y: 2000 },
        scale: { x: 100, y: 100 },
        rotation: 0,
        opacity: 100,
      },
      handle: "position",
    },
    viewport: {
      browserZoomPercent: 100,
      previewZoom: 0.2,
      previewPan: { x: 1600, y: 1600 },
      setup: [
        "click 1:1",
        "wheel out at viewport center until the clamped zoom label is 20%",
        "click center",
        "verify the selected Sub Composition bounds and radial handles are visible",
      ],
    },
    previewQuality: "medium",
  },
  glow: {
    id: "glow",
    file: "layer_test.psd",
    sha256: "4dc983360076ac8d41f09a3e31b7b289455f6df21f2fcbcbfc7e36a972562f5e",
    byteLength: 42_886_163,
    documentSize: { width: 4000, height: 4000 },
    import: {
      projectState: "fresh-empty-project",
      fileIndex: 0,
      layerDocumentIdPrefix: "layer-document:",
      compositionName: "layer_test",
    },
    target: {
      kind: "layer",
      name: "같이자요...",
      identity: {
        layerDocumentIdPrefix: "layer-document:",
        sourceIdPrefix: "psd-source:",
      },
      frame: 0,
      startFrame: 0,
      durationFrames: 150,
      logicalSize: { width: 714, height: 697 },
      initialTransform: {
        position: { x: 2691, y: 2601.5 },
        transformOffset: { x: 0, y: 0 },
        anchor: { x: 357, y: 348.5 },
        scale: { x: 100, y: 100 },
        rotation: 0,
        opacity: 100,
      },
      handle: "position",
    },
    viewport: {
      browserZoomPercent: 100,
      previewZoom: 0.2,
      previewPan: { x: 1600, y: 1600 },
      setup: [
        "click 1:1",
        "wheel out at viewport center until the clamped zoom label is 20%",
        "click center",
        "verify the selected Layer and silhouette glow are visible",
      ],
    },
    previewQuality: "medium",
  },
} as const satisfies Readonly<Record<string, ProfilingFixtureProfile>>;

export type ProfilingScenario = {
  readonly id: string;
  readonly family: ProfilingScenarioFamily;
  readonly fixture: keyof typeof PROFILING_FIXTURES;
  readonly mode: ProfilingRendererMode;
  readonly glow: "off" | "on";
  readonly captureWindow: string;
  readonly expectedCanvasPath: string;
};

function forModes(
  idPrefix: string,
  input: Omit<ProfilingScenario, "id" | "mode">
): ProfilingScenario[] {
  return (["fast-render", "full-render"] as const).map((mode) => ({
    ...input,
    id: `${idPrefix}-${mode === "fast-render" ? "fast" : "full"}`,
    mode,
  }));
}

export const PROFILING_SCENARIOS: readonly ProfilingScenario[] = [
  ...forModes("P-flat-off", {
    family: "P",
    fixture: "flat",
    glow: "off",
    captureWindow:
      "after an untimed frame 0-29 playback warm-up, record playback from frame 30 until frame 119 or actual 3 seconds, and record the actual terminal frame",
    expectedCanvasPath: "fast=PreviewScene dirty/skip path; full=RenderFrame full canvas path",
  }),
  ...forModes("I-flat-off", {
    family: "I",
    fixture: "flat",
    glow: "off",
    captureWindow: "record exactly 3 seconds at frame 0 with no input",
    expectedCanvasPath: "no repeated renderer work after the settled initial draw",
  }),
  ...forModes("S-flat-off", {
    family: "S",
    fixture: "flat",
    glow: "off",
    captureWindow:
      "record ten alternating frame changes 0→75→0→75→0→75→0→75→0→75 at a nominal 250 ms cadence; retain actual event timestamps",
    expectedCanvasPath: "selected renderer mode path for every seek",
  }),
  ...forModes("D-seed-flat-off", {
    family: "D-seed",
    fixture: "flat",
    glow: "off",
    captureWindow:
      "start before pointer down, move the selected pixel 8 CSS px right once, hold for two presented frames, stop capture before cancel",
    expectedCanvasPath: "both modes use Preview Draft; full may lazily build the first PreviewScene seed",
  }),
  ...forModes("D-steady-flat-off", {
    family: "D-steady",
    fixture: "flat",
    glow: "off",
    captureWindow:
      "outside capture create one 8 CSS px seed and wait two presented frames; then record a straight +120 x/+80 y CSS px path over nominal 1000 ms and stop before pointer up",
    expectedCanvasPath: "both modes use PreviewScene and bypass Composition Cache",
  }),
  ...forModes("D-commit-flat-off", {
    family: "D-commit",
    fixture: "flat",
    glow: "off",
    captureWindow:
      "outside capture create the same steady drag while holding the pointer; start capture immediately before pointer up and record 500 ms after pointer up",
    expectedCanvasPath: "final flush then Project/History once, followed by the selected mode path",
  }),
  ...forModes("D-steady-nested-off", {
    family: "D-steady",
    fixture: "nested",
    glow: "off",
    captureWindow:
      "outside capture create one 4 CSS px seed and wait two presented frames; then record a straight +60 x/+40 y CSS px path over nominal 1000 ms and stop before pointer up",
    expectedCanvasPath: "both modes use PreviewScene; current contract bypasses Composition Cache during Draft",
  }),
  ...forModes("D-steady-glow-on", {
    family: "D-steady",
    fixture: "glow",
    glow: "on",
    captureWindow:
      "outside capture create one 4 CSS px seed and wait two presented frames; then record a straight +60 x/+40 y CSS px path over nominal 1000 ms and stop before pointer up",
    expectedCanvasPath: "both modes use PreviewScene while the Glow overlay draws each accepted Draft",
  }),
  ...forModes("D-steady-glow-off", {
    family: "D-steady",
    fixture: "glow",
    glow: "off",
    captureWindow:
      "outside capture create one 4 CSS px seed and wait two presented frames; then record a straight +60 x/+40 y CSS px path over nominal 1000 ms and stop before pointer up",
    expectedCanvasPath: "matched Glow target/control path using PreviewScene with the Glow overlay disabled",
  }),
  ...forModes("D-wh-scale-flat-off", {
    family: "D-wh-scale",
    fixture: "flat",
    glow: "off",
    captureWindow:
      "outside capture press the verified WH linked-scale handle, move 4 CSS px radially outward from the Position-ring center and wait two presented frames; then record 100 absolute-deadline radial mousemoves over 1000 ms and stop before pointer up",
    expectedCanvasPath: "linked X/Y Scale Draft through PreviewScene; commit after capture and Undo exact 100/100",
  }),
  {
    id: "D-wh-scale-nested-off-fast",
    family: "D-wh-scale",
    fixture: "nested",
    mode: "fast-render",
    glow: "off",
    captureWindow:
      "outside capture seed the verified WH linked-scale handle 4 CSS px radially outward and wait two frames; record 100 absolute-deadline moves over 1000 ms before commit and Undo",
    expectedCanvasPath: "nested linked X/Y Scale Draft through PreviewScene",
  },
  {
    id: "D-wh-scale-glow-off-fast",
    family: "D-wh-scale",
    fixture: "glow",
    mode: "fast-render",
    glow: "off",
    captureWindow:
      "outside capture seed the verified WH linked-scale handle 4 CSS px radially outward and wait two frames; record 100 absolute-deadline moves over 1000 ms before commit and Undo",
    expectedCanvasPath: "Glow target linked Scale control with overlay disabled",
  },
  {
    id: "D-wh-scale-glow-on-fast",
    family: "D-wh-scale",
    fixture: "glow",
    mode: "fast-render",
    glow: "on",
    captureWindow:
      "outside capture seed the verified WH linked-scale handle 4 CSS px radially outward and wait two frames; record 100 absolute-deadline moves over 1000 ms before commit and Undo",
    expectedCanvasPath: "Glow target linked Scale path with overlay enabled",
  },
];

export const PROFILING_ENVIRONMENT_FREEZE = {
  status:
    "frozen-from-first-valid-layer-document-production-headless-pilot",
  sourceScenarioId: "D-seed-flat-off-fast",
  sourceLane: "browser-performance-production",
  captureMethod: "headless-chromium-cdp",
  captureDriver: "scripts/previewInteractionProfilingCdpDriver.mjs",
  browser: "HeadlessChrome/149.0.7827.55",
  protocolVersion: "1.3",
  productionUrl: "http://127.0.0.1:4174/",
  productionCommand:
    "npm run build && npm run preview -- --host 127.0.0.1 --port 4174 --strictPort",
  validityPrerequisites: [
    "create a fresh headless Chromium target for the exact production root URL through CDP",
    "import drag_test.psd into a fresh empty project and reach the frozen flat target at frame 0",
    "set medium Preview quality, fast-render, glow off, browser zoom 100%, and finish the declared Preview viewport setup",
    "use no CPU or network throttling and capture only the dedicated app target",
  ],
  measurementProcedure: [
    "use Runtime.evaluate through the headless Chromium CDP driver only after every validity prerequisite passes",
    "read window.innerWidth, window.innerHeight, window.outerWidth, window.outerHeight and window.devicePixelRatio",
    "read the Preview viewport DOMRect from document.querySelector('canvas')?.parentElement?.parentElement?.getBoundingClientRect()",
    "record that no visible browser or docked DevTools participates in the headless capture",
    "freeze the measured values in the baseline artifact; every later run must match them before capture",
  ],
  frozenValues: {
    capturedAtUtc: "2026-07-25T21:33:09Z",
    devToolsDocking: "not-applicable-headless-cdp",
    windowInnerCss: { width: 1792, height: 1012 },
    windowOuterCss: { width: 1792, height: 1012 },
    devicePixelRatio: 2,
    previewViewportDomRectCss: {
      x: 286,
      y: 42,
      width: 1180,
      height: 684,
    },
  },
} as const;

export const PROFILING_LANES: Readonly<Record<ProfilingLane, {
  readonly availability: "available" | "deferred-unavailable";
  readonly baselineRankingEligible: boolean;
  readonly command: string;
  readonly purpose: string;
  readonly requiredEnvironmentFields: readonly string[];
  readonly rules: readonly string[];
}>> = {
  "browser-performance-production": {
    availability: "available",
    baselineRankingEligible: true,
    command:
      "npm run build && npm run preview -- --host 127.0.0.1 --port 4174 --strictPort",
    purpose: "production Browser Performance main-thread, paint/composite and frame timing",
    requiredEnvironmentFields: [
      "UTC timestamp and local timezone",
      "git HEAD and git diff hash/status",
      "Node/npm/Vite version and production asset hash",
      "OS version/build, headless Chromium name/version and CDP protocol version",
      "CPU model/core count, physical memory and GPU",
      "power source, low-power mode and thermal state",
      "display refresh rate, display scaling and devicePixelRatio",
      "outer/inner viewport CSS size, browser zoom and Preview viewport DOMRect",
      "CPU/network throttling, extensions and background-tab state",
      "fixture hash, scenario ID, selected target, frame, quality, mode, glow, zoom and pan",
      "trace start/end timestamps and actual playback/pointer event counts",
    ],
    rules: [
      "use a fresh dedicated headless Chromium target with no unrelated capture targets",
      "freeze viewport and Preview DOMRect from the first valid production pilot rather than a repository literal",
      "use no CPU or network throttling unless the recorded environment deliberately fixes it",
      "run Browser Performance separately from React Profiler",
      "do not compare its absolute times with the dev React lane",
    ],
  },
  "react-profiler-dev": {
    availability: "deferred-unavailable",
    baselineRankingEligible: false,
    command: "npm run dev",
    purpose: "React commit scope, ranked components and changed props",
    requiredEnvironmentFields: [
      "all common machine/browser/viewport/fixture scenario fields from the production lane",
      "React and React DevTools version",
      "development build URL and Vite version",
      "StrictMode enabled=true from src/main.tsx",
      "Profiler settings and whether screenshots/why-rendered data are enabled",
      "root/Preview/Properties commit count, total duration and ranked component duration",
    ],
    rules: [
      "defer this lane while React DevTools Profiler is unavailable; do not install it or add product instrumentation",
      "exclude React candidates from baseline ranking while this lane is deferred",
      "retain StrictMode for every Before/After React capture",
      "run the same scenario ID as a separate capture from Browser Performance",
      "use React time only for dev-lane Before/After and component attribution",
    ],
  },
};

export const PROFILING_RUN_PROTOCOL = {
  independentRuns: 3,
  highFrequencySteady: {
    sampleCount: 100,
    intervalMs: 10,
    intendedDurationMs: 1000,
    scheduler: "absolute monotonic deadline; wait only until each start-relative target timestamp",
    captureBoundary: "seed and two requestAnimationFrame callbacks before capture; pointer up after capture",
    requiredCadenceEvidence: [
      "actual dispatch timestamp array",
      "intended and actual duration",
      "maximum and median schedule drift",
      "trace-identifiable raw pointer event count",
    ],
  },
  whScaleHighFrequency: {
    handleAriaLabel: "WH (비율/전체 크기)",
    handleTitle: "WH (비율/전체 크기)",
    initialLinkedScale: { x: 100, y: 100 },
    radialOrigin: "Position ring center",
    seedDistanceCss: 4,
    captureDistanceCss: 60,
    sampleCount: 100,
    intervalMs: 10,
    intendedDurationMs: 1000,
    firstMoveContract: "the first Draft scale derives from 100/100, never a historical 50% fallback",
    completionContract: "Draft Properties Scale and WH Gizmo readout update together; pointer up commits, then Undo restores exact 100/100 and the initial WH rect",
  },
  resetPerRun: [
    "close the previous app tab and open a fresh app tab from the same server",
    "start from an empty project and import exactly the scenario fixture as file index 0",
    "wait until the explicit medium Preview build is complete, then wait two idle seconds",
    "select the frozen timeline item at frame 0 and apply the frozen viewport setup",
    "set renderer mode and glow exactly as the scenario declares",
    "perform one matching untimed warm-up; cancel or Undo it so the frozen initial Transform is restored",
  ],
  statistics: {
    center: "median of three independent runs",
    spread: "report min/max and MAD (median absolute deviation)",
    browser: [
      "total main-thread ms per capture",
      "scripting/style-layout/paint/composite/GC ms and boundary share",
      "p95 presented-frame interval",
      "ms per actual playback frame for P/S when the terminal frame is known",
      "ms per observed raw pointer event when trace events are identifiable",
      "ms per presented frame and ms per capture for Draft fallback normalization",
    ],
    react: [
      "commit count and total/median commit duration per capture",
      "Preview and Properties subtree duration and ranked component share",
    ],
  },
  doNotPool: [
    "fast-render with full-render",
    "production Browser Performance with dev React Profiler",
    "flat with nested or glow",
    "seed, steady and commit windows",
    "legacy 20-sample/50 ms steady timing with high-frequency 100-sample/10 ms steady timing",
    "timing traces with CPU profiles collected under Profiler sampling overhead",
  ],
} as const;

export const PROFILING_REPLAY_CAPABILITY = {
  deterministicExternalReplayAvailable: true,
  evidence: [
    "package.json has no Playwright, Puppeteer, WebDriver or equivalent browser automation dependency",
    "scripts/previewInteractionProfilingCdpDriver.mjs implements trusted Input.dispatchMouseEvent replay through the dedicated headless Chromium CDP endpoint",
    "the high-frequency steady lane dispatches 100 raw mousemove inputs against absolute monotonic deadlines over 1000 ms",
    "Runtime Metrics are hook-local and have no product UI/export port for browser capture",
  ],
  unavailableCountsWithoutInstrumentation: [
    "exact requestAnimationFrame scheduler flush count",
    "exact accepted semantic Draft count",
    "hook-local Runtime Metrics snapshot",
  ],
  fallback: [
    "freeze pointer start/end, straight path, sample count and intended duration as declared by each replay lane",
    "record intended/actual timestamps and maximum/median deadline drift for high-frequency replay",
    "record actual raw pointer events only when the Browser trace exposes them",
    "never infer RAF or accepted counts from raw events or React commits",
    "normalize Browser data by capture, actual playback frame, observed raw event and presented frame where available",
    "pair Browser results with verifyCanvasTransformDragIntegration.ts for the deterministic 100 raw/10 RAF/10 accepted code contract",
    "leave ms/accepted Draft blank until a separately approved non-product replay/measurement port exists",
  ],
} as const;

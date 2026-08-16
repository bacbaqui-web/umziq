import { combineProjectExportStreams, type ProjectExportAudioMix } from "@/editor/projectExportAudio";

export async function recordProjectVideo(options: {
  readonly output: HTMLCanvasElement;
  readonly mimeType: string;
  readonly frameRate: number;
  readonly totalFrames: number;
  readonly transparent: boolean;
  readonly audioMix: ProjectExportAudioMix | null;
  readonly renderFrame: (frame: number, target: HTMLCanvasElement, transparent: boolean) => void | Promise<void>;
  readonly onProgress: (progress: { completedFrames: number; totalFrames: number }) => void;
  readonly signal?: AbortSignal;
}) {
  const throwIfAborted = () => {
    if (options.signal?.aborted) throw new DOMException("출력이 취소되었습니다.", "AbortError");
  };
  let visualStream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let recorderStopped: Promise<void> | null = null;
  const abort = () => {
    if (recorder?.state === "recording") recorder.stop();
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    throwIfAborted();
    visualStream = options.output.captureStream(options.frameRate);
    const stream = combineProjectExportStreams(visualStream, options.audioMix?.stream ?? null);
    await options.renderFrame(0, options.output, options.transparent);
    throwIfAborted();
    recorder = new MediaRecorder(stream, {
      mimeType: options.mimeType,
      videoBitsPerSecond: 12_000_000,
      ...(options.audioMix ? { audioBitsPerSecond: 256_000 } : {}),
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorderStopped = new Promise<void>((resolve, reject) => {
      recorder!.onstop = () => resolve();
      recorder!.onerror = () => reject(new Error("영상 출력 중 오류가 발생했습니다."));
    });
    recorder.start();
    const readClock = options.audioMix
      ? () => options.audioMix!.context.currentTime
      : () => performance.now() / 1_000;
    const exportStartTime = readClock() + 0.02;
    options.audioMix?.schedule(exportStartTime);
    const waitUntil = async (target: number) => {
      while (readClock() < target) {
        throwIfAborted();
        await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(20, Math.max(1, (target - readClock()) * 1_000))));
      }
    };
    await waitUntil(exportStartTime);
    options.onProgress({ completedFrames: 1, totalFrames: options.totalFrames });
    for (let frame = 1; frame < options.totalFrames; frame += 1) {
      await waitUntil(exportStartTime + frame / options.frameRate);
      await options.renderFrame(frame, options.output, options.transparent);
      options.onProgress({ completedFrames: frame + 1, totalFrames: options.totalFrames });
    }
    await waitUntil(exportStartTime + options.totalFrames / options.frameRate);
    if (recorder.state === "recording") recorder.stop();
    await recorderStopped;
    throwIfAborted();
    return new Blob(chunks, { type: recorder.mimeType || options.mimeType });
  } finally {
    options.signal?.removeEventListener("abort", abort);
    if (recorder?.state === "recording") recorder.stop();
    await recorderStopped?.catch(() => undefined);
    visualStream?.getTracks().forEach((track) => track.stop());
    options.audioMix?.dispose();
  }
}

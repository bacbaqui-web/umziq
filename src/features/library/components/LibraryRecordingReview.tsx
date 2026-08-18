import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  LibraryRecordingEditRequest,
  LibraryViewProps,
} from "@/engines/library";

// At a common 48 kHz input rate this covers about 43 ms, matching the live
// history sampling interval so short peaks are not skipped between frames.
const WAVEFORM_SAMPLES = 2048;
const REVIEW_BAR_WIDTH = 2;

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function drawWaveform(options: {
  canvas: HTMLCanvasElement;
  values: ArrayLike<number>;
  progress: number;
  live: boolean;
  gainDb?: number;
}) {
  const { canvas, values, live } = options;
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(bounds.width * ratio));
  const height = Math.max(1, Math.round(bounds.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const center = height / 2;
  const maximumHalfHeight = height * 0.41;
  const gain = 10 ** ((options.gainDb ?? 0) / 20);
  context.strokeStyle = "rgba(110, 137, 122, 0.24)";
  context.lineWidth = ratio;
  context.beginPath();
  context.moveTo(0, center);
  context.lineTo(width, center);
  context.stroke();
  if (values.length === 0) return;

  const progress = Math.max(0, Math.min(1, options.progress));
  const amplitudeAt = (index: number) => {
    const raw = Math.abs(values[index] ?? 0) * gain;
    return Math.min(1, raw);
  };
  const drawContinuousWave = (color: string, clipWidth?: number) => {
    context.save();
    if (clipWidth !== undefined) {
      context.beginPath();
      context.rect(0, 0, clipWidth, height);
      context.clip();
    }
    context.beginPath();
    for (let index = 0; index < values.length; index += 1) {
      const x = values.length === 1
        ? width / 2
        : (index / (values.length - 1)) * width;
      const halfHeight = Math.max(
        ratio,
        amplitudeAt(index) * maximumHalfHeight
      );
      if (index === 0) context.moveTo(x, center - halfHeight);
      else context.lineTo(x, center - halfHeight);
    }
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const x = values.length === 1
        ? width / 2
        : (index / (values.length - 1)) * width;
      const halfHeight = Math.max(
        ratio,
        amplitudeAt(index) * maximumHalfHeight
      );
      context.lineTo(x, center + halfHeight);
    }
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.restore();
  };
  drawContinuousWave("rgba(92, 201, 139, 0.28)");
  drawContinuousWave("rgba(92, 201, 139, 0.95)", live ? width : width * progress);

  const drawGuide = (decibels: number, color: string, label: string) => {
    const amplitude = 10 ** (decibels / 20);
    const offset = maximumHalfHeight * amplitude;
    context.save();
    context.strokeStyle = color;
    context.lineWidth = ratio;
    context.setLineDash(decibels === 0 ? [] : [5 * ratio, 4 * ratio]);
    for (const y of [center - offset, center + offset]) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.setLineDash([]);
    context.fillStyle = color;
    context.font = `${10 * ratio}px sans-serif`;
    context.fillText(label, 5 * ratio, Math.max(11 * ratio, center - offset - 3 * ratio));
    context.restore();
  };
  drawGuide(0, "rgba(226, 111, 111, 0.72)", "0 dB");
  drawGuide(-6, "rgba(223, 190, 79, 0.72)", "-6 dB");

  context.save();
  context.fillStyle = "rgba(235, 82, 82, 0.96)";
  for (let index = 0; index < values.length; index += 1) {
    if (Math.abs(values[index] ?? 0) * gain < 0.999) continue;
    const x = values.length === 1
      ? width / 2
      : (index / (values.length - 1)) * width;
    const nextX = values.length <= 1
      ? width
      : ((index + 1) / (values.length - 1)) * width;
    context.fillRect(x, center - maximumHalfHeight, Math.max(ratio, nextX - x), maximumHalfHeight * 2);
  }
  context.restore();
}

function LiveRecordingWaveform({
  read,
}: {
  readonly read: ((target: Float32Array) => void) | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meterRef = useRef<HTMLCanvasElement>(null);
  const decibelRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const samples = new Float32Array(WAVEFORM_SAMPLES);
    const history: number[] = [];
    const startedAt = performance.now();
    let lastPeakAt = 0;
    let displayedDb = -60;
    let frame = 0;
    const render = (now: number) => {
      read?.(samples);
      if (!read) samples.fill(0);
      let peak = 0;
      let sumSquares = 0;
      for (const sample of samples) {
        const absolute = Math.abs(sample);
        peak = Math.max(peak, absolute);
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      const measuredDb = rms > 0 ? 20 * Math.log10(rms) : -60;
      displayedDb = measuredDb > displayedDb
        ? measuredDb
        : displayedDb * 0.9 + measuredDb * 0.1;

      const canvas = canvasRef.current;
      if (canvas && now - lastPeakAt >= 42) {
        const bounds = canvas.getBoundingClientRect();
        const visibleBars = Math.max(
          1,
          Math.floor(bounds.width / REVIEW_BAR_WIDTH)
        );
        history.push(peak);
        if (history.length > visibleBars) history.splice(0, history.length - visibleBars);
        lastPeakAt = now;
      }
      if (canvas) {
        const visibleBars = Math.max(
          1,
          Math.floor(canvas.getBoundingClientRect().width / REVIEW_BAR_WIDTH)
        );
        const liveValues = new Float32Array(visibleBars);
        liveValues.set(history.slice(-visibleBars));
        drawWaveform({
          canvas,
          values: liveValues,
          progress: 1,
          live: true,
        });
        const context = canvas.getContext("2d");
        if (context) {
          const ratio = window.devicePixelRatio || 1;
          const width = canvas.width;
          const headX = Math.min(
            width - 1.5 * ratio,
            (Math.min(history.length, visibleBars) / visibleBars) * width
          );
          context.fillStyle = "#eb725f";
          context.fillRect(
            headX,
            0,
            Math.max(ratio, 1.5 * ratio),
            canvas.height
          );
        }
      }

      const meter = meterRef.current;
      if (meter) {
        const bounds = meter.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(bounds.width * ratio));
        const height = Math.max(1, Math.round(bounds.height * ratio));
        if (meter.width !== width || meter.height !== height) {
          meter.width = width;
          meter.height = height;
        }
        const context = meter.getContext("2d");
        if (context) {
          context.clearRect(0, 0, width, height);
          const meterLeft = 5 * ratio;
          const meterWidth = 14 * ratio;
          const top = 4 * ratio;
          const bottom = height - 4 * ratio;
          const meterHeight = bottom - top;
          const gradient = context.createLinearGradient(0, bottom, 0, top);
          gradient.addColorStop(0, "#3fad70");
          gradient.addColorStop(0.72, "#63c77f");
          gradient.addColorStop(0.86, "#e0bd4f");
          gradient.addColorStop(0.95, "#e07a45");
          gradient.addColorStop(1, "#e34f4f");
          context.fillStyle = "rgba(72, 83, 77, 0.34)";
          context.fillRect(meterLeft, top, meterWidth, meterHeight);
          const normalized = Math.max(0, Math.min(1, (displayedDb + 60) / 60));
          const fillHeight = meterHeight * normalized;
          context.fillStyle = gradient;
          context.fillRect(meterLeft, bottom - fillHeight, meterWidth, fillHeight);
          const recommendedY = bottom - meterHeight * (54 / 60);
          context.strokeStyle = "#f0dc7a";
          context.lineWidth = ratio;
          context.beginPath();
          context.moveTo(meterLeft - 2 * ratio, recommendedY);
          context.lineTo(meterLeft + meterWidth + 2 * ratio, recommendedY);
          context.stroke();
          context.fillStyle = displayedDb >= -0.5 ? "#ff6b61" : "#9ca8a1";
          context.font = `${10 * ratio}px sans-serif`;
          context.textBaseline = "middle";
          context.fillText("0", 24 * ratio, top + 2 * ratio);
          context.fillStyle = "#e7d675";
          context.fillText("-6", 24 * ratio, recommendedY);
          context.fillStyle = "#7f8b84";
          context.fillText("-60", 24 * ratio, bottom - 2 * ratio);
        }
      }
      if (timeRef.current) {
        timeRef.current.textContent = formatTime((now - startedAt) / 1000);
      }
      if (decibelRef.current) {
        const visibleDb = Math.max(-60, displayedDb);
        decibelRef.current.textContent = visibleDb <= -59.5
          ? "-60 dB"
          : `${visibleDb.toFixed(1)} dB`;
        decibelRef.current.style.color = visibleDb >= 0
          ? "#ff6b61"
          : visibleDb >= -6
            ? "#e7d675"
            : "#9ca8a1";
      }
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [read]);

  return (
    <div
      style={{
        height: 225,
        boxSizing: "border-box",
        border: "1px solid #34433b",
        borderRadius: 10,
        background: "#111815",
        padding: "8px 10px 7px",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <canvas
            ref={canvasRef}
            aria-label="시간순으로 누적되는 녹음 음파"
            style={{ display: "block", width: "100%", height: 176 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, color: "#84918a", fontSize: 10 }}>
            <span>녹음 중</span>
            <span ref={timeRef}>0:00</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <canvas
            ref={meterRef}
            aria-label="실시간 데시벨 미터, 마이너스 6 데시벨 권장"
            style={{ display: "block", width: 52, height: 208 }}
          />
          <span style={{ writingMode: "vertical-rl", color: "#77847d", fontSize: 9 }}>dB</span>
          <span
            ref={decibelRef}
            aria-label="현재 데시벨"
            style={{ width: 48, color: "#9ca8a1", fontSize: 10, fontVariantNumeric: "tabular-nums", textAlign: "right" }}
          >
            -60 dB
          </span>
        </div>
      </div>
    </div>
  );
}

const AUDIO_PROCESSING_LABELS = {
  noiseSuppression: "소음 억제",
  echoCancellation: "에코 제거",
  autoGainControl: "자동 음량 조절",
} as const;

type AudioProcessingFeature = keyof typeof AUDIO_PROCESSING_LABELS;

function AudioProcessingControls({
  processing,
  changing,
  error,
  disabled = false,
  onChange,
}: {
  readonly processing: LibraryViewProps["audioRecordingProcessing"];
  readonly changing: LibraryViewProps["audioRecordingChangingProcessing"];
  readonly error: string | null;
  readonly disabled?: boolean;
  readonly onChange: (feature: AudioProcessingFeature, enabled: boolean) => void;
}) {
  if (!processing) {
    return (
      <div style={{ color: "#87928c", fontSize: 11 }}>
        이 브라우저에서는 마이크 자동 보정 상태를 확인할 수 없습니다.
      </div>
    );
  }
  return (
    <section
      aria-label="마이크 자동 보정"
      style={{
        display: "grid",
        gap: 7,
        padding: "10px 12px",
        border: "1px solid #34403a",
        borderRadius: 9,
        background: "rgba(14, 20, 17, 0.7)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <strong style={{ fontSize: 12 }}>마이크 자동 보정</strong>
      {(Object.keys(AUDIO_PROCESSING_LABELS) as AudioProcessingFeature[]).map((feature) => {
        const setting = processing[feature];
        const busy = changing === feature;
        const stateLabel = !setting.supported || setting.enabled === null
          ? "확인 불가"
          : setting.enabled
            ? "켜짐"
            : "꺼짐";
        return (
          <div
            key={feature}
            style={{ display: "grid", gridTemplateColumns: "1fr auto 56px", alignItems: "center", gap: 9 }}
          >
            <span style={{ color: "#bcc6c0", fontSize: 12 }}>
              {AUDIO_PROCESSING_LABELS[feature]}
            </span>
            <span
              style={{
                color: setting.enabled ? "#79d89b" : "#89948e",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {stateLabel}
            </span>
            <button
              className="ui-button"
              type="button"
              disabled={disabled || !setting.canToggle || setting.enabled === null || changing !== null}
              onClick={() => onChange(feature, !setting.enabled)}
              style={{ minWidth: 56, padding: "4px 8px", fontSize: 11 }}
            >
              {busy ? "변경 중" : setting.enabled ? "끄기" : "켜기"}
            </button>
          </div>
        );
      })}
      {error && <div role="alert" style={{ color: "#e69a9a", fontSize: 11 }}>{error}</div>}
    </section>
  );
}

function DisconnectedMicrophonePreview({
  devices,
  selectedDeviceId,
  onSelectDevice,
}: {
  readonly devices: readonly MediaDeviceInfo[];
  readonly selectedDeviceId: string;
  readonly onSelectDevice: (deviceId: string) => void;
}) {
  return (
    <div
      aria-label="마이크 연결 전"
      style={{
        height: 225,
        boxSizing: "border-box",
        display: "grid",
        placeItems: "center",
        border: "1px solid #34403a",
        borderRadius: 10,
        background: "rgba(11, 19, 15, 0.72)",
        color: "#78857e",
        fontSize: 12,
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span>마이크</span>
        <select
          className="ui-input"
          aria-label="녹음할 마이크 선택"
          value={selectedDeviceId}
          onChange={(event) => onSelectDevice(event.currentTarget.value)}
          style={{ minWidth: 220, maxWidth: 320 }}
        >
          <option value="">기본 마이크</option>
          {devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `마이크 ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function buildPeaks(buffer: AudioBuffer, count: number) {
  const peakCount = Math.max(1, Math.round(count));
  const peaks = new Float32Array(peakCount);
  const channels = Array.from(
    { length: buffer.numberOfChannels },
    (_, index) => buffer.getChannelData(index)
  );
  for (let bucket = 0; bucket < peakCount; bucket += 1) {
    const start = Math.floor((bucket / peakCount) * buffer.length);
    const end = Math.max(
      start + 1,
      Math.floor(((bucket + 1) / peakCount) * buffer.length)
    );
    let peak = 0;
    for (const channel of channels) {
      for (let index = start; index < end; index += 1) {
        peak = Math.max(peak, Math.abs(channel[index] ?? 0));
      }
    }
    peaks[bucket] = peak;
  }
  return peaks;
}

type RecordingEditState = Omit<LibraryRecordingEditRequest, "name">;

function mergeRemovedRanges(
  ranges: RecordingEditState["removedRanges"]
) {
  const sorted = [...ranges].sort((left, right) => left.startSeconds - right.startSeconds);
  const merged: { startSeconds: number; endSeconds: number }[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.startSeconds <= previous.endSeconds) {
      previous.endSeconds = Math.max(previous.endSeconds, range.endSeconds);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function keptRecordingRanges(edit: RecordingEditState, duration: number) {
  const start = Math.max(0, Math.min(duration, edit.trimStartSeconds));
  const end = Math.max(start, Math.min(duration, edit.trimEndSeconds));
  const removed = mergeRemovedRanges(edit.removedRanges)
    .map((range) => ({
      startSeconds: Math.max(start, Math.min(end, range.startSeconds)),
      endSeconds: Math.max(start, Math.min(end, range.endSeconds)),
    }))
    .filter((range) => range.endSeconds - range.startSeconds > 0.001);
  const kept: { startSeconds: number; endSeconds: number }[] = [];
  let cursor = start;
  for (const range of removed) {
    if (range.startSeconds > cursor) {
      kept.push({ startSeconds: cursor, endSeconds: range.startSeconds });
    }
    cursor = Math.max(cursor, range.endSeconds);
  }
  if (cursor < end) kept.push({ startSeconds: cursor, endSeconds: end });
  return kept;
}

function rangesDuration(ranges: readonly { startSeconds: number; endSeconds: number }[]) {
  return ranges.reduce(
    (sum, range) => sum + range.endSeconds - range.startSeconds,
    0
  );
}

function sourceTimeAtEditedTime(
  ranges: readonly { startSeconds: number; endSeconds: number }[],
  editedSeconds: number
) {
  let remaining = Math.max(0, editedSeconds);
  for (const range of ranges) {
    const length = range.endSeconds - range.startSeconds;
    if (remaining <= length) return range.startSeconds + remaining;
    remaining -= length;
  }
  return ranges.at(-1)?.endSeconds ?? 0;
}

function editedTimeAtSourceTime(
  ranges: readonly { startSeconds: number; endSeconds: number }[],
  sourceSeconds: number
) {
  let elapsed = 0;
  for (const range of ranges) {
    if (sourceSeconds < range.startSeconds) return elapsed;
    if (sourceSeconds <= range.endSeconds) {
      return elapsed + sourceSeconds - range.startSeconds;
    }
    elapsed += range.endSeconds - range.startSeconds;
  }
  return elapsed;
}

function RecordingWaveformPlayer({
  file,
  edit,
  onEditChange,
}: {
  readonly file: File;
  readonly edit: RecordingEditState;
  readonly onEditChange: (next: RecordingEditState) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformViewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startSeconds: number;
  } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [decodedBuffer, setDecodedBuffer] = useState<AudioBuffer | null>(null);
  const [waveformViewportWidth, setWaveformViewportWidth] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<{
    readonly startSeconds: number;
    readonly endSeconds: number;
  } | null>(null);
  const undoStackRef = useRef<RecordingEditState[]>([]);

  useEffect(() => {
    let cancelled = false;
    const nextUrl = URL.createObjectURL(file);
    const publishUrlTimer = window.setTimeout(() => {
      if (!cancelled) setUrl(nextUrl);
    }, 0);
    const context = new AudioContext();
    void file.arrayBuffer()
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        if (cancelled) return;
        setDecodedBuffer(buffer);
        setDuration(buffer.duration);
        onEditChange({
          trimStartSeconds: 0,
          trimEndSeconds: buffer.duration,
          removedRanges: [],
          gainDb: 0,
        });
        undoStackRef.current = [];
        setZoom(1);
      })
      .catch(() => {
        if (!cancelled) setDecodedBuffer(null);
      })
      .finally(() => {
        if (context.state !== "closed") void context.close();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(publishUrlTimer);
      URL.revokeObjectURL(nextUrl);
    };
  }, [file, onEditChange]);

  useEffect(() => {
    const viewport = waveformViewportRef.current;
    if (!viewport) return;
    const update = () => setWaveformViewportWidth(viewport.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const peaks = useMemo(() => decodedBuffer
    ? buildPeaks(
      decodedBuffer,
      (Math.max(1, waveformViewportWidth) * zoom) / REVIEW_BAR_WIDTH
    )
    : new Float32Array(), [decodedBuffer, waveformViewportWidth, zoom]);

  const keptRanges = useMemo(
    () => keptRecordingRanges(edit, duration),
    [duration, edit]
  );
  const editedDuration = rangesDuration(keptRanges);
  const sourceTimelineRanges = useMemo(
    () => keptRecordingRanges({
      trimStartSeconds: 0,
      trimEndSeconds: duration,
      removedRanges: edit.removedRanges,
      gainDb: edit.gainDb,
    }, duration),
    [duration, edit.gainDb, edit.removedRanges]
  );
  const sourceTimelineDuration = rangesDuration(sourceTimelineRanges);
  const visiblePeaks = useMemo(() => {
    if (duration <= 0 || sourceTimelineDuration <= 0) {
      return new Float32Array();
    }
    const values = new Float32Array(peaks.length);
    for (let index = 0; index < values.length; index += 1) {
      const sourceTime = sourceTimeAtEditedTime(
        sourceTimelineRanges,
        ((index + 0.5) / values.length) * sourceTimelineDuration
      );
      const sourceIndex = Math.min(
        peaks.length - 1,
        Math.max(0, Math.floor((sourceTime / duration) * peaks.length))
      );
      values[index] = peaks[sourceIndex] ?? 0;
    }
    return values;
  }, [duration, peaks, sourceTimelineDuration, sourceTimelineRanges]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawWaveform({
      canvas,
      values: visiblePeaks,
      progress: sourceTimelineDuration > 0
        ? editedTimeAtSourceTime(sourceTimelineRanges, currentTime) / sourceTimelineDuration
        : 0,
      live: false,
      gainDb: edit.gainDb,
    });
    if (duration <= 0) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.width;
    const height = canvas.height;
    const toX = (sourceSeconds: number) => sourceTimelineDuration > 0
      ? (editedTimeAtSourceTime(sourceTimelineRanges, sourceSeconds) / sourceTimelineDuration) * width
      : 0;
    if (selection) {
      const start = Math.min(selection.startSeconds, selection.endSeconds);
      const end = Math.max(selection.startSeconds, selection.endSeconds);
      context.fillStyle = "rgba(96, 158, 211, 0.28)";
      context.fillRect(toX(start), 0, toX(end) - toX(start), height);
      context.strokeStyle = "rgba(126, 186, 235, 0.9)";
      context.lineWidth = ratio;
      context.strokeRect(toX(start), ratio / 2, toX(end) - toX(start), height - ratio);
    }
  }, [currentTime, duration, edit.gainDb, selection, sourceTimelineDuration, sourceTimelineRanges, visiblePeaks]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const update = () => {
      const audio = audioRef.current;
      if (audio) {
        const removed = edit.removedRanges.find(
          (range) => audio.currentTime >= range.startSeconds && audio.currentTime < range.endSeconds
        );
        if (removed) audio.currentTime = removed.endSeconds;
        if (audio.currentTime >= edit.trimEndSeconds) {
          audio.pause();
          audio.currentTime = edit.trimStartSeconds;
        }
        setCurrentTime(audio.currentTime);
      }
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [edit, playing]);

  useEffect(() => {
    const gainNode = audioGainRef.current;
    if (gainNode) gainNode.gain.value = 10 ** (edit.gainDb / 20);
  }, [edit.gainDb]);

  useEffect(() => () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    audioGainRef.current = null;
    if (context && context.state !== "closed") void context.close();
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      let context = audioContextRef.current;
      if (!context) {
        context = new AudioContext();
        const source = context.createMediaElementSource(audio);
        const gain = context.createGain();
        gain.channelCount = 1;
        gain.channelCountMode = "explicit";
        gain.channelInterpretation = "speakers";
        gain.gain.value = 10 ** (edit.gainDb / 20);
        source.connect(gain);
        gain.connect(context.destination);
        audioContextRef.current = context;
        audioGainRef.current = gain;
      }
      if (context.state === "suspended") void context.resume();
      if (
        audio.currentTime < edit.trimStartSeconds ||
        audio.currentTime >= edit.trimEndSeconds
      ) audio.currentTime = edit.trimStartSeconds;
      void audio.play();
    }
    else audio.pause();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLButtonElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const secondsAt = (clientX: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds || duration <= 0 || sourceTimelineDuration <= 0) return 0;
    const editedSeconds = Math.max(
      0,
      Math.min(
        sourceTimelineDuration,
        ((clientX - bounds.left) / bounds.width) * sourceTimelineDuration
      )
    );
    return sourceTimeAtEditedTime(sourceTimelineRanges, editedSeconds);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return;
    const seconds = secondsAt(event.clientX);
    dragRef.current = { pointerId: event.pointerId, startSeconds: seconds };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection({ startSeconds: seconds, endSeconds: seconds });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.buttons === 0) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    const seconds = secondsAt(event.clientX);
    setSelection({ startSeconds: drag.startSeconds, endSeconds: seconds });
  };

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    const finish = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      const canvas = canvasRef.current;
      if (canvas?.hasPointerCapture(drag.pointerId)) {
        canvas.releasePointerCapture(drag.pointerId);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") finish();
    };
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", finish, true);
    window.addEventListener("blur", finish);
    document.documentElement.addEventListener("mouseleave", finish);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", finish, true);
      window.removeEventListener("blur", finish);
      document.documentElement.removeEventListener("mouseleave", finish);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      finish();
    };
  }, []);

  const hasSelection = Boolean(
    selection && Math.abs(selection.endSeconds - selection.startSeconds) > 0.01
  );

  const deleteSelection = () => {
    if (!selection) return;
    const startSeconds = Math.max(
      0,
      Math.min(selection.startSeconds, selection.endSeconds)
    );
    const endSeconds = Math.min(
      duration,
      Math.max(selection.startSeconds, selection.endSeconds)
    );
    if (endSeconds - startSeconds <= 0.01) return;
    undoStackRef.current.push(edit);
    onEditChange({
      ...edit,
      removedRanges: mergeRemovedRanges([
        ...edit.removedRanges,
        { startSeconds, endSeconds },
      ]),
    });
    setSelection(null);
  };

  useEffect(() => {
    const undo = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;
      const previous = undoStackRef.current.pop();
      if (!previous) return;
      event.preventDefault();
      onEditChange(previous);
      setSelection(null);
    };
    window.addEventListener("keydown", undo);
    return () => window.removeEventListener("keydown", undo);
  }, [onEditChange]);

  return (
    <div
      style={{
        border: "1px solid #34433b",
        borderRadius: 10,
        background: "#111815",
        padding: "8px 10px 10px",
      }}
    >
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(duration);
          }}
        />
      )}
      <div ref={waveformViewportRef} style={{ overflowX: "auto", overflowY: "hidden" }}>
        <canvas
          ref={canvasRef}
          aria-label="녹음 음파, 클릭하여 재생 위치 이동"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onLostPointerCapture={() => {
            dragRef.current = null;
          }}
          style={{
            display: "block",
            width: `${zoom * 100}%`,
            height: 184,
            cursor: "crosshair",
            touchAction: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button
          className="ui-button"
          type="button"
          onClick={toggle}
          aria-label={playing ? "일시정지" : "재생"}
          style={{ minWidth: 36, padding: "4px 9px" }}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <span style={{ color: "#b6c0ba", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          {formatTime(editedTimeAtSourceTime(keptRanges, currentTime))} / {formatTime(editedDuration)}
        </span>
        <span style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className="ui-button"
            type="button"
            aria-label="음파 축소"
            disabled={zoom <= 1}
            onClick={() => setZoom((current) => Math.max(1, current / 2))}
            style={{ minWidth: 30, padding: "4px 8px" }}
          >
            −
          </button>
          <span
            style={{
              minWidth: 38,
              color: "#9ba6a0",
              fontSize: 11,
              textAlign: "center",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {zoom * 100}%
          </span>
          <button
            className="ui-button"
            type="button"
            aria-label="음파 확대"
            disabled={zoom >= 16}
            onClick={() => setZoom((current) => Math.min(16, current * 2))}
            style={{ minWidth: 30, padding: "4px 8px" }}
          >
            +
          </button>
        </div>
        <button
          className={`ui-button${hasSelection ? " ui-button--primary" : ""}`}
          type="button"
          disabled={!hasSelection}
          onClick={deleteSelection}
        >
          구간 삭제
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto",
          alignItems: "center",
          gap: 10,
          marginTop: 10,
        }}
      >
        <label htmlFor="recording-gain" style={{ color: "#c6cec9", fontSize: 12 }}>
          볼륨
        </label>
        <input
          id="recording-gain"
          type="range"
          min={-24}
          max={12}
          step={1}
          value={edit.gainDb}
          onChange={(event) => onEditChange({
            ...edit,
            gainDb: Number(event.currentTarget.value),
          })}
          aria-label="녹음 볼륨 조절"
        />
        <span style={{ minWidth: 48, color: "#aeb8b2", fontSize: 12, textAlign: "right" }}>
          {edit.gainDb > 0 ? "+" : ""}{edit.gainDb} dB
        </span>
        <button
          className="ui-button"
          type="button"
          onClick={() => onEditChange({ ...edit, gainDb: 0 })}
          disabled={edit.gainDb === 0}
        >
          초기화
        </button>
      </div>
    </div>
  );
}

export default function LibraryRecordingReview({
  status,
  name,
  file,
  readLiveWaveform,
  audioProcessing,
  changingAudioProcessing,
  audioProcessingError,
  error,
  canCancel,
  canRetry,
  canConfirm,
  onBegin,
  onStop,
  onSetAudioProcessing,
  onRetry,
  onCancel,
  onConfirm,
}: {
  readonly status: Exclude<LibraryViewProps["audioRecordingStatus"], "idle">;
  readonly name: string | null;
  readonly file: File | null;
  readonly readLiveWaveform: ((target: Float32Array) => void) | null;
  readonly audioProcessing: LibraryViewProps["audioRecordingProcessing"];
  readonly changingAudioProcessing: LibraryViewProps["audioRecordingChangingProcessing"];
  readonly audioProcessingError: string | null;
  readonly error: string | null;
  readonly canCancel: boolean;
  readonly canRetry: boolean;
  readonly canConfirm: boolean;
  readonly onBegin: (deviceId?: string | null) => void;
  readonly onStop: () => void;
  readonly onSetAudioProcessing: (
    feature: AudioProcessingFeature,
    enabled: boolean
  ) => void;
  readonly onRetry: () => void;
  readonly onCancel: () => void;
  readonly onConfirm: (request: LibraryRecordingEditRequest) => void;
}) {
  const [draftName, setDraftName] = useState(name ?? "움직_녹음");
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputDeviceId, setSelectedAudioInputDeviceId] = useState("");
  const [edit, setEdit] = useState<RecordingEditState>({
    trimStartSeconds: 0,
    trimEndSeconds: Number.POSITIVE_INFINITY,
    removedRanges: [],
    gainDb: 0,
  });

  useEffect(() => {
    if (status !== "ready" || !navigator.mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const devices = (await navigator.mediaDevices.enumerateDevices())
          .filter((device) => device.kind === "audioinput");
        if (cancelled) return;
        setAudioInputDevices(devices);
        setSelectedAudioInputDeviceId((current) =>
          current && devices.some((device) => device.deviceId === current) ? current : ""
        );
      } catch {
        if (!cancelled) setAudioInputDevices([]);
      }
    };
    void refresh();
    navigator.mediaDevices.addEventListener?.("devicechange", refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener?.("devicechange", refresh);
    };
  }, [status]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setDraftName(name ?? "움직_녹음");
      setEdit({
        trimStartSeconds: 0,
        trimEndSeconds: Number.POSITIVE_INFINITY,
        removedRanges: [],
        gainDb: 0,
      });
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [file, name]);

  useEffect(() => {
    if (!canCancel) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canCancel, onCancel]);

  const title = "녹음";

  return createPortal(
    <div
      className="new-project-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="오디오 녹음"
      style={{ alignItems: "flex-start", overflowY: "auto", paddingTop: 0 }}
    >
      <div
        className="new-project-dialog preview-dialog-surface"
        style={{
          width: "min(520px, calc(100vw - 40px))",
          marginTop: 200,
          marginBottom: 40,
        }}
      >
        <header className="new-project-dialog__header" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
          <strong style={{ flex: 1 }}>{title}</strong>
          {canCancel && <button className="ui-button" type="button" aria-label="녹음창 닫기" onClick={onCancel} style={{ minWidth: 34, padding: "5px 9px" }}>×</button>}
        </header>
        <main className="new-project-dialog__body" style={{ gap: 14, minHeight: 170, justifyContent: "center" }}>
          {(status === "ready" || status === "requesting" || status === "recording") && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: "50%", background: status === "recording" ? "#e46f6f" : "#68736d", boxShadow: status === "recording" ? "0 0 0 5px rgba(228, 111, 111, 0.12)" : "none" }} />
                <strong>{status === "recording" ? "녹음 중" : "녹음 준비 중"}</strong>
              </div>
              {status === "recording"
                ? <LiveRecordingWaveform read={readLiveWaveform} />
                : <DisconnectedMicrophonePreview
                    devices={audioInputDevices}
                    selectedDeviceId={selectedAudioInputDeviceId}
                    onSelectDevice={setSelectedAudioInputDeviceId}
                  />}
              <AudioProcessingControls
                processing={audioProcessing}
                changing={changingAudioProcessing}
                error={audioProcessingError}
                disabled={status !== "ready"}
                onChange={onSetAudioProcessing}
              />
            </>
          )}
          {status === "preparing" && <p style={{ margin: 0, color: "#aab2b9" }}>녹음 결과를 준비하고 있습니다…</p>}
          {(status === "review" || status === "saving" || status === "error") && file && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <strong style={{ fontSize: 13 }}>파일 이름</strong>
                <input
                  className="ui-input"
                  type="text"
                  value={draftName}
                  disabled={status === "saving"}
                  onChange={(event) => setDraftName(event.currentTarget.value)}
                  placeholder="움직_녹음_260818_164818"
                  style={{ width: "100%" }}
                />
                <span style={{ color: "#929da6", fontSize: 11 }}>
                  프로젝트 폴더의 audio 폴더에 저장됩니다.
                </span>
              </label>
              <div>
                <strong style={{ display: "block", fontSize: 13 }}>녹음 편집</strong>
              </div>
              <RecordingWaveformPlayer
                file={file}
                edit={edit}
                onEditChange={setEdit}
              />
            </>
          )}
          {status === "saving" && <p style={{ margin: 0, color: "#9ba6af", fontSize: 12 }}>프로젝트 audio 폴더에 원본을 저장하고 있습니다…</p>}
          {error && <div role="alert" style={{ padding: "10px 12px", border: "1px solid rgba(230, 120, 120, 0.38)", borderRadius: 8, background: "rgba(96, 35, 35, 0.2)", color: "#eaa0a0", fontSize: 12, lineHeight: 1.55 }}>{error}</div>}
        </main>
        <footer className="new-project-dialog__actions">
          {canCancel && <button className="ui-button" type="button" onClick={onCancel}>취소</button>}
          {canRetry && <button className="ui-button" type="button" onClick={onRetry}>다시 녹음</button>}
          {status === "ready" && <button className="ui-button ui-button--primary" type="button" onClick={() => onBegin(selectedAudioInputDeviceId || null)} autoFocus>녹음 시작</button>}
          {status === "requesting" && <button className="ui-button ui-button--primary" type="button" disabled>준비 중…</button>}
          {status === "recording" && <button className="ui-button ui-button--primary" type="button" onClick={onStop} autoFocus>녹음 끝내기</button>}
          {canConfirm && <button className="ui-button ui-button--primary" type="button" onClick={() => onConfirm({ name: draftName, ...edit })}>{status === "error" ? "다시 시도" : "확인"}</button>}
          {status === "saving" && <button className="ui-button ui-button--primary" type="button" disabled>저장 중…</button>}
        </footer>
      </div>
    </div>,
    document.body
  );
}

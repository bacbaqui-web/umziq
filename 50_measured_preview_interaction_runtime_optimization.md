# Preview Interaction Runtime 최적화 측정 기록

## 1. 문서의 범위와 현재 결론

이 문서는 Preview Transform interaction 최적화 Sprint에서 실제로 수집한 production Edge CDP 측정, 두 후보의 Before/After 결과, rollback 근거와 재측정 절차를 영구 보존한다. 수치는 `scripts/previewInteractionProfilingBaseline.json`의 유효 run만 사용한다.

- Candidate 1 `React Draft Boundary`는 scripting을 줄였지만 Paint와 frame p95 회귀가 있어 rollback했다.
- Candidate 2 `Displayed Pixel Preview Backing`은 raster/compositor 총 시간을 줄였지만 Position과 WH frame p95 회귀가 있어 rollback했다.
- 현재 제품 코드에는 두 후보의 제품 변경이 모두 남아 있지 않다. rollback 뒤 production asset은 `index-CKHXGN9H.js`, SHA-256 `eb9efbe0301431785aca3cf0e50e23619ef6db3c566445d3bd15def30ac408e0`로 Candidate 이전 상태와 일치했다.
- 남은 관찰 경계는 large-document WH Scale의 GPU/raster/compositor scheduling이다. backing 크기와 raster breadth의 상관은 관찰했지만 frame 제출 지연을 만드는 세부 메커니즘은 확정하지 않았다.

## 2. 고정 Fixture와 CDP Protocol

측정은 개발 서버가 아니라 `npm run build` 뒤 `127.0.0.1:4174` production preview를 전용 Edge CDP profile에서 실행했다. DevTools는 열지 않았고 CPU/network throttling을 사용하지 않았다.

| 항목 | 고정값 |
|---|---|
| Browser protocol | Edge CDP 1.3 |
| Window inner / outer | 1792×1012 / 1800×1130 CSS px |
| DPR | 2 |
| Preview viewport | x=286, y=0, 1180×726 CSS px |
| Preview quality | Medium |
| 시작 frame | 0 |
| Replay | seed와 2 RAF 뒤, absolute monotonic deadline으로 10ms 간격 100 samples / 1초 |
| Timing trace | pointer-up을 capture 밖에서 수행; scenario당 valid 3 runs |
| CPU attribution | source-map build로 별도 수집하고 timing 통계에서 제외 |
| Raster attribution | cc/gpu/viz/layers/skia category로 별도 수집하고 timing 통계에서 제외 |

Fixture identity는 SHA-256, import index, composition/target breadcrumb, 초기 Transform과 radial handle identity로 매 run 검증했다.

| Fixture | 문서 / 대상 | 문서 크기 | Preview zoom | 조건 |
|---|---|---:|---:|---|
| flat | `drag_test.psd` / `drag_test` Layer | 1080×1920 | 100% | Fast, Full |
| nested | `layer_test.psd` / `아빠` Sub Composition | 4000×4000 | 20% | Fast, Glow OFF |
| glow | `layer_test.psd` / `같이자요...` Layer | 4000×4000 | 20% | Fast, Glow OFF/ON |

Position과 WH 모두 Draft 중 Properties/Gizmo/Layer 동기화, pointer-up Commit, 단일 Undo의 정확한 초기 Transform 복원을 확인했다. Project Update 1회와 History 1회 계약은 CDP trace에서 추정하지 않고 deterministic drag/history fixture로 검증했다.

## 3. High-frequency Baseline

아래 값은 각 3-run median이다. 시간 단위는 ms이며 `ms/raw`는 RunTask / trace-identifiable raw pointer event다.

### Position

| Scenario | RunTask | Script | Layout | Paint | Frame p95 | Frames | ms/raw |
|---|---:|---:|---:|---:|---:|---:|---:|
| flat Fast | 280.218 | 144.135 | 37.462 | 54.107 | 16.667 | 59 | 2.889 |
| flat Full | 273.709 | 147.216 | 39.087 | 48.373 | 16.667 | 59 | 2.841 |
| nested Fast | 253.267 | 139.411 | 33.570 | 37.881 | 16.667 | 59 | 2.611 |
| Glow OFF Fast | 291.690 | 174.996 | 34.965 | 44.324 | 16.667 | 59 | 2.917 |
| Glow ON Fast | 291.745 | 193.953 | 39.209 | 39.963 | 16.667 | 59 | 2.920 |

### WH Scale

| Scenario | RunTask | Script | Layout | Paint | Frame p95 | Frames | ms/raw |
|---|---:|---:|---:|---:|---:|---:|---:|
| flat Fast | 256.279 | 153.230 | 14.850 | 39.011 | 16.667 | 59 | 2.669 |
| flat Full | 258.748 | 149.621 | 15.680 | 41.173 | 16.667 | 59 | 2.640 |
| nested Fast | 229.432 | 135.307 | 9.603 | 31.635 | 33.334 | 60 | 2.294 |
| Glow OFF Fast | 240.414 | 146.951 | 12.196 | 33.059 | 33.334 | 59 | 2.484 |
| Glow ON Fast | 246.200 | 148.042 | 13.361 | 33.064 | 33.334 | 59 | 2.512 |

large fixture의 WH p95만 33.334ms였고 RunTask, Script, Layout, Paint median은 flat보다 낮았다. Glow OFF/ON과 nested/layer가 같은 p95를 보여 main-thread 총량이나 Glow 자체만으로 이 현상을 설명할 수 없었다.

## 4. Task 4R Residual Attribution

Task 4R은 Candidate 1 rollback 뒤 WH flat과 large Glow OFF를 동일 replay로 한 번씩 별도 진단했다. 이 pair는 원인 방향을 좁히기 위한 최소 raster/compositor 자료이며 3-run timing 통계와 섞지 않았다.

| 관찰값 | flat | large Glow OFF |
|---|---:|---:|
| Canvas backing | 540×960 | 2000×2000 |
| Canvas DOM | 1080×1920 | 800×800 |
| `DrawEdgeAAImageSet` count / total | 229 / 0.840 | 1662 / 4.989 |
| `CreateRasterTask` count / total | 236 / 0.981 | 362 / 1.848 |
| `RendererRasterWorker` count / total | 65 / 24.554 | 150 / 33.269 |
| `MainFrame.Draw` count / total | 57 / 18.183 | 48 / 29.147 |
| `DirectRenderer::DrawFrame` count / total | 57 / 14.937 | 48 / 20.890 |
| `RasterTask` count / total | 117 / 12.225 | 181 / 9.567 |

large document는 DOM 표시 크기가 더 작아도 backing 면적과 image/raster 작업 폭이 컸다. 따라서 residual을 large-document WH Scale의 GPU/raster/compositor scheduling 경계로 한정했다. 다만 이 trace만으로 raster worker, compositor submission, frame presentation 중 어느 단계가 p95를 결정했는지는 확정할 수 없다.

## 5. Candidate 1 — React Draft Boundary

Candidate 1은 Position/WH timing 각 15/15와 별도 CPU profile 각 3 valid runs를 수집했다. 원본 source mapping으로 React Draft 경계의 호출 이동을 확인했고 기능 fixture와 모든 timing run의 Draft/Commit/Undo 계약은 통과했다.

Script median은 대체로 감소했다. 예를 들어 Position flat Fast는 `144.135 → 136.491`(-7.644), Glow OFF는 `174.996 → 135.950`(-39.046), WH flat Fast는 `153.230 → 137.494`(-15.736), WH nested는 `135.307 → 114.359`(-20.948)이었다.

그러나 Paint는 Position flat Fast `54.107 → 63.907`, flat Full `48.373 → 63.630`, Glow OFF `44.324 → 52.764`; WH flat Fast `39.011 → 46.714` 등으로 증가했다. frame p95도 Position flat Fast/Full과 Glow OFF/ON에서 `16.667 → 33.333`, WH flat Fast에서 `16.667 → 33.333`, WH nested에서 `33.334 → 43.447`로 악화됐다. scripting 개선이 표시 cadence 회귀를 상쇄하지 못해 Gate G4에서 rollback했다.

## 6. Candidate 2 — Displayed Pixel Preview Backing

Candidate 2는 선택 quality scale을 넘지 않으면서 CSS Preview zoom×DPR 기준으로 large backing을 2000×2000에서 1600×1600으로 제한했다. Position/WH timing은 각각 15/15 valid, 별도 raster pair는 2/2 valid였다. flat backing은 540×960으로 유지됐다.

별도 raster pair에서 large Glow OFF의 총량은 `DrawEdgeAAImageSet 4.989 → 3.535ms`, `RendererRasterWorker 33.269 → 28.314ms`, `MainFrame.Draw 29.147 → 24.403ms`, `DirectRenderer::DrawFrame 20.890 → 16.704ms`로 감소했다. flat에서도 `RendererRasterWorker 24.554 → 21.437ms`, `MainFrame.Draw 18.183 → 16.030ms`로 감소했다.

하지만 frame p95는 Position flat Fast와 Glow OFF/ON에서 `16.667 → 약 33.33`, WH flat Fast에서 `16.667 → 33.334`, nested에서 `33.334 → 49.999`, Glow OFF/ON에서 `33.334 → 43.543/44.258`로 악화됐다. raster 총량 감소가 frame scheduling 개선으로 이어지지 않았으므로 Gate G6에서 rollback했다.

## 7. 진행하지 않은 후보

- **Bounded Glow:** baseline WH에서 Glow OFF와 ON p95가 모두 33.334ms였고 nested Sub Composition도 같은 large-fixture p95였다. Task 4R도 Glow OFF만으로 large raster 차이를 재현했다. Glow를 우선 병목으로 승인할 근거가 없었다.
- **Draft-safe Composition Cache:** large Glow Layer와 nested Sub Composition 양쪽에서 같은 p95 경계가 나타났고, main-thread RunTask/Script/Layout/Paint는 flat보다 낮았다. Composition 재합성 비용이 frame 회귀의 반복 주 contributor라는 근거가 없어 구현하지 않았다.
- **Preview Scene Pass 통합:** source-mapped CPU profile에서 일반 Preview Scene geometry는 React root total이나 Task 4R의 raster/compositor 차이보다 작은 contributor였다. 두 후보 rollback 뒤 새 residual 근거 없이 scene/map/bounds 공유 구조를 바꾸지 않았다.

이는 후보가 영구적으로 무효라는 뜻이 아니다. 동일 고정 protocol에서 반복 contributor와 frame cadence의 인과가 새로 확인될 때만 다시 승인한다.

## 8. 재사용 가능한 측정 자산과 재측정 절차

| 자산 | 책임 |
|---|---|
| `scripts/previewInteractionProfilingManifest.ts` | fixture SHA/target/Transform, scenario, viewport/DPR와 lane 계약 |
| `scripts/previewInteractionProfilingCdpDriver.mjs` | production Edge CDP import/setup/hit test, 100-sample timing, CPU 및 raster 분리 수집 |
| `scripts/previewInteractionProfilingBaseline.json` | 54/54 baseline, Candidate 1/2 Before/After, MAD noise band, CPU와 raster summary |
| `scripts/recordCandidate1ReactDraftBoundaryAfter.mjs` | Candidate 1 timing/CPU 결과 검증과 artifact 기록 |
| `scripts/recordCandidate2DisplayedPixelBackingAfter.mjs` | Candidate 2 timing/raster 결과 검증과 artifact 기록 |
| `scripts/verifyPreviewInteractionProfilingManifest.ts` | fixture/scenario/protocol 정적 계약 |
| `scripts/verifyPreviewInteractionProfilingCdpDriver.ts` | driver와 보존 artifact의 run/build/function 계약 |

재측정할 때는 다음 순서를 지킨다.

1. normal production build를 만들고 asset filename/SHA-256/source map 부재를 기록한다.
2. manifest의 Edge viewport, DPR, production URL과 fixture identity를 먼저 검증한다.
3. Position과 WH 각각 flat Fast/Full, nested Fast, Glow OFF/ON Fast를 scenario당 3 valid runs 수집한다.
4. 각 run에서 100-sample cadence, live Draft, Commit, Undo, target identity를 확인한다. Project/History 횟수는 deterministic fixture로 별도 확인한다.
5. Before/After median과 MAD 합 noise band를 직접 비교하고 frame p95를 독립 gate로 본다.
6. CPU source-map profile이나 raster/compositor trace가 필요하면 timing build와 분리해 수집하며 timing 통계에 합치지 않는다.
7. 측정 뒤 다시 normal production build를 만들고 hash와 source map 부재를 확인한다.
8. 제품 후보의 유지/rollback은 기능 통과만으로 결정하지 않고 frame p95 회귀가 없는지 확인한 뒤 supervisor gate에서 판정한다.

## 9. 자동 Fixture와 실제 사용자 시각 QA의 경계

정적/자동 fixture는 fixture identity, 초기 Transform, hit target, 100-sample cadence, Draft/Commit/Undo, Project Update/History 횟수, trace event와 production asset identity를 재현 가능하게 검증한다. 이 문서의 모든 수치와 두 rollback 판정은 이 자동 측정 경계에 근거한다.

실제 사용자 시각 QA는 별도 단계다. 사람이 Position/Anchor/Scale W/H/WH/Rotation/Opacity, flat/nested, Fast/Full, Glow OFF/ON, cancel과 Undo/Redo를 조작하면서 blur 품질, silhouette, edge clipping, 잔상, 입력 감각과 체감 frame pacing을 확인해야 한다. 자동 fixture 통과는 이 시각·체감 QA를 대체하지 않으며, 이번 Task 11에서는 Browser QA를 실행하지 않았다.

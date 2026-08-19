# Preview Runtime Optimization

> 문서 번호: 44
> 상태: Sprint 99 완료 결과 문서
> 목적: Fast Preview Renderer를 “다시 그리지 않는 Renderer”로 만들기 위해 Sprint 99에서 확정한 Preview Runtime 최적화 구조를 기록한다.

## 1. Sprint 목표

Sprint 99 `Preview Runtime Optimization`의 목표는 Dual Renderer Architecture에서 완성한 구조를 바꾸지 않고, Preview Runtime 내부의 불필요한 작업을 줄이는 것이었다.

변경하지 않은 구조:

- Animation Evaluation
- Evaluated Scene
- Renderer Mode
- Preview Scene 계약
- Preview Update Pipeline 계약
- Accurate Renderer
- Export 경로

최적화 대상:

- Drag 중 Project update 반복
- Preview Scene 반복 생성
- 변경 없는 Preview Node 재생성
- 변경 없는 Composition 재합성
- 임시 Surface 반복 생성
- Playback 중 clean node 재계산
- 변경 없는 node의 `drawImage`

핵심 철학은 다음과 같다.

```text
변하지 않은 것은 다시 그리지 않는다.
모든 최적화는 수치로 증명한다.
```

## 2. 최종 Runtime Pipeline

Sprint 종료 시점의 Fast Preview Runtime은 다음 흐름을 기준으로 동작한다.

```text
Animation Evaluation
  ↓
Evaluated Scene
  ↓
Fast Preview Renderer
  ↓
Preview Scene
  ↓
Preview Update Pipeline
  ↓
Dirty State
  ↓
Node Cache
  ↓
Composition Cache
  ↓
Surface Cache
  ↓
Playback Dirty Update
  ↓
drawImage 최소화
  ↓
Canvas
```

Accurate Renderer는 기존처럼 `Evaluated Scene → RenderFrame → Canvas` 경로를 유지한다. Export는 Preview Runtime cache나 preview bitmap을 사용하지 않고 Original Source 계약을 유지한다.

## 3. Drag Runtime 분리

Drag move는 Project Plain Data를 수정하지 않는다.

현재 drag 흐름:

```text
PointerMove
  ↓
Preview Update Pipeline
  ↓
Preview draft 갱신
  ↓
Canvas

PointerUp
  ↓
Animation Command
  ↓
Project Update
  ↓
History Commit
  ↓
Animation Evaluation
  ↓
Renderer
```

효과:

- drag move 중 Animation Evaluation 반복 없음
- drag move 중 Fast Preview Renderer 재호출 없음
- drag move 중 Project update 반복 없음
- commit 시점의 Undo/Redo 정책은 기존처럼 유지

## 4. Runtime Metrics

Runtime Metrics는 Canvas Preview Runtime 전용 Runtime Resource다.

저장하지 않는 곳:

- Project Plain Data
- History
- Export
- Undo/Redo snapshot

Metrics 구조:

- Global Counter: 누적 성능 수치
- Frame Snapshot: 현재 frame 단위 수치
- Sprint Baseline / Task Baseline: Performance QA 요청 시에만 비교하는 runtime 기준점

대표 측정 항목:

- Animation Evaluation
- Fast Preview Renderer
- Accurate Renderer
- Preview Scene Generation
- Preview Node Updated / Reused
- Dirty Node / Frame Dirty
- Playback Dirty / Clean Node
- Composition Cache Hit / Miss
- Surface Create / Reuse / Dispose
- `drawImage`
- `drawImage` Skipped
- Canvas Draw Time
- Project Update
- History Commit

## 5. Dirty State

Dirty State는 “무엇이 바뀌었는지”를 판정하는 Runtime Resource다.

Dirty 종류:

- Transform Dirty
- Opacity Dirty
- Visibility Dirty
- Hierarchy Dirty
- Order Dirty
- Source Dirty
- Frame Dirty
- Logical Size Dirty
- Composition Dirty

규칙:

- 같은 입력이면 Dirty 없음
- Transform만 바뀌면 Transform Dirty만 발생
- Source fingerprint가 바뀌면 Source Dirty 발생
- Frame이 바뀌어도 표시 결과가 같으면 clean으로 유지 가능

Dirty State는 Node Cache, Composition Cache, Surface Cache, drawImage 최소화가 소비하지만, Project나 History에는 저장하지 않는다.

## 6. Node Cache

Node Cache는 Preview Node reference를 재사용하는 Runtime helper다.

기준:

- Cache Key: `PreviewNode.id`
- Dirty 없음: 이전 Preview Node reference 유지
- Dirty 있음: 새 Preview Node 생성

Composition Node는 children reference까지 확인한다. 자식이 바뀌었는데 부모만 stale reference로 남는 상태를 허용하지 않는다.

Node Cache는 객체 재사용을 담당한다. Composition 합성 결과 재사용은 Composition Cache의 책임이다.

## 7. Composition Cache

Composition Cache는 Composition Preview Node의 합성 결과를 재사용하는 Runtime Resource다.

Cache Key에 포함되는 최소 요소:

- Composition Preview Node id
- Logical Size
- Preview Quality
- Preview Scale
- Renderer Mode (`fast-preview`)
- Runtime 식별 정보

재사용 조건:

- Composition Dirty 없음
- Child Dirty 없음
- Logical Size 동일
- Preview Quality 동일
- Preview Scale 동일
- Node reference 동일

Cache hit이면 자식 Layer를 다시 합성하지 않는다. Cache miss이면 Surface Cache에서 작업 surface를 받아 다시 합성한다.

## 8. Surface Cache

Surface Cache는 Composition 합성 작업 공간인 Canvas surface를 재사용하는 Runtime Resource다.

Cache Key에 포함되는 최소 요소:

- Logical Width
- Logical Height
- Preview Quality
- Preview Scale
- Pixel Width
- Pixel Height

Composition id는 Surface Cache key가 아니다. 같은 크기와 품질 조건이면 다른 Composition도 surface를 재사용할 수 있다.

역할 구분:

- Composition Cache: 합성 결과 재사용
- Surface Cache: 합성 작업 공간 재사용

Unmount 또는 dispose 시 active surface와 pool surface를 정리해 Runtime resource leak을 막는다.

## 9. Playback Dirty Update

Playback frame이 바뀌어도 전체 Preview Scene을 매번 새로 만들지 않는다.

현재 규칙:

- 첫 Fast Preview 생성 또는 composition 변경 때만 Preview Scene Generation 증가
- 이후 frame update는 기존 Preview Scene을 기준으로 dirty node만 갱신
- 표시 결과가 같은 node는 clean node로 유지
- Keyframe / Modifier 결과로 표시값이 바뀐 node만 updated node가 된다

Composition Cache와 Surface Cache는 Playback Dirty Update 결과를 그대로 사용한다.

## 10. drawImage 최소화

Canvas Preview Adapter는 retained draw state를 사용한다.

생략 조건:

- Dirty 아님
- Node Cache reference 유지
- Dirty bounds와 겹치지 않음
- 필요한 Composition Cache 결과가 유지됨

반드시 다시 그리는 경우:

- Dirty Node
- Visibility 변경
- Opacity 변경
- Source 변경
- Dirty bounds와 겹치는 clean top-level node
- 새 Composition 또는 새 Surface

정확성을 위해 dirty bounds와 겹치는 clean node는 다시 표시될 수 있다. 이 경우에도 clean Composition은 Composition Cache hit surface를 사용하므로 자식 Layer를 다시 `drawImage`하지 않는다.

## 11. Performance QA 결과

`scripts/verifyPreviewPerformanceQa.ts`는 Sprint Baseline API로 시작 기준과 종료 기준을 비교한다.

400 frame 기준 결과:

| 항목 | Sprint 시작 | Sprint 종료 | 변화 |
|---|---:|---:|---:|
| Preview Scene Generation | 400 | 1 | -399 |
| Playback Dirty Node | 0 | 28 | +28 |
| Playback Clean Node | 0 | 1967 | +1967 |
| Node Updated | 0 | 28 | +28 |
| Node Reused | 0 | 1967 | +1967 |
| Composition Cache Hit | 0 | 6 | +6 |
| Composition Cache Miss | 400 | 15 | -385 |
| Surface Create | 400 | 15 | -385 |
| Surface Reuse | 0 | 0 | 0 |
| Surface Dispose | 0 | 0 | 0 |
| drawImage | 2000 | 87 | -1913 |
| drawImage Skipped | 0 | 1895 | +1895 |
| Canvas Draw Time | 400 | 400 | 0 |

해석:

- Preview Scene은 매 frame 생성에서 최초 1회 생성으로 줄었다.
- Composition miss와 Surface create가 400회에서 15회로 줄었다.
- `drawImage`는 2000회에서 87회로 줄었다.
- clean node와 skipped draw 수치가 증가해 “다시 그리지 않는 Renderer” 원칙이 실제 Runtime Metrics로 확인됐다.

## 12. Stress Test 결과

`scripts/verifyPreviewStressTest.ts`는 다음 상황을 검증한다.

- 10000 frame 긴 Playback
- retained canvas 반복 draw
- 300 Composition / 1000 Layer 대형 Preview Scene
- Preview Quality 반복 변경
- Import / Refresh / Delete 유사 source set 반복
- Composition Cache / Surface Cache / Preview Bitmap Cache dispose

대표 결과:

```text
peakTrackedBytes: 12206080
averagePlaybackDirtyNode: 약 0.045
finalPreviewCacheBytes: 0
```

## 13. Regression 확인

Sprint 종료 QA에서 다음 회귀를 확인했다.

- Accurate Renderer 결과 유지
- Export Original Source 계약 유지
- Animation Evaluation 계약 유지
- Preview Scene 계약 유지
- History / Undo / Redo 정책 유지
- Timeline / Properties / Canvas / PSD Import verification 통과
- Engine Import Boundary 통과

## 14. 남은 한계

- 실제 브라우저 메모리 API 기반 측정이 아니라 Runtime tracked bytes 기준으로 검증한다.
- 실제 PSD 파일 반복 import/refresh E2E가 아니라 Preview source set lifecycle verification으로 Runtime 경계를 검증한다.
- dirty bounds와 겹치는 clean top-level node는 정확성을 위해 다시 표시될 수 있다.
- `canvas2dPreviewSceneAdapter.ts`는 책임이 커져 후속 리팩토링 후보로 남긴다.

## 15. 후속 작업 기준

Preview Runtime Optimization Sprint는 완료됐다.

후속 Sprint는 이 구조를 다시 바꾸기보다, 다음 항목을 필요할 때 제품 목표에 맞춰 선택한다.

- 실제 브라우저 Performance panel 기반 측정
- 대형 실제 PSD 샘플 E2E
- Canvas adapter 책임 분리
- GPU/WebGL 또는 Worker Rendering 검토
- UI에서 Runtime Metrics를 노출할지 여부

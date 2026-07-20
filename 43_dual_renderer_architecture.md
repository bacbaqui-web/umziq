# Dual Renderer Architecture

> 문서 번호: 43
> 완료된 기능 문서
> 범위: Sprint 98에서 완성한 Animation Evaluation / Fast Preview Renderer / Accurate Renderer 분리 구조

## 1. 기능을 시작한 이유

기존 Canvas Preview는 편집, 드래그, 재생이 모두 전체 합성 중심으로 동작했다. 이 구조는 결과는 단순하지만, 대용량 PSD나 많은 Layer/Composition을 다룰 때 편집 반응성을 높이기 어렵다.

Sprint 98의 목적은 곧바로 cache 최적화를 구현하는 것이 아니라, 먼저 Preview Runtime과 Accurate Runtime을 분리할 수 있는 구조를 확정하는 것이었다.

핵심 질문은 다음과 같았다.

- Animation 계산은 하나만 유지할 수 있는가?
- Fast Preview와 Accurate Renderer가 같은 Animation 결과를 사용할 수 있는가?
- 편집용 Preview는 Layer/Composition 단위로 다룰 수 있는가?
- 최종 정확 재생과 Export 경계는 기존 RenderFrame 계약을 유지할 수 있는가?

## 2. 기존 Canvas 전체 합성 구조의 문제

기존 구조는 현재 frame을 계산한 뒤 Canvas에 전체 frame을 다시 합성하는 방식에 가까웠다.

```text
Timeline frame
  → Animation 계산
  → RenderFrame
  → Canvas 전체 draw
```

이 구조의 문제:

- 움직이지 않는 Layer와 Composition도 함께 다시 그려질 수 있다.
- Drag 중 Preview만 빠르게 갱신하기 어렵다.
- Renderer와 Animation Evaluation의 경계가 흐려지기 쉽다.
- Fast Preview용 Runtime을 추가하려면 RenderFrame 앞에 독립적인 계산 결과가 필요하다.
- Composition 단위 cache나 Node cache를 넣을 기준 Runtime이 부족하다.

## 3. Sprint 목표

Sprint 98의 목표는 Dual Renderer 구조를 만드는 것이었다.

```text
Animation Evaluation
  ↓
Evaluated Scene
  ├─ Fast Preview Renderer
  │    ↓
  │  Preview Scene
  │    ↓
  │  Preview Update Pipeline
  │    ↓
  │  Canvas
  │
  └─ Accurate Renderer
       ↓
     RenderFrame
       ↓
     Canvas
```

원칙:

- Animation Evaluation은 하나만 존재한다.
- Fast Preview Renderer와 Accurate Renderer는 같은 Evaluated Scene을 입력으로 사용한다.
- Renderer는 Animation을 다시 계산하지 않는다.
- Renderer 차이는 표시 방식에만 존재한다.
- Accurate Renderer는 기존 `RenderFrame` 출력 계약을 유지한다.
- Export 경계는 Accurate Renderer와 Original Source fallback 계약을 유지한다.

## 4. Animation Evaluation 분리

Animation Evaluation은 Renderer가 아닌 `buildEvaluatedScene()` 경계에서 수행한다.

계산 대상:

- Position
- Scale
- Rotation
- Opacity
- Anchor
- Visibility
- Hierarchy
- Layer Order
- Timeline local/global frame
- Keyframe과 Modifier 적용 결과

Renderer는 이 값을 다시 계산하지 않는다. Renderer는 계산된 값을 각자의 출력 Runtime으로 변환한다.

## 5. Evaluated Scene

`Evaluated Scene`은 현재 frame의 계산 완료 Runtime Scene이다.

포함하는 정보:

- Composition ID
- global frame
- logical frame size
- source별 local frame
- drawable node
- composition node
- transform
- opacity
- visibility
- order
- logical size
- children hierarchy

포함하지 않는 정보:

- `CanvasImageSource`
- `HTMLCanvasElement`
- Preview bitmap
- Preview resolver
- Original source
- Render Command
- Canvas API

즉 Evaluated Scene은 저장 Domain도 아니고 Canvas 출력 명령도 아니다. Renderer들이 공통으로 읽는 Runtime 계산 결과다.

## 6. Renderer Mode

Renderer Mode는 `full-render`와 `fast-render` 두 값을 가진다.

```text
rendererMode
  ├─ full-render
  └─ fast-render
```

Renderer Mode는 Playback Runtime state에 속한다.

- Project data를 변경하지 않는다.
- History를 증가시키지 않는다.
- Animation Evaluation 결과를 바꾸지 않는다.
- Canvas Render 경로가 어떤 Renderer output을 소비할지 선택한다.

기본값은 기존 정확 경로를 보존하는 `full-render`다. Preview 상단의 `표시 모드` control은 `작업용`을 `fast-render`, `완성본`을 `full-render`로 표시하며 설명 `빠르게 작업할 때 추천`과 `최종 결과 그대로 표시`를 항상 노출한다. 이 control은 별도 state를 만들지 않고 Root에서 Canvas Composition과 Preview props를 거쳐 주입된 기존 `usePlaybackEngine.setRendererMode`만 호출한다. Preview Quality control과는 값과 command가 독립적이다.

## 7. Fast Preview Renderer

Fast Preview Renderer는 Evaluated Scene을 `Preview Scene`으로 변환한다.

```text
Evaluated Scene
  → Fast Preview Renderer
  → Preview Scene
```

Fast Preview Renderer의 목표는 정확도를 희생해 속도를 얻는 것이 아니다.

진짜 목표:

- 움직이지 않는 Layer/Composition을 다시 렌더하지 않는 구조를 준비한다.
- Layer와 Composition을 독립 Preview Node로 유지한다.
- Transform 변경을 가능한 경우 Node 이동으로 처리할 수 있게 한다.
- Animation 결과는 Accurate Renderer와 동일하게 유지한다.

이번 Sprint에서는 Dirty Cache나 Node Cache를 구현하지 않았다. 대신 그 cache를 넣을 Runtime 구조를 만들었다.

## 8. Accurate Renderer

Accurate Renderer는 Evaluated Scene을 기존 `RenderFrame`으로 변환한다.

```text
Evaluated Scene
  → Accurate Renderer
  → RenderFrame
```

역할:

- 정확 재생
- 전체 합성
- Export 경계의 기준 Renderer

Accurate Renderer는 Preview Update Pipeline state를 사용하지 않는다. Preview resolver가 있으면 화면 Preview source를 사용할 수 있고, resolver가 없거나 null을 반환하면 original source로 fallback한다.

따라서 향후 Export는 resolver 없이 Accurate Renderer를 사용해 Original Source 계약을 유지할 수 있다.

## 9. Preview Scene

Preview Scene은 Fast Preview Renderer의 출력 Runtime이다.

포함하는 정보:

- Layer Preview Node
- Composition Preview Node
- parent / children
- transform
- opacity
- visibility
- order
- local frame
- global frame
- logical size
- identity

포함하지 않는 정보:

- Canvas
- drawImage
- bitmap
- resolver
- CanvasImageSource
- HTMLCanvasElement
- RenderCommand

Preview Scene은 표시 Runtime의 구조를 설명하지만, 직접 그리는 방법은 알지 않는다. Canvas adapter만 Preview Scene을 그린다.

## 10. Layer Preview

Layer Preview Node는 개별 Layer를 Preview Scene 안에서 표현한다.

사용하는 정보:

- transform
- opacity
- visibility
- logical size
- identity
- drawable/layer 연결 정보

Layer Preview는 source resolver 또는 original fallback을 통해 Canvas adapter에서 그려진다. Layer Preview Node 자체는 source image를 보관하지 않는다.

## 11. Composition Preview

Composition Preview Node는 자식 Preview Node를 재귀적으로 가진다.

```text
Composition Preview Node
  ├─ Layer Preview Node
  └─ Composition Preview Node
```

Composition Preview의 Runtime 계약은 Layer Preview와 같은 Base Preview Node를 공유한다.

Canvas adapter는 Composition children을 임시 surface에 먼저 그리고, 부모 Composition node의 transform/opacity/visibility를 적용해 부모 context에 표시한다.

이번 Sprint에서 구현하지 않은 것:

- Composition Cache
- Surface Cache
- Surface reuse 최적화
- drawImage 최소화

## 12. Preview Update Pipeline

Preview Update Pipeline은 기존 Preview Scene을 갱신하는 Canvas Runtime 경계다.

역할:

- Drag 중 target node transform/opacity draft 갱신
- Playback frame 변화에서 다음 Preview Scene을 기존 Preview Scene에 병합
- 같은 identity의 변경 없는 node reference 유지

```text
Preview Scene
  → Preview Update Pipeline
  → Updated Preview Scene
  → Canvas
```

Pipeline은 Animation Evaluation을 수행하지 않는다. Renderer를 직접 생성하지도 않는다.

## 13. Drag 연결

Drag 경로는 Preview Update Pipeline을 사용한다.

```text
Canvas pointer move
  → useCanvasTransformController
  → previewUpdates.updateTransform()
  → Preview Update Pipeline
  → Canvas
```

현재 한계도 있다. Drag onMove는 Preview Update Pipeline 갱신과 동시에 Project state update command도 호출한다.

```text
Drag move
  ├─ Preview Update Pipeline 갱신
  └─ Project state update
       ↓
     useRenderEngine 재계산 가능
```

따라서 drag 중 Animation Evaluation / Fast Preview Renderer 재호출 가능성이 남아 있다. 이 지점은 다음 최적화 Sprint의 첫 번째 대상이다.

## 14. Fast Playback

Fast Playback은 `fast-render` mode에서 Preview Scene 경로를 사용한다.

```text
Playback currentFrame
  → useRenderEngine
  → buildEvaluatedScene()
  → renderFastPreviewRenderer()
  → 새 Preview Scene
  → updatePreviewSceneFromPlaybackFrame()
  → Canvas
```

현재 Pipeline은 다음 frame Preview Scene을 기존 Preview Scene과 비교해 변경 없는 node reference를 유지한다.

아직 남은 비용:

- 매 frame Evaluated Scene 생성
- 매 frame 새 Preview Scene 생성

이 비용은 다음 Sprint의 Playback Dirty Update에서 다룬다.

## 15. Accurate Playback Runtime

Accurate Playback은 `full-render` mode에서 기존 전체 합성 경로를 사용한다.

```text
Playback currentFrame
  → useRenderEngine
  → buildEvaluatedScene()
  → renderAccurateRenderer()
  → RenderFrame
  → renderFrameToCanvas
```

Fast Preview Runtime과 분리된 점:

- Accurate는 `RenderFrame`을 출력한다.
- Accurate는 Preview Update Pipeline state를 사용하지 않는다.
- Accurate는 Preview Scene을 소비하지 않는다.

공유하는 점:

- 같은 Evaluated Scene
- 같은 Animation Evaluation 결과
- 같은 source resolver 계약

## 16. Runtime Verification 결과

Task 10에서 실제 코드 기준 Runtime 경계를 검증했다.

확인된 사실:

- `useRenderEngine`이 `buildEvaluatedScene()`을 호출한다.
- Renderer Mode dispatcher가 `full-render`와 `fast-render` 결과를 나눈다.
- Drag는 Preview Update Pipeline command를 호출한다.
- Playback `fast-render`는 새 Preview Scene을 만든 뒤 Pipeline에서 병합한다.
- Accurate Runtime은 Fast Preview Pipeline state에 의존하지 않는다.
- Fast Preview는 Accurate Renderer의 RenderFrame에 의존하지 않는다.

확인된 병목:

- Drag onMove가 Project state update를 함께 수행한다.
- Playback frame마다 Preview Scene 생성이 남아 있다.

## 17. Fast와 Accurate 결과 비교

Fast Preview와 Accurate Renderer는 같은 Evaluated Scene을 입력으로 사용한다.

검증 항목:

- Position
- Scale
- Rotation
- Opacity
- Visibility
- Hierarchy
- Layer Order
- Composition 결과
- Timeline local/global frame
- Preview Quality
- Resolver fallback

결론:

- Animation 결과는 Renderer별로 갈라지지 않는다.
- Accurate Renderer는 Evaluated Scene을 RenderFrame으로 바꾼다.
- Fast Preview Renderer는 Evaluated Scene을 Preview Scene으로 바꾼다.
- Preview Quality는 source pixel size와 image 선택만 바꾸며 logical Animation 결과를 바꾸지 않는다.
- Resolver가 없거나 null이면 original source fallback이 유지된다.

## 18. 최종 구조

Sprint 종료 기준 최종 구조는 다음과 같다.

```text
Playback Runtime
  ├─ currentFrame
  ├─ playheadFrame
  ├─ playbackRange
  ├─ loop/play state
  └─ rendererMode

useRenderEngine
  ↓
buildEvaluatedScene()
  ↓
Evaluated Scene
  ├─ renderWithRendererMode("full-render")
  │    ↓
  │  Accurate Renderer
  │    ↓
  │  RenderFrame
  │    ↓
  │  renderFrameToCanvas
  │
  └─ renderWithRendererMode("fast-render")
       ↓
     Fast Preview Renderer
       ↓
     Preview Scene
       ↓
     Preview Update Pipeline
       ↓
     renderPreviewSceneToCanvas
```

## 19. 변경된 주요 파일과 책임

| 파일 | 책임 |
|---|---|
| `src/engines/playback-render/helpers/evaluatedSceneHelpers.ts` | 현재 frame의 Animation/Timeline/Hierarchy 결과를 Evaluated Scene으로 평가 |
| `src/engines/playback-render/models/evaluatedSceneModel.ts` | Renderer 독립 Runtime Scene 계약 |
| `src/engines/playback-render/models/rendererModeModel.ts` | `full-render` / `fast-render` mode와 renderer 입출력 계약 |
| `src/engines/playback-render/renderers/accurateRenderer.ts` | Evaluated Scene을 RenderFrame으로 변환 |
| `src/engines/playback-render/renderers/fastPreviewRenderer.ts` | Evaluated Scene을 Preview Scene으로 변환 |
| `src/engines/playback-render/models/previewSceneModel.ts` | Preview Scene과 Preview Node 계약 |
| `src/engines/playback-render/helpers/previewSceneUpdateHelpers.ts` | Preview Scene drag/playback update helper |
| `src/engines/playback-render/adapters/canvas2dPreviewSceneAdapter.ts` | Preview Scene Canvas 표시 adapter |
| `src/engines/playback-render/adapters/canvas2dRenderAdapter.ts` | Accurate RenderFrame Canvas 표시 adapter |
| `src/engines/canvas/controllers/usePreviewUpdatePipeline.ts` | Canvas Runtime의 Preview Scene update pipeline |
| `src/engines/canvas/controllers/useCanvasRenderController.ts` | RenderFrame 또는 Preview Scene을 Canvas adapter에 전달 |
| `src/engines/playback-render/useRenderEngine.ts` | Evaluated Scene 생성과 Renderer Mode dispatch |
| `src/engines/playback-render/usePlaybackEngine.ts` | Playback read/command와 renderer mode 노출 |
| `src/editor/useEditorCompositionRoot.ts` | 기존 Playback mode와 setter를 Canvas Composition에 주입 |
| `src/engines/canvas/useCanvasComposition.ts` | Renderer Mode read/command를 Preview View props로 투영 |
| `src/features/preview/components/PreviewRendererModeControl.tsx` | `작업용` / `완성본` radio와 항상 보이는 설명을 표시하고 주입된 Playback setter만 호출 |

## 20. QA 결과

검증 결과:

- `npm run lint`: 성공
- `npm test`: 성공
- `npm run build`: 성공
  - Vite 500kB chunk size warning은 표시되었지만 build는 성공
- `npm run qa`: 성공
- `git diff --check`: 성공

관련 verification suite는 Engine Import Boundary, Animation, Render helper, Canvas Preview Integration, Preview Quality/Cache, PSD Pipeline, Timeline, Properties, History 회귀를 함께 검증한다.

## 21. 현재 남은 성능 병목

Sprint 98은 구조 분리를 완료했지만 최적화를 구현하지 않았다.

남은 병목:

- Drag onMove가 Preview Update Pipeline과 Project state update를 동시에 수행한다.
- Drag 중 Animation Evaluation / Fast Preview Renderer 재호출 가능성이 남아 있다.
- Playback은 매 frame Evaluated Scene과 Preview Scene을 새로 만든다.
- Composition Preview는 임시 surface를 사용하지만 Composition Cache와 Surface Cache가 없다.
- Dirty Cache와 Node Cache가 없다.
- drawImage 최소화가 없다.

## 22. 다음 최적화 Sprint와의 경계

다음 Sprint는 `97_next_sprint.md`의 Preview Runtime Optimization이다.

다음 Sprint에서 하지 말아야 할 것:

- 새 Engine 추가
- Animation Evaluation 구조 변경
- Renderer Mode 계약 변경
- Evaluated Scene 기본 계약 변경
- Preview Scene 기본 계약 변경
- Accurate Renderer 출력 계약 변경
- WebGL 전환
- Export 최적화

다음 Sprint에서 해야 할 것:

- Drag Runtime 분리
- Dirty Cache
- Node Cache
- Composition Cache
- Surface Cache
- Playback Dirty Update
- drawImage 최소화
- Runtime Metrics
- Stress Test
- 최종 Performance QA

가장 먼저 분리할 지점:

```text
Drag move
  → Preview Update Pipeline만 갱신

Drag commit
  → Project state / History commit
  → Evaluated Scene 재계산
```

이 경계가 정리되면 “다시 그리지 않는 Renderer” 구현을 구조 변경 없이 시작할 수 있다.

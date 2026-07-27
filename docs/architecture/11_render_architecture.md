# Render Architecture

## 상태

- 역할: Render의 영구 canonical Architecture
- 현재 상태: 구현 완료된 canonical 구조
- 현재 Runtime 조사 기록:
  `docs/completed/59_render_runtime_optimization_architecture_audit.md`,
  `docs/completed/60_render_runtime_architecture_inventory.md`,
  `docs/completed/61_render_runtime_bible.md`

## 한 문장 정의

Frame Evaluation이 현재 장면을 한 번 계산하고, Preview Renderer와 Accurate
Renderer가 같은 `EvaluatedScene`을 서로 다른 전략으로 그린다.

## 전체 흐름

```text
Project + Current Frame + Draft + Source
                  ↓
          Frame Evaluation
                  ↓
            EvaluatedScene
        ┌─────────┴─────────┐
        ↓                   ↓
Preview Renderer     Accurate Renderer
        ↓                   ↓
  Editor Canvas       정확한 전체 Frame
        ↓                   ↓
  Editor Overlay        미래 Export
```

작품 pixel과 Editor Overlay는 서로 다른 결과다.

## Frame Evaluation

입력:

- LayerDocumentProject
- Timeline Runtime의 current frame
- 활성 Transform Draft
- Animation과 Modifier
- Source descriptor와 resolved visual resource

출력:

- 현재 frame의 계층, Transform, opacity, local frame과 visual identity를 가진
  `EvaluatedScene`

Frame Evaluation은 Renderer mode, Preview Quality, Canvas pixel, Dirty
Region, Overlay와 Export를 알지 못한다. Renderer마다 다른 Scene을 만들지
않는다.

## EvaluatedScene

`EvaluatedScene`은 저장 데이터가 아니라 현재 frame의 계산 결과다. 두
Renderer가 공유하는 유일한 scene 입력이며 Canvas나 ImageBitmap을 소유하지
않는다.

주요 identity는 다음 의미를 분리한다.

- `layerDocumentId`: 작업 Layer identity
- `sourceId`: 공유 원본 identity
- `renderItemId`: drawable의 Source Runtime visual 또는 Group의
  renderable-content identity
- `drawableId`: Source 내부 drawable identity
- `targetCompId`: Group이 그릴 target composition identity
- source resource key: decoded visual generation
- layer result key: 현재 Layer visual 결과
- `localFrameByLayerDocumentId`: LayerDocument별 현재 local frame lookup

Renderer 내부 command identity를 Project identity로 사용하지 않는다.

## Preview Renderer

Preview Renderer는 사용자가 Editor에서 항상 보는 작품 화면을 담당한다.
정지, Draft, Properties 변경, seek, playback과 Undo/Redo를 같은 제품
경로에서 처리한다.

목표는 같은 시각 결과를 가능한 한 적은 계산으로 갱신하는 것이다.

- Previous Scene
- node identity와 reference reuse
- Dirty Region
- Composition Cache
- Surface Cache
- Source Runtime Cache
- 증분 Canvas draw

변화가 없으면 draw를 건너뛰고, 일부 변화만 있으면 필요한 영역만 다시
그린다. Cache key와 painter order는 출력 정확성의 일부다.

## Accurate Renderer

Accurate Renderer는 같은 `EvaluatedScene`에서 현재 frame 전체를 처음부터
끝까지 정확하게 생성한다.

- Root Canvas 전체를 매 호출 다시 그린다.
- 모든 활성 Layer와 Group을 painter order대로 순회한다.
- Previous Scene, Dirty Region과 Preview 결과 Cache에 의존하지 않는다.
- 작업 Canvas allocation은 재사용할 수 있지만 이전 frame의 완성 결과는
  재사용하지 않는다.
- Editor Overlay를 포함하지 않는다.

정확성이 속도보다 우선이며 미래 Export의 frame 생성 기반이다.

## Canvas Draw

Renderer는 그릴 scene 또는 command를 준비하고 Canvas painter가 실제 pixel을
기록한다.

Preview draw는 retained state와 Dirty Region을 사용할 수 있다. Accurate
draw는 전체 target을 clear한 뒤 현재 frame 전체를 그린다. 두 경로의 최종
작품 결과는 같은 조건에서 시각적으로 일치해야 한다.

## Editor Overlay

Overlay는 작품이 아니라 편집 도구다.

- Selection과 Outline
- Transform Handle, Anchor와 Pivot
- Motion Path
- Alpha Hit Test
- 선택 Screen Tone
- Hover와 Readout

Overlay는 `EvaluatedScene`과 Editor Selection/Draft를 기준으로 별도
projection을 만든다. Renderer output, Accurate frame와 Export 결과에
포함되지 않는다.

## Cache 소유권

| Cache | 책임 | 수명 |
|---|---|---|
| Source Runtime Cache | 외부 Source를 decoded visual로 제공 | Project session |
| Previous Preview Scene | node identity 비교 | Canvas Preview Runtime |
| Dirty Region | 이전/현재 변경 Bounds 계산 | Preview draw |
| Composition Cache | 변하지 않은 Group 합성 결과 재사용 | Canvas Preview Runtime |
| Surface Cache | offscreen Canvas allocation 재사용 | Canvas Preview Runtime |
| Alpha/Glow scratch | 선택과 hit test용 Editor 계산 | Canvas Overlay Runtime |

Cache는 Project와 History에 저장하지 않는다. Source revision, visual identity,
quality/scale/size와 lifecycle 변경에 맞춰 invalidate 또는 dispose한다.

## Preview Quality, Source Sampling과 Metrics

`previewQuality`는 Canvas backing scale과 Preview Cache 책임이다.
`sourceSamplingQuality`는 Frame Evaluation이 Source visual을 요청할 때
사용하는 별도 계약이다. 현재 Canvas Read 경계가 두 값을 명시적으로
연결하지만 같은 상태나 타입으로 소유하지 않는다.

Metrics와 FPS는 관찰용 Runtime이다. frame p95, draw skip, Dirty 범위,
Composition hit/miss, Surface reuse와 drawImage 수를 측정하지만 제품 결과를
바꾸지 않는다. retained Preview 관찰값은 `previewDirtyNode`,
`previewNodeReused`, `previewCompositionReused`처럼 Preview 책임 이름을
사용한다. Source Runtime Cache metric은 이 Runtime에 억지로 합치지 않는다.

## 미래 Export

Export는 세 번째 Renderer가 아니다.

```text
Frame Evaluation
→ Accurate Renderer
→ frame scheduling
→ Encoder + Audio
→ File
```

Export lifecycle, Encoder, Audio mux와 파일 생성은 별도 후속 기능이며 현재
Render Runtime에 미리 Store나 mode를 추가하지 않는다.

## 구현 규칙

현재 구현 사실은 `docs/20_src_map.md`를 따른다.

- Preview와 Accurate는 같은 `EvaluatedScene`을 사용한다.
- Accurate는 Preview 증분 state에 의존하지 않는다.
- Preview 최적화와 painter order를 훼손하지 않는다.
- Project schema, History와 Timeline Runtime을 변경하지 않는다.
- Editor 제품 경로는 Preview Renderer 하나만 사용한다.
- Accurate Renderer는 직접 호출 가능한 전체 Frame 생성 경계로 유지한다.
- Renderer 선택 mode와 사용자 선택 UI는 존재하지 않는다.

## 검증 원칙

- 동일 `EvaluatedScene` 기반 Preview/Accurate pixel 비교
- flat/nested Group과 painter order
- opacity, Transform, Animation, Modifier와 Draft
- Source revision, Missing Source와 placeholder
- Preview frame p95, FPS, Dirty, Cache와 Surface 수치
- Accurate의 전체 frame draw와 Preview state 비의존성
- Overlay가 작품 pixel에 포함되지 않음

비교는 테스트 행위이며 별도 제품 Runtime이나 Renderer 종류가 아니다.

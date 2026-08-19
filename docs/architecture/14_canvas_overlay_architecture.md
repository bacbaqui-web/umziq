# Canvas & Overlay Architecture

## 한 문장 정의

Canvas는 현재 작품을 보여주고 편집 Intent를 만들며, Overlay는 작품 pixel과
분리된 Editor 전용 표시다.

## Canvas Engine 책임

- viewport zoom, pan과 coordinate 변환
- pointer hit test와 tool interaction
- Transform Draft 생성과 commit intent
- Frame Evaluation 결과를 Preview Renderer에 연결
- Canvas draw state, Cache, Metrics와 FPS
- Selection과 Overlay projection

Canvas Engine은 Project를 소유하지 않고 Timeline clock을 직접 소유하거나
다른 Panel을 수정하지 않는다.

## 입력 흐름

```text
Project + Timeline frame + Draft + Source
→ Frame Evaluation
→ EvaluatedScene
├─ Preview Renderer → 작품 Canvas
└─ Overlay Projection → Editor Overlay
```

Canvas interaction은 공개 command와 Draft port를 사용한다.

## Transform 조작

Position, Scale, Rotation, Anchor와 Opacity 조작은 같은 계약을 따른다.

- 시작 시 committed Transform을 기준으로 Draft를 만든다.
- PointerMove 동안 Project와 History는 변경하지 않는다.
- 작품 Layer와 모든 Overlay는 같은 Draft snapshot을 사용한다.
- PointerUp에서 transaction 한 번으로 commit한다.
- Escape/Cancel은 Draft만 폐기한다.

## Overlay 구성

- Selection silhouette와 Outline
- Position/Scale/Rotation/Opacity Handle
- Anchor와 Pivot
- Motion Path와 current point
- Hover
- 값 Readout
- 선택 Screen Tone

Overlay는 Export와 Accurate frame에 포함되지 않는다.

선택된 Drawing Layer는 전용 SVG interaction surface를 표시한다. surface는 Layer의
position, anchor, scale과 rotation을 따라가며 화면 좌표를 Layer local 좌표로 저장한다.
Drawing pointer session은 capture/cancel 경계를 사용하고 작품 pixel과 분리된다.

## Selection과 Direct Hit Test

Canvas direct selection은 후보를 다음 순서로 줄인다.

```text
Bounds
→ transformed quad
→ source alpha
```

Painter order에서 가장 앞에 보이는 유효 Layer를 선택한다. Group과
SubComposition 선택 규칙은 현재 navigation scope를 따른다.

Hit Test와 선택 silhouette는 같은 Source Alpha 계약을 사용해 보이는 영역과
클릭 가능한 영역이 어긋나지 않게 한다.

## Alpha와 Screen Tone

Source Alpha는 Source visual이 바뀌기 전까지 재사용한다. Position, Scale,
Rotation, Anchor와 Draft 같은 geometry 변화는 alpha bitmap을 다시 만들지
않고 projection만 갱신한다.

선택 강조는 선택된 Layer 하나만 계산한다. Screen Tone scratch와 projection은
Canvas Overlay Runtime이며 Project, History와 Source descriptor에 저장하지
않는다.

Drag 중 불필요한 hover/silhouette 재계산은 피하되, 작품과 Transform
Overlay의 Draft 추종 계약은 유지한다.

## Motion Path

Motion Path의 current point, polyline, sample과 keyframe point는 공통 geometry
생성 결과를 사용한다. Position Draft 중 화면에 보이는 current geometry는
Project Commit을 기다리지 않는다.

Animation 원본과 sampling 책임은
`docs/architecture/16_animation_architecture.md`를 따른다.

## Preview Runtime

Canvas Panel 수명 동안 다음 Runtime을 가질 수 있다.

- Canvas backing scale용 Preview Quality
- previous scene와 draw state
- Dirty Region
- Composition/Surface Cache
- Alpha/Screen Tone scratch
- Metrics와 FPS
- viewport와 tool state

이 값은 저장하거나 Undo/Redo하지 않는다.

Source sampling은 별도 `sourceSamplingQuality` 계약이며 Canvas Read 경계에서
Preview Quality로부터 명시적으로 투영된다. Source resource의 수명과 cache는
Source Runtime이 소유한다.

## 불변 조건

- 작품 pixel과 Editor Overlay를 섞지 않는다.
- Canvas는 Project/Timeline/Visual Engine을 직접 mutation하지 않는다.
- 모든 Transform 표시가 같은 Draft snapshot을 사용한다.
- hit test와 silhouette는 같은 alpha 의미를 사용한다.
- Cache는 결과를 빠르게 만들 뿐 편집 원본이 아니다.

## 관련 Architecture

- Render: `docs/architecture/11_render_architecture.md`
- History/Draft: `docs/architecture/13_history_draft_architecture.md`
- Source: `docs/architecture/15_source_architecture.md`
- Animation: `docs/architecture/16_animation_architecture.md`

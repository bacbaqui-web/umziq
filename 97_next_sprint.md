# Next Sprint Handoff

> 상태: 계획 초안
> 구현: 시작하지 않음

## Sprint 이름

Canvas Visual Layer Selection

## Sprint 목표

Canvas에서 현재 선택한 대상을 박스만으로 구분하지 않고 실제 표시 실루엣의 Glow로 확인한다.

Canvas의 보이는 Layer 또는 현재 Composition의 Sub Composition을 클릭해 기존 Timeline/Properties/Canvas Selection으로 직접 선택할 수 있게 한다.

```text
Canvas Pointer
→ 현재 Evaluated Scene의 top-level 표시 대상 Hit Test
→ 기존 applySelectionForComposition()
→ Timeline / Properties / Gizmo / Glow 동기화
```

```text
Selected Evaluated Scene Node
→ Editor-only Alpha Mask
→ Silhouette Glow Overlay
```

Preview Renderer와 Export 출력에는 Glow나 선택 정보를 넣지 않는다.

## UX 계약

- Glow는 기존 Selection Box의 사각형 Glow가 아니라 Layer의 불투명 픽셀 실루엣을 따른다.
- 기존 Selection Box, Outline과 Transform Handle은 유지한다.
- Glow는 청록 계열의 낮은 강도로 표시하며 실제 Layer 내용을 가리지 않는다.
- Glow 두께는 Zoom과 무관하게 화면상 일정한 크기를 유지한다.
- 현재 Composition의 top-level Layer와 immediate Sub Composition만 직접 선택한다.
- Sub Composition 내부 Layer는 관통 선택하지 않는다. 내부 Layer는 해당 Composition에 진입한 뒤 선택한다.
- 겹친 대상은 현재 Painter Order에서 가장 위에 보이는 대상을 선택한다.
- 투명 픽셀은 Hit로 취급하지 않는다. 큰 투명 여백만 클릭해서 Layer가 선택되지 않아야 한다.
- `visible=false`, 활성 시간 밖, 크기 0, 최종 Opacity 0 대상은 선택 후보에서 제외한다.
- 빈 Canvas를 클릭하면 Item Selection을 해제한다.
- Space+왼쪽 버튼 또는 Middle Button Pan은 Selection보다 우선하며 선택을 변경하지 않는다.
- Handle, Anchor, Motion Path Point는 직접 선택 Hit Test보다 우선한다.
- 이미 선택된 대상을 누르면 기존 Position Drag를 시작한다.
- 다른 대상을 누르면 첫 동작은 선택만 한다. 오조작을 막기 위해 같은 PointerDown에서 바로 이동시키지 않는다.
- 아래에 가려진 Layer 순환 선택과 Alt/Cmd 클릭은 이번 Sprint 범위에서 제외한다.

## 구조 원칙

- 새 Engine, 전역 Store 또는 Project State를 만들지 않는다.
- 기존 `EvaluatedScene`, `RenderItem`, Canvas Selection command를 재사용한다.
- Hit Test 기준은 Renderer Mode에 따라 없어질 수 있는 `RenderFrame`이나 lazy `PreviewScene`이 아니라 항상 존재하는 현재 `EvaluatedScene`으로 통일한다.
- Hit Test와 Glow는 Editor 전용 Selection 기능이다. Playback Renderer 결과, Preview Cache, Dirty Region, Export에는 포함하지 않는다.
- Draft Transform이 활성화된 선택 대상은 기존 `DraftTransformSnapshot` Geometry를 사용해 Glow와 Hit Geometry가 Layer/Selection/Gizmo를 따라간다.
- Alpha Mask 생성은 제품 State가 아니라 Editor 표시 계산으로 취급한다.

## 제안 구조

### 1. Selection Candidate

현재 `EvaluatedScene.nodes`의 top-level node를 Canvas 선택 후보로 사용한다.

- Drawable node → `TimelineSelection.kind = layer`
- Composition node → `TimelineSelection.kind = subComp`
- `sourceId`와 대응 Timeline `itemId`를 함께 유지한다.
- node 배열을 뒤에서 앞으로 검사해 마지막으로 그려진 최상단 대상을 우선한다.
- Composition node의 children은 Alpha 판정에는 사용하지만 선택 결과는 부모 Sub Composition으로 반환한다.

### 2. 공통 Selection Alpha Mask

선택 후보의 현재 시각 결과를 Editor 전용 투명 Mask로 만든다.

- 현재 Evaluated Transform과 source Alpha를 사용한다.
- Layer는 drawable Alpha를 사용한다.
- Sub Composition은 children의 합성 Alpha를 사용하되 선택 결과는 Sub Composition 하나다.
- 먼저 transformed quad/bounds로 빠르게 후보를 거른 뒤 Alpha를 확인한다.
- 동일한 Mask 생성 규칙을 Click Hit Test와 Silhouette Glow가 공유한다.

Mask용 scratch surface 또는 Overlay canvas는 UI 계산 자원이며 Project/History/Runtime State로 저장하지 않는다.

### 3. Editor-only Glow Overlay

Preview Canvas와 Gizmo 사이에 Selection Highlight 전용 Canvas layer를 둔다.

```text
Preview Canvas
→ Selection Silhouette Glow Canvas
→ Selection Box / Motion Path / Transform Gizmo
```

선택 Mask에서 외곽 blur만 만들고 내부는 제거해 Layer 원본 색과 밝기를 바꾸지 않는다. Overlay는 `pointer-events: none`이며 Export와 Preview Renderer 출력에 포함되지 않는다.

## Task 계획

### Task 1 — Selection UX 및 Runtime 계약 확정

- 현재 Selection, Pointer, Painter Order와 Sub Composition 경계를 문서화한다.
- 위 UX 계약을 fixture 기준으로 고정한다.
- 동일 source가 Timeline에 여러 번 배치된 경우 `itemId` 결정 규칙을 확정한다.
- 아직 구현하지 않는다.

### Task 2 — Selection Candidate와 Alpha Mask 설계

- `EvaluatedScene` top-level node에서 Timeline Selection 후보를 만드는 순수 구조를 설계한다.
- Layer/Sub Composition Alpha Mask 생성 경계를 확정한다.
- Main Renderer API나 출력 변경 없이 재사용할 helper/adapter 범위를 확정한다.
- 아직 UI를 연결하지 않는다.

### Task 3 — Canvas Hit Test 구현

- Canvas pointer를 기존 좌표 helper로 Composition world 좌표로 변환한다.
- transformed quad/bounds prefilter를 구현한다.
- 후보를 Painter Order 역순으로 검사한다.
- Alpha Mask의 해당 픽셀이 불투명한 첫 top-level 후보를 반환한다.
- Layer/Sub Composition, Rotation, non-uniform/negative Scale, non-center Anchor와 Transform Offset을 지원한다.

### Task 4 — Canvas 직접 선택 연결

- Canvas Engine 안에 단일 책임 Direct Selection Controller를 연결한다.
- 기존 `applySelectionForComposition()`을 사용해 Timeline, Properties, Draft reset 의미를 유지한다.
- `itemId`, `sourceId`, `kind`를 보존한다.
- Handle/Motion Path/Pan pointer 우선순위를 유지한다.
- 현재 선택 대상이면 기존 Position Drag, 다른 대상이면 선택만 수행한다.
- 빈 Canvas 클릭은 Selection을 해제한다.

### Task 5 — Silhouette Glow Overlay 구현

- 선택된 top-level node의 공통 Alpha Mask로 Editor-only Glow를 생성한다.
- Preview Canvas 위, Gizmo 아래에 표시한다.
- Zoom/Pan/Fit/1:1과 Rotation/Scale/Anchor/Offset을 반영한다.
- Position Drag와 Editor Draft Runtime 중 Glow가 Layer를 실시간으로 따라가게 한다.
- Glow는 pointer event를 받지 않는다.

### Task 6 — 통합 및 회귀 검증

- 직접 선택 후 Timeline, Properties, Selection Box, Handles와 Glow가 같은 대상을 표시하는지 정적/통합 fixture로 확인한다.
- Full/Fast Renderer Mode에서 선택 결과가 같은지 확인한다.
- Preview/Export pixel이 선택 전후 동일한지 확인한다.
- History가 생성되지 않는지 확인한다.
- 기존 Position/Anchor/Scale/Rotation Drag와 Motion Path interaction이 유지되는지 확인한다.

### Task 7 — 문서 갱신

- 실제 구현에 맞게 `20_src_map.md`를 갱신한다.
- `98_sprint_plan.md` 진행 상태를 갱신한다.
- Sprint 완료 시 다음 번호의 영구 기능 문서를 작성한다.
- 작업을 멈추는 시점에만 루트 에이전트가 `99_recent_task.md`를 작성한다.

### Task 8 — QA

- 사용자가 명시적으로 요청했을 때만 실제 브라우저 QA를 수행한다.
- `layer_test.psd`에서 Layer, 겹친 Layer, 투명 여백, Sub Composition, 빈 공간을 확인한다.
- QA 전에는 Sprint를 구현 완료/QA 대기 상태로 보고한다.

## 정적 검증 계획

- no scene / no hit
- visible=false / inactive / opacity 0 / zero-size 제외
- rotated quad 바깥 AABB 오탐 방지
- non-uniform/negative Scale
- non-center Anchor와 Transform Offset
- 투명 픽셀 통과 후 아래 Layer 선택
- 불투명 픽셀이 겹치면 최상단 Painter 선택
- Layer와 immediate Sub Composition 결과
- duplicate source의 정확한 Timeline `itemId`
- 빈 Canvas Selection 해제
- Full/Fast Mode 동일 후보
- Draft Position 중 Glow Geometry 추종
- Preview/Export 출력 불변
- 변경 파일 ESLint
- 관련 verification
- `npm run build`
- `git diff --check`

## QA 계획

- Canvas 클릭 → Timeline/Properties/Gizmo/Glow 동시 선택
- 투명 여백 클릭 시 아래의 보이는 Layer 선택
- 겹친 불투명 픽셀은 최상단 Layer 선택
- 빈 공간 클릭 시 선택 해제
- 다른 대상 첫 클릭에서 Layer가 이동하지 않음
- 현재 선택 대상 Position Drag 유지
- Handle/Anchor/Motion Path Point interaction 우선
- Space/Middle Pan 중 Selection 불변
- Layer 및 immediate Sub Composition 선택
- Zoom/Pan/Fit/1:1 좌표 정확성
- Glow가 실제 실루엣을 따르고 내용물을 덮지 않음
- Glow가 Draft Transform을 실시간 추종
- Glow filter가 viewport edge에서 잘리지 않음
- Full/Fast Renderer Mode 동일
- Preview/Export 출력과 성능 구조 유지

## 예상 변경 경계

Canvas Engine:

- Selection candidate/hit-test helper
- Direct Selection Controller
- Canvas Engine/Composition port wiring
- 기존 Draft-aware Selection Geometry 재사용

Preview UI:

- Canvas pointer 연결
- Selection Silhouette Glow Canvas layer
- 기존 Selection polygon의 pointer ownership 조정

검증:

- Canvas hit-test helper fixture
- Selection/Glow integration fixture

문서:

- `20_src_map.md`
- `98_sprint_plan.md`
- `99_recent_task.md`
- Sprint 완료 영구 문서

## 절대 하지 말 것

- Glow를 Main Preview Canvas나 Export에 굽기
- Renderer Mode별 별도 선택 규칙
- Bounds만 빛나는 효과를 실제 Layer 실루엣 Glow로 기록하기
- 투명 영역 전체를 무조건 Hit로 처리하기
- Sub Composition 내부 Layer 관통 선택
- Selection 변경을 History에 저장하기
- 새 Selection Engine, 전역 Runtime, Store 또는 Project 필드 추가
- 기존 Draft Runtime, Preview Cache, Dirty Region 또는 Renderer 책임 변경
- Hover 선택 미리보기, 다중 선택, Alt-click 순환 선택 추가

## Sprint 완료 조건

- 선택된 Layer 또는 Sub Composition의 실제 표시 실루엣에 Editor-only Glow가 보인다.
- Canvas의 보이는 픽셀을 클릭하면 현재 Composition의 최상단 top-level 대상이 선택된다.
- 투명 여백은 아래 Layer 선택을 막지 않는다.
- Timeline, Properties, Selection Box, Handles와 Glow가 같은 Selection을 표시한다.
- Draft Transform 중 Layer와 Glow가 동시에 움직인다.
- Preview Renderer, Export, Cache, Dirty Region과 History 계약은 변경되지 않는다.
- 브라우저 QA 전에는 구현 완료/QA 대기로만 기록하며 QA 통과로 판단하지 않는다.

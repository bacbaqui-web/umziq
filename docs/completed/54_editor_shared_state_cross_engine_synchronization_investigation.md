# Editor Shared State & Cross-Engine Synchronization Investigation

> **현재 상태:** 이 문서는 LayerDocument cutover 전 문제를 조사한 역사 문서다. 아래의 이전 identity/state 진단은 당시 코드에 대한 결과이며, 현재 canonical identity는 `layerDocumentId`, Timeline 저장 의미는 `LayerDocument.common.placement`, 현재 owner/command/history 구조는 `docs/architecture/10_project_architecture.md`, `docs/architecture/12_timeline_playback_architecture.md`, `docs/architecture/13_history_draft_architecture.md`를 따른다.

## 현재 Addendum

이 문서의 2절 결론, 3절 Engine/상태 지도, 4절 이후 identity·Draft·History 진단은 모두 **조사 당시 구조를 설명하는 과거 기록**이다. 당시 발견한 중복 authority를 현재 구조에서는 다음처럼 해소했다.

| 조사 당시 문제 | 현재 계약 |
|---|---|
| Source/Timeline/Render identity 혼합 | 편집·선택은 `layerDocumentId`, 원본 공유만 `sourceId` |
| Timeline item과 Layer visibility 중복 | `LayerDocument.common.placement.visible` |
| Timeline move/resize가 Project를 매 PointerMove 갱신 | runtime Draft 후 semantic transaction 1회 |
| Runtime render data가 History snapshot에 포함 | Project/History는 Plain Data, resource는 Source runtime cache |
| Panel별 선택 사본 | Project owner session의 LayerDocument selection |

아래에서 제안하거나 평가한 이전 Engine 이름, state hook, record와 파일 경로는 현재 구현 안내가 아니다. `docs/20_src_map.md`와 `docs/architecture/10_project_architecture.md`가 현재 기준이다.

## 1. 문서 목적

이 문서는 Canvas, Timeline, Properties, PSD Tree가 서로를 직접 수정하지 않고 같은 편집 상태를 읽어 함께 갱신되는 구조가 현재 프로젝트에 얼마나 마련되어 있는지 정적 코드로 조사한 결과다.

이번 조사에서는 제품 코드, `docs/98_sprint_plan.md`, 기존 문서를 수정하지 않았다. 브라우저 QA, 실제 조작 QA, build, lint, verification도 실행하지 않았다.

조사 기준은 다음과 같다.

- 저장되는 Project Data
- 저장하지 않는 Editor Session Data
- PointerMove 동안만 존재하는 Draft Runtime Data
- Playback Data
- Project에서 계산되는 Render Result
- Engine 공개 command/read model과 Root wiring
- Selection, Transform, Animation, Timing, Visibility, History, PSD Refresh
- `sourceId`, `TimelineItem.id`, `RenderItem.id`의 identity 계약

## 2. 결론 요약

현재 프로젝트에는 원하는 구조의 뼈대가 이미 있다.

- `useEditorCompositionRoot`가 7개 Engine을 조립하는 유일한 Root 역할을 한다.
- Project, Session, Draft, Playback, Canvas UI, Timeline UI 상태는 Shell에서 소유된다.
- 각 Panel은 다른 Panel을 직접 수정하지 않고 Engine이 만든 View Props를 받는다.
- Canvas Transform은 PointerMove에서 `DraftTransformSnapshot`, PointerUp에서 Project/Animation Commit을 사용한다.
- Selection은 `applySelectionForComposition()`을 통해 Canvas와 Timeline이 공유한다.
- Undo/Redo는 Draft와 일시적인 Canvas/Timeline 상호작용 상태를 함께 비운다.

따라서 새 전역 Store, Event Bus, Engine을 추가할 이유는 없다. 전체를 다시 만드는 리팩토링도 필요하지 않다.

그러나 다음 네 부분은 구조적 정리가 필요하다.

1. `TimelineItem.id`와 `sourceId`의 역할이 일부 경로에서 혼합된다.
2. Visibility가 `Layer.visible`, `TimelineItem.visible`, `RenderItem.visible`, `RenderDrawable.visible`에 중복되어 있다.
3. Timeline item 이동과 resize는 PointerMove마다 Project Data를 직접 갱신해 Canvas의 Draft/Commit 계약과 다르다.
4. History가 저장 데이터뿐 아니라 Runtime RenderItem을 함께 보존하며, composition별 History가 전체 `comps`를 복원한다.

최종 판단은 **부분 리팩토링이 필요하다**이다. 현재 Root wiring과 7개 Engine은 유지하고, identity → semantic Project command → Timeline Draft → History/Render 파생 계약 순서로 작은 단계에서 정리하는 것이 가장 안전하다.

## 3. 현재 Engine 구조 지도

### 3.1 Root wiring

`src/editor/useEditorCompositionRoot.ts`는 다음 Engine을 생성하고 서로 필요한 공개 포트만 연결한다.

| Engine | 현재 책임 | 주요 입력 | 주요 출력 |
|---|---|---|---|
| Project | PSD import/refresh, Project records, navigation, selection derivation | Project State, Session selection | Project commands, selection read model |
| PSD Tree | Project/Group 트리 표시, import/refresh/remove/reorder intent | Project read/command port, composition selection command | PSD Tree view props |
| Playback/Render | frame/range/play 상태, EvaluatedScene, renderer 결과 | Project/Timeline/Runtime records, Playback State | Playback commands/read model, render result |
| Timeline | timing/order/navigation/keyframe UI intent | Project read/commands, Playback, Animation callbacks, Session selection | Timeline view props/read model |
| Properties | 선택 대상의 값 표시, raw numeric input, transform/keyframe intent | Selection, Playback, Draft, Animation commands | Properties view props, resolved values |
| Animation | Transform/Keyframe/Modifier 변경 | 선택 대상, local frame, Project command port, History | Animation commands |
| Canvas | 렌더 표시, direct selection, transform/motion-path interaction | Render result, Selection, Draft, Animation commands | Canvas view props, Draft updates |

Root는 `animationCommandsRef`, `canvasDraftCommandsRef`로 생성 순서상의 순환을 끊는다. 이는 Event Bus가 아니라 Root 내부의 포트 연결 장치다. 다만 장기적으로는 명시적인 command interface가 ref의 초기화 순서보다 이해하기 쉽다.

### 3.2 상태 저장 위치

| 분류 | 실제 상태 | 현재 저장 위치 | 현재 주요 소비자 |
|---|---|---|---|
| Project Data | Composition/Layer 구조와 Transform/Animation/Modifier | `useEditorProjectState().comps` | Project, Animation, Properties, Canvas, Render, PSD Tree |
| Project Data | Composition meta | `metaByCompId` | Timeline, Playback, Render, Canvas |
| Project Data | Timeline item timing/order/name/visible | `timelineItemsByCompId` | Timeline, Render active-frame 계산, Canvas selection |
| Runtime Data | drawable canvas와 render item | `renderItemsByCompId` | Playback/Render, Canvas, PSD refresh |
| Editor Session | 현재 composition | `selectedCompId` | 모든 Panel의 현재 범위 |
| Editor Session | 현재 item/소스 선택 | `selectedTimelineTarget` | Timeline, Project Selection Model, Canvas |
| Editor Session | 현재 layer 선택 복제값 | `selectedLayerId` | Project Selection Model |
| Editor Session | composition별 마지막 item 선택 | `lastSelectedItemByCompId` | Project navigation |
| Editor Session | 선택 keyframe | `selectedKeyframe` | Timeline, Properties, Animation |
| Draft Runtime | 공통 Transform snapshot | `draftTransformSnapshot` | Canvas Layer/Overlay/Handle/Motion Path, Properties projection |
| Draft/Session | position/scale/rotation/opacity scalar draft | Editor Session state | Animation/Properties resolved value |
| Input Draft | Properties raw 문자열/focus/scope | Editor Session state | Properties Numeric Input Controller |
| Playback | current frame, range, play, renderer mode | `useEditorPlaybackState` | Timeline, Animation, Render, Canvas, Properties |
| Canvas UI Session | zoom/pan/hover/readout/drag flags/glow | `useEditorCanvasState` | Canvas only |
| Timeline UI Session | hover/scrub/dragged item/dragging keyframe | `useEditorTimelineState` | Timeline only |
| Render Result | EvaluatedScene, RenderFrame, PreviewScene | `useRenderEngine` memo/runtime | Canvas |

### 3.3 현재 실제 동작 흐름

#### 선택

```text
Canvas hit 또는 Timeline row 또는 PSD Tree node
→ Root에서 주입한 selection/navigation command
→ selectedCompId / selectedTimelineTarget 갱신
→ Project Selection Model 재계산
→ Canvas / Timeline / Properties / PSD Tree View Props 재계산
```

Canvas direct selection candidate는 `TimelineSelection`에 `itemId`, `sourceId`, `kind`를 포함한다. Timeline도 같은 `applySelectionForComposition()`을 사용한다. PSD Tree는 composition navigation command를 사용한다.

#### Canvas Transform

```text
PointerDown
→ History begin
PointerMove
→ DraftTransformSnapshot 생성
→ PreviewScene transform patch + Editor Draft 저장
→ Canvas/Overlay/Properties가 Draft를 읽음
PointerUp
→ Animation command로 Project/Keyframe 갱신
→ History mark + commit
→ Draft reset
```

이 경로는 목표 철학과 가장 잘 맞는다.

#### Properties Transform

- raw 문자열은 `propertiesInputDrafts`에 저장한다.
- Anchor는 Input 중 공통 Transform Draft를 갱신하고 Commit 시 Animation command를 한 번 실행한다.
- Position/Scale/Rotation/Opacity는 raw input을 표시하는 동안 Project를 바꾸지 않고 Enter/Blur Commit에서 Animation command를 실행한다.
- History는 focus에서 begin, semantic change에서 mark, Enter/Blur에서 commit, Escape에서 cancel한다.

#### Timeline timing

- Keyframe 이동은 PointerMove 동안 `draggingKeyframe` Session만 바꾸고 PointerUp에서 Animation command로 Commit한다.
- Timeline item move와 resize는 PointerMove마다 `ProjectCommands.updateTimelineItem()`을 실행한다.
- History는 drag 시작에서 begin, 각 Project 변경에서 mark, 종료에서 commit한다.

따라서 History entry는 1회지만 Project Data는 PointerMove마다 변한다. 이는 Canvas Transform의 Draft/Commit 계약과 다르다.

#### Render

```text
Project Composition/Layer + TimelineItem + Runtime RenderItem + Playback frame
→ buildLocalFrameBySourceId()
→ getActiveRenderItems()
→ EvaluatedScene
→ full-render 또는 fast-render
→ Canvas
```

Render Result는 Project 원본이 아니라 파생 결과다. 이 원칙은 `useRenderEngine`에서는 지켜지지만 History snapshot에서는 Runtime RenderItem까지 보존한다.

## 4. 조사 질문에 대한 답

### 4.1 현재 공통 원본 역할을 하는 데이터는 무엇인가?

- Transform/Animation/Modifier: `Composition`과 `Layer`가 들어 있는 `comps`
- Timeline timing/order/name: `timelineItemsByCompId`
- 현재 composition/item/keyframe 선택: Editor Session State
- Canvas/Properties의 Transform 임시 편집: `DraftTransformSnapshot`과 Properties raw draft
- frame/range/play: Playback State
- drawable canvas: `renderItemsByCompId`의 Runtime resource

한 개의 거대한 공통 원본은 없고 책임에 따라 나뉘어 있다. 이 분리는 적절하다.

### 4.2 같은 의미의 데이터가 중복 저장되는가?

그렇다.

| 의미 | 중복 위치 | 위험 |
|---|---|---|
| Layer 선택 | `selectedTimelineTarget.sourceId` + `selectedLayerId` | 한쪽 setter만 사용하면 Panel 간 선택 불일치 |
| Visibility | `Layer.visible` + `TimelineItem.visible` + `RenderItem.visible` + `RenderDrawable.visible` | Timeline UI와 실제 Render가 다르게 보일 수 있음 |
| Transform Draft | scalar drafts + `DraftTransformSnapshot` + Properties raw draft | raw input과 semantic draft의 역할이 불명확해질 수 있음 |
| Timeline/Render instance 관계 | 배열 순서 + `sourceId` + 각자의 `id` | duplicate/reorder/refresh에서 다른 인스턴스와 연결될 수 있음 |

Properties raw 문자열은 숫자로 파싱되기 전의 입력을 보존하므로 필요한 중복이다. 반면 선택과 Visibility 중복은 단일 원본을 명확히 해야 한다.

### 4.3 한 Engine이 다른 Engine을 직접 수정하거나 강제 refresh하는가?

Panel이 다른 Panel 컴포넌트를 직접 수정하거나 브라우저 Event Bus로 refresh하는 경로는 찾지 못했다. Root가 command/read port를 주입하는 기본 방향은 올바르다.

다만 다음 결합은 존재한다.

- Timeline Engine은 주입받은 generic `ProjectCommands`로 TimelineItem과 RenderItem을 각각 변경한다.
- Timeline Engine은 주입받은 Animation callbacks로 keyframe을 변경한다.
- Properties Engine은 Animation 공개 함수와 command port를 사용한다.
- Canvas Engine은 Animation command와 Preview update port를 Root에서 받는다.

이는 직접 상태 import보다 낫지만, Timeline의 duplicate/reorder 같은 한 사용자 action이 여러 record setter를 순서대로 호출한다. 원자적인 Project command가 아니라 UI Engine이 동기화 책임을 떠안은 점이 문제다.

### 4.4 네 Panel이 같은 선택 대상을 공유하는가?

일반적인 단일 item에서는 대체로 공유한다. Canvas와 Timeline은 `TimelineSelection`을 사용하고 PSD Tree는 composition navigation을 사용한다.

완전히 안전하지는 않다.

- `selectedLayerId`와 `selectedTimelineTarget`이 별도 state다.
- `TimelineSelection.itemId`는 optional이라 일부 경로는 `sourceId` fallback을 사용한다.
- Project Selection Model의 실제 Transform target은 `sourceId`로 Layer/Composition을 찾는다.
- duplicate item 두 개가 같은 `sourceId`를 가지면 Timeline row 선택은 구분해도 Transform target은 같은 source entity다.

### 4.5 Canvas Draft 중 Properties와 Timeline의 표시 계약은 명확한가?

- Canvas와 Properties: 45/46 문서 및 `DraftTransformSnapshot`으로 비교적 명확하다.
- Timeline keyframe: drag session으로 임시 frame을 표시하고 Commit 시 Animation을 변경한다.
- Timeline의 Transform 값 표시: 선택 keyframe과 Animation evaluation을 읽지만 공통 Draft를 어디까지 표시해야 하는지 명시적인 read contract는 부족하다.
- Timeline item timing: 별도 Draft가 없고 Project를 즉시 변경한다.

즉 Transform Draft 계약은 강하지만, Timeline timing Draft와 Timeline이 Transform Draft를 어떻게 보여줄지에 대한 계약은 불완전하다.

### 4.6 PointerMove와 PointerUp 처리가 일관적인가?

아니다.

| Interaction | PointerMove | PointerUp |
|---|---|---|
| Canvas Transform | Draft only | Project/Animation commit 1회 |
| Properties numeric input | raw/draft only | Project/Animation commit 1회 |
| Timeline keyframe move | Session draft only | Animation commit 1회 |
| Timeline item move | Project TimelineItem 갱신 | History commit |
| Timeline item resize | Project TimelineItem 갱신 | History commit |

Timeline move/resize를 기존 Session Draft 원칙에 맞춰야 한다.

### 4.7 Undo/Redo 시 같은 시점으로 복원되는가?

현재 구현은 다음을 잘 처리한다.

- Project/Timeline/Render 관련 snapshot 복원
- selected composition/layer/timeline target 복원
- selected keyframe 해제
- Transform Draft와 Properties/Canvas 일시 상태 해제
- Playback 정지와 frame 복원

그러나 다음 위험이 있다.

1. composition별 History snapshot이 전체 `comps`를 저장한다. A composition History를 되돌릴 때 snapshot 이후 B composition에서 발생한 변경까지 되돌릴 가능성이 있다.
2. `RenderItem`의 Runtime canvas reference가 History에 포함된다. Render Result는 파생 데이터라는 원칙과 맞지 않으며 cache/resource 수명과 snapshot이 결합된다.
3. 선택 descriptor는 복원하지만 대상이 삭제/refresh된 경우 즉시 정규화하는 명시적인 restore gate가 없다.
4. generic setter 여러 개를 연속 호출하는 action은 중간 상태를 잠시 만들 수 있다.

따라서 “대부분 함께 돌아간다”는 동작은 있으나, Project/Session/Runtime을 같은 revision으로 복원한다는 강한 계약은 아직 없다.

### 4.8 같은 sourceId를 공유하는 duplicate는 독립적인가?

부분적으로만 독립적이며 현재 가장 큰 identity 위험이다.

- Timeline row의 `id`, start/duration, 선택은 구분 가능하다.
- 실제 Layer/Composition Transform과 keyframe target은 `sourceId`다.
- `buildLocalFrameBySourceId()`는 같은 `sourceId`의 여러 item을 하나의 Map entry로 덮어쓴다.
- `getActiveRenderItems()`는 active item의 `sourceId` Set으로 RenderItem을 고르므로 같은 source의 모든 RenderItem이 함께 active가 될 수 있다.
- `reorderTimelineRenderItems()`는 `sourceId` Map을 사용해 duplicate RenderItem을 하나로 축약할 수 있다.
- Duplicate controller는 RenderItem을 배열 index 또는 `sourceId`로 추정해서 복제하며 TimelineItem id와 직접 연결하지 않는다.

따라서 duplicate의 timing/selection은 item 단위처럼 보이지만 render/local frame/transform은 source 단위로 합쳐질 수 있다.

### 4.9 Visibility, Lock, Solo, Blend, Effect 확장이 가능한가?

현재처럼 Timeline UI가 TimelineItem과 RenderItem을 각각 수정하는 방식으로 확장하면 위험하다. 필드가 늘수록 동기화 대상도 늘어난다.

확장 가능하게 만들려면 먼저 다음을 정해야 한다.

- source 속성인지 instance 속성인지
- 저장되는 Project Data인지 Editor Session인지
- Animation 가능한 속성인지
- Render에서 파생되는 값인지
- action 하나를 처리하는 semantic command가 무엇인지

예를 들어 Visibility가 Timeline instance 속성이라면 `TimelineItem.visible`이 저장 원본이고 EvaluatedScene/Render에서 이를 읽어야 한다. `RenderItem.visible`은 별도 편집 원본이 되어서는 안 된다. Lock은 Editor Session/Project policy에 가까우며 Renderer가 직접 알 필요가 없다. Solo는 composition scope의 editor/playback evaluation policy로 설계해야 한다. Blend/Effect는 Project source 또는 instance 모델을 먼저 결정해야 한다.

### 4.10 새 Store나 Event Bus가 필요한가?

필요하지 않다.

현재 Shell state + `useEditorCompositionRoot` + Engine public command/read model이면 충분하다. 필요한 것은 새 통신 장치가 아니라 다음 정리다.

- canonical identity
- 단일 소유권
- semantic command
- scoped Draft
- Project change로부터 파생되는 Render
- restore 후 selection/runtime 정규화

## 5. 구체적인 문제 목록

### P0. instance identity가 source identity로 붕괴한다

관련 파일:

- `src/models/selectionModel.ts`
- `src/models/timelineItemModel.ts`
- `src/engines/project/models/runtimeRenderModel.ts`
- `src/engines/project/useProjectSelectionModel.ts`
- `src/engines/animation/helpers/animationFrameHelpers.ts`
- `src/engines/playback-render/helpers/activeTimelineItemHelpers.ts`
- `src/engines/timeline/helpers/timelineInteractionHelpers.ts`
- `src/engines/timeline/controllers/useTimelineDuplicateController.ts`

문제:

- `TimelineItem.id`는 instance identity, `sourceId`는 source identity처럼 보이지만 모든 경로가 이를 지키지 않는다.
- `RenderItem`에는 대응하는 `timelineItemId`가 없다.
- duplicate가 독립 배치인지 연결 복제인지 계약이 없다.

### P0. Visibility 단일 원본이 없다

관련 파일:

- `src/models/compositionModel.ts`
- `src/models/timelineItemModel.ts`
- `src/engines/project/models/runtimeRenderModel.ts`
- `src/engines/timeline/helpers/timelineViewModelHelpers.ts`
- `src/engines/playback-render/helpers/evaluatedSceneHelpers.ts`
- PSD import/refresh merge helpers

문제:

- Timeline 행은 `TimelineItem.visible`을 읽는다.
- EvaluatedScene은 `RenderItem.visible`과 `RenderDrawable.visible`을 읽는다.
- PSD source에는 `Layer.visible`도 있다.
- 앞으로 Timeline visibility command를 추가할 때 무엇을 변경해야 하는지가 불명확하다.

### P1. Timeline action이 Project record 동기화를 소유한다

관련 파일:

- `src/engines/timeline/controllers/useTimelineDuplicateController.ts`
- `src/engines/timeline/controllers/useTimelineReorderController.ts`
- `src/engines/timeline/controllers/useTimelineSplitController.ts`
- `src/engines/project/models/projectCommandModel.ts`

문제:

- generic replace/update command만 있어 Timeline Engine이 TimelineItem, RenderItem, Composition을 직접 맞춘다.
- action 도중 부분 갱신 상태가 가능하다.
- 새로운 필드가 추가될수록 Timeline Engine이 Project 내부 저장 구조를 더 많이 알아야 한다.

### P1. Timeline move/resize의 Draft/Commit 불일치

관련 파일:

- `src/engines/timeline/controllers/useTimelineItemController.ts`
- `src/engines/timeline/controllers/useTimelineResizeController.ts`
- `src/engines/timeline/controllers/useTimelineKeyframeController.ts`

문제:

- item move/resize는 PointerMove마다 Project를 변경한다.
- keyframe move와 Canvas Transform은 Session/Draft 후 Commit한다.
- interaction 종류에 따라 Project mutation 규칙이 다르다.

### P1. History가 Project와 Runtime 경계를 넘는다

관련 파일:

- `src/engines/project/history/projectHistorySnapshot.ts`
- `src/engines/project/controllers/useProjectHistoryController.ts`
- `src/engines/project/state/useProjectHistoryState.ts`

문제:

- Runtime RenderItem을 snapshot에 포함한다.
- composition별 stack이 전체 composition tree를 저장한다.
- selection 복원과 대상 유효성 정규화가 한 계약으로 묶이지 않는다.

### P2. 선택 의미가 두 state에 저장된다

관련 파일:

- `src/editor/state/useEditorSessionState.ts`
- `src/engines/project/useProjectSelectionModel.ts`

문제:

- `selectedTimelineTarget`과 `selectedLayerId`가 같은 layer 선택을 중복 표현한다.
- 현재 공통 helper를 사용하면 맞지만, public setter가 각각 노출되어 drift 가능성이 남는다.

### P2. Transform Draft 표현이 여러 층에 있다

관련 파일:

- `src/editor/state/useEditorSessionState.ts`
- `src/engines/canvas/helpers/draftTransformRuntimeHelpers.ts`
- `src/engines/properties/controllers/usePropertiesNumericInputController.ts`

문제:

- Properties raw input, scalar semantic draft, full snapshot이 함께 있다.
- 각 값의 목적은 존재하지만 어떤 read model이 우선하는지 중앙 계약이 약하다.

### P3. Root command ref의 생성 순서 결합

관련 파일:

- `src/editor/useEditorCompositionRoot.ts`

문제:

- `animationCommandsRef`, `canvasDraftCommandsRef`가 Engine 초기화 순서를 중재한다.
- 현재 동작상 문제는 아니지만 Root wiring을 처음 읽는 사람이 command 방향을 추적하기 어렵다.
- 우선순위는 낮으며 identity/ownership 정리 전에는 건드리지 않는다.

## 6. 목표 구조

### 6.1 기본 흐름

```text
Panel의 사용자 Intent
→ 담당 Engine의 공개 command
→ Root가 제공한 소유 Engine command 호출
→ 단일 원본 또는 scoped Draft 변경
→ Project Selection Model / Animation Evaluation / Timeline Read Model 재계산
→ Render Result 재계산
→ Canvas / Timeline / Properties / PSD Tree가 각자 같은 결과를 다시 읽음
```

Panel 간 refresh command는 만들지 않는다. Project command 결과로 `Canvas.refresh()`나 `Timeline.refresh()`를 호출하지 않는다. React state identity와 기존 read model이 재계산 신호가 된다.

### 6.2 저장 데이터와 파생 데이터

```text
Project Data ─┬─→ Selection/Properties/Timeline Read Models
              ├─→ Animation Evaluation
Playback ─────┤
Draft ────────┤
              └─→ EvaluatedScene → Renderer → Canvas

Editor Session → 현재 범위와 선택만 제공
Render Result  → 저장/History 대상이 아니라 재계산 대상
```

### 6.3 identity 계약

- `sourceId`: PSD/Project의 원본 Layer 또는 Composition identity
- `itemId`: 한 composition Timeline에 배치된 instance identity
- `renderItem.timelineItemId`: Render runtime이 어느 Timeline instance의 파생물인지 나타내는 명시적 연결 후보
- selection: 최소 `{ compId, itemId, sourceId, kind }`
- Source 편집과 instance 편집을 command 이름과 데이터 모델에서 구분

중요 Gate: duplicate를 After Effects처럼 독립 instance로 만들 것인지, 같은 source의 연결 배치로 유지할 것인지 먼저 제품 계약으로 확정해야 한다. 독립 instance가 목표라면 Transform/Animation/Visibility의 저장 위치도 instance model로 이동해야 하며 단순 `timelineItemId` 추가만으로 끝나지 않는다.

## 7. 목표 상태 소유권 표

| 데이터 | 단일 원본 | 수정 담당 | 읽는 Engine | 비고 |
|---|---|---|---|---|
| Composition/Layer source 구조 | Project Data | Project Engine | PSD Tree, Timeline, Animation, Properties, Render | PSD refresh도 Project semantic command |
| Timeline instance identity/order/timing | TimelineItem in Project Data | Project Engine의 Timeline semantic command | Timeline, Playback/Render, Canvas | Timeline은 intent만 발행 |
| Selection | Editor Session의 canonical descriptor | Project navigation/selection command | Canvas, Timeline, Properties, PSD Tree | `selectedLayerId`는 derive하거나 제거 |
| Transform/Animation | Project source 또는 향후 확정할 instance data | Animation Engine | Canvas, Properties, Timeline, Render | duplicate 계약 Gate 필요 |
| Draft Transform | 기존 Draft Runtime | Canvas/Properties adapter | Canvas, Properties, 필요한 Timeline read model | PointerUp 전 Project 불변 |
| Timeline move/resize draft | Editor Session의 scoped Timeline interaction draft | Timeline adapter | Timeline, Playback/Render가 필요한 경우 Root port | 새 Engine/Store 금지 |
| 현재 frame/range/play | Playback State | Playback Engine | Timeline, Animation, Properties, Render, Canvas | 유지 |
| Visibility | Timeline instance 또는 source 중 Gate에서 확정한 Project field | Project semantic command | Timeline, Properties, Render | RenderItem에 편집 원본 중복 금지 |
| Lock | Project/Editor policy 중 제품 계약으로 확정 | Project 또는 Editor Session command | Timeline, Canvas selection | Renderer가 직접 알 필요 없음 |
| Solo | composition-scoped Project/Session policy | Project/Playback command | Timeline, Render evaluation | 숨김과 별도 의미 |
| Blend/Effect | Project Data | Animation/Project command | Properties, Timeline, Render | instance/source 범위 선결정 |
| RenderItem/drawable canvas | Runtime cache/resource | Project import/runtime adapter | Render, Canvas | Project History에서 제외 |
| EvaluatedScene/Render result | 파생 결과 | Playback/Render Engine | Canvas | 저장/History 금지 |
| History transaction | Project Engine | 각 command는 begin/commit port 사용 | Undo/Redo | 사용자 action 1회당 1회 |

## 8. 단계별 리팩토링 계획

### Task 1. 계약 Fixture와 현재 동작 고정

목적:

- 리팩토링 전에 현재 선택, duplicate, timing, visibility, History 동작을 verification으로 고정한다.

작업:

- Canvas/Timeline/PSD Tree가 같은 selection descriptor를 만드는 verification
- Properties/Canvas transform draft와 commit 횟수 verification
- Timeline move/resize의 현재 mutation 횟수 계측
- duplicate source 두 개의 selection, active range, local frame, reorder 재현 fixture
- Undo/Redo 후 selection/draft/render 연결 fixture

Gate:

- 실패 현상을 재현하는 테스트와 현재 정상 계약을 보존하는 테스트가 분리되어야 한다.
- 제품 계약이 정해지지 않은 duplicate behavior를 임의로 테스트 정답으로 고정하지 않는다.

### Task 2. source identity와 instance identity 계약 확정

목적:

- `sourceId`, `TimelineItem.id`, `RenderItem.id`의 책임을 문서와 type으로 확정한다.

작업:

- duplicate가 독립 instance인지 연결 배치인지 제품 결정
- canonical selection descriptor에 `compId`와 필수 `itemId` 적용 가능성 검토
- `RenderItem`과 `TimelineItem`의 명시적 연결 방식 설계
- active item/local frame/reorder/refresh lookup을 item identity 중심으로 설계
- source 편집 command와 instance 편집 command 이름 분리

Gate:

- duplicate 두 개를 선택, timing, visibility, reorder, delete했을 때 어느 데이터가 독립인지 표로 확정한다.
- identity lookup에 배열 index fallback과 모호한 `sourceId` fallback이 남지 않는 설계여야 한다.

### Task 3. Selection 단일 원본 정리

목적:

- 모든 Panel이 한 canonical selection을 읽게 한다.

작업:

- `selectedTimelineTarget`을 canonical selection으로 확정
- `selectedLayerId`를 derive하거나 private compatibility projection으로 축소
- 개별 selection setter 노출 제거 또는 selection command 뒤로 숨김
- composition enter, Canvas hit, Timeline row, PSD Tree, Undo restore가 같은 command 사용
- 대상 삭제/refresh/undo 후 selection normalization helper 적용

Gate:

- 네 Panel의 selected item/comp가 항상 같은 descriptor에서 파생된다.
- duplicate item 전환 시 Properties/Canvas/Timeline 선택이 item identity를 잃지 않는다.

### Task 4. Project semantic command와 atomic mutation 도입

목적:

- UI Engine이 Project 내부 record 동기화를 책임지지 않게 한다.

작업:

- 기존 Project Engine 안에 semantic command 추가
- 예: `duplicateTimelineItem`, `deleteTimelineItem`, `reorderTimelineItem`, `commitTimelineTiming`, `setTimelineItemVisibility`
- 한 command가 Composition/Timeline/Runtime 파생 갱신을 원자적으로 계산
- 기존 generic commands는 import/restore 같은 내부 adapter에서만 사용하도록 범위 축소
- command 결과는 Event가 아니라 plain change result/updated records로 유지

Gate:

- Timeline Engine이 `RenderItem[]` 또는 composition tree 동기화 알고리즘을 직접 소유하지 않는다.
- action 하나당 Project revision과 History entry가 1회다.

### Task 5. Visibility를 첫 end-to-end pilot으로 정리

목적:

- 미래 Timeline context menu 기능의 기준 패턴을 만든다.

작업:

- Visibility가 source 속성인지 Timeline instance 속성인지 Task 2 계약에 따라 확정
- 저장 원본 하나만 command로 변경
- Timeline row, Properties read model, EvaluatedScene이 같은 원본을 읽음
- `RenderItem.visible`이 독립 편집 원본이라면 제거/파생값화
- PSD import/refresh merge 정책과 사용자 override 정책 분리

Gate:

- Timeline에서 한 번 변경하면 Canvas와 Properties가 별도 refresh 없이 반영된다.
- Undo/Redo 1회로 세 Panel이 함께 복원된다.
- duplicate visibility 계약이 fixture와 일치한다.

### Task 6. Timeline move/resize Draft 통합

목적:

- PointerMove Draft, PointerUp Commit 원칙을 Timeline timing에도 적용한다.

작업:

- 기존 Editor Session 범위에 itemId/compId로 scope된 timing draft 설계
- PointerMove는 Timeline read model에 draft projection만 제공
- 필요한 Preview는 Project + timing draft를 Root port로 평가
- PointerUp에서 `commitTimelineTiming` 한 번 실행
- Cancel/Escape/selection change/Undo에서 draft 정리
- keyframe drag의 기존 Session draft 패턴 재사용

Gate:

- PointerMove 중 Project record와 History past가 바뀌지 않는다.
- PointerUp에서 Project command와 History commit이 각각 1회다.
- Timeline과 Canvas가 같은 draft timing을 읽는다.

### Task 7. Draft read contract 정리

목적:

- raw input, scalar draft, full Transform snapshot의 우선순위를 명확히 한다.

작업:

- raw string은 Properties 입력 전용으로 유지
- semantic Transform draft는 `DraftTransformSnapshot`을 canonical projection으로 확정
- scalar drafts가 필요한 compatibility projection인지 제거 가능한 중복인지 검증
- Canvas/Properties/Timeline read model에서 `Project + Draft overlay` 해석 helper 공유
- target/frame scope mismatch 시 Project로 자연 복귀

Gate:

- 같은 target/frame에서 모든 View가 같은 값을 표시한다.
- scope 변경, Escape, PointerUp, Undo에서 stale draft가 남지 않는다.

### Task 8. History와 Render Result 경계 정리

목적:

- Undo/Redo가 저장 데이터와 Session을 복원하고 Runtime은 재계산하게 한다.

작업:

- History snapshot에서 Runtime RenderItem/canvas를 제외할 수 있는 rebuild 경로 설계
- composition별 stack이 전체 `comps`를 덮어쓰는 문제 해결
- global linear history 또는 revision-aware scoped snapshot 중 현재 제품에 맞는 방식 선택
- restore 후 canonical selection validation과 Draft clear를 하나의 restore contract로 묶음
- Project restore → runtime derive/rebind → render evaluation 순서 명시

Gate:

- A composition Undo가 관련 없는 B composition의 이후 편집을 되돌리지 않는다.
- Runtime canvas/cache는 snapshot에서 복제하지 않아도 정상 재연결된다.
- Undo/Redo 후 네 Panel과 Canvas Render가 같은 Project revision을 표시한다.

### Task 9. Lock/Solo/Blend/Effect 확장 규칙 문서화

목적:

- 이후 기능이 같은 구조를 반복 사용하게 한다.

작업:

- 속성마다 source/instance/session/runtime 분류표 작성
- 담당 Engine, semantic command, Draft 필요 여부, History 범위, Renderer 소비 위치 명시
- Timeline context menu는 command를 호출하는 View로만 유지

Gate:

- 새 기능 설계 시 다른 Panel refresh나 RenderItem 직접 수정이 필요하지 않아야 한다.

## 9. 회귀 위험

| 영역 | 위험 | 방어 방법 |
|---|---|---|
| Selection | optional itemId 제거 시 기존 source fallback 깨짐 | 호환 migration 후 fallback 계측, duplicate fixture |
| Duplicate | 기존에는 source-linked였던 Transform을 독립화하면 제품 의미 변경 | Task 2에서 제품 계약 먼저 승인 |
| History | snapshot 범위 변경 시 Undo 누락 | action별 before/after plain-data fixture |
| Draft | scalar draft 제거 시 Properties 표시 지연 | read precedence verification 선행 |
| Renderer cache | RenderItem identity 변경 시 Node/Surface cache miss 증가 | stable timelineItemId 기반 cache key와 성능 baseline |
| Timeline delete/reorder | item/render 연결 변경 시 painter order 회귀 | duplicate 포함 painter-order fixture |
| PSD refresh | source matching이 instance override를 덮어씀 | source refresh와 instance override merge 정책 분리 |
| Animation | sourceId 기반 track을 instance로 옮길 경우 keyframe 의미 변경 | independent instance 결정 전 migration 금지 |
| Playback | duplicate local frame 계산 변경 시 재생 결과 변화 | 서로 다른 startFrame duplicate fixture |
| Canvas direct selection | candidate가 잘못된 Timeline instance를 선택 | candidate에 canonical item identity 유지 |

## 10. 검증 계획

### 10.1 정적 검증

- 변경 파일 TypeScript/ESLint
- `git diff --check`
- Engine import boundary 검사
- Project/Session/Draft/Runtime type dependency 검사
- 500줄 이상 TypeScript/TSX 파일 보고

현재 조사 시점에는 500줄 이상인 `src` TypeScript/TSX 파일이 없었다.

### 10.2 기존 verification

- Project Selection derived identity
- Draft runtime target/frame scope
- Preview update pipeline
- Canvas direct selection and glow identity
- Timeline duplicate/split/reorder/delete
- Project History one-action/one-entry
- PSD refresh source identity preservation
- renderer mode and cache continuity

### 10.3 새로 필요한 verification

- canonical selection across Canvas/Timeline/Properties/PSD Tree
- duplicate item별 active range/local frame/selection/reorder/delete
- TimelineItem–RenderItem one-to-one instance link
- Visibility single-source propagation
- Timeline move/resize PointerMove Project mutation 0회
- PointerUp Project command 1회/History 1회
- Undo across different compositions
- restore 후 deleted/refreshed selection normalization
- Render runtime rebuild without History snapshot canvas resources

### 10.4 실제 Browser QA

Browser QA는 구현 단계에서 사용자가 요청하거나 해당 Task Gate가 실제 조작 없이는 확인 불가능할 때만 수행한다.

- Canvas 선택 → Timeline/Properties/PSD Tree 동기화
- Timeline 선택 → Canvas glow/handle/Properties 동기화
- Canvas/Properties Transform draft 실시간 동기화
- Timeline move/resize 중 Canvas timing 반영과 cancel
- duplicate 두 개의 독립 선택/timing/visibility
- Undo/Redo 후 모든 Panel 및 Canvas 복원
- PSD refresh 후 선택, override, render 유지
- playback 중 duplicate local frame과 visibility

정적 검증 통과를 Browser QA 통과로 기록하지 않는다.

## 11. 불필요한 리팩토링

다음 부분은 현재 방향이 적절하므로 유지한다.

- 7개 Engine 구성
- `useEditorCompositionRoot`를 유일한 cross-engine wiring 지점으로 사용하는 원칙
- Panel에 View Props만 전달하는 구조
- Playback State의 별도 소유
- Canvas 전용 zoom/pan/hover/readout state
- Timeline 전용 hover/scrub interaction state
- Properties raw 문자열 draft와 focus/scope
- 기존 `DraftTransformSnapshot`과 Preview update pipeline
- EvaluatedScene을 Project에서 계산한 파생 결과로 사용하는 구조
- Canvas pointer interaction의 begin/draft/commit/cancel 패턴
- Project Selection Model의 memoized derived identity 안정화
- 범용 Event Bus를 사용하지 않는 구조

새 Redux류 전역 Store, 범용 pub/sub, Panel refresh service, 새 Synchronization Engine은 만들지 않는다.

## 12. 최종 판단

### 리팩토링이 필요한가?

필요하다. 단, 전체 구조 교체가 아니라 identity와 ownership 경계의 부분 리팩토링이다.

### 일부만 정리하면 되는가?

그렇다. 우선순위는 다음과 같다.

1. source/item/render identity 계약
2. canonical selection
3. atomic semantic Project commands
4. Visibility pilot
5. Timeline timing Draft/Commit
6. Draft read precedence
7. History와 Runtime 분리

### 현재 구조를 그대로 유지해도 되는 부분은 무엇인가?

Root wiring, 7개 Engine, Shell state 분리, Playback, Canvas Draft Runtime, Engine View Props 구조는 유지하는 것이 낫다.

### 최종 설계 결론

새 공통 노트를 하나 더 만드는 것이 아니라, 이미 있는 여러 공통 노트의 제목과 담당자를 명확히 해야 한다.

- Project는 저장되는 편집 결과의 노트
- Session은 지금 무엇을 편집하는지 적는 노트
- Draft는 아직 확정하지 않은 임시 계산 노트
- Playback은 현재 시간의 노트
- Render Result는 위 노트를 읽고 다시 계산한 화면이며 저장 노트가 아님

각 action이 자신의 담당 command를 통해 이 중 하나만 바꾸고, 다른 Engine은 같은 노트를 다시 읽게 하면 된다.

## 13. 쉬운 설명

### 지금 공통 노트 역할을 하는 것은 무엇인가?

프로젝트 안의 레이어 위치, 애니메이션, 타임라인 길이는 Project Data라는 공통 노트에 적혀 있다. 지금 선택한 레이어는 Session 노트에 적혀 있고, 드래그 중 아직 마우스를 놓지 않은 위치는 Draft 노트에 적혀 있다. 현재 재생 시간은 Playback 노트에 적혀 있다.

Canvas, Timeline, Properties, PSD Tree는 원칙적으로 이 노트들을 읽어서 화면을 만든다. 그래서 기본 설계는 이미 올바르다.

### 어디가 중복되거나 꼬일 위험이 있는가?

한 레이어를 가리키는 이름표가 두 종류다. 원본 레이어 이름표인 `sourceId`와 타임라인에 놓인 한 장의 카드 이름표인 `itemId`가 있다. 복제하면 카드는 두 장인데 원본 이름표는 같다. 현재 일부 코드는 카드 이름표를 보고, 일부 코드는 원본 이름표만 본다. 그래서 복제본을 따로 움직이거나 숨길 때 서로 섞일 수 있다.

보이기/숨기기도 Layer, TimelineItem, RenderItem 여러 곳에 같은 내용이 적혀 있다. 한 곳만 바뀌면 Timeline에서는 숨겨졌는데 Canvas에는 보이는 일이 생길 수 있다.

### 왜 리팩토링이 필요한가?

앞으로 삭제, 복제, 숨기기, 잠금, Solo, Blend, Effect가 늘어나면 지금의 작은 중복이 계속 커진다. Timeline이 Canvas를 직접 고치게 만들면 기능 하나마다 여러 Panel을 수동으로 새로고침해야 한다. 지금 identity와 소유권만 바로잡으면 그런 연결 코드를 만들 필요가 없다.

### 무엇부터 어떤 순서로 고칠 것인가?

먼저 원본 레이어와 타임라인 복제본을 확실히 구분한다. 다음으로 선택 정보를 하나로 합친다. 그 뒤 복제·삭제·정렬·숨기기를 Project의 한 command가 한 번에 처리하게 한다. Visibility로 전체 흐름을 먼저 검증한 후, Timeline 드래그도 Canvas처럼 드래그 중에는 Draft만 쓰고 마우스를 놓을 때 한 번만 저장하게 한다. 마지막으로 Undo가 Runtime 화면 조각이 아니라 실제 Project Data를 복원하도록 정리한다.

### 리팩토링 후 네 영역은 어떻게 함께 움직이는가?

예를 들어 Timeline에서 숨기기를 누르면 Timeline이 Canvas를 부르지 않는다. Timeline은 Project Engine에 “이 item을 숨겨 달라”고 한 번 요청한다. Project의 공통 노트가 바뀌면 Timeline, Properties, Renderer가 같은 값을 다시 읽는다. Renderer 결과가 바뀌므로 Canvas도 자동으로 사라진 레이어를 보여준다. Undo하면 같은 Project 노트가 이전 상태로 돌아가고 네 영역이 모두 그 상태를 다시 읽는다.

Canvas에서 레이어를 선택하거나 위치를 움직일 때도 같은 방식이다. 선택은 Session 노트, 드래그 중 위치는 Draft 노트, 마우스를 놓은 최종 위치는 Project 노트에 한 번 기록된다. 어느 Panel도 다른 Panel에 직접 전화하지 않아도 모두 같은 결과를 표시하게 된다.

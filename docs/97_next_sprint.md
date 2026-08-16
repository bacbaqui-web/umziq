# Next Sprint Handoff

> 상태: 사용자 검토용 계획 제안
> 구현: 시작하지 않음
> QA: 미실행
> 현재 Sprint 승격: 사용자 승인 후 `docs/98_sprint_plan.md`로 이동

> 2026-08-17 동기화: 이 문서는 Timeline 재구성 제안 당시 기록이다. 아래의
> Audio waveform/source trim 미구현 표기는 이후 `docs/98_sprint_plan.md`의
> Library + Audio Foundation Sprint에서 구현되어 현재 상태가 아니다.

## 제안 방향

프로젝트 철학은 After Effects를 그대로 복제하는 것이 아니라, 숏폼 제작에 필요한 핵심 편집 감각만 더 쉽고 가볍게 제공하는 것이다.

현재 Timeline에는 이미 다음 기능이 있다.

- Composition breadcrumb와 switcher
- 재생·일시정지·한 frame 이동
- Ruler hover, scrub, playhead와 시간 readout
- Playback Range 시작·끝 편집과 전체 duration 편집
- Timeline item 선택, 이동, 좌우 resize, reorder, rename, duplicate, split
- PSD source 상태와 delete/keep 결정
- Position, Scale, Rotation, Opacity track과 keyframe 표시
- Keyframe 선택·이동·삭제
- Project/Animation/Playback Command와 History transaction

따라서 다음 단계의 핵심은 기능을 많이 추가하는 것이 아니다. 현재 기능을 AE처럼 빠르게 읽고 탐색할 수 있는 작업 공간으로 재구성하는 것이다.

## 현재 구조의 핵심 문제

### 1. 선택과 펼침이 같은 상태다

현재는 선택된 item의 enabled property만 자동으로 표시된다. 다른 item을 선택하면 기존 property row가 사라지므로 여러 Layer의 animation 구조를 동시에 비교할 수 없다.

```text
현재
Item 선택
  → Property 표시

목표
Item 선택
  → 편집 대상 결정

Disclosure
  → Property 표시 여부 결정
```

### 2. 시간축이 항상 전체 Duration에 맞춰진다

현재 `pxPerFrame`은 전체 duration을 available width에 맞추는 구조다. 긴 Composition에서는 frame, keyframe과 item edge가 지나치게 압축되며 사용자가 원하는 구간을 확대해 편집할 수 없다.

### 3. Layer Stack 문법이 약하다

현재 왼쪽 영역은 이름과 source status 중심이다. Layer index, item kind, disclosure hierarchy, hover·focus·selection의 구분과 sticky 구조가 약해 복잡한 Timeline을 읽기 어렵다.

### 4. 후속 기능을 담을 좌표 기반이 부족하다

Snapping, box selection, multi-keyframe, easing과 Graph Editor를 추가하려면 Ruler, playhead, item, range, keyframe이 같은 frame↔x 좌표 계약과 실제 visible time viewport를 먼저 사용해야 한다.

## 발전 로드맵

### Phase 1 — Timeline Workspace Foundation

- AE식 Layer Stack 문법
- 선택과 독립된 Property Disclosure
- Horizontal Zoom/Scroll
- Adaptive Ruler와 공통 frame 좌표
- 기존 편집 기능과 History 의미 유지

### Phase 2 — Precision Editing

- Playhead, item edge, range edge와 keyframe snapping
- Snap guide와 시간 readout
- Timeline keyboard action과 context action
- 이전/다음 keyframe 탐색
- 기존 Property Track 활성화 기능의 Timeline 진입점

### Phase 3 — Multi Selection

- Item과 keyframe의 Shift/Cmd 선택
- Box selection
- 선택 집합 이동·삭제·복제·복사/붙여넣기
- duplicate `sourceId`와 `itemId`의 instance 의미를 먼저 설계

### Phase 4 — Motion Shaping

- 제한된 easing preset
- Interpolation Plain Data와 normalize/migration
- 숏폼에 필요한 Position/Scale/Rotation/Opacity Graph Editor
- Animation Evaluation과 Motion Path의 interpolation 일치

### Phase 5 — Media Workflow

- Marker
- Audio waveform
- source trim/offset
- 필요한 경우에만 lock/solo와 media-specific track

첫 Sprint에서는 Phase 1만 진행한다.

## 다음 Sprint 제안

### Sprint 이름

`Timeline Layer Stack & Time Viewport Foundation`

### Sprint 목표

기존 Project, Animation, Playback, History와 Renderer 의미를 변경하지 않고 다음 기반을 만든다.

```text
Layer Stack
  ├─ 명확한 Item Row
  ├─ 독립 Disclosure
  └─ 기존 Enabled Property Rows

Time Viewport
  ├─ Fit
  ├─ Zoom
  ├─ Horizontal Scroll
  └─ Adaptive Ruler

모든 표시
  → 동일한 frame ↔ x 좌표 계약
```

### 사용자 경험 목표

- 여러 Layer의 기존 Transform track을 동시에 펼쳐 비교할 수 있다.
- Layer를 선택해도 다른 Layer의 펼침 상태가 사라지지 않는다.
- 긴 Timeline의 원하는 구간을 확대하고 좌우로 이동할 수 있다.
- Ruler, playhead, playback range, item bar와 keyframe이 확대·스크롤 후에도 정확히 정렬된다.
- 현재 지원하는 이동·resize·reorder·rename·duplicate·split·keyframe 편집이 그대로 동작한다.

## 설계 원칙

### Timeline Session View State

다음 값은 Project 데이터가 아닌 Editor session UI state다.

- Composition별 expanded item IDs
- Timeline zoom 또는 `pxPerFrame`
- horizontal scroll position
- focused row
- Fit/Manual viewport mode

Project Plain Data, History, Export와 Renderer에 저장하지 않는다. Project를 열거나 Composition을 전환할 때 존재하지 않는 item ID는 안전하게 제거한다.

처음 Composition에 진입하면 현재 선택 item의 enabled property가 있는 경우 그 item만 초기 펼침 대상으로 삼고, 이후에는 사용자의 disclosure 상태를 유지한다. 여러 item을 동시에 펼칠 수 있다.

### Hierarchical Row

첫 Sprint의 계층은 다음 범위만 사용한다.

```text
Timeline Item
  └─ 변형
      ├─ 위치
      ├─ 크기
      ├─ 회전
      └─ 투명
```

- 기존 `enabledProperties`가 활성화된 property만 표시한다.
- `변형`은 hierarchy를 설명하는 presentation이며 새 animation data가 아니다.
- Property target과 keyframe data는 기존 Layer/Composition source를 그대로 사용한다.
- Row identity는 duplicate source에서도 안전하도록 `itemId + property`를 사용한다.
- Selection은 기존 단일 `TimelineSelection`을 유지한다.

### Layer Stack Presentation

첫 Sprint에 추가할 표시 정보:

- Disclosure caret
- Layer index
- Layer/Sub Composition kind 표시
- 이름
- 기존 source sync status
- selected, hovered, focused 상태의 명확한 구분
- sticky Layer column과 sticky Ruler

Visibility, lock, solo처럼 실제 mutation 책임이 확정되지 않은 버튼은 가짜 UI로 추가하지 않는다.

### Time Viewport

- 기본 진입은 현재 동작과 같은 `Fit`이다.
- Zoom slider 또는 명확한 wheel gesture를 사용하면 Manual mode로 전환한다.
- Zoom anchor는 pointer 위치를 우선하고 keyboard/slider 조작은 playhead를 우선한다.
- Fit 버튼으로 전체 duration 표시로 돌아간다.
- playhead 또는 선택 item을 viewport 안으로 가져오는 최소 navigation을 제공한다.
- active item drag 중 zoom 변경은 허용하지 않는다. Drag session 종료 후 변경한다.

### 공통 좌표 계약

Ruler, grid, item span, playback range, playhead, property line와 keyframe은 하나의 순수 frame projection을 사용한다.

```text
frameToTimelineX(frame, viewport)
timelineXToFrame(x, viewport)
resolveVisibleFrameRange(viewport)
resolveAdaptiveTickStep(viewport)
```

Ruler tick과 화면 밖 keyframe은 전체 duration 길이에 비례해 생성하지 않고 visible range와 작은 overscan 범위만 ViewModel로 만든다.

## Task 계획

### Task 1 — Current Timeline Contract Baseline

- 현재 Timeline UX, command와 ViewModel 경계를 코드와 fixture 기준으로 확정한다.
- item select/move/resize/reorder/rename/duplicate/split 계약을 기록한다.
- keyframe select/move/delete, global↔local frame과 History transaction을 기록한다.
- long duration, duplicate source/different itemId, nested Sub Composition과 property 0개 fixture를 정의한다.
- 아직 제품 UI를 수정하지 않는다.

### Task 2 — Timeline Session View State 설계

- Composition별 disclosure, Fit/Manual, zoom, scroll과 focus state 책임을 설계한다.
- Composition 전환, Project import, Undo/Redo와 item add/remove 후 normalize 규칙을 정한다.
- Project/History에 저장하지 않는 것을 정적 검증으로 고정한다.
- 아직 Presentation을 구현하지 않는다.

### Task 3 — Hierarchical Row ViewModel

- Item, Transform group와 Property row의 명시적 depth/parent/disclosure ViewModel을 만든다.
- Selection과 expansion을 분리한다.
- 여러 item의 기존 enabled property를 동시에 표시한다.
- duplicate source에서도 `itemId + property` 표시 identity를 유지한다.

### Task 4 — Layer Stack Presentation

- sticky Layer column/header를 만든다.
- disclosure caret, index, kind, name, sync status와 hover/selected/focused 표시를 통일한다.
- 기존 rename, reorder와 deletePending 결정 흐름을 보존한다.
- Visibility/lock/solo와 새로운 mutation 기능은 추가하지 않는다.

### Task 5 — Time Viewport와 Adaptive Ruler

- Fit/Manual zoom, horizontal scroll과 zoom anchor를 구현한다.
- 공통 frame projection helper를 Ruler, grid, range, item, playhead와 keyframe에 연결한다.
- visible window 기반 adaptive tick과 keyframe filtering을 구현한다.
- sticky Ruler와 viewport edge 표시를 정리한다.

### Task 6 — 기존 Interaction 연결

- 새로운 viewport 좌표에서 scrub, item move/resize, keyframe drag와 edge auto-scroll을 연결한다.
- drag 중 zoom 금지와 pointer coordinate 안정성을 보장한다.
- Project/Animation/Playback Commands와 History port를 그대로 재사용한다.

### Task 7 — 정적 회귀와 성능 검증

- long duration에서 tick/ViewModel 수가 전체 duration에 비례하지 않는지 검증한다.
- Draft-only root update에서 Timeline panel render 0 계약을 유지한다.
- Project Update와 History transaction 수를 기존과 비교한다.
- Animation Evaluation, exclusive playback range, Renderer order와 global↔local frame 의미가 바뀌지 않았는지 검증한다.
- 변경 파일 ESLint, 관련 verification, 전체 test, build와 diff check를 실행한다.

### Task 8 — 실제 QA 대기

사용자가 명시적으로 요청한 경우에만 실제 Browser QA를 수행한다.

QA fixture:

- `drag_test.psd`
- `layer_test.psd`

확인 항목:

- 여러 Layer disclosure 유지
- Composition별 disclosure/zoom/scroll 유지
- Fit, zoom anchor와 horizontal scroll
- Ruler/playhead/range/item/keyframe 정렬
- move/resize/reorder/rename/duplicate/split
- keyframe select/move/delete
- Undo/Redo와 Composition 전환
- 긴 Timeline의 반응성과 Console 오류

## Sprint 완료 조건

- Selection과 Property Disclosure가 분리된다.
- 여러 Timeline Item의 기존 enabled property를 동시에 볼 수 있다.
- Composition별 disclosure/zoom/scroll이 session 동안 유지된다.
- Session View State는 Project serialization과 History에 들어가지 않는다.
- Fit과 Manual zoom/scroll이 동작한다.
- Ruler, playhead, range, item과 keyframe이 같은 frame 좌표를 사용한다.
- visible tick/keyframe ViewModel이 전체 duration에 비례해 증가하지 않는다.
- 기존 Timeline item/keyframe 편집과 History 의미가 유지된다.
- Animation Evaluation, Playback, Renderer, Draft Runtime과 Export 의미가 변경되지 않는다.
- 새 Engine, 전역 Store와 Project schema가 추가되지 않는다.

## 첫 Sprint에서 하지 않을 것

- Snapping과 snap guide
- Item/Keyframe multi-selection
- Box selection
- Copy/Paste와 batch mutation
- Easing, Bezier와 Graph Editor
- Keyframe interpolation schema 변경
- Marker와 audio waveform
- source trim/offset와 time remap
- 별도 Work Area 데이터 추가
- Visibility, lock, solo, shy 기능 추가
- Anchor animation
- Timeline View의 Project 직접 수정
- 새 Engine, 전역 Runtime 또는 Store
- Renderer, Evaluated Scene, Preview/Export 변경

## 위험과 보호 계약

### Plain Data와 Migration

첫 Sprint는 Project schema 변경이 없으므로 migration은 0건이다. 향후 easing은 keyframe interpolation Plain Data와 normalize가 선행되어야 한다.

### Duplicate Item

여러 Timeline Item이 같은 `sourceId`와 animation track을 공유할 수 있다. Timeline 표시 identity는 `itemId`를 사용하되, keyframe mutation target이 item instance별이라고 오해해서는 안 된다.

### History

- disclosure, zoom, scroll과 focus: History 0
- item/property mutation: 기존 Project/Animation History port
- drag: begin → markDirty → commit 1회
- no-op/cancel: History 0

### Playback

Playback Range `endFrame`의 exclusive 의미를 유지한다. 첫 Sprint에서는 Playback Range와 별도의 Work Area를 만들지 않는다.

### Draft Runtime

Timeline zoom/disclosure는 활성 Transform Draft를 Commit하거나 변경하지 않는다. Drag 중 viewport 변경은 금지해 pointer session 좌표를 안정화한다.

### Renderer와 Order

Timeline reorder는 Project Command를 통해 Timeline, Render와 Composition order를 함께 갱신한다. ViewModel이나 UI에서 배열을 직접 변경하지 않는다.

### Performance

- 기존 Timeline panel memo 경계와 Draft-only render 0을 유지한다.
- 전체 duration frame 배열 생성을 visible tick 생성으로 교체한다.
- 확대된 property row가 많아질 수 있으므로 stable row identity와 memo 입력을 유지한다.
- 첫 Sprint에서 새 DOM virtualization system까지 도입하지 않는다. 실제 row 병목이 증명되면 후속 Sprint로 분리한다.

## 예상 변경 경계

### Session State와 조립

- `src/editor/state/useEditorEngineStateStores.ts`
- `src/editor/state/useEditorSessionState.ts`
- `src/editor/useEditorCompositionRoot.ts`
- `src/engines/timeline/useTimelineEngine.ts`

### Timeline Model과 Controller

- `src/engines/timeline/constants/timelineConstants.ts`
- `src/engines/timeline/models/timelineViewModel.ts`
- `src/engines/timeline/models/timelineEngineTypes.ts`
- `src/engines/timeline/models/timelineInteractionModel.ts`
- `src/engines/timeline/helpers/timelineLayoutHelpers.ts`
- `src/engines/timeline/helpers/timelineViewModelHelpers.ts`
- `src/engines/timeline/helpers/timelineInteractionHelpers.ts`
- `src/engines/timeline/controllers/useTimelineViewController.ts`
- `src/engines/timeline/controllers/useTimelinePlaybackUIController.ts`
- `src/engines/timeline/controllers/useTimelinePointerController.ts`

### Timeline UI

- `src/features/timeline/components/TimelinePanel.tsx`
- `src/features/timeline/components/TimelineRuler.tsx`
- `src/features/timeline/components/TimelineTrackRows.tsx`
- `src/features/timeline/components/TimelineTrackOverlays.tsx`
- `src/features/timeline/components/TimelineItemTrackRow.tsx`
- `src/features/timeline/components/TimelinePropertyTrackRow.tsx`
- `src/features/timeline/components/TimelineHeader.tsx`

### 보존할 Cross-Engine 계약

- `src/models/offlineMigration/timelineItemModel.ts`
- `src/models/offlineMigration/selectionModel.ts`
- `src/models/animationModel.ts`
- `src/engines/project/models/projectCommandModel.ts`
- `src/engines/project/history/projectHistorySnapshot.ts`
- `src/engines/animation/controllers/usePropertyTrackController.ts`
- `src/engines/animation/controllers/useKeyframeController.ts`
- `src/engines/animation/helpers/animationFrameHelpers.ts`
- `src/engines/playback-render/controllers/usePlaybackRangeController.ts`
- `src/engines/playback-render/helpers/activeTimelineItemHelpers.ts`

## 리팩토링 제안

이번 조사에서 Timeline 관련 500줄 이상 TS/TSX 파일은 발견되지 않았다. 다음 500줄 이상 verification 파일은 보고만 하며 이번 Sprint 계획과 분리한다.

- `scripts/verifyCanvasTransformDragIntegration.ts` — 849줄
- `scripts/verifyRenderHelpers.ts` — 816줄
- `scripts/verifyPsdPipeline.ts` — 795줄
- `scripts/verifyCanvasDirectSelection.ts` — 618줄
- `scripts/verifyPreviewInteractionProfilingCdpDriver.ts` — 613줄
- `scripts/verifyCanvasInteractionHelpers.ts` — 587줄
- `scripts/verifyCanvasDragPerformance.ts` — 572줄
- `scripts/verifyCanvasPreviewIntegration.ts` — 534줄
- `scripts/verifyDrawImageOptimization.ts` — 519줄

## 계획 검토 결과

- Graph Editor보다 Layer Stack과 Time Viewport가 먼저라는 순서로 정리했다.
- Selection과 Disclosure 책임을 분리했다.
- Project 데이터와 Editor session view state를 분리했다.
- 새 animation 기능 없이 기존 enabled track만 재사용한다.
- horizontal zoom 전에 공통 frame projection과 visible range를 계획에 포함했다.
- sticky presentation과 mutation 기능을 분리해 가짜 visibility/lock control을 금지했다.
- duplicate source의 item identity와 animation target 차이를 위험 항목으로 명시했다.
- 실제 QA는 사용자 요청 전까지 실행하지 않도록 분리했다.

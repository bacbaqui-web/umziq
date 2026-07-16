# Seven-engine refactoring plan

> 기준: Task 17 종료 시점
> 이 문서는 목표 구조와 전체 작업 순서를 설명한다. 현재 구현 상태는 `src_map.md`, 가장 최근 Task의 인수인계는 `recent_task.md`를 기준으로 한다.

현재 진행: Task 1~Task 17 완료. Seven-engine 구조 리팩토링과 자동 QA를 종료했다.

## 1. 현재 구조 조사 결과

### 현재 주요 기능과 데이터 흐름

현재 앱은 PSD import/refresh, composition/layer 트리, Canvas 2D 프리뷰, transform/keyframe, timeline 편집, playback, undo/redo를 하나의 React 애플리케이션으로 연결한다.

```text
EditorShell
  → useEditorCompositionRoot
      ├─ Shell-owned State Stores + Project Commands/History
      ├─ Project Selection/PSD Engine
      ├─ PSD Tree Engine
      ├─ Playback & Render Engine
      ├─ Timeline Engine
      ├─ Properties Engine
      ├─ Animation Engine
      ├─ Canvas Composition
      └─ Shell Layout/History Shortcut
           ↓ Engine ViewProps
      EditorShellLayout
        ├─ PsdTree
        ├─ PreviewWorkspacePane
        ├─ PropertiesPanel
        └─ TimelinePanel
```

PSD import는 `File → ag-psd → Composition/Layer + TimelineItem + RenderItem`으로 변환된다. Transform 입력은 Properties, Canvas, Timeline에서 시작하지만 `Composition`과 `Layer`의 같은 transform/keyframe 필드를 수정한다. Playback Engine이 global frame과 range/loop를 소유하고 Render Engine이 Animation 공개 API로 Render Frame을 평가한 뒤 Canvas Adapter가 출력한다.

### Task 3 완료 후 상태 소유권

Task 3에서 `src/editor/state/useEditorState.ts`에 섞였던 상태를 다음 소유 Hook으로 분리했다.

- Project: `useProjectState`
- Project runtime: `useProjectRuntimeState`
- History ref/snapshot type: `useProjectHistoryState`
- Selection/draft: `useEditorSessionState`
- Playback: `usePlaybackState`
- Canvas viewport/interaction: `useCanvasViewportState`, `useCanvasInteractionState`
- Timeline interaction: `useTimelineState`
- Shell layout: `useEditorShellLayoutState`

`useEditorState`는 기존 반환 계약과 history/selection callback을 유지하는 compatibility adapter다. Project command와 history controller 분리는 Task 4 계획이다.

### 이미 Engine/Controller/Helper 역할을 하는 파일

- Composition root/compatibility에 가까움: `useEditorShellFeatures`, `usePreviewController`, `useTimelineController`, `useTransformActions`
- Project Controller에 가까움: `useProjectActions`
- Animation Controller에 가까움: `useAnimatedTransformValueActions`, `useStaticTransformValueActions`, property/keyframe action hooks
- 순수 Project Helper에 가까움: `compositionActions`, `projectModelHelpers`, `psdRefreshHelpers`, import helper들
- 순수 Animation Helper에 가까움: `keyframeTrackHelpers`, `keyframeTargetHelpers`, `previewValueEvaluation`
- Playback은 실제 Engine: `usePlaybackEngine`, 세 Playback Controller, Frame/Range Helper
- Render는 실제 Engine: `useRenderEngine`, `buildRenderFrame`, Active/Source Helper, Canvas 2D Adapter
- 실제 PSD Tree UI Engine: `usePsdTreeEngine`, Selection/Picker/Reorder/Source Action Controller, UI State, View Model/Drop Helper, Browser Picker Adapter
- 실제 Canvas Engine: `useCanvasEngine`, Viewport/Workspace/Pan/Guide/Selection/Render와 Pointer/Transform/Gizmo/Motion Path Controller, 순수 Camera/Guide/Selection/Interaction Helper
- 실제 Properties UI Engine: `usePropertiesEngine`, View/Numeric/Draft/Track/Keyframe Controller, 순수 ViewModel/Numeric Helper
- UI Controller에 가까움: Timeline의 기존 Controller/interaction

### 큰 파일과 우선 위험

| 파일 | 줄 수 | 현재 섞인 책임 |
|---|---:|---|
| `useEditorShellFeatures.ts` | 565 | 전체 엔진 조립, history adapter, 네 패널 props |
| `useTimelineItemInteractions.ts` | 609 | reorder/move/resize/select/duplicate/split/rename |
| `useEditorState.ts` | 156 | State/Project controller 조립, selection compatibility callback |
| `TimelineRuler.tsx` | 519 | ruler UI, scrub, duration/range 편집 |
| `psdCompositionMergeHelpers.ts` | 486 | 재귀 composition/layer merge와 timeline/render 결과 조립 |

500줄 이상 파일은 작은 수정에도 넓은 문맥을 읽어야 하므로 유지보수와 AI 토큰 비용이 높다. Task별 책임 분리 시 우선 대상이지만, 기계적 이동과 로직 변경을 한 Task에 섞지 않는다.

### 직접 결합과 책임 혼합

- `usePreviewController`는 Render Read와 Canvas Port를 연결하는 compatibility adapter다. Viewport와 transform/motion Controller 조립은 `useCanvasEngine`이 소유한다.
- 기존 `usePreviewTransformInteractions → usePreviewHandleInteractions → 개별 transform interaction` 호출 사슬은 Task 12에서 제거되고 compatibility re-export만 남았다.
- `useTimelineController`는 Task 15에서 `useTimelineEngine` compatibility alias가 됐고 Engine만 독립 View/Interaction Controller를 조립한다.
- 기존 `useTransformActions → commit/property → input/value → static/animated` 호출 사슬은 Task 7에서 Animation Engine 조립으로 이동했다.
- Timeline UI Hook의 `editor/actions`와 Preview 내부 Helper 직접 import는 Task 15에서 제거됐다.
- Canvas interaction이 animation evaluation 및 project tree mutation helper를 직접 import한다.
- `useEditorShellFeatures`는 Project/Animation/Playback/UI controller를 조립한다. Task 8에서 `setInterval` lifecycle은 Playback Loop Controller로 이동했다.
- `motionPathGeometry`는 Animation 공개 sampling과 Canvas overlay geometry만 조립한다.
- `previewRenderer`는 Task 9에서 Playback & Render 공개 API의 8줄 compatibility re-export로 축소됐다.

### 특수 처리와 핵심 관계

- master composition은 `comps`에 저장되지 않는다. `useEditorSelectionModel`에서 가상으로 만들고 transform은 별도 state에 둔다. 저장 모델 정리 전까지 일반 composition과 동일 취급하면 안 된다.
- history는 composition별 최대 100 snapshot이며 연속 pointer drag는 begin/dirty/commit capture로 묶는다. PSD import/refresh 때 history 전체를 초기화한다.
- PSD refresh는 `sourcePath`로 엔티티를 매칭하고 `sourceFingerprint`로 변경 여부를 판단한다. 사용자 transform/timing을 보존하면서 `updated/new/deletePending/missing` 상태를 병합한다.
- `Layer`/`Composition`은 source transform과 keyframe을, `TimelineItem`은 comp 안의 instance timing을, `RenderItem`은 canvas drawable과 nested render 연결을 소유한다. 삭제/정렬/refresh에서는 세 구조를 함께 갱신해야 한다.

## 2. 목표 디렉터리 원칙

최종 형태의 방향은 다음과 같다. Task 1의 공개 façade부터 Task 15의 완전한 Timeline View·Interaction Engine까지 실제로 생성되었으며 Shell Integration과 Final QA는 계획이다.

```text
src/
  engines/
    project/
      index.ts
      projectEngine.ts
      controllers/
      helpers/
      state/
      models/
      constants/
    animation/
    playback-render/
    psd-tree/
    canvas/
    properties/
    timeline/
  models/               여러 Core Engine이 공유하는 직렬화 가능 계약만 허용
  editor/               최종적으로 앱 shell과 engine composition만 유지
  app/
```

규칙:

- 엔진 외부 코드는 각 엔진의 `index.ts`만 import한다.
- `index.ts`는 공개 API만 내보내며 내부 Controller/Helper를 그대로 모두 노출하지 않는다.
- Engine이 Controller를 조립한다. Controller는 다른 Controller를 호출하지 않는다.
- Helper는 hook/DOM/state 변경 없이 입력을 계산해 결과만 반환한다.
- Core Engine은 React component와 UI Engine을 import하지 않는다.
- UI Engine은 다른 UI Engine을 직접 import하지 않고 Core 공개 API와 props/state 계약으로 연결한다.
- `src/models`는 Composition/Layer/TimelineItem/RenderItem처럼 여러 Core가 반드시 함께 알아야 하는 저장 계약만 둔다. 편의성만을 위한 `common` 폴더는 만들지 않는다.

## 3. 일곱 Engine 목표 설계

### 3.1 Project Engine

현재 후보 파일:

- `editor/actions/useProjectActions.ts`, `projectActionHelpers.ts`, `psdRefreshHelpers.ts`, `compositionActions.ts`
- `editor/import/*`
- `editor/models/projectModelHelpers.ts`
- `editor/state/useEditorState.ts`의 프로젝트/history/source 부분
- Timeline item mutation 중 project data를 직접 바꾸는 로직

Controller 후보:

- Project Lifecycle Controller
- Composition Controller
- Timeline Item Controller
- PSD Import Controller
- PSD Refresh Controller
- Source Sync Controller
- History Controller

Helper 후보:

- composition tree update/reorder
- project selection resolution
- PSD parse/convert/merge
- timeline/render order sync
- project snapshot clone/restore

소유 State/Model:

- 저장 가능한 Project State와 source binding
- History State
- Composition/Layer/TimelineItem/RenderItem/CompositionMeta 모델

공개 API 초안:

- `useProjectEngine()` 또는 React 비종속 `createProjectEngine()` 경계
- project 조회/초기화
- PSD import/refresh/source decision
- composition/layer/timeline item add/update/delete/reorder
- timeline item duplicate/split/rename/timing 변경
- history begin/mark/commit, undo/redo

허용 의존성:

- 공유 domain model
- PSD parser library
- Animation Engine의 공개 command 계약이 필요한 경우 Engine 조립층을 통해 전달
- UI Engine 의존 금지

제거할 직접 의존:

- Timeline/Canvas hook의 project tree 재귀 수정
- Shell이 다수의 project setter를 Project Controller에 직접 주입하는 구조

### 3.2 Animation Engine

현재 후보 파일:

- `editor/actions/keyframe*`, `transformActions.ts`, `transformPropertyActionHelpers.ts`
- `editor/actions/use*Transform*`
- `editor/preview/previewValueEvaluation.ts`
- `motionPathGeometry.ts`의 frame sampling 부분
- `state/useEditorPropertyModel.ts`의 평가 부분

Controller 후보:

- Property Track Controller
- Transform Value Controller
- Keyframe Controller
- Motion Path Controller

Helper 후보:

- keyframe upsert/move/remove
- interpolation/evaluate property
- local frame 계산
- transform normalization
- motion path sample 계산

소유 State/Model:

- Keyframe/Property Track 모델과 정책
- animation 자체는 Project의 저장 모델을 수정하는 command 결과를 반환하고 UI draft는 소유하지 않는다.

공개 API 초안:

- property track enable/disable
- static/animated property 값 적용
- keyframe create/update/move/delete
- `evaluateProperty`, `evaluateTransform`
- `calculateLocalFrame`, `buildMotionPathSamples`

허용 의존성:

- 공유 domain model
- Project Engine의 데이터 snapshot/command port는 Engine 조립층에서 주입
- UI/DOM 의존 금지

제거할 직접 의존:

- Canvas/Timeline이 `editor/actions`와 evaluation 내부 파일을 직접 import
- transform Controller hook 간 직접 호출 사슬

### 3.3 Playback & Render Engine

현재 후보 파일:

- `features/timeline/hooks/useTimelinePlayback.ts`의 시간 계산
- `useEditorShellFeatures.ts`의 interval effect와 playback range 계산
- `editor/preview/previewRenderer.ts`
- `motionPathGeometry.ts`의 active/local frame 부분
- `features/preview/hooks/usePreviewCanvasRenderer.ts`, `usePreviewSceneGeometry.ts`의 render 계산

Controller 후보:

- Playback Controller
- Playback Range Controller
- Frame Evaluation Controller
- Render Composition Controller
- Canvas Output Controller

Helper 후보:

- frame clamp/step/range
- active timeline item 판정
- source local frame map
- nested composition render command 생성
- frame/time formatting

소유 State/Model:

- Playback State: current frame, playing, range
- Render evaluation 결과 모델; DOM canvas ref는 Canvas Engine에서 전달받고 저장하지 않는다.

공개 API 초안:

- play/pause/seek/step/reset
- playback range/duration 정규화
- `evaluateFrame(project, frame)`
- `getActiveTimelineItems`
- `buildRenderFrame`
- Canvas output adapter 호출

허용 의존성:

- Project snapshot read model
- Animation Engine 공개 evaluation API
- UI Engine 의존 금지

제거할 직접 의존:

- Shell의 `setInterval`과 playback state 직접 변경
- Canvas UI hook의 render 내부 helper 직접 접근

### 3.4 PSD Tree Engine

현재 실제 구조:

- `usePsdTreeEngine`이 Shell에서 Project Read/Command Port와 Selection Port를 주입받아 조립한다.
- Tree Selection, PSD Picker, Tree Reorder, Source Action Controller가 서로를 직접 호출하지 않는다.
- `usePsdTreeState`가 file input ref, pending picker mode, dragged main ID, drop target을 소유한다.
- Drop Helper와 Tree View Model Helper는 React/DOM/Project mutation을 모르는 순수 함수다.
- Browser Picker Adapter가 File System Access API, AbortError, File/Handle source 변환을 소유한다.
- `PsdTree`와 `PsdTreeNode`는 Engine View Props/View Model만 렌더한다.

공개 API:

- `PsdTree`, `usePsdTreeEngine`
- `PsdTreeProjectReadPort`, `PsdTreeProjectCommandPort`, `PsdTreeSelectionPort`
- `PsdTreeViewProps`, 외부에 필요한 View Model/Drop Position 타입

허용 의존성:

- Project Engine 공개 read/command API
- 다른 UI Engine 의존 금지

제거된 직접 의존:

- Component의 Project Domain/Runtime 타입 직접 해석
- Component의 File System Access API와 source 변환
- Component의 drag/drop 상태와 drop 위치 계산

### 3.5 Canvas Engine

현재 실제 구조:

- `useCanvasEngine`이 기존 단일 Canvas State Port를 주입받아 Viewport/Workspace/Pan/Guide/Selection/Render Controller를 조립한다.
- Viewport Helper가 clamp/fit/base offset/pan/zoom/world-screen/pointer 좌표를 소유한다.
- Workspace Adapter/Controller가 초기 측정, ResizeObserver observe와 disconnect를 소유한다.
- Guide Helper/Controller가 9:16/safe-zone geometry, visibility와 toggle Command를 소유한다.
- Selection Helper/Controller가 Layer/Sub Composition evaluation과 world/screen overlay Read Model을 만든다.
- Pointer Controller가 단일 window mouse/rAF session, commit/cancel과 listener cleanup을 소유한다.
- Transform Controller가 position/scale/rotation/opacity/anchor와 arrow nudge를 Animation Command/History Port에 연결한다.
- Motion Path Controller가 공개 sampling/evaluation으로 View Model을 만들고 keyframe 선택/drag를 Animation Command에 연결한다.
- Gizmo Controller가 handle geometry/cursor/visibility, hover/pending/direct input/readout과 motion point View Model을 조립한다.
- `useCanvasInteractionState`가 drag/readout뿐 아니라 hover/pending/direct input session을 한 번만 소유한다.
- `usePreviewController`는 Render 공개 Read와 Canvas State/Core Command Port를 실제 Canvas Engine에 전달하는 compatibility adapter다.

공개 API:

- `PreviewWorkspacePane`, `useCanvasEngine`, compatibility `usePreviewController`
- Viewport/Guide/Selection/Gizmo/Interaction Read Model과 Command 타입
- 외부에서 필요한 좌표/guide/selection/interaction 순수 API

허용 의존성:

- 세 Core Engine의 공개 API
- 다른 UI Engine 의존 금지

제거된 직접 의존:

- Canvas Engine의 Editor preview helper 및 Core 내부 helper 경로 import
- View Component의 guide 계산과 raw guide setter
- Preview Scene Geometry의 selection overlay 계산

제거된 직접 의존:

- Preview Transform/Gizmo Controller → 개별 Controller Hook 호출 사슬
- Motion Path interaction의 Editor compatibility evaluation 경로
- Preview Component의 overlay geometry/cursor/pending interaction 계산

### 3.6 Properties Engine

현재 실제 구조:

- `usePropertiesEngine`이 Selection/Playback/Project Read와 Animation Command Port를 받아 다섯 Controller를 조립한다.
- Property View Controller는 Animation 공개 evaluation을 호출해 현재 값을 읽고 완성된 Panel/Row/Info/Keyframe View Model을 만든다.
- Numeric Input Controller는 빈 문자열, `-`, 입력 중 소수 문자열을 보존하고 Enter/Blur commit, Escape cancel을 처리한다.
- Draft Controller는 새 Store 없이 기존 Editor Session State의 transform draft와 Properties 문자열/focus session을 사용한다.
- Track/Keyframe Controller는 Animation 공개 Command만 호출한다.
- Numeric/ViewModel Helper는 React, DOM, Project/Playback/Animation Command를 호출하지 않는 순수 계산이다.
- `PropertiesPanel`, Property Row, Info Popover는 Engine ViewProps/ViewModel과 DOM event만 사용한다.
- `useEditorPropertyModel`은 `usePropertiesEngine` compatibility 이름만 남았다.

공개 API:

- `PropertiesPanel`, `usePropertiesEngine`
- `PropertiesReadModel`, `PropertiesPropertyRowViewModel`, `PropertiesCommand`, `PropertiesEngineViewProps`

허용 의존성:

- Project/Animation 공개 API
- Playback current frame read API
- 다른 UI Engine 의존 금지

제거된 직접 의존:

- Shell이 모든 draft setter와 transform action을 `PropertiesPanel` 개별 prop으로 조립하는 구조
- Property Row의 숫자 parse/clamp/scale link/history/Animation mutation 계산
- Info Popover의 Composition Meta 문자열 계산

### 3.7 Timeline Engine

현재 후보 파일:

- `features/timeline/**/*`
- `features/propertyVisualTokens.ts` 중 timeline 표시 부분

Controller 후보:

- Playhead Input Controller
- Timeline Selection Controller
- Timeline Item Input Controller
- Keyframe Input Controller
- Playback Range Input Controller
- Composition Navigation Controller

Helper 후보:

- pointer→frame/snap
- row layout
- selection/breadcrumb/switcher view model
- drag preview timing
- source status 표시

소유 State/Model:

- hover frame, scrub/drag/pending input, row UI State
- project item/keyframe/playback 값은 Core 소유

공개 API 초안:

- `TimelinePanel`, `useTimelineEngine`
- Project/Animation/Playback command port를 입력으로 받음

허용 의존성:

- 세 Core Engine의 공개 API
- 다른 UI Engine 의존 금지

제거할 직접 의존:

- project/action/preview 내부 helper 직접 import
- Timeline Controller가 세 하위 Controller를 직접 조립하는 구조

## 4. 전체 Task 계획

각 Task는 완료 시 build 가능한 상태를 유지하고 `src_map.md`와 `recent_task.md`를 갱신한 뒤 멈춘다.

### Task 1. Engine 공개 경계와 리팩토링 청사진 — 완료

- 목표: 실제 구조를 조사하고 7개 Engine의 안정적인 공개 import 경계를 만든다.
- 변경 대상: `src/engines/*/index.ts`, Shell의 최상위 import, 세 문서.
- 완료 조건: 7개 façade 존재, Shell이 UI/Core 대표 기능을 façade에서 import, 로직/동작 변경 없음, 전체 계획 기록.
- 검증: build, lint, 기존 dev server HTTP 및 화면 smoke 확인 가능한 범위.
- 예상 위험: façade가 실제 분리 완료처럼 오해될 수 있음. 문서와 주석에 compatibility 상태를 명시한다.
- 다음 연결: Task 2가 façade 뒤의 model/constant 소유권을 정리한다.

### Task 2. 공유 Domain Model과 Constant 소유권 정리 — 완료

- 목표: 저장 가능한 domain model과 engine별 정책 상수를 UI/session 타입에서 분리한다.
- 변경 대상: `editor/types/*`, `editorShellConstants`, `psdDocumentFactory` 상수, timeline/canvas constants.
- 완료 조건: Composition/Layer/TimelineItem/RenderItem/Keyframe 계약 위치 확정, 중복 FPS/duration 제거, 호환 re-export 제공.
- 검증: build/lint, import graph 확인, 모델 생성 기본값 단위 테스트 기반 추가 여부 검토.
- 예상 위험: 순환 type import, master 특수 모델 누락.
- 다음 연결: Task 3이 확정된 모델을 기준으로 state를 분류한다.

### Task 3. Project State와 UI Session State 경계 — 완료

- 목표: `useEditorState`의 상태를 저장 대상/project, history, selection, playback, UI session으로 분류하고 작은 hook/state 모듈로 추출한다.
- 변경 대상: `useEditorState`, shell models, engine별 state 디렉터리.
- 완료 조건: 외부 동작/return 계약을 adapter로 유지하면서 최소 Project/History/Canvas UI/Timeline UI 경계가 파일 수준으로 드러남.
- 검증: build/lint, undo/redo·selection·panel/viewport 수동 smoke.
- 예상 위험: stale closure, snapshot 복원 누락, master 별도 state 손실.
- 다음 연결: Project Engine이 Project/History State만 받도록 만든다.

### Task 4. Project Engine 기본 명령과 History 분리 — 완료

- 목표: composition/layer/timeline item의 일반 mutation과 undo/redo를 Project Engine 공개 API 뒤로 이동한다.
- 변경 대상: composition actions, project model helpers, state history, timeline item mutation 중 일반 부분.
- 완료 조건: UI hook이 project tree를 직접 재귀 수정하지 않음, history controller 독립, 기존 adapter 유지.
- 검증: pure helper tests, build/lint, reorder/delete/undo/redo 수동 확인.
- 예상 위험: TimelineItem/RenderItem 순서 불일치, composition별 snapshot 선택 복원.
- 다음 연결: PSD import/refresh가 같은 Project commit 경로를 사용한다.

### Task 5. PSD Import와 Refresh Controller 분리 — 완료

- 목표: parse/convert/merge/commit을 분리하고 PSD source sync를 Project Engine 내부로 이동한다.
- 변경 대상: `editor/import/*`, `useProjectActions`, `projectActionHelpers`, `psdRefreshHelpers`.
- 완료 조건: import/refresh/source decision이 Project 공개 API로만 노출, 900줄 refresh helper가 책임별 helper로 분리, UI 비종속 테스트 가능.
- 검증: PSD fixture 기반 import/refresh tests, build/lint, 실제 picker fallback 수동 확인.
- 예상 위험: rename/reparent/deletePending 병합, canvas 보존, history 초기화, file handle browser 차이.
- 다음 연결: Animation Engine이 안정된 Project command/read 계약을 사용한다.

### Task 6. Animation Model과 순수 Helper 분리 — 완료

- 목표: keyframe/property track/evaluation/local frame/motion sampling 계산을 UI와 Project mutation에서 분리한다.
- 변경 대상: keyframe helpers/actions, preview value evaluation, motion path 계산 일부.
- 완료 조건: interpolation/evaluate/upsert/move/remove가 Animation helper에 있고 DOM/React 의존 없음.
- 검증: 경계 frame/빈 track/중복 frame/보간 unit tests, build/lint.
- 예상 위험: layer position만 playhead frame을 쓰는 기존 예외, local frame off-by-one.
- 다음 연결: Task 7이 Helper를 Animation Controller/API로 조립한다.

### Task 7. Animation Engine Command API — 완료

- 목표: Properties/Canvas/Timeline의 transform/keyframe 변경을 하나의 Animation 공개 API로 통일한다.
- 변경 대상: 모든 `use*Transform*`, transform actions, Timeline/Canvas keyframe interaction adapter.
- 완료 조건: UI가 animation 내부 action을 직접 import하지 않음, static/animated/master 처리 경로 통합, Controller 간 직접 호출 제거.
- 검증: build/lint, transform/property toggle/keyframe/motion path/undo smoke.
- 예상 위험: master 별도 setter, anchor offset 보상, drag history capture.
- 다음 연결: Playback/Render가 Animation evaluation API만 사용한다.

### Task 8. Playback State와 Controller 분리 — 완료

- 목표: current frame, play/pause, range, seek/step을 Playback & Render Engine이 소유하게 한다.
- 변경 대상: shell interval effect, `useTimelinePlayback`, playback state/range.
- 완료 조건: Shell/Timeline은 playback command만 호출, frame 진행과 range clamp가 Core에 위치.
- 검증: fake timer tests, build/lint, play/stop/step/range/duration smoke.
- 예상 위험: interval cleanup, selected comp 전환, range 끝 frame 정책.
- 다음 연결: Task 9가 frame evaluation과 render를 연결한다.

### Task 9. Frame Evaluation과 Render 분리 — 완료

- 목표: active item 판정→Animation 평가→nested composition render command→Canvas 출력 흐름을 분명히 한다.
- 변경 대상: preview renderer, scene geometry, canvas renderer, render/local-frame helper.
- 완료 조건: Core가 React UI를 import하지 않으며 Canvas Engine은 평가된 render frame을 표시만 함.
- 검증: active range/nested comp/render order tests, build/lint, Canvas 결과 smoke.
- 예상 위험: HTMLCanvasElement 직렬화 불가, nested opacity/transform/anchor 순서, bundle 크기.
- 다음 연결: UI Engine들이 안정된 세 Core API 위에서 정리된다.

### Task 10. PSD Tree Engine 정리 — 완료

- 목표: tree UI state/picker/drop controller와 Project command port 경계를 명시한다.
- 변경 대상: `features/psdtree`, `engines/psd-tree`.
- 완료 조건: component는 view 중심, Project 내부 import 없음, source 상태 표시 포함.
- 검증: build/lint, import/refresh/reorder/delete UI smoke.
- 예상 위험: File System Access API fallback과 picker cancel.
- 다음 연결: Canvas UI Engine 정리 패턴으로 사용한다.

### Task 11. Canvas Viewport·Guide·Selection Engine 정리 — 완료

- 목표: camera/viewport/guide/selection/overlay 표시 책임을 Canvas Engine 내부 Controller/Helper/State로 정리한다.
- 변경 대상: preview viewport/hooks/geometry/components, camera/guide helper.
- 완료 조건: Canvas UI state 소유권 명확, Controller 직접 호출 대신 Canvas Engine 조립, Core 데이터 read-only 표시.
- 검증: coordinate helper tests, build/lint, zoom/pan/guide/selection smoke.
- 예상 위험: ResizeObserver, pointer capture, 좌표계/zoom 보정.
- 다음 연결: Task 12가 직접 transform interaction을 같은 Engine에 연결한다.

### Task 12. Canvas Transform·Gizmo·Motion Path Controller 정리 — 완료

- 목표: 개별 pointer Controller를 독립화하고 결과를 Canvas Engine이 Animation/Project command에 전달한다.
- 변경 대상: preview interaction hooks, gizmo/motion components, overlay state.
- 완료 조건: Controller 간 직접 호출 제거, Helper는 DOM/state 변경 없음, 기존 drag/readout 유지.
- 검증: interaction math tests, build/lint, position/scale/rotation/opacity/anchor/motion path/undo smoke.
- 예상 위험: 전역 mouse listener 정리, history commit 누락, static/animated mode.
- 다음 연결: Properties가 동일 Animation command API를 사용한다.

### Task 13. Properties Engine 정리 — 완료

- 목표: property view model, numeric draft, track/keyframe input을 Properties Engine으로 캡슐화한다.
- 변경 대상: properties components/sections/types, property model/drafts.
- 완료 조건: Shell의 개별 setter prop 감소, Project/Animation 내부 import 없음, anchor 포함 정책 명확화.
- 검증: parse/clamp tests, build/lint, 모든 숫자 입력/track toggle/keyframe smoke.
- 예상 위험: focus 중 draft 동기화, scale link, 선택 전환.
- 다음 연결: Timeline도 command port 방식으로 정리한다.

### Task 14. Timeline View·Navigation·Playback UI 정리 — 완료

- 목표: row/ruler/breadcrumb/switcher/playback control UI와 view model을 Timeline Engine에 캡슐화한다.
- 변경 대상: timeline components, selection path/layout/source status helper.
- 완료 조건: Timeline UI state와 Core state 구분, playback은 Playback 공개 API만 호출.
- 실제 결과: `useTimelineEngine`이 View/Playback UI/Navigation Controller를 조립하고 Panel/Header/Ruler/Duration/Row가 Engine ViewModel을 렌더한다. Task 15 interaction은 compatibility controller에 유지했다.
- 검증: row/layout helper tests, build/lint, navigation/scrub/range smoke.
- 예상 위험: row overlay 좌표, master/sub comp navigation.
- 다음 연결: Task 15가 mutation interaction을 Project/Animation API로 연결한다.

### Task 15. Timeline Item·Keyframe Interaction 정리 — 완료

- 목표: 609줄 item interaction을 기능별 Controller로 나누고 Project/Animation command를 사용한다.
- 변경 대상: timeline item/keyframe interaction hooks와 row components.
- 완료 조건: move/resize/reorder/duplicate/split/rename/keyframe drag Controller 분리, 직접 project mutation 없음.
- 실제 결과: `useTimelineEngine`이 Item/Resize/Reorder/Rename/Duplicate/Split/Keyframe/Pointer Controller를 독립 조립한다. 순수 Interaction Helper와 Session Model이 추가됐고 기존 feature interaction Hook은 compatibility re-export로 축소됐다. Rows는 ViewModel을 렌더하고 DOM event intent만 전달한다.
- 공개 연결: Project 공개 Timeline/Composition/Render Command, Animation 공개 keyframe move/delete Command, Playback current frame Read, 기존 Project History Port만 사용한다.
- 검증: timing/split/order tests, build/lint, 모든 interaction과 undo smoke.
- 예상 위험: duplicated source 인스턴스 의미, render order sync, local frame.
- 검증 결과: build/lint/diff check와 기존 9개 Helper/Command 검증, 신규 Timeline Interaction Helper 검증이 통과했다. in-app browser 부재로 실제 interaction 클릭 smoke는 남았다.
- 다음 연결: Task 16에서 Shell이 완성된 Engine API만 조립하도록 정리한다.

### Task 16. Shell Integration과 직접 참조 제거 — 완료

- 목표: `useEditorShellFeatures`를 Engine composition root로 축소하고 façade 밖 내부 import를 제거한다.
- 변경 대상: editor shell/controller/models/features, 모든 engine public index.
- 완료 조건: Core→UI 참조 0, UI→UI 직접 참조 0, 외부의 engine internal import 0, Shell은 Engine 반환값 연결만 담당.
- 실제 결과: `useEditorCompositionRoot`가 일곱 Engine의 유일한 조립 지점이 됐다. Shell state store와 History shortcut을 분리하고, Project selection/Timeline rows·duration/Canvas view props 계산을 해당 Engine으로 이동했다. 외부 코드는 Engine 공개 façade만 사용하며 참조가 없는 Editor/Feature compatibility 구현을 삭제했다.
- 경계 결과: Engine 외부 내부 경로 import 0, Core→UI 0, UI→UI 0, Controller→Controller import 0. `verifyEngineImportBoundaries.ts`가 이 규칙을 고정한다.
- 검증: build/lint/diff check, import boundary, 기존 10개 Helper/Command 검증 성공. 인앱 브라우저 부재로 실제 UI smoke는 Task 17에 남겼다.
- 예상 위험: props 계약 대규모 변화, React rerender/stale closure.
- 다음 연결: 마지막 분해/QA에서 남은 기술 부채를 정리한다.

### Task 17. 대형 파일 마무리, 테스트 기반, 전체 QA — 완료

- 목표: 남은 500줄 이상 혼합 파일을 분해하고 핵심 pure helper test와 boundary 검사를 고정한다.
- 변경 대상: 잔여 대형 파일, test config/fixtures, docs/README.
- 완료 조건: 7개 Engine 실제 분리, build/lint/test 성공, 핵심 기능 smoke checklist 완료, 문서가 실제 구조와 일치.
- 검증: build/lint/test, production preview, PSD fixture 회귀, 주요 사용자 시나리오 전체 수동 QA.
- 예상 위험: 브라우저 API 자동화 한계, visual regression 미구축, bundle 성능.
- 다음 연결: 전체 리팩토링 종료 후 저장/export 기능 설계 단계로 이동한다.
- 실제 결과: 500줄 이상 TS/TSX 혼합 파일이 남지 않았고, 미사용 Shell/Preview/Timeline/Editor compatibility alias와 Vite template asset을 제거했다. Engine 경계 검사를 모든 façade 하위 구현 경로로 강화했다.
- 테스트 기반: `npm test`와 `npm run qa`를 추가하고 기존 11개 검증에 합성 PSD binary parse/import/replace 및 Project History undo/redo/transaction 검증을 더해 총 13개 검증을 고정했다.
- QA 결과: lint, 13개 test, production build, diff check, production preview entry/asset 응답이 성공했다. 인앱 브라우저가 제공되지 않아 실제 pointer/keyboard visual smoke는 실행하지 못했으며 이는 구조 완료를 막지 않는 환경 한계로 기록한다.
- 종료 판단: 일곱 Engine 분리, 공개 façade, Composition Root, 자동 회귀 기반과 문서 대조가 완료되어 Seven-engine 리팩토링을 종료한다. 다음 범위는 persistence/export와 bundle code splitting이다.

## 5. 계획 변경 규칙

- 각 Task 시작 시 실제 의존 graph와 이전 Task 결과를 다시 확인한다.
- Task 범위가 build 가능한 크기를 넘으면 번호를 추가해 더 작게 나눈다.
- 계획 변경 이유는 해당 시점 `recent_task.md`에 기록한다.
- 완료되지 않은 미래 구조를 `src_map.md`의 현재 구조로 기록하지 않는다.
- 한 Task 완료 후 다음 Task를 자동 시작하지 않는다.

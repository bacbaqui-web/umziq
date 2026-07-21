# Canvas Engine Responsibility Refactoring

> 문서 번호: 47
> 상태: 완료 / Task 7 Composer 교정 및 전체 QA 통과
> 작성일: 2026-07-19
> 목적: Canvas Transform Input과 Preview Canvas Render의 책임 분리 이유, 최종 구조, 보존 계약과 검증 한계를 기록한다.

## 1. Sprint 배경

Canvas Transform 입력과 Fast Preview Canvas 표시 기능은 동작하고 있었지만 두 중심 파일이 서로 다른 책임을 함께 소유하고 있었다.

- `useCanvasTransformController.ts`: DOM pointer context, Position/Scale/Rotation/Opacity/Anchor/Arrow 입력, Draft, Preview patch, interaction state, Animation command, History와 metric
- `canvas2dPreviewSceneAdapter.ts`: dirty bounds, incremental 판정, drawable/source 해석, Layer/Composition draw, cache/surface lifecycle, browser canvas 생성, main Canvas clear와 draw state

이번 리팩토링은 줄 수 감소나 파일 수 증가가 아니라 각 파일에 하나의 주된 책임을 부여하기 위해 진행했다. 새 Engine, Runtime, 기능, 버그 수정은 추가하지 않았다. 사용자 입력, Draft/History, Preview Scene, Canvas 출력, Runtime과 UI의 제품 계약 변화는 0이다.

## 2. Task 1 현재 구조 분석

분리 전에 Input, Runtime, Render, Overlay, Selection, Anchor, Preview, History, Draft 책임을 실제 호출 흐름으로 추적했다.

- Input은 Preview UI/Gizmo의 시작 판단, Transform controller의 transaction, Pointer controller의 RAF sample/commit lifecycle로 나뉘어 있었다.
- History 저장소는 Project Engine에 있고 Canvas는 Animation을 통해 주입된 port만 호출했다.
- Draft는 property draft, Editor-owned `DraftTransformSnapshot`, Preview Update Pipeline의 draft Scene 세 표현을 사용했다.
- Properties Anchor 숫자 입력도 Canvas Transform controller의 `updateAnchorDraft/resetDraftRuntime` 공개 경계를 사용했다.
- Selection/Overlay/Gizmo는 별도 Canvas helper와 DOM/SVG View 책임이며 Preview Canvas bitmap adapter의 책임이 아니었다.
- Preview Render는 Canvas Render controller가 retained draw state와 cache frame lifecycle을 소유하고 Playback Render adapter를 호출하는 구조였다.
- 기존 의존 방향은 Canvas → Playback Render였으며 Playback Render는 Canvas Engine을 import하지 않았다.

분석 결과, 동작별 transaction을 쪼개서 순서를 바꾸는 방식이 아니라 각 transaction을 통째로 이동해야 History와 Draft 의미를 보존할 수 있다고 판단했다.

## 3. 승인된 목표 구조

```text
src/engines/canvas/
├─ composers/
│  └─ useCanvasTransformComposer.ts
├─ controllers/
│  ├─ useCanvasTransformDraftController.ts
│  ├─ useCanvasPositionDragController.ts
│  ├─ useCanvasScaleDragController.ts
│  ├─ useCanvasRotationDragController.ts
│  ├─ useCanvasOpacityDragController.ts
│  ├─ useCanvasAnchorTransformController.ts
│  └─ useCanvasArrowNudgeController.ts
└─ models/
   └─ canvasTransformControllerModel.ts

src/engines/playback-render/
├─ adapters/
│  ├─ canvas2dPreviewSceneAdapter.ts
│  ├─ canvas2dPreviewNodeRenderer.ts
│  └─ canvas2dPreviewSurfaceAdapter.ts
├─ helpers/
│  └─ previewSceneDirtyRegionHelpers.ts
└─ models/
   └─ previewCanvasRenderModel.ts
```

Preview Render의 기존 adapter entry는 직접 import와 public index를 보존하기 위해 남겼다. Transform Input 조립은 후속 Task 7에서 Controller import 경계를 지키는 Composer로 이동했다.

## 4. Canvas Transform Input 결과

### 조립 entry

`useCanvasTransformComposer.ts`는 다음만 담당한다.

- overlay DOM bounds와 viewport 값으로 공통 pointer context 생성
- Draft와 동작별 하위 controller 조립
- 기존 7개 command 반환

```text
startPositionDrag
startScaleDrag
startRotationDrag
startOpacityDrag
startAnchorDrag
updateAnchorDraft
resetDraftRuntime
```

### 동작별 transaction

- `useCanvasPositionDragController.ts`: Position local frame/base 평가와 begin/move/commit/cancel
- `useCanvasScaleDragController.ts`: PointerDown world 위치를 현재 Scale의 100% baseline으로 캡처하고 이후 같은 local axis 투영 거리의 상대 배율, handle/Shift snap/Scale draft/readout transaction 처리. 첫 move가 PointerDown과 같은 좌표면 값이 변하지 않고 baseline 거리의 2배/절반은 시작 Scale의 2배/절반이 된다.
- `useCanvasRotationDragController.ts`: pointer angle/Shift snap/Rotation draft/readout transaction
- `useCanvasOpacityDragController.ts`: screen-space Anchor 거리 25~50px를 0~100%로 선형 매핑하고 최종 값에 Shift snap을 적용하는 Opacity draft/readout transaction. PointerMove Draft가 같은 계산의 25~50px hollow handle 위치와 connection line 끝에 즉시 반영된다.
- `useCanvasAnchorTransformController.ts`: Canvas Anchor drag와 Properties live Anchor draft의 clamp/transformOffset 보정/command
- `useCanvasArrowNudgeController.ts`: editable DOM target을 제외한 전역 Arrow key와 `history.push` 즉시 Position command

각 drag controller가 자기 `history.begin → move → command → markDirty → reset → commit` 또는 cancel 순서를 통째로 소유한다. 공통화 때문에 Position local frame, Shift snap, master Anchor 차단, readout/flag 정리나 metric 조건이 바뀌지 않도록 했다. Arrow는 drag transaction으로 합치지 않았다.

### Draft 경계

`useCanvasTransformDraftController.ts`만 다음 동기화를 담당한다.

```text
transform patch
  → DraftTransformSnapshot 생성
  → Editor snapshot 저장
  → Preview Scene patch 전송

reset
  → Editor snapshot null
  → Preview draft reset
```

History 저장과 Animation command는 알지 않는다. 공통 port와 기존 공개 option/command 타입은 `canvasTransformControllerModel.ts`에 모았고 기존 controller 경로에서 type re-export했다.

## 5. Preview Canvas Render 결과

### 조립 entry

`canvas2dPreviewSceneAdapter.ts`는 기존 공개 함수 signature를 유지하며 다음만 담당한다.

- `drawPreviewSceneToContext`
- `renderPreviewSceneToCanvas`
- full/skip/dirty 분기
- main Canvas resize/clear/transform
- canvas draw/skip metric
- `PreviewCanvasDrawState` 갱신

### 순수 incremental plan

`previewSceneDirtyRegionHelpers.ts`는 Canvas/DOM/Project/metric 의존 없이 다음을 계산한다.

- node count와 id map
- transform 기준 axis-aligned bounds
- 이전/현재 node reference 비교
- Composition render state 변화
- 이전/현재 bounds 합산과 2 logical pixel inflate
- pixel scale과 Scene 조건을 포함한 full/skip/dirty plan
- dirty bounds와 top-level node의 교차 여부

### Node draw

`canvas2dPreviewNodeRenderer.ts`는 실제 Canvas2D node tree draw만 담당한다.

- `renderItemId:drawableId` lookup
- Preview source resolver와 original source fallback
- Layer/Composition transform과 opacity
- 원래 node/children 배열 순서
- Composition Cache hit/miss/store
- Surface Cache acquire/factory fallback/release
- draw/cache metric과 skipped node count

Layer와 Composition의 `save → globalAlpha → transform → drawImage → metric → restore` 순서를 유지했다.

### Browser surface와 계약

`canvas2dPreviewSurfaceAdapter.ts`는 pixel scale normalize, ceil 기반 pixel size, offscreen clear/transform과 `document.createElement("canvas")` 환경 경계만 담당한다.

`previewCanvasRenderModel.ts`는 surface/factory/cache/draw-state/node-bounds 공개 계약을 소유한다. 기존 adapter 경로에서 모든 기존 type을 재-export하므로 Canvas cache/runtime과 public index 이름은 바뀌지 않았다.

## 6. 최종 의존 흐름

### Input → Draft/History/Preview

```text
Preview UI / Gizmo
  → useCanvasTransformComposer
  → 동작별 controller
      ├─ move: property draft + interaction state
      ├─ useCanvasTransformDraftController
      │   ├─ Editor DraftTransformSnapshot
      │   └─ usePreviewUpdatePipeline → Preview Scene draft
      └─ commit/cancel: Animation command + Project History port

Properties Anchor
  → 기존 CanvasTransformDraftCommands
  → Anchor controller
  → 같은 Draft controller
```

### Canvas Render Controller → Playback Render

```text
useCanvasRenderController
  ├─ retained draw state
  ├─ cache beginFrame/endFrame
  └─ canvas2dPreviewSceneAdapter
      ├─ Dirty Region helper → draw plan
      ├─ Node Renderer → Layer/Composition draw와 cache
      └─ Surface Adapter → pixel size/browser surface
```

Canvas Engine은 Playback Render 공개 API를 호출하지만 Playback Render는 Canvas Engine, Selection, Overlay 또는 UI를 import하지 않는다. Overlay/Gizmo는 계속 별도 DOM/SVG 레이어다.

## 7. 보존한 공개 API와 동작 계약

- `UseCanvasTransformControllerOptions` model 계약과 7개 반환 command
- Properties가 사용하는 `CanvasTransformDraftCommands.updateAnchor/reset`
- `drawPreviewSceneToContext`, `renderPreviewSceneToCanvas` 경로와 signature
- Preview Canvas surface/cache/draw-state type 이름과 public index export
- Pointer RAF sample 병합과 commit 전 마지막 sample flush
- drag별 History begin/dirty/commit/cancel 조건과 Arrow `history.push`
- Draft 생성/갱신/reset 순서와 commit 시점
- Position local frame, Shift snap, Anchor clamp와 compensated transformOffset
- Canvas pixel 크기, clear rounding과 transform 수치
- Layer/Composition 배열 순서와 Canvas state/drawImage 순서
- cache hit/miss/store/release 조건과 metric 증가 지점
- incremental eligibility, reference identity, bounds 합산, 2px inflate와 draw-state 갱신 시점
- accurate/fast-preview fallback과 Canvas → Playback Render Engine Boundary

Project Plain Data, normalize, History snapshot 형식, Preview Scene 구조, Editor Draft Runtime, Canvas 출력과 UI는 변경하지 않았다.

## 8. Task 진행 결과

- Task 1: 아홉 책임과 실제 Runtime/호출 관계 분석
- Task 2: 파일별 단일 책임, 입력/출력과 의존 방향 설계
- Task 3: Engine Boundary, 공개 API와 불변 계약 기준 설계 검토·승인
- Task 4: Canvas Transform Input과 Draft/Anchor/Arrow 책임 분리
- Task 5: Preview Canvas adapter, dirty plan, node draw, browser surface와 공개 model 책임 분리
- Task 6: 소스 지도와 본 영구 문서 갱신
- Task 7: Controller import boundary 결함을 Transform Composer로 교정

## 9. 정적 검증과 한계

Task 4와 Task 5에서 각각 다음 정적 검증을 실행해 통과했다.

- 변경 파일 대상 ESLint
- TypeScript/Vite production build (`npm run build`)
- `git diff --check`

Build에는 기존 500kB 초과 chunk 경고가 있었지만 오류는 없었다.

사용자가 별도로 요청하기 전에는 실제 QA를 실행하지 않는 운영 규칙에 따라 다음은 실행하지 않았다.

- 브라우저 조작 QA
- Canvas pixel/visual regression QA
- `npm run qa`
- 전체 verification test

따라서 정적 검증 통과를 실제 QA 통과로 기록하지 않는다. 기능, 출력, Runtime과 UI 변화가 없는 구조 리팩토링으로 구현했지만 실제 브라우저 상호작용과 픽셀 결과는 이번 Sprint 검증 범위에서 별도로 확인하지 않았다.

## 10. 결과

Canvas Transform Input은 Composer 조립 entry, 동작별 transaction, Draft/Preview 동기화와 port 계약으로 분리됐다. Preview Canvas Render는 공개 adapter 조립, 순수 dirty plan, node tree draw, browser surface와 공개 계약으로 분리됐다.

새 Engine이나 Runtime을 만들지 않았고 Canvas → Playback Render 방향, Project/Animation History port, Properties Anchor 공개 경계와 Overlay DOM/SVG 경계를 유지했다. 제품 기능, Canvas 출력, Runtime과 UI 계약의 의도적 변화는 없다.

## 11. Post-Sprint QA 결과

사용자가 명시적으로 요청한 뒤 Microsoft Edge 150과 `drag_test.psd`로 실제 Runtime QA 및 `npm run qa`를 수행했다.

### Edge Runtime

- PSD/Canvas 출력, Position drag, Anchor drag와 Properties 양방향 반영, Undo/Redo, Rotation, linked Scale, Opacity, Escape cancel을 확인했다.
- 반복 drag에서 잔상, 누락, 잘못된 draw order 또는 Canvas clear 이상은 발견되지 않았다.
- 저품질 fast-preview와 원본 accurate 표시 경로 모두 가시적 이상이 없었다.
- Computer Use의 drag가 한 동작으로 실행되어 PointerMove 중간 프레임 스크린샷은 확보하지 못했다.

### 자동 QA

- ESLint: 통과
- 앞선 verification 9개: 통과
- Engine Import Boundary: 실패
- 별도 TypeScript/Vite build: 통과
- `git diff --check`: 통과

실패 원인은 `useCanvasTransformController.ts`가 분리된 Canvas controller 7개를 직접 import한 것이다. 기존 `verifyEngineImportBoundaries.ts`는 controllers 폴더의 Controller가 다른 Controller를 직접 import하면 위반으로 판정한다. 따라서 실제 Edge Runtime 회귀는 발견되지 않았지만 전체 QA 결과는 실패이며, 구조와 기존 boundary assertion 중 어느 쪽을 기준으로 정리할지 후속 수정 Task가 필요하다.

## 12. Task 7 Engine Import Boundary 교정

### 결함 원인

Task 4에서 여러 Transform Controller를 조립하는 entry를 `controllers/useCanvasTransformController.ts`에 남겼다. 제품 동작은 유지됐지만 파일 분류가 책임과 맞지 않아 Controller가 다른 Controller를 직접 import했고, 기존 Engine Import Boundary assertion을 위반했다. Verification script의 규칙이나 예외가 문제가 아니라 조립 책임의 위치가 잘못된 구조 결함이었다.

### 수정 구조

```text
useCanvasEngine
  → useCanvasTransformComposer
      ├─ 공통 PreviewPointerContext 생성
      ├─ useCanvasTransformDraftController
      ├─ useCanvasPositionDragController
      ├─ useCanvasScaleDragController
      ├─ useCanvasRotationDragController
      ├─ useCanvasOpacityDragController
      ├─ useCanvasAnchorTransformController
      └─ useCanvasArrowNudgeController
```

`composers/useCanvasTransformComposer.ts`가 공통 pointer context 생성, 일곱 하위 Controller hook 조립과 기존 일곱 command 구성을 그대로 이어받았다. `useCanvasEngine.ts`는 Composer를 직접 호출하며, Controller 이름의 wrapper나 alias는 남기지 않았다. `CanvasTransformDraftCommands` façade type export는 책임 소유 model인 `canvasTransformControllerModel.ts`를 직접 가리킨다. 개별 Controller가 공유하는 `UseCanvasTransformControllerOptions` 이름과 계약은 유지했다.

Composer는 여러 Controller 조립과 공개 API 구성만 담당한다. 제품 계산이나 mutation은 추가하지 않았고 Transform 계산, DOM event, Pointer transaction, History/Draft/Preview/metric 순서와 개별 Controller 구현은 변경하지 않았다. 의존 방향은 `Engine → Composer → Controller`이며 Controller → Controller/Composer와 Composer → Composer import는 없다.

### 최종 검증

Task 7의 1차 검증 결과는 다음과 같다.

- 변경 파일 ESLint: 통과
- Engine Import Boundary 단독 verification: 통과
- production build: 통과. 기존 500 kB 초과 chunk 경고만 발생
- `git diff --check`: 통과

감독관 diff 승인 후 전체 QA를 처음부터 다시 실행했다.

- `npm run qa`: 통과
- ESLint: 통과
- Verification Suite 33개: 모두 통과
- Engine Import Boundary: 통과
- TypeScript/Vite build: 통과
- `git diff --check`: 통과

Microsoft Edge 150과 `drag_test.psd`를 사용한 실제 smoke에서도 PSD/Canvas 출력, Position, Rotation, linked Scale, Opacity, Canvas/Properties Anchor, Undo/Redo, Escape numeric draft cancel, fast-preview/accurate와 반복 drag를 확인했다. 잔상, 누락, draw order 또는 clear 이상은 발견되지 않았다.

Computer Use drag는 mouse-down/move/up을 한 번에 수행하므로 PointerMove 중간 프레임은 캡처하지 못했다. 활성 Canvas drag 도중 Escape 대신 Rotation 숫자 draft `77 → 기존 30` 복원으로 cancel을 확인했다. 이 관찰 한계를 제외한 Task 7 완료 조건은 모두 충족했다.

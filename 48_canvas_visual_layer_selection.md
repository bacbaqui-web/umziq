# Canvas Visual Layer Selection

> 문서 번호: 48
> 상태: Task 5~9.2 구현 및 자동 검증 기록 완료 / 브라우저 QA 미실행
> 작성일: 2026-07-21
> 목적: Evaluated Scene 기반 Canvas 직접 선택, 공용 Source Alpha Mask와 Editor-only outer glow의 실제 구현 구조와 안전 경계를 기록한다.

## 1. 목적과 범위

Preview Canvas에서 보이는 Layer 또는 Sub Composition의 실제 불투명 pixel을 눌러 Timeline selection을 바꾸고, 현재 선택된 대상의 실제 silhouette 바깥에 Editor-only glow를 표시한다.

이 기능은 편집기 interaction 계층에만 존재한다.

- 선택 판정은 현재 `EvaluatedScene`과 runtime `RenderItem` source를 읽는다.
- Glow는 Preview Canvas 위에 별도 overlay canvas로 표시한다.
- Preview/Accurate/Fast Renderer의 출력 pixel을 변경하지 않는다.
- Export, Project Plain Data, History snapshot, Animation command와 Preview cache key를 변경하지 않는다.
- 선택 alpha와 glow surface는 저장 데이터가 아닌 Canvas controller 소유 runtime resource다.

구현 위치:

- `src/engines/canvas/controllers/useCanvasDirectSelectionController.ts`
- `src/engines/canvas/helpers/canvasDirectSelectionCandidateHelpers.ts`
- `src/engines/canvas/helpers/canvasDirectSelectionGeometryHelpers.ts`
- `src/engines/canvas/helpers/canvasDirectSelectionHitHelpers.ts`
- `src/engines/canvas/helpers/canvasSelectionAlphaFingerprintHelpers.ts`
- `src/engines/canvas/helpers/selectionSourceAlphaProvider.ts`
- `src/engines/canvas/helpers/canvasSelectionGlowHelpers.ts`
- `src/engines/canvas/adapters/canvasSelectionAlphaBrowserAdapter.ts`
- `src/engines/canvas/adapters/canvasSelectionGlowBrowserAdapter.ts`
- `src/engines/canvas/models/canvasDirectSelectionModel.ts`
- `src/engines/canvas/models/canvasSelectionAlphaModel.ts`
- `src/engines/canvas/models/canvasSelectionGlowModel.ts`
- `src/features/preview/components/PreviewOverlay.tsx`
- `src/features/preview/components/PreviewWorkspacePane.tsx`
- `src/features/preview/components/PreviewWorkspaceControls.tsx`
- `src/features/preview/components/PreviewGizmoBackdrop.tsx`

## 2. Evaluated Scene Candidate

Candidate 원본은 현재 composition의 `EvaluatedScene.nodes` top-level 배열이다. Child node를 별도 직접 선택 대상으로 펼치지 않는다.

지원 대상:

- top-level drawable node → Layer candidate
- top-level composition node → Sub Composition candidate

Candidate에는 다음 identity와 표시 정보가 함께 저장된다.

- `sceneNodeIndex`
- `renderItemId`
- `sourceId`
- exact drawable 또는 `null`
- Layer/Composition transform target
- exact active Timeline item
- source↔viewport Projection
- ready Source Alpha descriptor 또는 blocked reason

Hit는 candidate 배열을 역순으로 순회한다. Evaluated Scene/Renderer가 앞에서 뒤로 그리는 painter order의 마지막 node가 먼저 검사되므로 화면에서 위에 보이는 대상이 우선한다.

Full/Fast Renderer mode는 candidate를 바꾸지 않는다. 두 mode는 같은 `EvaluatedScene` 이후의 표시 출력만 선택하며 direct selection은 `RenderFrame`이나 `PreviewScene`을 identity/alpha 입력으로 사용하지 않는다.

## 3. Exact Identity와 Safe Block

Candidate는 active Timeline item과 runtime Render item을 다음 값으로 연결한다.

- current composition
- active global frame 구간
- `kind`
- `sourceId`
- Sub Composition의 `targetCompId`
- scene node의 `renderItemId`

Timeline match와 Render match가 각각 정확히 하나이고 scene의 selectable top-level identity도 정확히 하나일 때만 ready다.

다음은 ambiguous 또는 불완전 identity로 blocked 처리한다.

- 같은 source/kind/target의 active Timeline item 중복
- 같은 source/kind/target의 visible Render item 중복
- scene node와 exact Render item ID 불일치
- 동일 selection identity로 연결되는 selectable top-level node split/중복
- exact drawable 누락
- reorder 이후 scene/render identity 불일치

Blocked candidate의 quad 안을 누르면 다음 동작을 하지 않는다.

- Alpha 생성/readback
- 아래 candidate로 fallthrough
- 기존 selection clear
- drag 시작

즉 identity가 모호할 때 임의의 대상을 고르지 않고 현재 selection을 보존한다. Invisible, opacity 0 이하, 잘못된 크기, non-finite transform, scale 0과 inactive Timeline item은 candidate에서 제외되며 ambiguity 수에도 포함하지 않는다.

## 4. Pointer 우선순위와 Selection Intent

Pointer 우선순위는 다음과 같다.

1. viewport capture의 middle-button pan 또는 Space+primary pan
2. Scale/Rotation/Opacity/Move Handle
3. Anchor control
4. Motion Path point
5. Preview toolbar와 form control
6. viewport body direct selection

Pan은 capture 단계에서 propagation을 중단한다. Handle, Anchor, Motion Path는 자기 event에서 propagation을 중단하며 toolbar/form control은 viewport body handler가 제외한다.

Selection rectangle polygon/fill/stroke와 내부 두 diagonal은 렌더하지 않으며, 변환 quad 전체를 가로채는 투명 hit layer도 없다. Layer/SubComp 본체 press와 hover는 모두 viewport body에서 같은 candidate/Projection/Source Alpha Provider/hit helper를 사용한다.

Cursor 규칙:

- alpha-ready visible pixel hover → `pointer`
- transparent, none, blocked, unavailable → `default`
- 실제 Position drag → `grabbing`
- middle/Space pan → 기존 `grab`/`grabbing`
- Handle과 Anchor/Pivot → 기존 전용 cursor

Pan과 Handle/Anchor 전용 cursor는 alpha hover cursor보다 우선한다.

Position/Scale/Rotation/Anchor/Opacity 중 하나라도 Transform Drag 중이면 viewport direct-selection hover를 잠근다. Pointer down capture와 drag-state effect가 stale hover를 clear하고, 잠긴 동안 hover `moveTarget`과 Source Alpha Provider get/build/readback은 실행하지 않는다. Scale은 별도 `isDraggingScale` 상태를 begin부터 commit/cancel까지 유지하며 Motion Path interaction도 Scale을 포함한 공통 Transform Drag lock을 따른다. Position drag의 기존 `grabbing` cursor와 pan/handle cursor 우선순위는 유지된다.

Primary pointer의 alpha hit 결과:

- 현재 선택된 exact Timeline item의 visible-alpha pixel hit → 기존 Position drag 시작
- 다른 ready item의 visible-alpha pixel hit → selection만 변경하고 같은 press에서 drag하지 않음
- 모든 candidate가 투명하거나 대상이 없는 성공적인 빈 hit → selection clear
- ambiguous blocked 또는 Alpha unavailable → 현재 selection 보존

사각 selection body나 bounds polygon을 별도 press target으로 두지 않는다. Bounds와 transformed quad는 viewport body Alpha hit의 broad/narrow phase 계산에만 쓰며 UI hit layer를 만들지 않는다.

## 5. 단일 Selection Alpha Mask 계약

Hit와 Glow는 `SELECTION_ALPHA_THRESHOLD` 하나를 공유한다. 현재 값은 `0`이며 `alpha > 0`인 source pixel만 silhouette 내부로 본다.

Hit 순서:

```text
viewport point
  → composition logical bounds 확인
  → candidate viewport AABB 확인
  → transformed quad 확인
  → 공용 Source Alpha Provider.get(descriptor)
  → 같은 Projection의 signed viewportToSource inverse
  → SourceAlphaEntry.sample(source-local x, y)
  → alpha > SELECTION_ALPHA_THRESHOLD
```

Transparent ready candidate는 transient entry를 release하고 다음 아래 candidate로 이동한다. Ready entry 생성/readback이 unavailable이면 안전하게 blocked로 종료한다.

별도의 Glow Alpha, Glow threshold, Renderer별 selection mask는 없다.

## 6. Source-local Alpha와 Projection 분리

Alpha plane은 source-local logical pixel 좌표에만 존재한다. Position, Scale, Rotation, Anchor, Transform Offset, zoom과 pan은 alpha plane을 다시 만들지 않고 Projection만 바꾼다.

Projection은 하나의 affine transform 쌍을 가진다.

- `sourceToViewport`: Glow draw와 transformed quad 생성
- `viewportToSource`: Hit alpha sample

Projection은 negative signed scale을 보존하고 rotation, zoom, pan을 포함한다. Bounds는 빠른 reject 용도이고 최종 spatial 포함 판정은 quad로 수행한다. Composition logical bounds 밖의 point는 clamp해 안쪽 hit로 바꾸지 않는다.

이 분리 때문에 Position-only Draft 중에는 공용 alpha provider build와 selected source scratch build가 증가하지 않고 Hit/Glow Projection draw만 갱신된다.

## 7. Layer와 Sub Composition Alpha 의미

### Layer

Layer descriptor는 exact drawable의 원본 source canvas를 logical size로 그린 뒤 evaluated opacity를 적용한다. Alpha readback은 RGBA 전체가 아니라 최종 alpha byte plane 한 장만 retained entry에 저장한다.

### Sub Composition

Sub Composition descriptor는 top-level composition logical surface에 `orderedChildren`을 painter order대로 합성한다.

각 child는 다음을 포함한다.

- 재귀 Source Alpha descriptor
- evaluated Position
- Scale
- Rotation
- Anchor
- Transform Offset
- Opacity와 Visibility

Nested Sub Composition은 자식 surface를 재귀 합성하지만 readback은 최종 root surface에서 한 번만 수행한다. 임시 합성 canvas는 build 종료 시 즉시 축소·폐기한다.

## 8. Visual Fingerprint와 Invalidation

Source Alpha fingerprint는 다음 visual identity를 포함한다.

- source canvas identity token과 pixel size
- source fingerprint와 explicit source revision
- explicit frame visual key
- logical size
- opacity
- visibility
- Sub Composition ordered child source fingerprint
- child evaluated transform
- child opacity/visibility
- child 배열 순서

현재 PSD drawable canvas는 local frame마다 bitmap pixel이 바뀌는 source가 아니다. 따라서 Layer와 Sub Composition root는 stable `static-psd` frame visual key를 사용한다. Playhead의 local frame 숫자만 바뀌고 source visual과 child evaluated geometry가 같다면 fingerprint와 provider entry를 재사용한다.

향후 frame-dependent bitmap source가 연결될 경우 호출부가 실제 frame visual key 또는 revision을 명시적으로 공급해야 한다. 시간 값 자체를 visual 변화의 대리자로 자동 사용하지 않는다.

Root의 Position/Scale/Rotation/Anchor/Transform Offset과 viewport zoom/pan은 fingerprint에 포함하지 않는다. Sub Composition child transform은 root source-local 합성 결과를 실제로 바꾸므로 fingerprint에 포함한다.

## 9. Provider, Cache와 Cleanup

`createSelectionSourceAlphaProvider()`는 Canvas Editor runtime 내부의 bounded provider다.

- 기본 ready entry limit: 2
- failure memo limit: 8
- fingerprint별 build/reuse
- 성공 hit 또는 selected glow fingerprint retain
- transparent transient fingerprint release
- retain 목록 밖의 ready entry 제거
- source replacement 시 clear
- controller unmount 시 dispose
- unavailable failure memo로 반복 readback 차단

Source replacement 감지는 Render item set, drawable identity와 source canvas reference를 기준으로 한다. 교체 시 provider entry와 selected glow scratch를 함께 비운다.

공통 Transform Drag hover lock 동안에는 hover provider 조회 자체를 시작하지 않는다. `선택 강조` OFF 전환에서는 provider `clear`로 selected retain entry까지 제거한다.

Retained alpha memory는 최대 두 source alpha plane이다. Glow memory는 full interaction viewport backing canvas 하나와 선택된 source scratch canvas 하나다. 모든 candidate용 glow surface나 viewport-sized offscreen blur surface를 만들지 않는다.

## 10. Hit와 Glow의 공통 계약

선택 Glow는 다음을 새로 계산하지 않는다.

- candidate
- source descriptor
- visual fingerprint
- alpha threshold
- alpha byte plane
- Projection

Glow controller는 exact selected ready candidate 하나를 찾고 direct selection과 같은 provider에서 같은 `SelectionSourceAlphaEntry`를 받는다. Hit 직후 Glow 조회는 같은 fingerprint와 entry object를 reuse한다.

Hover pointermove도 같은 hit helper와 provider를 사용한다. Hover mode는 ready hit를 retain하지 않고 transparent miss의 unretained entry만 release하며 outside/none에서 `retain([])`를 호출하지 않는다. 따라서 selected glow fingerprint는 계속 retain되고 cache는 provider 최대 두 ready entry 범위 안에서 selected entry와 현재 hover 작업 entry만 유지한다.

Selection 없음, selected candidate 중복, blocked candidate 또는 provider unavailable이면 Glow를 clear하고 selected scratch를 폐기한다. Selection identity나 visual fingerprint가 바뀌어도 scratch를 교체한다.

Glow 표시 여부는 Project/History/Runtime store가 아닌 기본 ON의 plain Editor UI state `showSelectionGlow`가 소유한다. Preview toolbar의 `선택 강조` 버튼은 `aria-pressed`와 active/inactive styling으로 이를 전환하며 기존 toolbar/form exclusion 경계 안에 있다.

- OFF: provider의 selected retain entry를 clear하고 renderer의 selected source scratch를 해제하며 target canvas backing을 1×1로 줄인다. selected candidate용 provider get/retain과 full glow draw는 실행하지 않는다.
- OFF 상태에서도 viewport direct-selection hit/hover와 selection 변경은 그대로 동작한다.
- ON: 현재 exact-selected ready candidate를 기존 공용 Source Alpha lifecycle로 다시 조회해 필요하면 rebuild하고 자연스럽게 redraw한다.

## 11. Editor-only Outer Glow

Glow browser adapter는 선택된 entry의 `alphaBytes`에서 공용 threshold를 통과한 pixel만 source scratch mask로 만든다. 같은 visual fingerprint이면 scratch를 재사용한다.

Draw 순서:

```text
full interaction viewport clear
  → sourceToViewport × DPR matrix로 selected mask blur draw
  → 같은 matrix와 mask를 destination-out으로 draw
  → silhouette interior 제거
```

따라서 Bounds rectangle glow가 아니라 실제 alpha silhouette의 바깥쪽 blur만 남는다. Blur 두께는 screen-space CSS pixel 상수에 DPR만 곱하며 zoom 배율에 따라 과도하게 굵거나 얇아지지 않는다.

Overlay 순서:

```text
Preview Canvas
  → Selection Glow canvas
  → Motion Path SVG
  → Gizmo Handle/Anchor/Pivot/connection → readout/direct numeric input
```

Glow canvas는 interaction viewport 전체 크기를 사용해 Preview frame 가장자리에서 불필요한 frame-bounds clipping을 피한다. `pointer-events:none`이며 selection, pan, handle과 motion interaction을 가로채지 않는다. Preview 출력 Canvas 자체의 크기나 pixel은 변경하지 않는다.

Task 9.2 이후에도 silhouette Glow, Transform Handle과 connection line, Anchor/Pivot, Motion Path, drag readout은 유지된다. Transform Handle은 이후 Anchor 중심 radial design으로 정리되어 Position은 Anchor와 중심이 같은 파란 ring, Scale은 채움 없이 shaft와 두 arrow wing을 handle당 단일 SVG path로 한 번만 paint하는 line-only W/H/WH 화살표, Rotation/Opacity는 hollow endpoint로 표시된다. 단일 path는 shaft endpoint와 arrow tip 좌표를 공유해 반투명 stroke의 접합부 alpha 중첩을 만들지 않는다. 모든 radial connection은 각 handle 방향의 Position ring 바깥 경계에서 시작한다. Rotation/Opacity connection line은 공통 endpoint geometry로 원의 시각 반지름만큼 짧아져 hollow circle 중심과 겹치지 않고 바깥 경계에서 끝난다. Scale/Rotation 중심은 50px screen-space 반지름을 유지하고 Opacity 중심은 현재 Draft-aware 값에 따라 25px(0%)~50px(100%) 사이를 이동하며 대상 local axis와 함께 회전한다. 0%에서는 Opacity 원 안쪽 경계와 Position ring이 20px에서 접해 connection 길이가 0이고, 값이 커지면 원과 lineEnd가 함께 바깥으로 이동한다. Position ring은 별도 connection line 없이 기존 Position drag 입력을 제공한다. Visible connection과 분리된 투명 12px butt-cap stroke hit layer가 W/H/WH shaft와 Rotation/Opacity line을 endpoint와 같은 hover, cursor, pending drag와 double-click numeric input에 연결한다. zero-length Opacity line은 hit을 만들지 않으며 Position ring 안쪽, Motion Path와 Canvas direct selection 우선순위를 침범하지 않는다. W/H/WH는 각각 기존 `x`/`y`/`xy` Scale command에 매핑되며, PointerDown world 위치를 현재 값의 100% baseline으로 삼아 이후 같은 local axis 투영 거리의 상대 배율을 적용한다. 따라서 고정 screen-space handle 반지름은 Scale 절대값으로 해석되지 않고 첫 move 값 점프를 만들지 않는다. Opacity drag는 현재 screen-space Anchor 거리 25~50px를 0~100%로 선형 매핑하고 Shift snap 뒤 기존 PointerMove Draft/PointerUp Commit/History 의미를 유지한다. Anchor/Position/Scale/Rotation/Opacity drag active 동안에는 기존 drag flag를 소비하는 `document.body` portal의 투명 fixed cursor shield가 최상위 hit surface에서 `cursor:none`을 적용한다. shield의 mousemove/mouseup은 기존 window pointer tracker로 bubble되어 Draft/Commit/Cancel을 유지하며, drag 종료/cancel/unmount에는 조건부 portal이 즉시 제거되고 pending press/hover에는 나타나지 않는다. Glow는 toolbar toggle로만 표시를 끌 수 있으며 direct selection 기능과 독립적이다. 제거된 것은 사각 Selection Box로 보이던 polygon fill/stroke, 내부 diagonal 두 개와 polygon hit layer뿐이다.

## 12. DraftTransformSnapshot

Candidate가 exact selected Timeline item과 target/local frame까지 일치할 때만 `DraftTransformSnapshot`을 적용한다.

Projection에 즉시 적용하는 값:

- Position
- Scale
- Rotation
- Anchor
- Transform Offset

Opacity는 source alpha visual을 실제로 바꾸므로 descriptor/fingerprint에 적용한다. 다른 target, 다른 item 또는 다른 local frame의 Snapshot은 사용하지 않는다.

Draft spatial change 중 Preview Layer, Hit quad/inverse와 Glow forward Projection이 같은 Snapshot을 따라간다. Commit 후 Snapshot이 reset되면 별도 보정 상태 없이 새 `EvaluatedScene`의 Project/Animation 결과로 자연스럽게 복귀한다. Project는 기존 Animation command와 History transaction으로만 Commit된다.

## 13. 불변 경계

이번 기능이 변경하지 않은 영역:

- `EvaluatedScene` model과 Animation Evaluation
- Accurate/Fast Renderer mode 의미
- Preview Scene과 RenderFrame 계약
- Preview/Dirty/Node/Composition/Surface Cache
- Preview Quality와 source resolver
- Export/Original Source 경계
- Project Plain Data와 Project State store
- History snapshot/Undo/Redo transaction
- Animation property/keyframe/modifier mutation

Canvas Engine은 기존 Playback Render 공개 façade에서 `evaluatedScene`을 읽는다. Playback Render, Project, Animation은 Canvas selection/glow helper나 runtime을 import하지 않는다. Feature View는 Canvas 공개 façade만 사용한다.

## 14. Duplicate/Split/Reorder 한계

현재 구현은 모호한 identity를 자동 복구하거나 후보 중 하나로 추측하지 않는다.

- 같은 source의 Timeline instance가 동시에 둘 이상 active
- 하나의 selection identity가 여러 selectable top-level scene node로 split
- Render record가 중복
- scene/render reorder가 exact identity와 불일치
- drawable lookup이 유일하지 않음

위 경우 해당 영역은 blocked다. 아래 Layer가 보여도 같은 press에서 fallthrough하지 않으며 기존 selection과 drag state를 보존한다. 이 정책은 직접 선택이 잘못된 Project target을 수정하는 것보다 선택을 하지 않는 쪽을 우선하는 안전 경계다.

## 15. Immediate Sub Composition 더블클릭 진입

Viewport body의 더블클릭은 단일클릭과 별도 bounds 판정을 만들지 않고 같은 `hitCanvasDirectSelection()`의 Bounds → Quad → 공용 Source Alpha sample 결과를 사용한다. hit candidate가 exact identity의 ready immediate Sub Composition일 때만 candidate의 composition target id를 Project Engine의 기존 `enterComposition()`에 전달한다.

- 일반 Layer ready hit는 선택/drag 대상으로만 남고 진입하지 않는다.
- 투명 pixel과 빈 공간은 진입하지 않으며 selection도 더블클릭 자체로 변경하지 않는다.
- blocked/alpha unavailable candidate는 아래 대상으로 관통하거나 진입하지 않는다.
- Handle과 toolbar/form control은 기존 event 경계가 우선하고, Anchor와 Motion Path point도 double-click propagation을 차단한다.
- Space Pan modifier 또는 Transform drag 중에는 viewport double-click 진입을 실행하지 않는다.
- 두 번째 `mousedown`은 `event.detail >= 2`에서 body Position press를 시작하지 않아 불필요한 drag/history capture 없이 뒤따르는 `dblclick`만 처리한다. 첫 번째 `mousedown`의 기존 선택/drag 의미는 유지한다.

새 Project/History/Runtime 상태는 없으며 진입에 따른 선택 복원과 source status 승인은 기존 Project Navigation Controller 책임을 그대로 사용한다.

## 16. 정적 검증 상태

Task 9.2 종료 시점의 자동 검증 실행 기록은 다음과 같다.

- 전체 ESLint
- `npm test`: 38개 verification script
- TypeScript/Vite production build: 306 modules
- Engine Import Boundary
- 기존 Preview/Dirty/Node/Composition/Surface Cache 회귀
- History/Animation/Project 회귀
- `git diff --check`

관련 신규 fixture:

- `scripts/verifyCanvasSelectionAlpha.ts`
- `scripts/verifyCanvasDirectSelection.ts`
- `scripts/verifyCanvasDirectSelectionUi.ts`
- `scripts/verifyCanvasSelectionGlow.ts`

Fixture는 Layer/SubComp alpha 의미, static frame reuse와 visual invalidation, bounded provider/failure lifecycle, reverse painter order, exact/ambiguous/split policy, transparent fallthrough, signed inverse, Draft Projection, Hit/Glow 공용 entry와 selected scratch lifecycle, 모든 Transform Drag flag의 hover/provider 접근 lock, hover cursor/Position drag/pan 우선순위, selected glow를 보존하는 hover cache 제한, selection polygon/diagonal/quad hit layer 제거, viewport body press/hover 연결, `선택 강조` toolbar/default/state/reset/form exclusion, Glow OFF release와 target backing 1×1 축소 및 ON rebuild, outer-only 합성, DPR와 overlay 순서를 검사한다.

브라우저 pointer/keyboard/visual QA와 실제 UI 조작은 실행하지 않았다. `npm run qa`도 실행하지 않았다. 따라서 이 문서는 정적 검증 통과와 브라우저 QA 미실행을 구분하며 실제 브라우저 QA 통과를 주장하지 않는다.

## 17. 관련 문서

- `43_dual_renderer_architecture.md`: 공용 Evaluated Scene과 Full/Fast Renderer 경계
- `45_editor_draft_runtime_integration.md`: PointerMove Draft와 Commit/reset 경계
- `46_transform_origin_editing.md`: Anchor/Transform Offset와 scoped Draft 의미
- `47_canvas_engine_responsibility_refactoring.md`: Canvas controller/composer와 Preview Render 책임 분리
- `98_sprint_plan.md`: 이번 Sprint의 Task 순서와 승인 계약

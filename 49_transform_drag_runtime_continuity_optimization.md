# Transform Drag Runtime Continuity Optimization

> 문서 번호: 49
> 상태: Task 1~8 완료 / 전체 정적 검증 완료 / 사용자 승인 범위 Edge 대상 QA 완료
> 작성일: 2026-07-21
> 목적: Transform Draft가 기존 Runtime과 React memo 경계를 불필요하게 끊던 원인, 단계별 최적화와 호출 수 결과, 보존 계약과 후속 후보를 기록한다.

## 1. 배경과 원인

이 Sprint는 radial handle의 SVG paint 수나 체감 FPS를 먼저 최적화하지 않았다. 같은 Transform drag에서 이미 유지되던 RAF 병합과 PointerUp 단일 Commit 위로 Draft-only root render가 전파되면서, 의미가 바뀌지 않은 Project 파생값과 후속 계산의 reference가 반복 교체되는 것이 우선 병목이었다.

```text
Transform PointerMove
  → RAF에서 최신 pointer sample 승인
  → Property/Editor/Preview Draft 갱신
  → Composition Root render
  → Project Selection derived identity 재생성
  → Animation / Full·Fast paired Renderer probe / Draft seed memo 무효화
  → Motion Path / Direct Selection Candidate / Alpha / Glow 후속 계산
  → PSD Tree / Timeline panel render 전파
```

Task 1 계측은 이 흐름을 브라우저 FPS가 아니라 재현 가능한 호출 수로 고정했다. 실제 React commit, GPU 시간과 FPS를 측정한 fixture는 아니며, root가 사용하는 pure derivation과 실제 `Object.is` dependency 의미 및 downstream helper 호출을 같은 입력으로 재현한다.

## 2. 보존한 기존 계약

이번 최적화가 유지한 제품 계약은 다음과 같다.

- `DraftTransformSnapshot`은 Position, Anchor, Scale, Rotation, Opacity와 Overlay가 공유하는 기존 Editor Draft Runtime이다.
- raw pointer sample은 RAF에서 최신 값 하나로 병합된다.
- PointerMove는 Draft와 Preview만 갱신하며 Project와 History를 변경하지 않는다.
- PointerUp은 Project update 1회와 History commit 1회를 수행한다.
- commit 전 마지막 pending sample flush와 cancel 복원을 유지한다.
- Full/Fast Renderer의 결과 의미, Preview Canvas와 Export 출력은 변경하지 않는다.
- Motion Path sample 수, Glow, radial handle, connection hit, readout과 cursor를 줄이거나 숨기지 않는다.
- Hit와 Glow는 같은 Source Alpha entry와 `alpha > 0` threshold를 사용한다.
- Direct Selection의 painter order, exact/blocked identity, duplicate/split/reorder safe-block과 transparent fallthrough 의미를 유지한다.
- 새 Engine, 전역 Runtime, Store, Project/History 필드를 추가하지 않는다.

## 3. Task 1 통합 Baseline

모든 시나리오는 raw pointer 100개를 RAF 10 frame으로 병합해 semantic Draft 10개를 승인하는 동일 조건이다. Full과 Fast 수치는 제품이 두 Renderer를 동시에 실행한다는 뜻이 아니라 같은 입력을 두 mode에 적용한 paired probe다.

| 대상 / Handle | Raw / RAF / Accepted | Selection / Animation / Full / Fast / Seed / Preview | Motion Build / Sample | Candidate / Projection | Alpha Build / Reuse | Glow Build / Reuse / Draw | Project / History |
|---|---:|---:|---:|---:|---:|---:|---:|
| Layer Position | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 1 / 9 | 1 / 9 / 10 | 1 / 1 |
| Layer Anchor | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 1 / 9 | 1 / 9 / 10 | 1 / 1 |
| Layer Scale W/H/WH | 각 100 / 10 / 10 | 각 10 | 각 10 / 300 | 각 10 / 10 | 각 1 / 9 | 각 1 / 9 / 10 | 각 1 / 1 |
| Layer Rotation | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 1 / 9 | 1 / 9 / 10 | 1 / 1 |
| Layer Opacity | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 10 / 0 | 10 / 0 / 10 | 1 / 1 |
| SubComp Position | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 1 / 9 | 1 / 9 / 10 | 1 / 1 |
| SubComp Opacity | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 10 / 0 | 10 / 0 / 10 | 1 / 1 |

Baseline에서 spatial Transform의 Alpha/Glow scratch는 재사용됐지만 Selection, Animation, Renderer, seed, Motion Path와 Candidate는 accepted frame마다 반복됐다. Opacity는 root opacity가 fingerprint와 raster에 반영되어 Alpha와 Glow scratch도 매 frame 다시 만들었다. Draft active Composition Cache lookup/store는 기존 bypass 계약에 따라 0이었다.

## 4. Task 2 Project Selection Identity

`useProjectSelectionModel`은 hook-local memoized deriver를 소유한다. module-global cache나 새 Store를 만들지 않고 다음 파생 경계를 실제 입력 단위로 나눴다.

- master timeline과 virtual master composition
- root composition tree
- Layer/Composition ID Map
- selected composition/main/layer/timeline composition
- transform/property target와 Properties fallback
- selected meta와 timeline items

Draft, readout과 Preview Draft만 바뀐 render에서는 전체 model과 필요한 주요 reference를 유지한다. Project import/refresh, Composition/Layer/Timeline selection, Meta, master transform과 timeline record가 바뀌면 관련 reference만 최신 값으로 교체한다.

### Task 2.5 동일 fixture Before / After

| 대상 / Handle | Animation | Full | Fast | Draft Seed | Motion Path | Candidate | Alpha Build/Reuse | Glow Build/Reuse | Project/History |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Layer Position | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 10→10 | 1/9→1/9 | 1/9→1/9 | 1/1→1/1 |
| Layer Anchor | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 10→10 | 1/9→1/9 | 1/9→1/9 | 1/1→1/1 |
| Layer Scale W/H/WH | 각 10→1 | 각 10→1 | 각 10→1 | 각 10→1 | 각 10→1 | 각 10→10 | 각 1/9→1/9 | 각 1/9→1/9 | 각 1/1→1/1 |
| Layer Rotation | 10→1 | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 1/9→1/9 | 1/9→1/9 | 1/1→1/1 |
| Layer Opacity | 10→1 | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 10/0→10/0 | 10/0→10/0 | 1/1→1/1 |
| SubComp Position | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 10→10 | 1/9→1/9 | 1/9→1/9 | 1/1→1/1 |
| SubComp Opacity | 10→1 | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 10/0→10/0 | 10/0→10/0 | 1/1→1/1 |

Task 2만 적용한 독립 효과로 Animation, Full/Fast paired Renderer와 Draft seed가 모든 시나리오에서 10회에서 1회로 줄었다. Scale/Rotation/Opacity Motion Path도 안정 입력을 재사용했지만 Position/Anchor geometry, Candidate와 Opacity Alpha/Glow는 별도 의미 경계가 남았다.

## 5. Task 3 Semantic No-op과 DOMRect 보류

`useCanvasTransformDraftController`는 직전 accepted `DraftTransformSnapshot`과 새 snapshot의 의미 값을 비교한다. 같은 semantic 결과면 공통 경계에서 snapshot과 Preview patch를 거부하며, 각 Handle은 승인된 뒤에만 property draft, readout과 latest commit 값을 갱신한다.

- Position, Anchor, Scale W/H/WH, Rotation, Opacity의 동일 semantic 또는 같은 snap/clamp 결과 100회: Draft/Readout/Snapshot/Preview 각 1회
- 서로 다른 semantic 값 100회: 100회 모두 반영
- final pending flush, PointerUp Project/History 각 1회 유지
- cancel 복원, Rotation snap, Opacity clamp, negative/non-uniform Scale 유지

DOMRect session capture는 구현하지 않았다. drag 중 wheel zoom과 `ResizeObserver` 기반 viewport 변경이 가능하지만, 같은 session에서 좌표계를 언제 refresh하거나 cancel할지 계약이 없었다. PointerDown bounds를 고정하면 stale 좌표로 잘못된 Transform을 계산할 수 있으므로, 명시적 viewport-change transaction 설계 전까지 후속 후보로 보류했다.

## 6. Task 4 Positive Root Alpha Shape

현재 Hit/Glow silhouette는 `alpha > 0`의 binary shape다. top-level root opacity 1~100%는 source pixel의 alpha 세기만 바꾸고 positive pixel 영역은 바꾸지 않는다.

- fingerprint의 root positive opacity는 하나의 shape class로 정규화한다.
- browser alpha build는 top-level positive opacity를 shape-neutral하게 유지한다.
- root opacity 0과 `visible=false`는 Candidate/Hit/Glow에서 제외한다.
- Sub Composition child opacity/visibility/transform/order/source, frame visual key, source revision과 logical size는 실제 source-local 합성 shape를 바꾸므로 exact invalidation을 유지한다.
- Hit와 Glow의 provider entry 및 threshold를 분리하지 않는다.

Layer와 SubComp의 root opacity 100→1, 100 semantic frame에서 Source Alpha build/readback과 Glow scratch build는 각 1회, reuse는 각 99회였다. 1→0 제거, 0→positive 복구와 child/source/frame/size invalidation fixture도 유지됐다.

## 7. Task 5 Direct Selection 세 단계

Direct Selection Candidate를 다음 세 단계로 분리했다.

```text
Project / Timeline / Render / Evaluated Scene
  → static identity join + descriptor
  → viewport projection
  → exact-selected Draft projection + root opacity
```

Static 단계는 Timeline/Render/Scene identity와 drawable을 Map index로 만들어 반복 filter와 O(N²) 성격의 lookup을 제거한다. Viewport 단계는 zoom/pan과 root transform을 projection한다. Draft 단계는 snapshot target/item/local frame이 exact-selected candidate와 맞을 때 그 candidate의 spatial projection/root opacity만 교체한다.

100 spatial Draft frame 결과:

- static join/descriptor build: 1
- selected Draft projection update: 100
- 미선택 Candidate rebuild: 0
- 통합 10-frame fixture의 static/viewport Candidate build: 10→1
- 필요한 semantic Draft update: 10 유지

미선택 candidate reference와 painter order를 보존했으며 exact/blocked identity, duplicate/split safe-block, 아래 Candidate 관통 금지, negative Scale, transparent fallthrough와 immediate Sub Composition double-click 의미는 변경하지 않았다.

## 8. Task 6 Motion Path와 Gizmo Memo 경계

Motion Path와 radial gizmo의 서로 다른 변화 원인을 독립 경계로 나눴다.

- duration-wide Layer/SubComp Position geometry sampling
- current-frame marker
- viewport projection과 polyline
- Current/Keyframe/Sample point ViewModel
- hover/hit point와 readout
- radial handle geometry, Scale readout와 cursor descriptor

Position, Anchor와 Transform Offset Draft만 duration geometry에 참여한다. Scale/Rotation/Opacity는 path geometry를 다시 만들지 않는다. viewport-only 변화는 sampling을 재실행하지 않고 projection/polyline만 갱신한다.

100 semantic frame 결과:

- Scale W/H/WH, Rotation, Opacity: 초기 sampling 1회, 추가 full build 0
- Position/Anchor/Transform Offset: 초기 포함 101회, semantic frame당 1회
- viewport-only 100회: sampling 초기 1회 유지, projection/polyline 초기 포함 101회

Current/Keyframe/Sample, polyline, hover/hit Point ViewModel은 같은 projected point geometry를 사용한다. radial 위치, 반지름, cursor, connection hit, readout과 helper 공개 의미는 유지했다.

## 9. Task 7 Panel 격리와 TDZ 회귀

Task 1~6 이후에도 Draft-only root render는 plain `PsdTree`와 `TimelinePanel`을 실행했다. Task 2의 selection model reference만으로는 충분하지 않았고 PSD Tree와 Timeline Engine도 controller option, callback, read model, command/interaction과 최종 `viewProps`를 새로 만들었다.

수정 경계:

- `PsdTree`와 `TimelinePanel`을 `React.memo` 경계로 전환
- PSD Tree state/port/controller callback과 최종 `viewProps`를 실제 PSD/selection/session 입력별로 안정화
- Timeline controller input, playback ruler, navigation, read model, command/interaction과 최종 `viewProps`를 실제 Project/Selection/Playhead/Toolbar 입력별로 안정화
- Project History 공개 hook은 stable command façade가 layout effect로 최신 controller를 가리켜 callback identity와 최신 state를 함께 보존
- Preview와 Properties는 memo 차단 대상에서 제외해 semantic Draft를 계속 반영

새 DOM test dependency를 추가하지 않았다. shallow memo 판정과 source boundary를 결합한 fixture에서 Draft-only root frame 100개의 추가 panel render 판정은 PSD Tree 0, Timeline 0이었고 Preview/Properties는 각 100이었다. Project/Selection/Playhead/Toolbar 입력 교체는 관련 panel을 invalidate한다. 이는 실제 React commit counter가 아닌 정적 fixture 결과다.

### Edge 중간 QA에서 발견한 TDZ

첫 Edge 실행에서는 앱이 빈 화면이었고 Console에 다음 오류가 확인됐다.

```text
Uncaught ReferenceError: Cannot access 'memo' before initialization
```

원인은 `PsdTree.tsx`와 같은 패턴의 `TimelinePanel.tsx`에서 `import { memo } from "react"`가 default export 아래 파일 하단에 놓인 것이었다. TypeScript/Vite production build만으로 드러나지 않은 ESM TDZ runtime 회귀였다. 두 import를 파일 최상단으로 옮긴 뒤 변경 파일 ESLint, 전체 verification, build와 diff 검사를 다시 통과했다.

수정 후 새 Edge 창의 대상 중간 QA에서 `drag_test.psd` import, Transform drag와 Properties 갱신, Undo/Redo, Timeline 한 frame 이동, PSD Tree Composition 전환과 Timeline Layer 선택이 동작했다. 이 결과는 Task 7 경계의 대상 smoke이며 Sprint 전체의 모든 Handle 성능·시각 QA 완료를 뜻하지 않는다.

## 10. 최종 호출 수 요약

동일한 raw 100 / RAF 10 / semantic 10 통합 fixture의 최종 의미는 다음과 같다.

| 항목 | 최종 호출 수 |
|---|---:|
| PointerMove Project update | 0 |
| PointerUp Project update / History commit | 1 / 1 |
| Project Selection derivation identity build | 1 |
| Animation / Full paired / Fast paired / Draft seed | 각 1 |
| Position·Anchor Motion Path full build | 각 10 |
| Scale W/H/WH·Rotation·Opacity Motion Path full build | 각 1 |
| Direct Selection static / viewport / selected Draft update | 1 / 1 / 10 |
| Spatial Alpha build/reuse | 1 / 9 |
| Positive Opacity Alpha build/reuse | 1 / 9 |
| Glow scratch build/reuse/draw | 1 / 9 / 10 |

별도 100-frame 경계 fixture:

- 동일 semantic 입력: Draft/Readout/Snapshot/Preview 1회
- positive root opacity 100→1: Alpha와 Glow scratch build 각 1회, reuse 각 99회
- spatial Draft: static candidate 1회, selected projection 100회, 미선택 rebuild 0
- Scale/Rotation/Opacity Motion Path: 초기 1회 뒤 추가 0
- Position/Anchor/Transform Offset Motion Path: 초기 포함 101회
- viewport-only Motion Path: sampling 1회, projection/polyline 초기 포함 101회
- Draft-only panel: PSD Tree/Timeline 추가 0, Preview/Properties 각 100

Composition Cache는 Draft active 상태에서 기존처럼 bypass되므로 이 Sprint가 cache hit 증가를 주장하지 않는다. FPS, frame time과 GPU 비용도 측정하지 않았다.

## 11. 변경 파일 책임

### Project와 React panel

| 파일 | 이번 Sprint 책임 |
|---|---|
| `src/engines/project/useProjectSelectionModel.ts` | 실제 Project/Selection 입력별 hook-local derived identity 안정화 |
| `src/engines/project/useProjectHistory.ts` | 최신 controller를 참조하는 stable History command façade |
| `src/engines/project/index.ts` | identity fixture에 필요한 Project Selection 공개 계약 정리 |
| `src/engines/psd-tree/state/usePsdTreeState.ts` | PSD Tree session state object identity 안정화 |
| `src/engines/psd-tree/usePsdTreeEngine.ts` | controller port/callback과 최종 ViewProps 안정화 |
| `src/features/psdtree/components/PsdTree.tsx` | memo panel 경계와 상단 React import |
| `src/engines/timeline/useTimelineEngine.ts` | controller input/read/command/interaction/ViewProps memo 조립 |
| `src/engines/timeline/controllers/useTimelineNavigationController.ts` | breadcrumb/switcher memo 경계 |
| `src/engines/timeline/controllers/useTimelinePlaybackUIController.ts` | ruler와 command memo 경계 |
| `src/engines/timeline/controllers/useTimelineViewController.ts` | stable option별 Timeline read model memo 경계 |
| `src/features/timeline/components/TimelinePanel.tsx` | memo panel 경계와 상단 React import |

### Canvas Draft, Direct Selection, Alpha, Motion/Gizmo

| 파일/영역 | 이번 Sprint 책임 |
|---|---|
| Transform drag controller 5개와 Anchor controller | semantic snapshot 승인을 따른 draft/readout/latest commit 갱신 |
| `useCanvasTransformDraftController.ts`, `draftTransformRuntimeHelpers.ts` | 공통 semantic equality와 no-op Preview update 차단 |
| `useCanvasDirectSelectionController.ts`, `canvasDirectSelectionCandidateHelpers.ts` | static/viewport/selected Draft 세 단계와 index 기반 exact join |
| `canvasSelectionAlphaFingerprintHelpers.ts`, `canvasSelectionAlphaBrowserAdapter.ts` | top-level positive opacity shape 정규화와 child exact invalidation |
| `useCanvasMotionPathController.ts`, `canvasMotionPathHelpers.ts` | duration geometry와 current-frame marker 분리 |
| `useCanvasGizmoController.ts`, `canvasGizmoHelpers.ts` | radial geometry, viewport projection/polyline, point/readout/cursor memo 분리 |
| `src/engines/canvas/index.ts` | 신규 순수 helper 계약 공개 |

### Verification

| 파일 | 검증 책임 |
|---|---|
| `verifyCanvasTransformDragIntegration.ts` | 동일 10-frame baseline/before-after와 100-frame Motion/viewport 경계 |
| `verifyProjectSelectionModelIdentity.ts` | Draft-only identity 유지와 실제 입력 invalidation |
| `verifyCanvasTransformSemanticNoop.ts` | no-op/변경값/final flush/commit/history/cancel |
| `verifyCanvasSelectionAlpha.ts`, `verifyCanvasSelectionGlow.ts` | positive root shape reuse와 0/child/source/frame/size invalidation |
| `verifyCanvasDirectSelection.ts` | indexed static join, selected-only Draft projection과 기존 identity/hit 계약 |
| `verifyCanvasInteractionHelpers.ts` | Motion/Gizmo geometry 분리와 공통 projected geometry |
| `verifyDraftPanelRenderIsolation.ts` | memo source boundary와 100 Draft-only shallow render 판정 |

## 12. 정적 검증

Task 7 TDZ 수정 뒤 최종 코드 기준으로 다음 검증이 통과했다.

- 전체 ESLint
- `npm test`: verification 42개
- TypeScript/Vite production build: 307 modules
- Engine Import Boundary
- Project History, Animation, Canvas Drag, Direct Selection, Selection Alpha/Glow, Dirty/Node/Composition/Surface Cache 회귀
- `git diff --check`

Node experimental loader 경고와 기존 단일 JS chunk 500 kB 초과 경고는 남아 있다. Production build 성공은 최초 Edge에서 발견된 import TDZ가 없다는 증거가 아니었으며, 그래서 정적 검증과 브라우저 runtime 결과를 별도로 기록한다.

## 13. QA 전·후 상태 구분

### 정적 구현 완료 상태

Task 1~7 코드와 42개 verification은 완료됐다. 이 단계의 호출 수는 결정적 fixture 결과이며 실제 브라우저 FPS나 React commit/GPU 측정 결과가 아니다.

### Task 7 대상 Edge 중간 QA 후 상태

첫 실행에서 memo import TDZ를 발견하고 수정했으며, 재실행에서 PSD import와 대표 Transform/Properties/History/Timeline/Tree 흐름을 확인했다. 이는 Task 7 runtime 진입과 대표 상호작용 smoke 결과다.

### Sprint 마감 Edge 대상 QA

사용자 승인 후 새 Edge 창과 `drag_test.psd`에서 PSD import, Composition/Timeline 선택, Position·Anchor Draft와 Properties 갱신, PointerUp Commit, Undo/Redo, `작업용(fast-render)`·`완성본(full-render)` 전환, Glow OFF/ON과 Console 오류 유무를 확인했다. 제품 runtime 오류는 없었다.

Scale/Rotation/Opacity의 작은 radial hit target은 Computer Use 좌표 자동화로 신뢰성 있게 반복하지 못했으므로 실제 Edge 통과로 기록하지 않는다. 이 Handle들의 공통 Draft/Commit과 계산 계약은 통합 fixture와 전체 정적 verification 결과로 보완한다. 실제 FPS/frame time/GPU profiler, 모든 Handle의 장시간 수동 체감, Preview/Export pixel 비교를 포함한 포괄 성능 QA는 별도 범위다.

## 14. 알려진 한계와 후속 후보

### 현재 한계

- 호출 수 fixture는 실제 React commit, browser layout/paint, GPU 시간과 FPS를 측정하지 않는다.
- Edge 대상 QA는 모든 작은 radial Handle의 장시간 수동 성능 측정이나 pixel 비교를 대신하지 않는다.
- panel fixture는 DOM renderer 없이 shallow memo 조건과 source boundary를 검증한다.
- DOMRect는 drag 중 zoom/resize 계약이 없어 매 session 고정하지 않는다.
- Draft active Composition Cache lookup/store는 계속 0이며 nested Composition surface 재사용을 새로 제공하지 않는다.
- Glow draw는 interaction viewport 전체를 clear/blur한다.
- 단일 production JS chunk가 Vite 500 kB 경고 기준을 넘는다.

### 별도 설계가 필요한 후보

1. Preview Scene Pass 통합
   - 이미 알려진 changed node/stats를 Dirty/Node/Draw Plan에서 재사용할 수 있다.
   - dirty kind, ancestor, old/new bounds 누락은 잔상과 잘못된 skip을 만들 수 있다.
2. Draft-safe Composition Cache
   - outer transform과 child-content identity를 분리해 clean child surface를 Draft 중 재사용할 수 있다.
   - stale pixel, old bounds, child dirty와 surface lifecycle을 pixel fixture로 먼저 증명해야 한다.
3. Bounded Glow
   - selected old/new bounds와 blur padding만 clear/draw할 수 있다.
   - rotation, negative/non-uniform Scale, DPR, viewport edge clipping과 잔상 검증이 선행돼야 한다.

이 후보들은 이번 Sprint에 포함하지 않았으며 단순 호출 수 감소만으로 승인할 수 없다. 제품 계약과 pixel correctness를 별도 계획에서 먼저 고정해야 한다.

## 15. 관련 문서

- `44_preview_runtime_optimization.md`: Dirty/Node/Composition/Surface Cache와 Preview Runtime 기준
- `45_editor_draft_runtime_integration.md`: PointerMove Draft와 PointerUp Commit 경계
- `46_transform_origin_editing.md`: Anchor/Transform Offset와 Properties 양방향 Draft
- `47_canvas_engine_responsibility_refactoring.md`: Transform Composer/Controller와 Preview Render 책임
- `48_canvas_visual_layer_selection.md`: Direct Selection, 공용 Alpha와 outer glow 계약

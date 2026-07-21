# Current Sprint Plan

> 문서 번호: 98
> 상태: 완료
> 구현: Task 1~8 완료
> QA: 사용자 승인 범위의 Edge 대상 QA 완료 / 전체 정적 검증 완료

## Sprint

- 이름: Transform Drag Runtime Continuity Optimization
- 유형: Editor Transform 성능 최적화
- 목표: 기존 Transform UX와 Draft/Commit 계약을 유지하면서, Handle drag의 Draft-only update가 Project Selection, Renderer, Preview, Motion Path, Direct Selection과 Glow의 memo/cache 경계를 불필요하게 무효화하지 않도록 한다.

이번 Sprint는 실제 FPS 숫자를 먼저 약속하거나 기능을 줄이는 Sprint가 아니다. 통합 호출 수를 먼저 측정하고, 이미 존재하는 Runtime과 React 경계의 연속성을 회복하여 불필요한 작업을 제거한다.

## 배경과 현재 판단

현재 정적 분석에서 가장 큰 구조적 병목은 radial handle SVG 자체가 아니다.

```text
Transform PointerMove
→ Draft/Readout state 갱신
→ Root render
→ Project Selection 파생 객체 identity 재생성
→ Evaluated Scene / Renderer memo 무효화 가능
→ Preview Draft base 재생성 가능
→ Motion Path / Direct Selection / Glow 후속 계산 반복
```

현재 유지되는 최적화:

- Pointer sample은 최신 값 하나로 RAF 병합된다.
- PointerMove 동안 Project와 History를 변경하지 않는다.
- PointerUp에서 Project Commit과 History가 한 번 생성된다.
- Position/Scale/Rotation/Anchor의 Source Alpha는 재사용된다.
- Transform drag 중 Direct Selection hover는 중단된다.
- Preview bitmap과 surface allocation cache는 유지된다.

현재 약화되거나 확인이 필요한 최적화:

- Draft-only render 중 Animation Evaluation과 Renderer 정지
- 같은 drag에서 Full Render Draft seed 1회 재사용
- Scale/Rotation/Opacity 중 Motion Path 재계산 차단
- Direct Selection static candidate 재사용
- positive Opacity drag의 Source Alpha 재사용
- Draft-only update에서 Timeline/PSD Tree render 차단
- Draft 중 nested Composition 재사용

## 고정 구조 계약

- `DraftTransformSnapshot`은 모든 Transform UI가 공유하는 기존 Draft Runtime이다.
- PointerMove는 Draft와 Preview만 갱신한다.
- PointerUp에서만 Project Commit을 수행한다.
- 한 drag는 History 한 건만 생성한다.
- Full/Fast Renderer의 결과 의미와 Preview/Export 출력은 변경하지 않는다.
- Motion Path, Glow, Readout, Handle과 Direct Selection 기능을 숨기거나 품질을 낮추지 않는다.
- 기존 Alpha Hit와 Glow는 동일한 Source Alpha 및 threshold를 계속 사용한다.
- duplicate/split/reorder의 safe-block, Painter Order와 Selection identity 의미를 변경하지 않는다.
- 새 Engine, 전역 Runtime, Store, Project/History 필드를 만들지 않는다.

## 공통 성능 판정 기준

성능 개선은 우선 실제 FPS가 아니라 재현 가능한 호출 수로 판정한다.

대표 fixture는 Position, Anchor, Scale W/H/WH, Rotation, Opacity와 Layer/Sub Composition을 포함한다.

100회의 accepted RAF Draft update에서 다음을 관찰한다.

- raw pointer sample / scheduled frame / accepted semantic update
- Project update / History begin·commit
- Animation Evaluation / Full Renderer / Fast Renderer
- Preview Draft base seed build
- Preview update / dirty·updated·reused node
- Motion Path full build / sampled point
- Direct Selection static candidate build / Draft projection update
- Source Alpha build·reuse / Glow scratch build·reuse / Glow draw
- Composition Cache hit·miss / surface create·reuse
- 필요한 경우 Root와 Panel render count

Sprint의 핵심 목표 count:

- PointerMove Project update: 0
- PointerUp Project update: 1
- 한 drag의 History commit: 1
- 첫 Draft seed 이후 Animation Evaluation 추가 호출: 0
- 첫 Draft seed 이후 Renderer 추가 호출: 0
- Full Render Draft seed: 한 drag당 1회
- Scale/Rotation/Opacity 중 duration-wide Motion Path full build: 0
- 동일 semantic 값 반복 입력의 후속 Draft/Preview update: 최초 1회 이하
- positive Opacity 연속 drag의 Source Alpha와 Glow scratch build: 최초 1회 이하

실제 Edge/Chrome FPS와 frame time은 사용자가 QA를 명시적으로 요청했을 때만 측정한다.

## Task 계획과 진행 상태

### Task 1 — 통합 Drag 계측 Fixture와 Baseline

- 상태: 완료 / 감독관 검토 완료
- 기존 scheduler/helper 중심 검증을 실제 root 통합 경로의 호출 수까지 확장한다.
- 기존 metrics, observer와 test injection 경계를 재사용한다.
- 필요할 경우 별도 verification script를 추가하되 제품 Runtime이나 State를 만들지 않는다.
- 각 Handle과 Layer/Sub Composition 대표 fixture에서 현재 baseline을 기록한다.
- 현재 발생하는 불필요 호출을 검증 코드가 숨기지 않도록 한다.

Task 1 완료 조건:

- 같은 입력에서 동일한 호출 수를 반복 관찰할 수 있다.
- 이후 Task가 모두 같은 fixture로 전후 비교된다.
- 기존 Draft/Commit/Cancel 최종 값이 유지된다.
- 관련 verification, ESLint, build와 `git diff --check`가 통과한다.

감독관 승인 게이트 G1:

- baseline과 각 후속 Task의 목표 count를 검토한다.
- 계측을 위해 제품 동작이나 Runtime 책임을 바꾸지 않았는지 확인한 뒤 Task 2를 승인한다.

Task 1 Baseline 결과:

| 대상 / Handle | Raw / RAF / Accepted | Selection / Animation / Full / Fast / Seed / Preview | Motion Build / Sample | Candidate / Projection | Alpha Build / Reuse | Glow Build / Reuse / Draw | Project / History |
|---|---:|---:|---:|---:|---:|---:|---:|
| Layer Position | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 1 / 9 | 1 / 9 / 10 | 1 / 1 |
| Layer Anchor | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 1 / 9 | 1 / 9 / 10 | 1 / 1 |
| Layer Scale W/H/WH | 각 100 / 10 / 10 | 각 10 | 각 10 / 300 | 각 10 / 10 | 각 1 / 9 | 각 1 / 9 / 10 | 각 1 / 1 |
| Layer Rotation | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 1 / 9 | 1 / 9 / 10 | 1 / 1 |
| Layer Opacity | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 10 / 0 | 10 / 0 / 10 | 1 / 1 |
| SubComp Position | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 1 / 9 | 1 / 9 / 10 | 1 / 1 |
| SubComp Opacity | 100 / 10 / 10 | 각 10 | 10 / 300 | 10 / 10 | 10 / 0 | 10 / 0 / 10 | 1 / 1 |

Task 1 감독관 검토:

- accepted frame마다 Selection 파생, Animation, Renderer, Draft Seed, Motion Path와 Candidate가 반복되는 현재 Baseline을 확인했다.
- Spatial Transform의 Source Alpha와 Glow scratch는 최초 1회 생성 후 9회 재사용된다.
- Opacity는 accepted frame 10회 모두 Source Alpha와 Glow scratch를 다시 생성한다.
- Project Update와 History Commit은 한 drag에서 각 1회로 기존 계약을 유지한다.
- Draft active Composition Cache lookup/store는 0으로 현재 bypass 계약과 일치한다.
- Full/Fast count는 제품에서 두 mode가 동시에 실행된다는 뜻이 아니라 동일 조건의 paired probe다.
- Fixture는 브라우저 React commit 자체를 측정하지 않고 root가 사용하는 실제 pure derivation과 downstream helper 호출 수를 측정한다. Root/Panel render count는 DOM test dependency가 없어 관찰하지 않는다.
- `npm test` 39 scripts, 변경 파일 ESLint, build와 `git diff --check`가 통과했다.
- G1을 승인하고 Task 2로 진행한다.

### Task 2 — Project Selection Derived Identity 안정화

- 상태: 완료 / 감독관 검토 완료
- `useProjectSelectionModel`의 Master Timeline/Composition, Layer/Composition Map, selected target와 selection 파생 값을 실제 Project/Selection 입력 단위로 안정화한다.
- Draft, Readout과 Preview Draft만 바뀐 render에서는 동일한 파생 reference를 유지한다.
- Project import/refresh, Composition, Selection, Timeline과 Frame 변경 시에는 필요한 reference가 정상적으로 갱신되어야 한다.
- Selection 결과, navigation, identity join과 fallback 의미는 변경하지 않는다.

Task 2 완료 조건:

- Draft-only rerender에서 주요 Map과 selected target reference가 유지된다.
- 100 accepted Draft frame에서 초기 seed 이후 Animation Evaluation과 Renderer 추가 호출이 0이다.
- Full Render Draft seed가 한 drag에서 1회만 만들어진다.
- Project/Selection 변경 뒤 stale model이 남지 않는다.
- Full/Fast Renderer의 semantic 결과가 동일하다.

감독관 승인 게이트 G2:

- dependency 누락과 stale identity 가능성을 검토한다.
- 구현 및 회귀 검증이 통과하면 Task 2.5의 독립 효과 측정을 승인한다.
- 이 시점에는 Task 3을 시작하지 않는다.

Task 2 검토 결과:

- 각 Hook 인스턴스가 module-global cache 없이 자체 memoized deriver를 소유한다.
- master timeline/composition, root tree, Layer/Composition Map, selected target/meta/items와 Properties fallback을 실제 입력 경계별로 안정화했다.
- 동일 입력과 equivalent selection에서는 전체 model과 주요 reference가 유지된다.
- Composition/Layer/Timeline target, Scene/Master timeline, Meta, Master transform과 Project refresh 변경에서는 필요한 reference가 최신 값으로 교체된다.
- Selection 의미, navigation, fallback, Project/History와 Renderer 계약은 변경하지 않았다.
- 새 Engine, Runtime, Store 또는 전역 cache를 추가하지 않았다.
- `npm test` 40 scripts, build와 `git diff --check`가 감독관 재실행에서도 통과했다.
- G2를 승인하고 다른 최적화를 섞지 않은 상태로 Task 2.5를 진행한다.

### Task 2.5 — Identity 안정화 효과 검증

- 상태: 완료 / 감독관 검토 완료
- Task 1에서 만든 것과 동일한 Drag Fixture, 입력 sample 수, Handle 종류, Layer/Sub Composition 대상과 Renderer Mode를 그대로 사용한다.
- Task 2 이외의 최적화가 섞이기 전에 동일한 계측을 다시 실행한다.
- Task 1 Baseline과 Task 2 적용 후 결과를 직접 비교한다.
- 감이나 체감으로 Task 3 진행을 승인하지 않는다.

Task 2.5 비교 항목:

- Animation Evaluation 호출 수
- Renderer 호출 수
- Preview Draft Seed 생성 횟수
- Motion Path Build 횟수
- Direct Selection Candidate Build 횟수
- Source Alpha Build / Reuse
- Glow Scratch Build / Reuse
- Project Update
- History Commit

Task 2.5 보고 형식:

```text
Metric                         Before   After   Difference   판정
Animation Evaluation          xxx      xxx     xxx          ...
Renderer                      xxx      xxx     xxx          ...
Preview Draft Seed            xxx      xxx     xxx          ...
Motion Path Build             xxx      xxx     xxx          ...
Direct Selection Candidate    xxx      xxx     xxx          ...
Source Alpha Build / Reuse    xxx      xxx     xxx          ...
Glow Scratch Build / Reuse    xxx      xxx     xxx          ...
Project Update                xxx      xxx     xxx          ...
History Commit                xxx      xxx     xxx          ...
```

Task 2.5 완료 조건:

- Task 1 Baseline과 Task 2 적용 후 결과의 전후 비교표를 작성한다.
- Task 2가 줄인 호출과 줄이지 못한 호출을 구분한다.
- Animation Evaluation, Renderer와 Preview Draft Seed의 핵심 목표 달성 여부를 확인한다.
- Motion Path, Direct Selection Candidate, Alpha와 Glow에서 발생한 간접 효과도 기록한다.
- Project Update와 History Commit 계약이 그대로인지 확인한다.
- 같은 Fixture와 입력 조건을 사용했음을 보고서에 명시한다.

감독관 승인 게이트 G2.5:

- 효과가 충분하면 Task 3 진행을 승인한다.
- 효과가 거의 없거나 핵심 세 count가 목표에 도달하지 못하면 Task 3을 시작하지 않는다.
- 효과가 부족한 경우 Task 1 Baseline과 Task 2.5 결과를 바탕으로 병목 우선순위를 다시 평가하고, 남은 identity 무효화 경계를 조사하거나 Sprint 계획을 수정한다.
- Task 3 이후에는 Task 2의 독립 효과를 다시 측정할 수 없으므로 Task 2.5를 생략하거나 뒤로 미루지 않는다.

Task 2.5 Before / After 결과:

| 대상 / Handle | Animation | Full | Fast | Draft Seed | Motion Path | Candidate | Alpha Build/Reuse | Glow Build/Reuse | Project/History |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Layer Position | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 10→10 | 1/9→1/9 | 1/9→1/9 | 1/1→1/1 |
| Layer Anchor | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 10→10 | 1/9→1/9 | 1/9→1/9 | 1/1→1/1 |
| Layer Scale W/H/WH | 각 10→1 | 각 10→1 | 각 10→1 | 각 10→1 | 각 10→1 | 각 10→10 | 각 1/9→1/9 | 각 1/9→1/9 | 각 1/1→1/1 |
| Layer Rotation | 10→1 | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 1/9→1/9 | 1/9→1/9 | 1/1→1/1 |
| Layer Opacity | 10→1 | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 10/0→10/0 | 10/0→10/0 | 1/1→1/1 |
| SubComp Position | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 10→10 | 1/9→1/9 | 1/9→1/9 | 1/1→1/1 |
| SubComp Opacity | 10→1 | 10→1 | 10→1 | 10→1 | 10→1 | 10→10 | 10/0→10/0 | 10/0→10/0 | 1/1→1/1 |

Task 2.5 감독관 판정:

- Task 1과 같은 raw 100 / RAF 10 / accepted 10, 동일 Handle/대상과 Full/Fast paired probe 조건을 사용했다.
- Animation Evaluation, Full/Fast Renderer와 Draft Seed가 모든 시나리오에서 10회에서 1회로 90% 감소했다.
- Scale/Rotation/Opacity Motion Path도 10회에서 1회로 감소했다.
- Position/Anchor Motion Path는 해당 Draft geometry가 실제로 매 frame 바뀌므로 감소하지 않았다.
- Candidate는 Draft Snapshot dependency 때문에, Alpha/Glow는 Candidate와 Opacity fingerprint 의미 때문에 감소하지 않았다.
- Project Update와 History Commit은 각 1회로 유지됐다.
- React DOM commit/GPU 시간은 측정하지 않았으며 동일 helper와 실제 `Object.is` dependency 의미를 결정적으로 재현한 호출 수 검증이다.
- Task 2 효과가 충분하므로 G2.5를 승인하고 Task 3으로 진행한다.

### Task 3 — Semantic No-op Draft 제거와 Pointer Bounds 재사용

- 상태: 완료 / 감독관 검토 완료

#### Task 3A — Semantic No-op Guard

- Position, Anchor, Scale, Rotation과 Opacity의 직전 accepted semantic 값을 기존 drag session 안에서 비교한다.
- 동일한 값이면 Property Draft, Readout, Snapshot과 Preview update를 모두 생략한다.
- 최초 Draft 표시, 마지막 sample flush, PointerUp commit과 cancel 복원은 유지한다.
- Shift snap, clamp, negative/non-uniform Scale 계산 의미는 변경하지 않는다.

#### Task 3B — DOMRect Session Capture

- Transform drag 동안 viewport resize, zoom과 pan이 가능한 경계를 먼저 조사한다.
- 안전한 경우 PointerDown에서 얻은 overlay bounds를 같은 drag session에서 재사용한다.
- 동시 viewport 변경 계약이 불명확하면 Task 3B는 구현하지 않고 근거와 함께 후속 후보로 보류한다.

Task 3 완료 조건:

- 동일 또는 같은 snap 결과 100회 입력의 semantic Draft/Preview update가 최초 1회 이하이다.
- 실제 값이 바뀌는 입력은 누락 없이 반영된다.
- DOMRect를 재사용한 경우 한 drag의 layout bounds read가 1회다.
- Commit/History/Cancel 결과가 기존과 동일하다.

감독관 승인 게이트 G3:

- Task 3A의 모든 Handle 수치와 transaction fixture를 검토한다.
- Task 3B는 viewport 동시 변경 계약이 명확할 때만 승인한다.

Task 3 검토 결과:

- 공통 Draft Snapshot semantic equality를 Transform Draft Controller에 추가했다.
- 각 Handle은 공통 경계가 변경된 Snapshot을 승인한 뒤에만 Property Draft, Readout과 latest commit 값을 갱신한다.
- Position/Anchor/Scale W·H·WH/Rotation/Opacity 모두 동일 semantic 100 accepted 입력에서 Draft/Readout/Snapshot/Preview가 각 1회만 발생했다.
- 서로 다른 값 100 accepted 입력은 100회 모두 반영됐다.
- 마지막 pending sample flush, PointerUp Project/History 각 1회와 Cancel 복원 계약이 유지됐다.
- Rotation snap, Opacity clamp와 negative/non-uniform Scale을 포함한 fixture가 통과했다.
- Task 2.5의 Before/After 목표 수치도 유지됐다.
- DOMRect session capture는 drag 중 wheel zoom과 ResizeObserver 변경이 가능하고 cancel/coordinate refresh 계약이 없어 stale 좌표 위험 때문에 보류했다.
- `npm test` 41 scripts, build와 `git diff --check`가 통과했다.
- G3을 승인하고 Task 4로 진행한다.

### Task 4 — Positive Root Opacity Alpha Shape 재사용

- 상태: 완료 / 감독관 검토 완료
- 먼저 현재 `alpha > 0` threshold에서 선택된 top-level root Opacity 1~100%가 binary Hit/Glow silhouette를 바꾸지 않는지 fixture로 증명한다.
- positive top-level Opacity는 같은 Source Alpha shape와 Glow scratch를 재사용한다.
- Opacity 0과 `visibility=false`는 기존처럼 Candidate/Glow에서 제외한다.
- Sub Composition child의 Opacity/Visibility/Transform/Order/Source 변화는 기존 invalidation을 유지한다.
- Hit와 Glow의 Alpha entry와 threshold를 분리하지 않는다.

Task 4 완료 조건:

- root Opacity 100→1에서 Hit/Glow pixel 의미가 같고 Source Alpha build가 증가하지 않는다.
- 1→0에서 Candidate/Hit/Glow가 제거되고 0→positive에서 정상 복구된다.
- child visual 변화, source refresh, frame visual과 size 변화는 정상 invalidation된다.
- positive Opacity 100 accepted frame의 Source Alpha, scratch와 readback build가 최초 1회 이하이다.

감독관 승인 게이트 G4:

- root Opacity와 child Opacity 계약 및 0 경계 fixture를 별도 검토한다.
- 미래 threshold 의미와 충돌하거나 Alpha 계약이 불명확하면 이번 Sprint에서 제외한다.

Task 4 검토 결과:

- top-level positive Opacity가 fingerprint와 root raster에 직접 반영되어 매 frame Source Alpha entry와 Glow scratch가 재생성되던 원인을 제거했다.
- root Opacity 1~100은 동일 binary shape로 분류하고, 0과 `visible=false`는 기존처럼 Candidate/Hit/Glow에서 제외한다.
- Sub Composition child Opacity/Visibility/Transform/Order/Source와 frame/size 변화는 실제 합성 Alpha를 바꾸므로 기존 exact invalidation을 유지한다.
- Glow mask는 원래 `alpha > 0`을 255로 이진화하므로 positive root Alpha 세기를 제거해도 Glow 밝기와 pixel 영역은 바뀌지 않는다.
- Layer/SubComp 100→1의 Source Alpha build/readback과 Glow scratch build가 각 1회이고 재사용은 99회다.
- 1→0 제거와 0→positive 복구, child/source/frame/size invalidation fixture가 통과했다.
- 새 Cache, Runtime, State 또는 Store를 추가하지 않았다.
- `npm test` 41 scripts, build와 `git diff --check`가 통과했다.
- G4를 승인하고 Task 5로 진행한다.

### Task 5 — Direct Selection Static Candidate와 Draft Projection 분리

- 상태: 완료 / 감독관 검토 완료
- Project/Evaluated source 기반 identity join과 static descriptor를 Draft projection에서 분리한다.
- Timeline/Render/Scene lookup을 사전 index로 바꾸어 반복 filter와 O(N²) 성격의 rebuild를 제거한다.
- Draft 중에는 필요한 selected Candidate의 Projection/Opacity만 갱신한다.
- Painter Order, exact/blocked identity, duplicate safe-block, hover/press/double-click 의미는 변경하지 않는다.

Task 5 완료 조건:

- 안정된 Scene의 100 spatial Draft frame에서 static join/descriptor build가 1회다.
- 미선택 Candidate rebuild가 0이다.
- 선택 Candidate Projection만 semantic Draft 변화에 맞춰 갱신된다.
- 기존 Direct Selection ambiguity와 Alpha/Glow fixture가 모두 통과한다.

감독관 승인 게이트 G5:

- instance identity, duplicate source와 Painter Order 회귀가 없는지 검토한 뒤 Task 6을 승인한다.

Task 5 검토 결과:

- Direct Selection을 static identity/descriptor, viewport projection, selected Draft projection/root opacity의 3단계로 분리했다.
- Timeline, Render, Scene identity와 Drawable lookup을 사전 index Map으로 구성해 반복 filter와 O(N²) 성격을 제거했다.
- 안정된 Scene의 100 spatial Draft에서 static join/descriptor build 1회, selected projection update 100회, 미선택 Candidate rebuild 0을 확인했다.
- 통합 Fixture의 static/viewport Candidate build가 10회에서 1회로 감소하고 semantic Draft update는 필요한 10회를 유지했다.
- Draft 단계는 selected Candidate만 새 projection/opacity로 교체하며 미선택 Candidate reference와 Painter Order를 보존한다.
- exact/blocked identity, duplicate/split safe-block, 아래 Candidate 관통 금지, negative Scale, transparent fallthrough와 Sub Composition double-click 계약이 유지됐다.
- Task 4의 positive root Alpha와 Glow 재사용도 유지됐다.
- 새 Runtime, Store 또는 State를 추가하지 않았다.
- `npm test` 41 scripts, build와 `git diff --check`가 통과했다.
- G5를 승인하고 Task 6으로 진행한다.

### Task 6 — Motion Path와 Gizmo Memo 경계 분리

- 상태: 완료 / 감독관 검토 완료
- selected target의 안정된 identity를 사용한다.
- duration-wide Motion Path sampling, viewport projection, point ViewModel과 radial handle geometry의 memo 경계를 분리한다.
- Position, Anchor와 Transform Offset에서만 필요한 Draft geometry를 재평가한다.
- 불필요한 배열, Map과 meta 복사를 제거한다.
- Motion Path를 숨기거나 point/sample 수와 품질을 낮추지 않는다.

Task 6 완료 조건:

- Scale W/H/WH, Rotation과 Opacity 100 frame에서 Motion Path full build 증가가 0이다.
- Position/Anchor는 필요한 semantic frame마다 1회 이하로 계산된다.
- Current/Keyframe/Sample/Hover/Hit/Readout의 공통 geometry 의미가 유지된다.
- radial handle과 Motion Path가 같은 Draft Snapshot을 계속 소비한다.

감독관 승인 게이트 G6:

- Motion Path 전체 geometry fixture와 Handle interaction fixture를 검토한 뒤 Task 7의 필요성을 판단한다.

Task 6 검토 결과:

- duration-wide Motion Path sampling과 current-frame 표식을 분리했다.
- radial handle geometry, Motion Path viewport projection/polyline, hover·hit point ViewModel, Scale readout와 cursor descriptor를 독립 경계로 분리했다.
- Controller 내부의 불필요한 Render/Timeline/Meta 복사를 제거했다.
- Scale W/H/WH, Rotation과 Opacity 100 semantic frame은 초기 sampling 1회 이후 추가 build가 0이다.
- Position/Anchor/TransformOffset은 초기 포함 101회로 semantic frame당 정확히 1회다.
- viewport-only 100회 변화는 duration sampling 추가 0, projection/polyline만 100회 갱신된다.
- Current/Keyframe/Sample, polyline, hover/hit Point ViewModel이 동일 projected geometry와 일치한다.
- radial 위치, 반지름, cursor, hit, readout과 기존 helper API를 유지했다.
- `npm test` 41 scripts, build와 `git diff --check`가 통과했다.
- G6을 승인하고 Task 7의 조건 충족 여부를 평가한다.

### Task 7 — React Panel과 Props 격리

- 상태: 완료 / 감독관 검토 및 Edge QA 완료
- Task 1~6 이후에도 PSD Tree나 Timeline render가 accepted Draft frame마다 증가할 때만 수행한다.
- 기존 viewProps, command와 callback identity를 안정화하고 기존 Component memo 경계를 사용한다.
- Preview와 Properties는 필요한 Draft 값을 계속 반영하되 PSD Tree와 Timeline은 Draft-only update를 건너뛴다.
- 새 Context, Store, external subscription이나 state ownership 이동은 금지한다.

Task 7 완료 조건:

- Draft-only 100 frame에서 PSD Tree와 Timeline 추가 render가 0이다.
- Project, Selection, Playhead와 Toolbar 변경에는 각 Panel이 정상 갱신된다.
- Properties current value, Preview Gizmo와 Canvas는 모든 semantic Draft를 반영한다.
- 광범위 props 재설계가 필요하면 구현하지 않고 후속 Sprint로 보류한다.

감독관 승인 게이트 G7:

- render count 개선과 stale callback 가능성을 검토한다.
- Task 7이 불필요하거나 범위가 커지면 보류 근거를 Sprint 결과에 기록한다.

Task 7 검토 결과:

- Draft-only root render가 plain `PsdTree`와 `TimelinePanel`까지 전파되고, controller option/callback/read model/viewProps 객체도 매번 생성되는 조건을 확인했다.
- 두 Panel에 `React.memo` 경계를 추가하고 PSD Tree/Timeline의 기존 controller input, read model, command/interaction과 최종 viewProps identity를 실제 입력별로 안정화했다.
- History command는 stable façade가 최신 controller를 참조하여 stale closure 없이 Timeline props를 안정화한다.
- Preview와 Properties는 memo 차단 대상에서 제외하여 semantic Draft 100회를 모두 반영한다.
- fixture에서 Draft-only 100 frame의 PSD Tree/Timeline 추가 render는 0, Preview/Properties는 각 100이며 Project/Selection/Playhead/Toolbar 입력은 정상 invalidation된다.
- 실제 React commit count가 아닌 shallow memo 조건과 source boundary를 결합한 정적 fixture라는 한계 때문에 새 Edge 창에서 중간 QA를 수행했다.
- 최초 Edge QA에서 하단에 배치된 `memo` import의 TDZ 오류로 앱이 빈 화면이 되는 회귀를 발견했다.
- `PsdTree.tsx`와 `TimelinePanel.tsx`의 import를 파일 상단으로 교정한 뒤 재검증했다.
- 재QA에서 `drag_test.psd` import, Transform drag/Properties 갱신, Undo/Redo, Timeline 한 프레임 이동, PSD Tree Composition 전환과 Timeline Layer 선택이 정상 동작했다.
- 전체 42개 verification, build와 `git diff --check`가 감독관 재실행에서도 통과했다.
- G7을 승인하고 Task 8 문서 마감으로 진행한다.

### Task 8 — 문서 갱신과 Sprint 정적 마감

- 상태: 완료
- 실제 변경과 측정 결과에 맞게 `20_src_map.md`와 관련 영구 문서를 갱신한다.
- 완료된 최적화의 구조, 호출 수 전후, 보류 항목과 알려진 한계를 영구 문서에 기록한다.
- `98_sprint_plan.md`를 최종 상태로 갱신한다.
- 작업을 멈추는 시점에 루트 에이전트가 `99_recent_task.md`를 가장 최근 Task 한 건으로 교체한다.
- 실제 QA 전에는 Sprint 상태를 `구현 완료 / QA 대기`로 기록한다.

Task 8 결과:

- `49_transform_drag_runtime_continuity_optimization.md`를 작성해 Baseline, Task 2.5 전후 계측, 최종 호출 수, 보존 계약, 보류 항목과 알려진 한계를 영구 기록했다.
- `20_src_map.md`를 실제 Project Selection, Draft no-op, Direct Selection, Alpha/Glow, Motion/Gizmo와 Panel memo 경계에 맞게 갱신했다.
- 감독관 검토에서 문서 수치와 42개 verification 결과가 일치하고, 정적 결과와 실제 Edge QA의 범위가 구분되어 있음을 확인했다.
- 사용자 승인에 따라 Task 7 중간 QA와 Sprint 마감 대상 QA를 실제 Edge 새 창에서 수행했다.

## 이번 Sprint에서 제외하는 고위험 후보

다음 항목은 Task 1~7 이후의 계측으로 필요성이 확인되고 사용자가 별도 계획을 승인할 때만 후속 Sprint로 승격한다.

### Preview Scene Pass 통합

- Transform update가 이미 아는 changed node와 stats를 Dirty/Node/Draw Plan에서 재사용하는 방안
- 위험: dirty kind, ancestor와 old/new bounds 누락

### Draft-safe Composition Cache

- Composition outer transform과 child-content identity를 분리하여 clean child surface를 Draft 중 재사용하는 방안
- 위험: stale pixel, old bounds 잔상, child dirty와 surface lifecycle 누락

### Glow Bounded Draw

- full viewport clear/blur 대신 selected old/new bounds와 blur padding만 처리하는 방안
- 위험: Rotation, negative/non-uniform Scale, DPR, viewport edge clipping과 잔상

이 후보들은 단순 호출 수 감소만으로 승인하지 않는다. 별도 설계와 pixel correctness fixture가 먼저 필요하다.

## 공통 정적 검증

각 구현 Task에서 작업 성격에 맞게 다음을 실행한다.

- 변경 파일 ESLint
- 관련 verification scripts
- `npm test`
- `npm run build`
- `git diff --check`
- Engine Import Boundary
- Project History / Animation / Canvas Drag / Direct Selection / Glow / Dirty / Cache 회귀 검증

500줄 이상인 `.ts` 또는 `.tsx` 파일은 `00_rule.md`에 따라 파일명과 줄 수만 리팩토링 제안으로 보고하며 임의로 분리하지 않는다.

정적 검증 통과를 실제 QA 통과로 기록하지 않는다.

## QA 결과

사용자가 Sprint 진행 중 필요한 QA 수행을 명시적으로 승인해 새 Edge 창과 `drag_test.psd`로 대상 QA를 수행했다.

확인 항목:

- Position/Anchor/Scale W/H/WH/Rotation/Opacity의 체감 FPS와 frame time
- Layer와 Sub Composition의 Handle drag
- Draft 중 Layer/Selection/Gizmo/Motion Path/Glow/Properties 동기화
- PointerUp Commit과 Undo/Redo 한 번
- Full/Fast Renderer 결과 동일
- Glow ON/OFF 비교
- drag cancel과 viewport 경계
- Preview/Export 출력 회귀 없음

실제 확인 결과:

- PSD import, Composition/Timeline 선택과 편집기 runtime 진입이 정상이다.
- Position과 Anchor 조작에서 Draft 중 Canvas/Properties가 갱신되고 PointerUp Commit과 Undo/Redo가 동작한다.
- Renderer Mode `작업용(fast-render)`과 `완성본(full-render)` 전환이 즉시 반영되고 앱 오류가 없다.
- 선택 Glow OFF/ON이 즉시 반영되고 direct selection은 유지된다.
- Edge Console에는 제품 runtime 오류가 없고 React 개발 안내와 설치된 확장 안내만 존재한다.
- Scale/Rotation/Opacity의 작은 radial hit target은 Computer Use 좌표 자동화로 신뢰성 있게 반복 조작하지 못했다. 이 항목을 실제 Edge 통과로 과장하지 않고, 공통 Draft/Commit 계약과 Handle별 계산은 관련 통합 fixture와 42개 정적 verification 통과로 기록한다.

이번 QA는 제품 핵심 runtime과 변경 경계의 회귀 여부를 확인하는 대상 QA다. 실제 FPS/frame time/GPU profiler 수치와 모든 Handle의 장시간 수동 체감 평가는 별도 성능 QA 범위로 남긴다.

## 절대 하지 말 것

- 기능 제거, UI 숨김 또는 품질 저하로 FPS를 확보하기
- Full Render를 Fast Render로 강제 우회하기
- PointerMove에서 Project 또는 History를 변경하기
- 새 Engine, Runtime, State, Store, Project/History 필드를 추가하기
- Preview/Export 출력과 Renderer 의미를 변경하기
- DraftTransformSnapshot 또는 Editor Draft Runtime 의미를 변경하기
- Motion Path sample 수를 줄이기
- Glow와 Hit Alpha 계약을 분리하기
- duplicate/split/reorder safe-block과 Painter Order를 변경하기
- 강제 refresh, timer 또는 임시 Handle별 예외 처리로 해결하기
- 계측 근거 없이 Preview Cache와 Dirty 구조를 리팩토링하기

## Sprint 완료 조건

- Task 1, Task 2, Task 2.5, Task 3~6과 Task 8이 완료된다.
- Task 2.5에서 Task 1과 동일한 Fixture를 사용한 Before/After 비교표가 작성되고 감독관 승인 게이트 G2.5를 통과한다.
- Task 7은 계측상 필요할 때 완료하거나, 불필요/과범위 근거와 함께 후속 보류된다.
- PointerMove Project update는 0이고 PointerUp update와 History commit은 각 1회다.
- 모든 Handle에서 초기 seed 이후 Animation Evaluation과 Renderer 추가 호출이 0이다.
- Full Render Draft seed는 한 drag당 1회다.
- 동일 semantic 값의 후속 Draft/Preview update가 제거된다.
- Scale/Rotation/Opacity에서 duration-wide Motion Path full build가 0이다.
- 승인된 경우 positive Opacity의 Source Alpha와 scratch build가 최초 1회 이하이다.
- Direct Selection static Candidate는 안정된 Scene에서 한 번만 만들어진다.
- 기존 Draft/Commit/Cancel, Full/Fast, Hit/Glow, radial UI, cursor, connection hit와 readout 동작이 유지된다.
- 관련 정적 검증이 모두 통과한다.
- 실제 QA 전에는 `구현 완료 / QA 대기`로만 마감한다.

## 감독관 자기 평가와 반영

계획 초안을 독립 설계 검토 관점에서 평가하고 다음을 반영했다.

1. FPS 목표만 두면 개선 원인을 증명할 수 없다.
   - Task 1에서 통합 호출 수 baseline을 먼저 고정했다.
2. 가장 큰 identity 문제 전에 하위 Canvas 최적화를 하면 효과 판정이 흐려진다.
   - Project Selection identity를 첫 구현 Task로 배치했다.
3. DOMRect 재사용은 viewport 동시 변경과 충돌할 수 있다.
   - 선행 조사와 별도 승인 조건을 추가했다.
4. Opacity Alpha 재사용은 child Alpha 의미를 훼손할 위험이 있다.
   - positive top-level root와 0/child invalidation을 분리하고 fixture 선행 조건을 추가했다.
5. Direct Selection과 Motion Path 변경을 한 번에 검토하면 회귀 원인을 구분하기 어렵다.
   - 독립 Task와 승인 게이트로 분리했다.
6. React 격리는 계측 없이 진행하면 광범위한 props 리팩토링이 될 수 있다.
   - Task 1~6 후에도 render count가 남을 때만 실행하는 조건부 Task로 제한했다.
7. Preview pass, Composition Cache와 bounded Glow는 stale pixel 위험이 크다.
   - 이번 Sprint에서 제외하고 별도 설계가 필요한 후속 후보로 분리했다.
8. 실제 브라우저 QA가 자동으로 실행될 위험이 있다.
   - 사용자 명시 요청 전에는 정적 검증만 하고 `구현 완료 / QA 대기`로 종료하도록 고정했다.
9. Task 2 뒤 다른 최적화를 곧바로 적용하면 identity 안정화의 독립 효과를 판단할 수 없다.
   - Task 2 직후 같은 Fixture로 Baseline을 재측정하는 Task 2.5와 필수 승인 게이트 G2.5를 추가했다.
10. 보강 후 Task 순서를 다시 검토했다.
   - `Baseline → Identity 구현 → 동일 조건 효과 검증 → 후속 최적화` 순서가 원인별 효과를 분리하며, Task 2.5 결과가 부족하면 Task 3 전에 우선순위를 재평가하도록 확정했다.

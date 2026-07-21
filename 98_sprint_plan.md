# Current Sprint Plan

> 문서 번호: 98
> 상태: 구현 완료 / QA 대기
> QA: 미실행

## Sprint

- 이름: Canvas Visual Layer Selection
- 유형: Editor Selection 기능 개발
- 목표: Canvas에서 보이는 Layer/Sub Composition을 직접 선택하고, 선택된 대상의 실제 불투명 픽셀 실루엣을 Editor-only Glow로 표시한다.

이번 Sprint는 `97_next_sprint.md`의 계획을 현재 Sprint로 승격한 것이며, 승인된 설계에 따라 Task를 순서대로 구현 중이다.

## 핵심 흐름

```text
Canvas Pointer
→ EvaluatedScene top-level candidate
→ Bounds
→ Transformed Quad
→ 공통 Source Alpha
→ Painter Order 최상단 Hit
→ 기존 applySelectionForComposition()
→ Timeline / Properties / Gizmo / Glow 동기화
```

```text
공통 Source-local Alpha
  + 현재 Evaluated/Draft Transform
  + Viewport Projection
→ Hit Test sample
→ 선택된 대상 1개의 Silhouette Glow
```

## 고정 UX 계약

- Glow는 Selection Box의 사각형 Glow가 아니라 실제 불투명 픽셀 실루엣을 따른다.
- 기존 Selection Box, Outline과 Transform Handle은 유지한다.
- Glow는 Layer 내용을 덮지 않는 낮은 강도의 외곽 효과이며 Zoom과 무관한 screen-space 두께를 사용한다.
- 현재 Composition의 top-level Layer와 immediate Sub Composition만 선택한다.
- Sub Composition children은 Alpha 합성에는 포함하지만 선택 결과는 부모 Sub Composition이다.
- 겹친 대상은 실제 Painter Order에서 최상단인 대상을 선택한다.
- 투명 픽셀은 Hit가 아니며 아래 후보 또는 빈 공간 판정으로 계속 진행한다.
- `visible=false`, 활성 시간 밖, 크기 0, 최종 Opacity 0 대상은 후보에서 제외한다.
- 빈 Canvas 클릭은 Item Selection을 해제한다.
- 다른 대상을 처음 누른 gesture는 선택만 수행하고 이동시키지 않는다.
- 현재 선택 대상의 불투명 픽셀을 누른 경우에만 기존 Position Drag를 시작한다.
- 선택 polygon의 투명 여백이 Alpha Hit Test를 우회해 Drag를 시작해서는 안 된다.
- 다중 선택, Hover 선택 미리보기, Alt/Cmd-click 순환 선택은 이번 Sprint 범위가 아니다.

## Pointer 우선순위

다음 우선순위를 고정한다.

```text
1. Transform Handle / Anchor / Motion Path Point
2. Space+Left 또는 Middle Button Pan
3. 현재 선택 대상의 공통 Alpha Hit → 기존 Position Drag
4. 다른 top-level 대상의 공통 Alpha Hit → Selection만 변경
5. Hit 없음 → Selection 해제
```

각 상위 단계가 event를 소비하면 아래 단계는 Selection이나 Drag를 시작하지 않는다.

## 구조 원칙

- 새 Engine, 전역 Store, 공개 Runtime, Project State 또는 History 필드를 만들지 않는다.
- 기존 `EvaluatedScene`, `RenderItem`, `TimelineItem`, `DraftTransformSnapshot`과 `applySelectionForComposition()`을 재사용한다.
- Hit Test 기준은 mode에 따라 없을 수 있는 `RenderFrame`이나 lazy `PreviewScene`이 아니라 항상 존재하는 현재 `EvaluatedScene`이다.
- Full/Fast Renderer Mode는 같은 Candidate와 Alpha 의미를 사용한다.
- Glow와 Hit Test는 Editor Selection 계산이며 Main Preview Canvas, Playback Renderer, Export에 포함하지 않는다.
- 기존 Preview Bitmap/Node/Composition/Surface Cache와 Dirty Region의 계약을 변경하지 않는다.
- 허용되는 Cache는 Canvas Selection 계산 경계 안의 bounded scratch cache뿐이다.

## Selection Identity 계약

### Candidate identity

Selection Candidate는 source만이 아니라 현재 top-level instance를 식별해야 한다.

- Layer: `renderItemId + drawableId + Timeline itemId + sourceId + kind`
- Sub Composition: `renderItemId + targetCompId + Timeline itemId + sourceId + kind`
- identity join이 유일한 Selection 결과는 정확한 `itemId`, `sourceId`, `kind`를 기존 `applySelectionForComposition()`에 전달한다.
- `sourceId`만으로 Timeline item을 찾는 fallback은 duplicate source에서 사용하지 않는다.
- `renderItemId → 현재 Composition TimelineItem.id`의 기존 record join을 Task 1에서 조사한다.
- join이 유일하지 않은 duplicate/split/reorder 후보는 임의 선택하거나 아래 Layer로 관통하지 않는다. 현재 Selection을 유지하고 Canvas 직접 선택과 Glow를 안전하게 보류한다.

### Duplicate source 경계

- 동일 bitmap과 visual fingerprint를 가진 duplicate instance는 Source Alpha entry를 재사용할 수 있다.
- Candidate identity, Timeline itemId, Painter Order와 Viewport Projection은 instance마다 분리한다.
- 서로 다른 local frame이나 시각 결과는 같은 Source Alpha entry를 공유하지 않는다.
- 기존 renderer의 sourceId 기반 active/local-frame 및 duplicate timing 의미를 이번 Sprint에서 변경하지 않는다.
- exact Timeline item join이 불가능한 ambiguous duplicate는 잘못된 instance를 선택하지 않는 것을 안전 기준으로 한다. 해당 pixel은 아래 후보로 통과시키지 않으며 기존 Timeline 선택 경로를 사용한다.

## 공통 Alpha Mask 계약

Hit Test와 Glow는 반드시 같은 `SelectionAlphaMask` 계약과 같은 Alpha 판정 상수를 사용한다.

별도 Hit Mask, Glow Mask, Renderer Mode별 Mask를 만들지 않는다.

```text
SelectionAlphaMask
├─ Source-local Alpha entry
└─ Candidate별 Viewport Projection descriptor

Hit Test → 같은 entry/descriptor의 alpha sample
Glow     → 선택된 같은 entry/descriptor의 outer glow projection
```

- Glow에 포함되는 픽셀과 클릭 가능한 픽셀은 동일한 Alpha 판정 결과를 사용한다.
- Alpha threshold는 한 상수로 정의하며 두 소비자가 별도로 정하지 않는다.
- Hit 결과가 반환하는 Candidate/Mask descriptor와 Glow가 재해석하는 Selected Candidate의 descriptor가 동일 fingerprint 규칙을 사용해야 한다.
- Alpha Mask는 Project State가 아니라 Editor 계산 결과다.

## 2단계 Alpha 설계

### 1. Source-local Alpha

대상의 local pixel 좌표계에서 현재 시각 Alpha만 생성한다.

- Layer는 실제 source bitmap/canvas Alpha를 사용한다.
- Sub Composition은 Painter Order를 유지한 ordered children의 Alpha 합성 결과를 사용한다.
- Source-local Alpha에는 top-level Position, Scale, Rotation, Anchor, Transform Offset과 Viewport 값이 들어가지 않는다.
- 최종 Opacity와 Visibility처럼 현재 Alpha 의미를 바꾸는 값은 visual fingerprint와 후보 판정에 반영한다.

### 2. Viewport Projection

Source-local Alpha에 다음 Geometry만 적용한다.

- Position
- Scale
- Rotation
- Anchor
- Transform Offset
- matching `DraftTransformSnapshot`
- Preview Zoom/Pan/Base Offset/Fit/1:1

이 값들이 바뀌면 Projection descriptor만 다시 계산한다. Source-local Alpha surface는 재생성하지 않는다.

## Alpha Mask Scratch Cache 계약

### 소유권과 수명

- 기존 Canvas Selection 계산 경계가 소유하는 UI 계산용 ephemeral resource다.
- React/Project/History State, `RenderItem`, `EvaluatedScene`, Preview Runtime Store에 저장하지 않는다.
- 기존 Preview Bitmap/Node/Composition/Surface Cache에 편입하지 않는다.
- 새 범용 Cache framework, LRU budget system, async worker 또는 generation Store를 만들지 않는다.
- 현재 Composition의 active candidate 수를 상한으로 하는 bounded on-demand cache다.
- Bounds/Quad를 통과한 후보와 선택된 Glow 대상에 대해서만 lazy 생성한다.
- Composition/source set 교체 시 active fingerprint가 아닌 entry를 폐기한다.
- PSD import/refresh/source replacement와 component unmount에서 관련 surface를 clear/dispose한다.

### 최소 책임

```text
getSourceAlpha(visualFingerprint)
retainActive(activeFingerprints)
clear / dispose
buildCount / reuseCount (검증용 read only)
```

검증용 count는 제품 State나 Runtime Metrics에 저장하지 않고 fixture에서 관찰 가능한 최소 adapter 결과로 둔다.

## Cache Key와 무효화 계약

### Layer Source Alpha fingerprint

- 실제 source bitmap/canvas identity
- source identity/fingerprint와 drawable identity
- logical width/height
- PSD import/refresh로 교체된 source 경계
- frame-dependent source visual identity
- Alpha 의미를 바꾸는 Opacity/Visibility

### Sub Composition Source Alpha fingerprint

- target composition identity와 logical size
- local frame의 실제 visual identity
- 부모 Alpha 의미를 바꾸는 Opacity/Visibility
- Painter Order를 보존한 ordered child visual fingerprints
- child bitmap identity와 size
- child local frame visual
- child Opacity/Visibility
- Sub Composition local Alpha 합성을 바꾸는 child Transform와 order

### 반드시 무효화

- source bitmap/canvas 교체
- PSD import/refresh/source replacement
- frame visual 변경
- Opacity 변경
- Visibility 변경
- Sub Composition child visual/bitmap/transform/order 변경
- logical size 변경

### Source Alpha를 재생성하지 않음

- top-level Position/Scale/Rotation/Anchor/Transform Offset
- 같은 spatial field의 Draft Transform
- Viewport Zoom/Pan/Base Offset/Fit/1:1

위 변화는 Projection만 갱신한다.

### 안전 규칙

- key에 `sourceId`만 사용하지 않는다.
- 무조건 `globalFrame`만 넣어 static source cache hit를 없애지 않는다.
- 전체 Scene JSON, 현재 시간, random 값을 key로 사용하지 않는다.
- 같은 canvas 객체가 in-place로 바뀌는 경로는 새 Project revision 필드를 만들지 않고 기존 PSD import/refresh/source replacement 경계에서 cache를 clear한다.

## 성능 원칙

Hit Test 후보는 반드시 다음 순서로 줄인다.

```text
Bounds(AABB)
→ Transformed Quad containment
→ inverse projection된 Source Alpha sample
```

- Bounds 탈락 후보는 Quad/Alpha를 계산하지 않는다.
- Quad 탈락 후보는 Alpha entry를 생성하거나 읽지 않는다.
- Painter Order 역순의 첫 Alpha Hit에서 탐색을 종료한다.
- Glow rasterization/projection은 선택된 top-level 대상 정확히 하나만 수행한다.
- 모든 Layer의 Glow 또는 Projected Mask를 PointerMove마다 생성하지 않는다.
- Position/Scale/Rotation/Anchor/Transform Offset Draft 중 Source Alpha build count는 증가하지 않아야 한다.

## Task 계획과 진행 상태

### Task 1 — Selection Runtime, Identity와 Pointer 조사

- 상태: 완료 / 감독관 검토 완료
- 현재 Selection Overlay, Canvas/Gizmo Pointer ownership과 `applySelectionForComposition()` 경계를 확인한다.
- `EvaluatedScene.nodes` Painter Order와 top-level Layer/Sub Composition mapping을 확정한다.
- `renderItemId → Timeline itemId` join과 duplicate source 한계를 fixture 기준으로 확정한다.
- 기존 selected polygon이 Alpha Hit/Drag를 우회하는 경로를 확인한다.
- 아직 구현하지 않는다.

Task 1 확인 결과:

- `EvaluatedScene.nodes`는 back-to-front painter 배열이며 Hit Test는 배열 끝에서 시작해야 한다.
- top-level drawable은 Layer, top-level composition은 immediate Sub Composition 후보이고 children은 부모 Alpha 합성 전용이다.
- Pan은 viewport capture, Handle/Anchor/Motion Path는 propagation 차단으로 Body Selection보다 우선한다.
- 기존 Selection polygon은 투명 pixel 여부와 무관하게 전체 quad에서 Position Drag를 즉시 시작하므로 공통 Alpha Body press 경계로 교체해야 한다.
- 일반 unique-source는 Timeline join이 가능하지만 duplicate/split/reorder 전체에서 안전한 `renderItemId → Timeline itemId` foreign-key 계약은 없다.
- 감독관은 Renderer/Project identity 확장 없이 ambiguous duplicate를 임의 선택하지 않는 안전 보류 정책을 승인했다.

### Task 2 — Selection Candidate와 공통 Alpha 계약 설계

- 상태: 완료 / 감독관 승인
- Candidate identity와 top-level/immediate Sub Composition 경계를 설계한다.
- Hit Test와 Glow가 소비할 단일 `SelectionAlphaMask` 입력/출력과 Alpha threshold를 확정한다.
- Main Renderer API와 기존 Preview Cache를 변경하지 않는 adapter/helper 경계를 확정한다.
- 아직 구현하지 않는다.

Task 2 승인 결과:

- Candidate는 `ready`와 `blocked`로 구분하고 `scene.nodes`의 기존 배열을 끝에서 앞으로 순회한다.
- Layer는 top-level drawable, Sub Composition은 top-level composition만 Candidate이며 children은 부모 Source Alpha 합성 입력이다.
- `SelectionAlphaMask`는 하나의 Source Alpha entry와 하나의 Projection descriptor를 묶고 Hit와 Glow가 동일 resolver로 소비한다.
- Alpha threshold는 단일 module constant로 고정하며 Hit/Glow가 별도 값을 받지 않는다.
- Hit 결과는 동일 Mask를 포함하고 Glow도 같은 Candidate/fingerprint resolver를 사용한다.
- matching Draft는 target/localFrame뿐 아니라 현재 selected Timeline itemId와 Candidate itemId가 일치할 때만 완성된 spatial snapshot 전체를 Projection에 적용한다.
- blocked Candidate는 Bounds/Quad 진입 시 Selection 유지/Drag 금지/no-glow로 종료하며 Alpha cache에 접근하지 않는다.
- 후보/Projection/Hit는 순수 helper, Source Alpha surface/sample은 browser adapter, 연결은 Canvas Engine 책임으로 승인했다.
- negative Scale inverse matrix와 unclamped viewport-to-world 변환은 기존 helper를 잘못 재사용하지 않고 Task 구현 fixture로 고정한다.

### Task 3 — 공통 Alpha Mask + Cache 설계

- 상태: 완료 / 감독관 수정 승인
- Source Alpha 생성과 Viewport Projection을 분리한다.
- Layer Source Alpha와 Sub Composition ordered children Alpha 합성 규칙을 설계한다.
- Cache Key와 visual fingerprint를 확정한다.
- source bitmap, PSD, frame visual, Opacity, Visibility, Composition children visual 변경의 무효화 규칙을 확정한다.
- top-level Geometry/Draft/Viewport 변화가 Projection만 갱신하도록 계약을 고정한다.
- duplicate source의 Source Alpha 공유와 instance Projection 분리 규칙을 확정한다.
- scratch surface의 생성, active candidate 상한, retain, clear/dispose와 unmount 수명을 확정한다.
- 새 Runtime/Store/Project/History 필드가 생기지 않는지 확인한다.
- 아직 제품 UI를 연결하지 않는다.

Task 3 승인 결과:

- 단일 Provider는 versioned visual fingerprint와 provider-local canvas object token을 사용한다.
- Layer는 original drawable Alpha, Sub Composition은 ordered children의 source-local Canvas2D 합성 Alpha를 사용한다.
- Sub Composition group Opacity는 children 각각이 아니라 offscreen 합성 결과에 한 번 적용한다.
- 최종 root에서만 1회 readback하고 Hit는 저장된 canonical 8-bit Alpha plane을 O(1) sample한다.
- Source Alpha key는 source visual/size/frame visual/Opacity/Visibility와 Sub Composition child visual/transform/order를 포함하고 top-level spatial/Draft/Viewport 값을 제외한다.
- 동일 visual duplicate는 Source Alpha를 공유하고 Candidate/Projection은 instance별로 분리한다.
- context/readback/taint 실패는 transparent가 아니라 blocked 결과로 승격한다.
- import/refresh/source-set 교체와 unmount에서 clear/dispose하며 transform-only 변경은 cache를 비우지 않는다.

감독관 메모리 보완:

- 장기 entry에 RGBA surface와 별도 Alpha 배열을 동시에 보관하지 않는다. canonical Alpha plane 하나만 Source Alpha의 진실로 저장한다.
- Glow seed surface는 선택된 fingerprint 하나에 대해서만 같은 Alpha plane에서 재구성하고 재사용한다.
- Hit 중 transparent로 탈락한 비선택 후보 resource는 sample 직후 폐기한다.
- persistent ready cache는 선택된 fingerprint와 가장 최근 성공 Hit처럼 실제 재사용 대상만 소수 유지한다. 모든 active candidate의 full-size mask를 보관하지 않는다.
- active fingerprint set은 허용/무효화 판정용이며 cache entry 수 상한으로 해석하지 않는다.
- failure memoization은 작은 metadata만 active fingerprint 수 안에서 유지하며 source invalidation 뒤 재시도한다.

### Task 4 — 감독관 설계 검토

- 상태: 완료 / 구현 승인
- Task 1~3 결과에서 책임 중복, Engine Boundary, cache 과설계와 invalidation 누락을 검토한다.
- Hit Test와 Glow가 동일 Alpha entry/threshold를 소비하는지 확인한다.
- Animated Layer, duplicate source와 Sub Composition children이 안전하지 않으면 구현을 승인하지 않는다.
- 문제를 수정한 뒤에만 Task 5를 승인한다.

Task 4 검토 결과:

- Hit Test와 Glow의 Source Alpha/threshold 단일성: 승인
- Source-local Alpha와 Projection 분리: 승인
- spatial/Draft/Viewport projection-only 갱신: 승인
- Animated Opacity/frame visual/Sub Composition child invalidation: 승인
- duplicate ambiguous blocked 정책과 pointer 우선순위: 승인
- 기존 Preview/Renderer/Export/Cache 경계: 승인
- 이중 RGBA+Alpha 보관과 active 전체 mask 누적 위험은 위 메모리 보완으로 수정 후 승인

### Task 5 — Source Alpha Provider와 Scratch Cache 구현

- 상태: 완료 / 감독관 검토 완료
- 승인된 단일 Source Alpha provider를 구현한다.
- Layer Alpha와 Sub Composition Alpha를 같은 계약으로 반환한다.
- bounded on-demand scratch cache와 무효화/폐기 lifecycle을 구현한다.
- Glow/Hit 전용 Mask를 따로 만들지 않는다.

Task 5 검토 결과:

- Layer/Sub Composition이 동일한 Source Alpha entry와 단일 Alpha threshold 계약을 사용한다.
- 장기 entry에는 canonical 8-bit Alpha plane만 보관하며 RGBA surface를 함께 유지하지 않는다.
- Source visual/revision/frame/Opacity/Visibility와 Sub Composition child visual/transform/order가 fingerprint를 무효화한다.
- top-level spatial/Draft/Viewport는 fingerprint에서 제외되어 Projection만 갱신할 수 있다.
- 동일 visual duplicate는 entry를 재사용하고 cache는 기본 2개로 제한된다.
- transparent miss를 즉시 release하고 선택/최근 hit만 retain할 수 있으며 unavailable은 투명 hit로 처리되지 않는다.
- 관련 fixture, ESLint, 전체 verification, build, diff check가 통과했다. 이는 브라우저 QA 통과를 의미하지 않는다.

### Task 6 — Canvas Hit Test와 직접 선택 연결

- 상태: 완료 / 감독관 검토 완료
- 기존 좌표 helper와 EvaluatedScene을 사용해 Bounds → Quad → Alpha Hit Test를 구현한다.
- Painter Order 역순 첫 Hit를 정확한 Timeline Selection으로 변환한다.
- 기존 `applySelectionForComposition()`을 재사용한다.
- Pointer 우선순위, empty clear와 현재 선택 visible-pixel Drag 계약을 연결한다.
- 다른 대상 첫 gesture는 선택만 수행한다.

Task 6 검토 결과:

- top-level EvaluatedScene node를 painter order 역순으로 검사하고 Layer/Sub Composition만 직접 선택 후보로 사용한다.
- exact Timeline/Render identity만 ready이며 모호한 duplicate는 선택 유지/no-drag/no-fallthrough로 안전하게 차단한다.
- Hit Test는 Bounds → Quad → 공통 Source Alpha → signed inverse sample 순서를 따른다.
- transparent miss는 즉시 release 후 아래 후보로 진행하고 unavailable은 blocked로 처리한다.
- 현재 선택 대상의 visible pixel만 기존 Position Drag를 시작하며 다른 대상은 첫 gesture에서 선택만 수행한다.
- empty hit는 선택을 해제하고 Pan/Handle/Anchor/Motion Path의 기존 pointer 우선순위는 유지한다.
- Draft spatial 값은 정확히 일치하는 선택 대상의 Projection에만 반영된다.
- 정적 PSD는 local frame 변화만으로 Source Alpha를 재생성하지 않도록 감독관 수정 후 승인했다.
- 관련 fixture, lint, 전체 verification, build, diff check가 통과했다. 브라우저 QA는 아직 실행하지 않았다.

### Task 7 — Editor-only Silhouette Glow 구현

- 상태: 완료 / 감독관 검토 완료
- Task 5의 동일 Source Alpha와 Projection descriptor를 선택된 대상 하나에만 사용한다.
- Preview Canvas 위, Gizmo 아래에 outer glow를 표시한다.
- interior 제거, screen-space 두께, viewport edge padding과 `pointer-events: none`을 적용한다.
- Draft Transform 중 같은 Projection 경로로 Layer를 실시간 추종한다.

Task 7 검토 결과:

- Glow는 선택된 ready candidate의 동일 Source Alpha entry/fingerprint/threshold/Projection을 재사용한다.
- viewport 크기의 DPR-aware Editor-only canvas에서 blur 후 동일 mask를 `destination-out`하여 내부를 제거한다.
- 선택된 fingerprint 하나의 source scratch만 유지하고 position-only Draft에서는 scratch를 재사용한 채 Projection draw만 갱신한다.
- Preview Canvas 위, Motion Path와 Selection/Gizmo 아래에 배치되며 `pointer-events: none`이다.
- selection/visual 변경, blocked/unavailable, source replacement와 unmount에서 이전 scratch가 폐기된다.
- Renderer/Preview/Export 경로에는 연결되지 않았다.
- 관련 fixture, lint, 전체 verification, build, diff check가 통과했다. 브라우저 QA는 아직 실행하지 않았다.

### Task 8 — 통합 및 정적 회귀 검증

- 상태: 완료 / 감독관 검토 완료
- 공통 Alpha/Cache/Hit/Glow/Pointer/Draft/duplicate/Animation fixture를 수행한다.
- Full/Fast 후보와 Alpha 의미가 동일한지 확인한다.
- Preview/Export 출력과 기존 Preview Cache/Dirty/History 계약이 불변인지 확인한다.
- 변경 파일 ESLint, 관련 verification, `npm run build`, `git diff --check`를 수행한다.
- 정적 검증을 QA 통과로 기록하지 않는다.

Task 8 검토 결과:

- 동일 identity가 여러 selectable scene node로 분리되는 경우를 추가로 발견해 전부 blocked 처리했다.
- scale-zero 등 실제 선택 불가능한 degenerate node는 ambiguity 집계에서 제외한다.
- 비정상 DPR이 Glow backing size에 전파되지 않도록 1로 정규화했다.
- Hit 후 Glow 조회가 동일 Source Alpha entry를 재사용하며 build count가 증가하지 않음을 통합 fixture로 확인했다.
- Draft spatial 변화는 Source Alpha/scratch rebuild 없이 Projection redraw만 발생한다.
- Alpha/Direct Selection/Glow 및 기존 37개 verification, lint, build, diff check가 모두 통과했다.
- Preview/Export/Dirty/Node/Composition/Surface Cache/History/Animation/Project State 경계에는 변경이 없다.
- 위 결과는 정적 검증이며 브라우저 QA 통과를 의미하지 않는다.

### Task 9 — 문서 갱신

- 상태: 완료 / 감독관 검토 완료
- 실제 변경 파일과 책임에 맞게 `20_src_map.md`를 갱신한다.
- Task 진행마다 본 문서 상태를 갱신한다.
- Sprint 완료 시 다음 번호의 영구 기능 문서를 작성한다.
- 작업을 멈추는 시점에 루트 에이전트만 `99_recent_task.md`를 작성한다.

Task 9 검토 결과:

- `20_src_map.md`를 실제 Candidate/Alpha Provider/Hit/Glow/Preview Overlay 파일 책임과 신규 verification에 맞게 갱신했다.
- 영구 기능 문서 `48_canvas_visual_layer_selection.md`를 작성해 exact identity, safe block, 공통 Source Alpha/Projection, bounded cache, pointer 우선순위, Editor-only outer glow와 불변 경계를 기록했다.
- 정적 검증과 브라우저 QA 미실행 상태를 구분해 기록했다.
- 제품 코드와 `98_sprint_plan.md`, `99_recent_task.md`는 작업자가 수정하지 않았다.
- 감독관 대조 검토와 문서 `git diff --check`를 통과했다.

### Task 9.1 — Selection Visual과 Cursor 개선

- 상태: 완료 / 감독관 검토 완료
- 선택된 대상의 사각 polygon stroke/fill과 내부 대각선을 제거한다.
- Transform Handle, Anchor, Pivot, Motion Path와 Glow는 유지한다.
- 실제 Alpha Hit 가능한 Layer/Sub Composition 위에서는 `pointer` cursor를 표시한다.
- Position Drag 중에는 `grabbing` cursor를 표시한다.
- Pan과 Handle cursor 우선순위는 기존대로 유지한다.
- 공통 Candidate/Projection/Source Alpha Hit Test를 재사용하며 별도 hover mask/runtime/store를 만들지 않는다.
- 관련 정적 검증 후 문서와 최근 작업 보고를 갱신한다.

Task 9.1 검토 결과:

- 선택 사각 polygon의 fill/stroke, 내부 대각선과 전체 quad hit layer를 제거했다.
- Transform Handle과 연결선, Anchor/Pivot, Motion Path, Readout, silhouette Glow는 유지했다.
- viewport body가 기존 공통 Candidate/Projection/Source Alpha Hit Test를 사용해 hover 가능 여부와 press를 함께 판정한다.
- ready Alpha Hit는 `pointer`, Position Drag는 `grabbing`, Pan은 기존 `grab`/`grabbing` 우선순위를 사용한다.
- transparent/none/blocked/unavailable은 선택 가능 cursor를 표시하지 않는다.
- hover는 선택 Glow entry를 retain한 채 bounded provider를 재사용하고 별도 mask/runtime/store를 만들지 않는다.
- 관련 UI/Direct Selection fixture를 포함한 38개 verification, ESLint, build, diff check가 통과했다.
- `20_src_map.md`와 `48_canvas_visual_layer_selection.md`를 실제 UI/cursor 구조에 맞게 갱신했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.2 — Transform Drag Hover Lock과 Selection Glow Toggle

- 상태: 완료 / 감독관 검토 완료
- 모든 Transform Drag 중 direct-selection Alpha hover를 중단한다.
- Scale Drag 상태를 명시해 Hover와 Motion Path interaction lock에 포함한다.
- Preview 상단 Control에 `선택 강조` Toggle을 추가하고 기본값은 켜짐으로 유지한다.
- Toggle OFF에서는 Glow canvas를 clear하고 selected scratch를 폐기하며 이후 Glow draw를 중단한다.
- Canvas 직접 선택과 Alpha Hit Test는 Toggle과 무관하게 유지한다.
- Preview/Renderer/Export/Project/History/Animation 의미는 변경하지 않는다.
- 정적 검증 후 관련 문서와 최근 작업 보고를 갱신한다.

Task 9.2 검토 결과:

- Position/Scale/Rotation/Anchor/Opacity를 하나의 Transform Drag lock으로 묶어 direct-selection hover를 중단한다.
- 명시적 `isDraggingScale` 상태를 start/commit/cancel에 연결하고 Motion Path interaction lock에도 포함했다.
- Drag 시작 시 stale Alpha hover cursor를 즉시 해제한다.
- Preview toolbar에 기본 ON인 `선택 강조` Toggle을 추가했다.
- OFF에서는 Glow source 조회/draw를 중단하고 Provider 선택 entry와 source scratch를 해제하며 viewport backing canvas를 1×1로 축소한다.
- ON 복귀 시 현재 exact selected candidate와 공통 Source Alpha로 Glow를 다시 생성한다.
- OFF에서도 Canvas 직접 선택과 Alpha Hit/hover cursor는 유지된다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- `20_src_map.md`와 `48_canvas_visual_layer_selection.md`를 실제 구조에 맞게 갱신했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.3 — Canvas Sub Composition 더블클릭 진입

- 상태: 완료 / 감독관 검토 완료
- Canvas 직접 선택의 공통 Candidate/Projection/Source Alpha Hit 결과를 재사용한다.
- ready 상태의 immediate Sub Composition을 더블클릭한 경우에만 기존 Project `enterComposition()` 경계로 진입한다.
- 일반 Layer, 투명 픽셀, 빈 공간, blocked/ambiguous candidate는 컴포지션 진입을 수행하지 않는다.
- Handle/Anchor/Motion Path/Pan 우선순위와 단일클릭 Selection/Position Drag UX를 유지한다.
- 새 Engine, Store, Runtime, Project/History 필드를 추가하지 않는다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.3 검토 결과:

- Viewport body의 더블클릭도 단일클릭과 동일한 `hitCanvasDirectSelection()`의 Bounds → Quad → 공통 Source Alpha 결과를 사용한다.
- exact identity의 ready immediate Sub Composition에서만 candidate의 composition target id를 기존 Project `enterComposition()`에 전달한다.
- 일반 Layer, 투명 pixel, 빈 공간, blocked/ambiguous/unavailable candidate는 진입하지 않는다.
- 두 번째 `mousedown`은 `event.detail >= 2`에서 Position press를 시작하지 않아 뒤따르는 `dblclick`과 충돌하지 않는다.
- Handle/Anchor/Motion Path의 더블클릭은 propagation을 차단하고 Pan/Transform drag 상태에서는 body 진입을 보류한다.
- 새 Engine, Store, Runtime, Project/History 필드와 Preview/Export 변경은 없다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.4 — Radial Transform Handle Design

- 상태: 완료 / 감독관 검토 완료
- Anchor를 원형 조작계의 중심으로 사용하고 바깥 파란 ring을 Position handle로 변경한다.
- 동일한 screen-space 반지름에 H(위/초록), W(왼쪽/빨강), WH(오른쪽 아래/노랑), Rotation(오른쪽 위/주황), Opacity(왼쪽 아래/흰색)를 배치한다.
- 모든 바깥 handle은 Anchor까지 동일한 길이의 연결선을 사용한다.
- 기존 Scale direction, Hover 강조, cursor, Drag, 더블클릭 입력과 Draft/Commit/History 계약을 유지한다.
- Preview/Export 출력과 Project/Animation 의미는 변경하지 않는다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.4 검토 결과:

- 중앙 Anchor는 항상 식별 가능한 파란 점, Position은 Anchor를 둘러싼 34px 파란 ring으로 변경했다.
- W/H/WH는 각각 빨강/초록/노랑 바깥 방향 화살표이며 기존 `x`/`y`/`xy` Scale command에 그대로 연결된다.
- Rotation은 오른쪽 위 주황 hollow circle, Opacity는 왼쪽 아래 흰색 hollow circle로 표시한다.
- 다섯 outer handle은 Anchor에서 76px의 동일한 screen-space 반지름과 같은 길이의 connection line을 사용한다.
- 조작계 방향은 대상의 local axis를 따라 함께 회전하므로 회전된 Layer에서도 표시 방향과 기존 Scale projection이 일치한다.
- 고정 반지름 Opacity handle은 drag 시작 opacity와 pointer radial delta를 사용해 첫 move 값 점프를 방지했다.
- 기존 Hover 강조, cursor, Drag, 더블클릭 numeric input, Draft/Commit/History/Animation 계약을 유지했다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.5 — Radial Handle 간격과 선 두께 조정

- 상태: 완료 / 감독관 검토 완료
- outer handle과 Anchor의 screen-space 거리를 76px에서 38px로 줄인다.
- connection line과 Position/Rotation/Opacity 원형 외곽선 두께를 기존의 두 배로 조정한다.
- Anchor와 Scale 화살표 크기, 색상, Hover, cursor, Drag와 입력 계약은 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.5 검토 결과:

- radial outer handle 중심과 Anchor의 거리를 76px에서 38px로 줄였다.
- Scale connection line은 idle 2.4px, hover 3.2px로 조정했다.
- Rotation/Opacity connection line은 idle 2px, hover/drag 2.8px로 조정했다.
- Position ring과 Rotation/Opacity hollow circle 외곽선은 2px에서 4px로 조정했다.
- Anchor와 Scale 화살표 크기, 색상과 interaction wiring은 변경하지 않았다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.6 — Radial Handle 시각 크기와 연결선 보강

- 상태: 완료 / 감독관 검토 완료
- Position ring border는 유지하고 Scale/Rotation/Opacity connection line 두께를 현재 값의 두 배로 보강한다.
- Anchor, Position ring, Scale 화살표, Rotation/Opacity endpoint의 시각 크기와 hit area를 현재의 두 배로 확대한다.
- 중심 반지름 38px와 기존 Hover, cursor, Drag, 입력 계약은 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.6 검토 결과:

- Scale connection line은 idle 4.8px, hover 6.4px로 보강했다.
- Rotation/Opacity connection line은 idle 4px, hover/drag 5.6px로 보강하고 모든 line에 round cap을 적용했다.
- Position ring 지름은 68px, Anchor는 20px, Rotation/Opacity endpoint는 20px로 확대했다.
- Scale 화살표 hit area는 36px, 내부 glyph는 26px로 확대했다.
- 중심 반지름 38px와 기존 색상, Hover, cursor, Drag, 더블클릭 입력 계약은 유지했다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.7 — Task 9.6 시각 확대 원상복귀

- 상태: 완료 / 감독관 검토 완료
- 바로 직전 Task 9.6의 핸들 크기 확대와 connection line 추가 확대만 되돌린다.
- Task 9.5의 중심 거리 38px, 핸들 크기와 선 두께 상태로 정확히 복원한다.
- 기존 radial design, 색상, Hover, cursor와 interaction 계약은 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.7 검토 결과:

- Task 9.6에서 확대했던 핸들 크기와 connection line 두께만 Task 9.5 수치로 복원했다.
- 현재 중심 거리는 38px, Position ring은 34px, Anchor와 Rotation/Opacity endpoint는 10px다.
- Scale 화살표 hit area는 18px, 내부 glyph는 13px다.
- Scale connection line은 idle 2.4px/hover 3.2px, Rotation/Opacity는 idle 2px/hover·drag 2.8px다.
- Task 9.6에서 추가한 round cap을 제거했다.
- radial design, Opacity delta, Hover, cursor와 interaction wiring은 변경하지 않았다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.8 — Radial Handle 최종 수치 조정

- 상태: 완료 / 감독관 검토 완료
- W/H/WH/Rotation/Opacity 중심 거리를 Anchor에서 50px로 조정한다.
- Position ring은 15px로 줄이고 Anchor에서 positive local X 방향 25px에 배치한다.
- Anchor와 Rotation/Opacity endpoint는 15px, Scale 화살표 glyph는 15px로 조정한다.
- 기존 선 두께, 색상, Hover, cursor와 interaction 계약은 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.8 검토 결과:

- W/H/WH/Rotation/Opacity 중심 거리를 Anchor에서 50px로 조정했다.
- Position ring은 지름 15px이며 Anchor에서 positive local X 방향 25px에 배치했다.
- Anchor와 Rotation/Opacity endpoint는 15px, Scale 화살표 glyph는 15px로 조정했다.
- Position ring과 outer handle은 Layer local axis를 따라 함께 회전한다.
- Scale 화살표 hit area는 18px을 유지하고 connection line 두께도 Task 9.5 값을 유지했다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9 — Concentric Position Ring과 Line Arrow 교정

- 상태: 완료 / 감독관 검토 완료
- Position ring 중심을 Anchor와 일치시키고 반지름 25px, 지름 50px로 변경한다.
- W/H/WH의 filled arrow를 제거하고 connection shaft와 정확히 이어지는 SVG line arrow로 교체한다.
- outer 중심 거리 50px과 기존 색상, Hover, cursor와 interaction 계약은 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9 검토 결과:

- Position ring 중심을 Anchor와 정확히 일치시키고 반지름 25px, 지름 50px로 변경했다.
- W/H/WH의 CSS filled arrow를 제거하고 SVG shaft와 line-only arrowhead로 교체했다.
- shaft와 arrowhead는 동일 tip, 색상과 strokeWidth를 사용해 끊김 없이 연결된다.
- Arrowhead 폭은 15px, tip에서 wing 중심까지 길이는 12px이며 transparent 18px hit target은 유지했다.
- local axis 회전, Hover 강조, cursor, Drag와 더블클릭 입력 계약을 유지했다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9.1 — Radial Ring 외곽선 2px 조정

- 상태: 완료 / 감독관 검토 완료
- Position ring과 Rotation/Opacity hollow endpoint의 외곽선을 4px에서 2px로 줄인다.
- 크기, 위치, connection line과 기존 interaction 계약은 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9.1 검토 결과:

- Position ring과 Rotation/Opacity hollow endpoint 외곽선을 4px에서 2px로 줄였다.
- 크기, 위치, connection line, 색상과 interaction wiring은 변경하지 않았다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9.2 — Scale Arrow 단일 Path와 크기 조정

- 상태: 완료 / 감독관 검토 완료
- Scale shaft와 arrowhead를 하나의 SVG path로 합쳐 접합부의 반투명 중첩을 제거한다.
- Arrowhead 폭과 길이를 현재의 3분의 2로 줄이되 transparent hit target은 유지한다.
- 기존 Hover, cursor, Drag와 local-axis geometry 계약은 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9.2 검토 결과:

- W/H/WH 각각의 shaft와 arrowhead를 하나의 SVG path로 합쳐 별도 object의 alpha 중첩을 제거했다.
- shaft endpoint와 두 wing이 동일한 `handle.point` tip을 사용한다.
- Arrowhead wing span은 15px에서 10px, tip-to-wing 길이는 12px에서 8px로 줄였다.
- transparent 18px hit target과 기존 Hover, cursor, Drag, local-axis geometry는 유지했다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9.3 — 원형 핸들 및 Position Ring 크기 조정

- 상태: 완료 / 감독관 검토 완료
- Anchor, Rotation, Opacity 원형 핸들의 보이는 지름을 15px에서 10px로 줄인다.
- Position ring 반지름을 25px에서 20px로 줄이고 Anchor와 동일한 중심을 유지한다.
- Position ring 2px border, outer handle 중심 거리 50px, Scale arrow와 hit target을 유지한다.
- Draft/Commit/Runtime/History와 interaction wiring은 변경하지 않는다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9.3 검토 결과:

- Anchor, Rotation, Opacity 원형 핸들의 보이는 지름을 10px로 통일했다.
- Position ring을 반지름 20px, 지름 40px로 변경하고 중심은 Anchor와 일치시켰다.
- Position ring border 2px, outer 중심 거리 50px, Scale arrow와 18px hit target은 유지했다.
- interaction 및 계산 계층에는 변경이 없다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9.4 — Rotation/Opacity 연결선 접점 교정

- 상태: 완료 / 감독관 검토 완료
- Rotation과 Opacity 연결선이 hollow endpoint 원과 중복 합성되지 않도록 원의 바깥 경계에서 끝낸다.
- 두 핸들은 같은 endpoint geometry 계약을 사용하고 Layer local-axis 회전을 그대로 따른다.
- 원 지름 10px, border 2px, outer 중심 거리 50px와 interaction 계약은 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9.4 검토 결과:

- 공통 hollow endpoint geometry가 중심점과 별도의 `lineEnd`를 제공하도록 변경했다.
- 연결선은 endpoint 중심보다 5px 앞인 원의 바깥 경계, 즉 Anchor에서 45px 지점에서 종료된다.
- 기본축과 30도 회전축 fixture에서 중심↔접점 5px, Anchor↔접점 45px를 확인했다.
- Hover/Drag/cursor/hit area와 Draft/Commit/Runtime 동작은 변경하지 않았다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9.5 — 연결선 Position Ring 경계 시작

- 상태: 완료 / 감독관 검토 완료
- W/H/WH, Rotation, Opacity 연결선 시작점을 Anchor 중심에서 Position ring 바깥 경계로 옮긴다.
- 각 핸들의 outer 중심과 endpoint, 화살표 크기 및 조작 계약은 유지한다.
- 기본축과 회전된 local axis 모두 같은 반지름 계약을 사용한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9.5 검토 결과:

- 공통 Position ring 반지름 20px를 geometry 시작점 계산에 적용했다.
- W/H/WH Scale path와 Rotation/Opacity line은 각 local direction의 Anchor+20px 지점에서 시작한다.
- Scale tip 50px, Rotation/Opacity endpoint 중심 50px와 line end 45px는 유지했다.
- 기본축과 30도 회전축에서 다섯 연결선의 Anchor↔시작점 거리가 20px임을 확인했다.
- Hover/Drag/cursor/hit area와 Draft/Commit/Runtime 동작은 변경하지 않았다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9.6 — Scale Drag 상대 Baseline 교정

- 상태: 완료 / 감독관 검토 완료
- W/H/WH Scale drag는 PointerDown 위치를 현재 Scale의 100% 기준점으로 사용한다.
- 이후 PointerMove는 고정 world 반지름이 아니라 시작점 대비 상대 거리로 Scale을 계산한다.
- X/Y/XY 축 책임, 음수 Scale, Shift snap과 Draft/Commit/History 계약은 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9.6 검토 결과:

- 기존 고정 descriptor 반지름과 radial UI의 50px 반지름 불일치가 첫 이동 시 값이 튀는 원인이었다.
- Scale PointerDown의 client 좌표를 controller까지 전달하고 composition 좌표의 `startPointer`로 캡처했다.
- Scale factor는 local axis에 투영한 `currentDistance / startDistance`로 계산한다.
- 동일 좌표는 초기 Scale을 그대로 유지하고, 시작 거리의 2배/절반은 초기 Scale의 2배/절반이 된다.
- X/Y/XY, non-uniform 비율, 음수 Scale과 회전된 local axis fixture를 확인했다.
- Shift 10% snap, Draft/Commit/History transaction과 다른 Transform 동작은 변경하지 않았다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9.7 — Opacity Handle Radial Track

- 상태: 완료 / 감독관 검토 완료
- Opacity hollow handle의 위치가 현재 Opacity를 0~100% radial track으로 표시하도록 변경한다.
- 0%는 Position ring과 접하는 중심 반지름 25px, 100%는 기존 outer 중심 반지름 50px로 정의한다.
- PointerMove 거리와 Draft Opacity가 같은 geometry 계약을 사용해 원과 연결선이 실시간 이동해야 한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9.7 검토 결과:

- Opacity 중심 반지름을 `25 + clamp(opacity, 0, 100) / 100 * 25`로 계산한다.
- 0%/50%/100%에서 중심 반지름은 각각 25px/37.5px/50px다.
- 연결선은 ring 경계 20px에서 시작해 움직이는 원의 안쪽 경계에서 끝나며 0%에서는 길이가 0이 된다.
- Drag는 화면 좌표의 Anchor 거리로 `(radius - 25) / 25 * 100`을 계산하고 0~100으로 제한한다.
- 기존 draft-aware `currentOpacity`를 Gizmo ViewModel에 전달하여 PointerMove 중 원과 line end가 즉시 이동한다.
- Shift 10% snap, PointerMove Draft, PointerUp Commit과 History transaction은 유지했다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9.8 — Drag Cursor 숨김 및 Connection Line Hit

- 상태: 완료 / 감독관 검토 완료
- Transform handle을 드래그하는 동안 포인터 위치와 관계없이 cursor를 숨긴다.
- W/H/WH, Rotation, Opacity의 보이는 연결선 전체를 해당 handle과 동일한 조작 영역으로 만든다.
- visible stroke와 interaction stroke를 분리하고 Position ring 및 다른 Editor overlay의 우선순위를 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9.8 검토 결과:

- 기존 다섯 Transform drag flag 중 하나가 활성화되면 전역 cursor-none style을 설치하고 종료·취소·언마운트 cleanup에서 제거한다.
- Hover와 pending press 전에는 기존 handle별 cursor를 유지한다.
- 별도 Connection Hit Layer가 W/H/WH shaft, Rotation line, 동적 Opacity line에 12px transparent stroke hit 영역을 제공한다.
- 선의 Hover, MouseDown과 DoubleClick은 endpoint와 같은 command 및 cursor를 재사용한다.
- visible Backdrop은 pointer-events none과 기존 stroke를 유지하고 Controls는 hit layer 위에서 기존 우선순위를 유지한다.
- Opacity 0%처럼 길이가 0인 connection은 hit line을 렌더하지 않아 넓은 점 영역을 만들지 않는다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9.9 — Edge Drag Cursor Shield

- 상태: 완료 / 감독관 검토 완료
- 실제 Edge drag 중 커서가 남는 전역 CSS 방식의 한계를 제거한다.
- 다섯 Transform drag 상태에서만 최상위 투명 cursor shield를 사용하고 종료·취소 시 즉시 제거한다.
- 기존 window pointer tracker와 Draft/Commit/Cancel 계약은 유지한다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9.9 검토 결과:

- pointer-events none인 Preview Overlay의 동적 전역 style 방식은 제거했다.
- 실제 drag active 동안 `document.body` portal로 fixed/inset 0의 투명 cursor-none hit surface를 렌더한다.
- shield의 mousemove/mouseup은 기존 window listener로 bubble되어 기존 Transform transaction을 유지한다.
- drag 종료·취소·언마운트에는 조건부 portal이 즉시 제거되며 pending press와 Hover에는 생성되지 않는다.
- Anchor/Position/Scale/Rotation/Opacity 모두 같은 기존 drag flag 계약을 사용한다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 수정 후 실제 Edge 브라우저 QA는 아직 실행하지 않았다.

### Task 9.9.10 — Gizmo Readout 최상위 표시

- 상태: 완료 / 감독관 검토 완료
- W를 포함한 모든 Transform readout과 direct numeric input이 Anchor 및 다른 Gizmo visual보다 앞에 표시되도록 공통 paint order를 교정한다.
- 값 계산, 위치, 스타일, pointer event와 interaction 계약은 변경하지 않는다.
- 브라우저 QA는 실행하지 않고 관련 fixture와 정적 검증만 수행한다.

Task 9.9.10 검토 결과:

- 기존 Controls 순서 `Handles → Readouts → Anchor`에서 마지막 Anchor가 Scale readout을 덮는 원인을 확인했다.
- 공통 DOM paint 순서를 `Handles → Anchor → Readouts`로 변경했다.
- Position, Scale X/Y/XY, Rotation, Opacity readout과 direct input이 같은 최상위 표시 계약을 사용한다.
- Backdrop, connection hit layer와 Controls의 기존 상위 구조 및 interaction은 변경하지 않았다.
- 관련 38개 verification, ESLint, build, diff check가 통과했다.
- 수정 후 실제 Edge 브라우저 QA는 아직 실행하지 않았다.

### Task 10 — QA

- 상태: 사용자 요청 대기
- 사용자가 명시적으로 요청했을 때만 실제 브라우저 QA를 수행한다.
- QA 전에는 `구현 완료 / QA 대기`로만 기록하고 Sprint를 QA 통과로 종료하지 않는다.

## 정적 검증 기준

### 공통 Alpha와 Cache

- Hit Test와 Glow가 같은 Candidate/fingerprint의 동일 Source Alpha entry와 동일 Alpha threshold를 사용한다.
- Hit 가능 영역과 Glow pixel 영역이 일치한다.
- Source Alpha 재사용 시 build count는 증가하지 않고 reuse count만 증가한다.
- Bounds 탈락 후보의 mask access는 0이다.
- Bounds 통과/Quad 탈락 후보의 mask access는 0이다.
- Quad 통과 후보만 lazy Alpha access를 수행한다.
- 첫 Painter Hit 이후 아래 후보를 검사하지 않는다.
- Glow 생성 대상은 선택된 top-level 후보 1개이며 미선택 후보 Glow 생성은 0회다.

### Projection과 Draft

- Position만 바뀌면 Source Alpha를 재생성하지 않고 Projection만 변경된다.
- Scale/Rotation/Anchor/Transform Offset과 동일 Draft 변화도 Projection만 변경한다.
- Draft Transform 중 Glow, Hit Geometry, Layer, Selection과 Gizmo가 같은 위치를 사용한다.
- Zoom/Pan/Fit/1:1 변화도 Projection만 변경한다.

### Invalidation

- frame visual 변경 시 stale Source Alpha를 재사용하지 않는다.
- source bitmap/PSD refresh 변경 시 해당 entry를 무효화한다.
- Opacity/Visibility 변경 시 후보/Alpha 결과를 갱신한다.
- Sub Composition child visual/transform/order 변경 시 합성 Alpha를 무효화한다.
- Composition/source set 교체와 unmount에서 scratch surface를 폐기한다.

### Identity와 Geometry

- unambiguous candidate는 정확한 Timeline `itemId`를 선택한다.
- ambiguous duplicate/split/reorder는 잘못된 instance나 아래 Layer를 선택하지 않고 안전하게 보류한다.
- duplicate instance의 Projection과 Painter Order를 임의로 공유하지 않는다.
- Rotation, non-uniform/negative Scale, non-center Anchor와 Offset을 반영한다.
- 투명 hole/여백은 아래 후보로 통과한다.
- Layer와 immediate Sub Composition만 반환한다.

### Pointer와 기존 UX

- Handle/Anchor/Motion Path/Pan event에서 Selection은 변하지 않는다.
- 현재 선택 대상의 불투명 pixel down만 기존 Position Drag를 시작한다.
- 현재 선택 대상의 투명 pixel은 아래 후보 또는 empty clear로 진행한다.
- 다른 대상 첫 down은 Selection만 변경한다.
- Selection 변경은 History를 생성하지 않는다.

### 경계 보존

- Full/Fast Renderer Mode의 Candidate/Hit/Glow Alpha 의미가 같다.
- Glow/Selection 전후 Main Preview Canvas와 Export pixel fixture가 동일하다.
- 기존 Preview Bitmap/Node/Composition/Surface Cache와 Dirty Region metric/결과가 불변이다.
- Project Plain Data와 History snapshot 형식이 변하지 않는다.

## QA 계획

사용자가 명시적으로 요청하면 `layer_test.psd`를 사용해 다음을 확인한다.

- 실제 실루엣 Glow와 클릭 가능 영역 일치
- 투명 여백/구멍을 통한 아래 Layer 선택
- 겹친 불투명 pixel의 최상단 Painter 선택
- Layer와 immediate Sub Composition 선택
- Animated frame과 Opacity/Visibility 변화
- unambiguous duplicate instance selection과 ambiguous duplicate 안전 보류
- Position/Scale/Rotation/Anchor Draft 중 Glow 추종
- 다른 대상 첫 클릭은 이동 없음
- 현재 선택 visible pixel Drag 유지
- Handle/Anchor/Motion Path/Pan 우선순위
- 빈 Canvas Selection 해제
- Zoom/Pan/Fit/1:1
- Full/Fast Mode 동일
- Glow viewport edge clipping 없음
- Preview/Export 출력 영향 없음

## 절대 하지 말 것

- Hit Test와 Glow용 Alpha Mask를 따로 만들기
- Main Preview Canvas 또는 Export에 Glow 굽기
- Renderer Mode별 별도 선택 규칙
- 모든 Layer의 Glow/Projected Mask 선생성
- PointerMove마다 Source Alpha 재생성
- `sourceId`만으로 duplicate Timeline item 선택
- ambiguous duplicate를 임의 instance로 선택하거나 아래 후보로 관통
- Sub Composition 내부 Layer 관통 선택
- Selection 변경을 History에 저장
- 새 Selection Engine, 전역 Runtime, Store 또는 Project 필드 추가
- scratch cache를 기존 Preview/Composition/Surface Cache에 편입
- Preview Pipeline, Dirty Region 또는 Renderer 책임 변경
- Hover 선택, 다중 선택, Alt-click 순환 선택 추가

## 감독관 자기 평가 및 반영

최종 계획을 독립 설계 검토 기준으로 다시 평가하고 다음 문제를 문서 안에서 수정했다.

1. 공통 Mask의 의미가 모호했다.
   - 동일 생성 함수 수준이 아니라 동일 Source Alpha entry, Projection descriptor와 Alpha threshold를 Hit/Glow가 공유하도록 강화했다.
2. Geometry 변화가 Source Alpha를 재생성할 위험이 있었다.
   - Source-local Alpha와 Viewport Projection을 분리하고 모든 spatial/Draft/Viewport 변화를 projection-only로 고정했다.
3. scratch cache가 숨은 Runtime/Store가 될 수 있었다.
   - 기존 Canvas Selection 계산 경계 소유, active candidate bounded, on-demand, clear/dispose만 갖는 ephemeral resource로 제한했다.
4. duplicate source에서 Alpha 재사용과 Selection identity가 충돌했다.
   - 동일 visual source의 Alpha 재사용은 허용하되 `renderItemId/itemId` 기반 Candidate와 Projection은 instance별로 분리했다.
5. Animated/Sub Composition invalidation이 부족했다.
   - frame visual, Opacity/Visibility, ordered child visual/transform/order와 source replacement를 fingerprint와 검증 기준에 추가했다.
6. Selection polygon이 Alpha Hit를 우회할 수 있었다.
   - 기존 polygon body Drag도 공통 Alpha Hit를 통과하도록 Pointer 우선순위를 고정했다.
7. Task 순서가 구현 중심이었다.
   - Runtime/identity 조사 → 공통 계약 → Cache 설계 → 감독관 승인 후 Provider/Hit/Glow 구현 순서로 변경했다.
8. 기존 Cache 불변 문구와 scratch cache 허용이 충돌했다.
   - 불변 대상은 기존 Preview Bitmap/Node/Composition/Surface Cache라고 명시했다.

## Sprint 완료 조건

- Canvas의 보이는 픽셀을 클릭하면 identity가 유일한 현재 Composition의 정확한 최상단 Layer/Sub Composition이 선택된다.
- Hit Test와 Glow가 동일한 Source Alpha entry, Projection과 Alpha threshold를 사용한다.
- 투명 여백과 hole은 아래 Layer 선택을 막지 않는다.
- 선택된 top-level 대상 하나의 실제 실루엣에만 Editor-only Glow가 표시된다.
- Timeline, Properties, Selection Box, Handles와 Glow가 동일한 `itemId/sourceId/kind`를 표시한다.
- Position/Scale/Rotation/Anchor/Transform Offset Draft 중 Source Alpha를 재생성하지 않고 Projection만 갱신한다.
- frame/source/Opacity/Visibility/Sub Composition child visual 변화에는 stale Alpha를 재사용하지 않는다.
- Pointer 우선순위와 기존 선택 대상 Drag UX가 유지된다.
- Preview/Export/기존 Cache/Dirty Region/History 계약에 영향이 없다.
- 새 Engine, 전역 Runtime, Store, Project/History 필드가 없다.
- ambiguous duplicate/split/reorder는 잘못된 Canvas Selection/Glow를 만들지 않으며 기존 Timeline 선택 경로를 유지한다.
- 정적 검증 완료 뒤에도 실제 QA 전에는 `구현 완료 / QA 대기`로 기록한다.

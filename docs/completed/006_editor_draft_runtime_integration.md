# Editor Draft Runtime Integration

> 문서 번호: 45
> 상태: Sprint 완료
> 완료일: 2026-07-19
> 목적: 드래그 중 Editor UI가 Project Commit 이전의 동일한 Draft Transform을 참조하도록 만든 구조와 QA 결과를 기록한다.

## 1. Sprint 목표

이번 Sprint의 목표는 Handle이나 Selection만 개별적으로 보정하는 것이 아니라, 드래그 중 Layer와 Editor Overlay가 동일한 Draft Transform을 사용하도록 통합하는 것이었다.

```text
PointerMove
  → Draft Transform Snapshot
     ├─ Preview Scene Layer
     ├─ Selection Box / Outline
     ├─ Transform Handle
     ├─ Anchor / Pivot
     └─ Motion Path Full Geometry

PointerUp
  → Project Commit
  → Draft Runtime 초기화
```

Project Plain Data는 PointerMove마다 갱신하지 않는다. PointerMove는 Preview Runtime만 갱신하고 PointerUp에서 한 번만 Project에 반영한다.

## 2. 발견된 QA 결함

초기 통합 후 Layer, Selection Box, Selection Outline과 Transform Handle은 실시간으로 이동했지만 Anchor/Pivot 표시는 이전 Project 기반 위치에 남는 문제가 확인되었다.

원인은 Layer 렌더와 Overlay가 Draft 상태를 찾는 기준이 달랐기 때문이다.

- Layer는 Preview Scene의 Draft Transform을 사용했다.
- Overlay는 Project에서 만든 Selection Overlay와 Draft Snapshot의 일치 여부에 의존했다.
- Project Overlay가 stale 또는 null이면 Anchor/Pivot이 Draft Snapshot geometry 대신 Project fallback을 사용할 수 있었다.

Pivot은 별도 위치 모델이 아니라 현재 Anchor의 world position을 사용하는 표시이므로 Anchor와 같은 원인으로 움직이지 않았다.

## 3. 해결 구조

새 Runtime이나 예외 처리를 추가하지 않고 기존 `DraftTransformSnapshot`을 선택 대상 기준으로 해석하도록 수정했다.

- 선택된 Layer/Composition과 Draft Snapshot의 target을 직접 비교한다.
- target이 일치하면 `DraftTransformSnapshot.geometry`로 Selection Overlay를 만든다.
- Selection Box, Selection Outline, Transform Handle, Anchor/Pivot은 같은 geometry에서 파생된다.
- Motion Path 전체 geometry는 target/item/local frame이 일치하고 Position, Anchor 또는 Transform Offset이 변경된 기존 `DraftTransformSnapshot` 객체 자체를 입력받는다. Position Draft는 기존 Position Commit 의미로 다시 평가하고, Anchor/Transform Offset Draft는 공통 geometry 입력으로 사용한다.
- Current/Keyframe/Sample point, 모든 polyline vertex와 point 좌표를 공유하는 hover/hit/readout은 같은 `PreviewMotionPathPoint[]`를 사용한다.
- opacity, rotation, scale 같은 Overlay Runtime 값도 동일한 target 기준 Draft Snapshot을 우선한다.
- Draft가 없거나 target이 다를 때만 기존 Project Overlay를 사용한다.

주요 변경 위치:

- `src/engines/canvas/helpers/draftTransformRuntimeHelpers.ts`
- `src/engines/canvas/controllers/useCanvasSelectionController.ts`
- `src/engines/canvas/helpers/canvasGizmoHelpers.ts`
- `src/engines/canvas/useCanvasEngine.ts`

### Motion Path Full Draft Geometry 통합

Motion Path Controller는 선택 target, 대응 Timeline item과 local frame이 모두 일치하며 Position, Anchor 또는 Transform Offset Draft가 활성화된 경우 기존 `DraftTransformSnapshot` 객체 자체를 geometry 생성부에 전달한다. 별도 Motion Path Draft 객체나 projection type은 만들지 않는다. Geometry helper는 Position 변경일 때만 Snapshot의 `position`과 `localFrame`을 기존 base/keyframe 평가 입력에 적용하고, Snapshot의 `anchor`와 `transformOffset`은 모든 sample이 공유하는 Transform Geometry 입력으로 사용한다.

```text
Project Position / Keyframes
  + scoped DraftTransformSnapshot.position
  + scoped DraftTransformSnapshot.anchor / transformOffset
  → Static: Draft Position을 임시 base position으로 적용
  → Animated: Draft Position을 임시 base와 current local-frame keyframe에 적용
  → Animation Evaluation / Modifier / Transform Geometry
  → 공통 PreviewMotionPathPoint[]
     ├─ Polyline
     ├─ Current / Keyframe / Sample Point
     └─ Hover / Hit Target / Readout
```

Animated Position Commit이 base position도 갱신하고 current local-frame keyframe을 upsert하는 기존 `applyPositionToCompositions` 의미를 그대로 재사용한다. Static은 keyframe 배열을 바꾸지 않고 base position만 Draft 값으로 평가한다. Anchor Drag에서는 Project Position/Keyframe 평가를 유지하면서 Snapshot의 `anchor`와 보정된 `transformOffset`으로 전체 Motion Path Geometry를 계산한다. Draft가 없거나 scope가 맞지 않으면 같은 공통 geometry 입력 선택에서 기존 Project/Animation 결과로 fallback한다.

`buildPreviewOverlayViewModel`은 더 이상 Current Point를 Selection Overlay anchor로 치환하지 않는다. 모든 View 요소는 upstream에서 완성된 공통 geometry를 viewport 좌표로 투영할 뿐이며 `isDraggingPosition`, Current Point 숨김 또는 point별 Draft 예외는 없다. Motion Path keyframe drag transaction, Animation/Timeline/History, Renderer와 Preview Pipeline은 변경하지 않았다.

이 후속 통합에서는 변경 파일 ESLint, production build와 `git diff --check`만 수행한다. 브라우저/실제 조작 QA, `npm run qa`와 전체 verification은 수행하지 않으며 정적 검증 결과를 QA 통과로 기록하지 않는다.

## 4. QA 결과

### 실제 Runtime QA

Microsoft Edge에서 `drag_test.psd`를 불러와 이동 드래그를 확인했다.

- Layer 실시간 이동 정상
- Selection Box / Outline 실시간 이동 정상
- Transform Handle 실시간 이동 정상
- Anchor / Pivot 실시간 이동 정상
- Anchor/Pivot과 Handle의 PointerMove 이동량 일치
- PointerUp 후 Project Commit 결과 유지

### 자동 Regression QA

`npm run qa`가 성공했다.

- ESLint 통과
- Verification Suite 33개 통과
- TypeScript build 통과
- Vite production build 통과
- Dirty Cache 검증 통과
- Preview Cache Runtime 검증 통과
- Preview Performance QA 검증 통과
- Preview Memory 및 Runtime Stress 검증 통과
- Canvas Drag Performance 검증 통과

Canvas Drag Performance 결과:

```text
PointerMove       102회
Preview Update      2회
Project Update      1회
Preview Build       1회
```

PointerMove마다 Project를 갱신하지 않고 Preview Runtime을 사용한다는 기존 최적화 원칙이 유지되었다.

### Anchor PointerMove Runtime 원인 조사

2026-07-19에는 Canvas Anchor drag 중 Anchor Handle이 PointerUp까지 이전 위치에 남는다는 제보를 별도 Runtime 원인 조사로 확인했다. 이는 QA 통과 판정과 구분한다.

CDP로 PointerMove 도중의 상태와 실제 paint를 관찰한 결과, `DraftTransformSnapshot.geometry.anchorWorld` → Selection Overlay → Gizmo ViewModel → Anchor DOM `left`/`top`과 Gizmo line origin이 같은 move에서 갱신됐다. 화면의 이전 mousedown 위치에 남아 보이던 청록색 원은 제품 Anchor DOM이 아니라 자동 입력 도구의 cursor marker였다. 실제 Anchor DOM과 paint는 새 위치에 있었고 PointerUp 전에도 이동했다.

따라서 이 조사에서는 제품 결함을 재현하지 못했으며, 제품 코드 수정이 필요하지 않았다. 조사로 인한 제품 코드·구조·API 변경도 없다.

## 5. Sprint 완료 상태

드래그 중 다음 요소가 동일한 Draft Transform을 사용한다.

- Layer
- Selection Box
- Selection Outline
- Transform Handle
- Anchor
- Pivot
- Motion Path Current/Keyframe/Sample Point와 전체 Polyline Geometry

Properties에 Anchor Point를 추가하거나 새로운 UI, Transform 데이터 구조, Runtime을 만들지 않았다. 이번 Sprint는 기존 Editor Draft Runtime의 QA 결함 수정 범위에서 종료했다.

# Transform Origin Editing

> 문서 번호: 46
> 상태: Sprint 완료
> 완료일: 2026-07-19
> 목적: Properties와 Canvas가 같은 Editor Draft Runtime으로 Anchor Point를 양방향 편집하는 구조와 QA 결과를 기록한다.

## 1. 기능 목표

Properties에 Anchor X/Y 입력을 추가하고 Canvas Anchor Handle과 동일한 Transform Origin을 편집하도록 연결했다.

```text
Properties Anchor X/Y
  ↕
Editor Draft Transform Snapshot
  ↕
Canvas Anchor / Pivot / Handles
```

두 입력 표면은 별도 Anchor state를 갖지 않는다. 편집 중 의미 값은 기존 `DraftTransformSnapshot` 하나가 소유하고, 완료 시 기존 `applyAnchor` command로 Project에 반영한다.

## 2. Transform Origin 정의

Anchor X/Y는 선택 Layer bitmap 또는 Sub Composition logical frame의 좌상단을 `{0, 0}`으로 하는 source-local pixel 좌표다.

- X는 오른쪽 방향이다.
- Y는 아래쪽 방향이다.
- 입력 범위는 source width/height 안으로 clamp한다.
- Pivot은 별도 Project 저장값이 아니라 현재 Transform geometry의 `anchorWorld`다.
- Master Composition은 기존 정책대로 Anchor 편집 대상에서 제외한다.
- Anchor는 AnimatableProperty나 keyframe track에 추가하지 않았다.

Anchor가 바뀔 때 대상의 화면 위치가 튀지 않도록 기존 `getCompensatedTransformOffset()` 규칙으로 `transformOffset`을 함께 보정한다.

## 3. Properties UI

Properties Transform 영역의 첫 행에 `기준`을 표시한다. 표시 순서는 `기준 → 위치 → 크기 → 회전 → 투명`이다.

- Anchor X 숫자 입력
- Anchor Y 숫자 입력
- 기존 Properties 숫자 입력의 focus/change/blur/Enter/Escape 패턴 재사용
- 모든 Transform 행이 공통 Transform Row presentation을 사용해 높이, 여백, label, X/Y 입력, 숫자 입력 상태, 글꼴, 색상, 간격과 정렬을 공유
- Layer와 Sub Composition에서 편집 가능
- Master와 편집 대상 없음은 read-only
- track checkbox와 keyframe UI 없음

View는 Project를 직접 수정하지 않고 Properties Engine command만 호출한다.

## 4. Properties → Canvas

Properties의 raw 문자열과 의미 있는 Transform Draft를 분리했다.

```text
focus
  → History begin
  → 초기 Anchor 보관

change
  → raw 문자열 draft 저장
  → 유효 숫자만 local Anchor command로 변환
  → source bounds clamp
  → transformOffset 보정
  → DraftTransformSnapshot 갱신
  → Preview Scene 갱신

blur / Enter
  → 최종 ApplyAnchorCommand 계산
  → Project applyAnchor 1회
  → History dirty
  → Draft/Preview reset
  → History commit 1회
```

빈 문자열, `-`, `.` 같은 intermediate 값은 입력 중 raw draft로 유지하지만 semantic Draft Runtime이나 Project를 변경하지 않는다.

## 5. Canvas → Properties

Canvas Anchor drag도 Properties와 같은 local-anchor 보정 helper를 사용한다.

```text
PointerMove
  → world pointer를 source-local Anchor로 변환
  → source bounds clamp
  → transformOffset 보정
  → shared DraftTransformSnapshot
  → Canvas Preview와 Properties X/Y 동시 갱신

PointerUp
  → applyAnchor 1회
  → History commit 1회
  → Draft reset 후 Project 값으로 fallback
```

Properties는 Root가 현재 target kind/id와 local frame을 검증해 전달한 plain Anchor draft 값만 읽는다. target이나 frame이 다르면 Project Anchor를 사용한다.

Properties Engine이 Canvas Engine 타입이나 helper를 직접 import하지 않도록 Composition Root가 shared Snapshot을 plain read value로 투영한다. Engine Import Boundary 검증으로 이 경계를 고정했다.

Motion Path는 별도 state, Runtime, Draft 객체나 projection type을 만들지 않고 target/item/frame scope가 일치하며 Position, Anchor 또는 Transform Offset이 변경된 기존 `DraftTransformSnapshot` 객체 자체 또는 `null`을 전체 sample 생성부에 전달한다. Static Position 편집은 `snapshot.position`을 임시 base position으로, Animated Position 편집은 기존 Commit과 동일하게 임시 base position과 `snapshot.localFrame` keyframe에 적용한다. Anchor 편집은 Project Position/Keyframe 평가를 유지하면서 `snapshot.anchor`와 보정된 `snapshot.transformOffset`을 모든 sample의 공통 Transform Geometry에 적용한다. Current/Keyframe/Sample point와 모든 polyline vertex는 같은 `PreviewMotionPathPoint[]`를 소비하며, Snapshot이 reset되거나 scope가 맞지 않으면 기존 Project/Animation geometry로 fallback한다.

### Motion Path Current Point Anchor Draft 회귀 수정

Anchor Drag 중 실제 `PreviewAnchorControl`은 `DraftTransformSnapshot.geometry.anchorWorld`를 사용했지만 Motion Path Controller가 `changed.position`만 허용해 Current Frame Point는 Project Anchor에 남는 불일치가 있었다. Controller의 Snapshot 수용 범위를 Position, Anchor, Transform Offset으로 확장하고, Motion Path 공통 Geometry가 Snapshot의 `anchor/transformOffset`을 사용하도록 수정했다. Current Point만 치환하거나 숨기는 예외는 추가하지 않았으며, Snapshot reset 뒤에는 별도 처리 없이 Project 값으로 복귀한다.

### PointerMove Runtime 원인 조사

2026-07-19 CDP Runtime 관찰에서 초기 Properties 기준값 `X=540, Y=960`, Anchor DOM `left=590px, top=363px`, Gizmo line origin `(590, 363)`을 확인했다. 같은 drag의 PointerMove 중에는 각각 `X=587.603305785124, Y=983.8016528925621`, `left=608px, top=372px`, line origin `(608, 372)`로, 다음 move에서는 `X=651.0743801652893, Y=1015.5371900826447`, `left=632px, top=384px`, line origin `(632, 384)`로 함께 갱신됐다. Properties 값은 source-local 좌표이고 DOM/Gizmo 값은 Preview CSS 좌표이므로 수치 체계는 다르지만 동일한 Draft geometry를 반영한다.

이 결과는 QA 통과 기록이 아니라 제보에 대한 Runtime 원인 조사다. PointerMove 중 Properties 기준 X/Y, Anchor DOM 위치와 Gizmo line이 동기화됐고, 이전 위치의 청록색 원은 자동 입력 도구의 cursor marker로 확인되어 제품 코드 수정은 불필요했다. 조사로 인한 제품 코드·구조·API 변경은 없다.

## 6. Cancel과 History

다음 상황에서는 Project mutation 없이 Draft를 폐기한다.

- Escape
- invalid/intermediate final value
- 실제 Anchor 의미 값 변화 없음
- selection 변경
- frame 변경
- pointer cancel

Undo/Redo restore는 다음 runtime 값을 함께 초기화한다.

- shared DraftTransformSnapshot
- Properties raw numeric draft
- Properties draft scope와 focus
- Preview Transform draft

History에는 Project Plain Data만 저장하며 Draft Runtime은 포함하지 않는다. Anchor와 transformOffset은 같은 Project mutation으로 Undo/Redo된다.

## 7. 주요 구현 위치

- `src/features/properties/components/PropertiesTransformRow.tsx`
- `src/features/properties/components/PropertiesTransformOriginRow.tsx`
- `src/engines/properties/models/propertiesEngineModel.ts`
- `src/engines/properties/controllers/usePropertiesNumericInputController.ts`
- `src/engines/properties/controllers/usePropertiesPropertyViewController.ts`
- `src/engines/canvas/helpers/draftTransformRuntimeHelpers.ts`
- `src/engines/canvas/controllers/useCanvasAnchorTransformController.ts`
- `src/engines/canvas/composers/useCanvasTransformComposer.ts`
- `src/editor/state/useEditorSessionState.ts`
- `src/editor/useEditorCompositionRoot.ts`
- `src/engines/project/history/projectHistorySnapshot.ts`

## 8. QA 결과

Microsoft Edge 150에서 `drag_test.psd`를 사용했다.

- 초기 Anchor X=540, Y=960 확인
- Properties X `540 → 600` 입력 중 Canvas Pivot/Handle 즉시 이동
- Enter 후 X=600 유지
- Canvas Anchor drag 중 Properties X/Y 실시간 갱신
- PointerUp 후 최종값 유지
- Undo 1회와 Redo 1회 정상
- Escape 취소 시 Project와 Canvas 원복
- X=9999 입력은 Draft와 Commit 모두 X=1080으로 clamp
- Position, Scale, Rotation, Opacity와 Layer drag 회귀 없음

자동 QA:

- `npm run qa` 통과
- ESLint 통과
- Verification Suite 33개 통과
- Engine Import Boundary 통과
- TypeScript/Vite production build 통과
- Canvas Drag Performance 검증 통과
- `git diff --check` 통과

### Properties Transform UI Presentation QA

Properties Transform 표시를 `기준 → 위치 → 크기 → 회전 → 투명`으로 통일한 뒤 사용자 요청에 따라 다시 QA했다.

- 전체 `npm run qa`와 Verification Suite 33개 통과
- 기존 창과 분리된 Microsoft Edge 새 창에서 `drag_test.psd` import 통과
- 기준 행의 최상단 배치, 명칭과 checkbox 미표시 정책 통과
- 일반 Transform 행 checkbox 유지와 공통 Row 시각적 일관성 통과
- 기준 X Enter commit과 Escape cancel 통과
- Properties 기준 변경 시 Canvas pivot 반영 통과
- Canvas Anchor drag 시 Properties X/Y 실시간 반영 통과
- `git diff --check` 통과

기능 오류는 발견되지 않았다. Node experimental loader와 기존 Vite 500 kB 초과 chunk 경고만 확인했다.

## 9. Sprint 완료 상태

Properties Anchor X/Y와 Canvas Anchor Handle은 동일한 Editor Draft Runtime 위에서 양방향 동기화된다.

PointerMove와 숫자 입력 중에는 Project를 반복 변경하지 않는다. 편집 완료 시 Anchor와 transformOffset을 한 번만 Commit하며, 한 편집 동작이 Undo 한 번으로 되돌아간다.

Anchor 전용 Runtime, 새 Transform 데이터 구조, View의 Project 직접 수정, 대상별 예외 처리는 추가하지 않았다.

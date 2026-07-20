# Current Sprint Plan

> 문서 번호: 98
> 이 문서는 현재 진행 중인 Sprint 하나의 계획과 진행 상태만 담습니다.

## Sprint

- 이름: Layer Separation Position Drag QA
- 유형: Post-Sprint 회귀 QA 및 원인 확정
- 목표: `layer_test.psd`에서 Position Drag 중 레이어 표시 누락을 Bounds 기준으로 실제 재현하고, 원인을 확정한 경우에만 최소 수정한다.

## 진행 상태

### Task 1 — 깨끗한 Edge 재현 환경 및 Bounds 계측 구성

- 상태: 완료
- Microsoft Edge를 새로고침하고 프로젝트 루트의 `layer_test.psd`만 다시 불러왔다.
- Renderer Mode를 `fast-render`(`작업용`)로 설정했다.
- 실제 Draw Plan이 사용하는 AABB, Dirty Bounds, `shouldDrawNodeForDirtyBounds()`, redraw 대상과 Layer 간 Bounds 교차 여부를 기록하는 임시 Probe를 사용했다.

### Task 2 — Bounds 교차/분리 PointerMove QA

- 상태: 완료 / 제보 증상 미재현
- `layer_test.psd > 아빠 > 입`에서 작은 Layer와 큰 Layer를 각각 선택해 확인했다.
- 같은 Position Drag 안에서 `Bounds 교차 → 완전 분리 → 교차 → 완전 분리`를 반복했다.
- 이미지 픽셀의 겹침 여부가 아니라 실제 Layer AABB 교차 결과만 판정 기준으로 사용했다.

작은 `입` Layer:

- 교차 AABB: `{ left: 2250, top: 2062, right: 2390, bottom: 2145 }`
- 분리 AABB: `{ left: 955, top: 985, right: 1095, bottom: 1068 }`
- 분리 시 다른 Layer와의 교차: 0건
- 분리 시 `shouldDraw=true`, scheduled/actual redraw 대상 포함
- 분리 상태 Canvas alpha pixel: `7651`

큰 `아빠` Layer:

- 교차 AABB: `{ left: 1409, top: 1469, right: 2407, bottom: 3979 }`
- 분리 AABB: `{ left: 1411, top: 1469, right: 2409, bottom: 3979 }`
- 상대 Layer의 오른쪽 경계 `1411`과 정확히 맞닿아 교차가 1건에서 0건으로 바뀌는 1px 경계를 왕복했다.
- 경계 양쪽에서 `shouldDraw=true`와 redraw 대상 포함 상태가 유지됐다.
- 완전 분리 상태 Canvas alpha pixel: `1922784`

### Task 3 — PointerUp 전후 비교

- 상태: 완료
- 완전 분리 상태의 PointerUp 전 Canvas alpha pixel: `1922784`
- PointerUp 후 동일 Bounds의 Canvas alpha pixel: `1922784`
- PointerMove 중 사라졌다가 Commit 후 복구되는 변화가 없었다.

### Task 4 — 원인 확정 및 수정

- 상태: 완료
- 이전 QA는 이동 중인 선택 Layer가 Draw 대상에서 빠지는지만 확인했다. 사용자 스크린샷을 다시 분석한 결과, 실제로 사라지는 대상은 Dirty Bounds와 더 이상 교차하지 않는 다른 앞쪽 Layer일 가능성이 높다.
- Dirty 경로는 Dirty Bounds만 clear하지만, 교차 Node는 Dirty clip 없이 전체 크기로 draw한다.
- 큰 뒤쪽 Node가 전체 redraw되면서 Dirty 밖에 retained된 앞쪽 Layer pixel을 덮을 수 있다.
- 해당 앞쪽 Layer는 Dirty Bounds와 교차하지 않으면 `shouldDraw=false`라 복구되지 않는다.
- 일반 Layer transform은 dirty mode를 사용하지만 Composition transform 변경은 `hasCompositionRenderStateChange()` 때문에 full draw를 사용한다. Composition에서는 증상이 없다는 관찰과 일치한다.
- dirty branch의 redraw 동안 logical Dirty Bounds clip을 적용했다.
- 기존 `shouldDrawNodeForDirtyBounds()` 대상 집합과 painter order는 유지했다.
- Full/skip 경로, Draw Plan, Dirty Bounds 계산, Cache, Runtime 구조는 변경하지 않았다.
- 별도로 확인된 Anchor AABB 결함은 이번 수정에 포함하지 않았다.

### Task 5 — 계측 제거 및 정적 검증

- 상태: 완료
- 임시 Bounds QA Probe를 전부 제거했다.
- Dirty 밖 retained 앞쪽 Layer pixel 보존 회귀 fixture: 통과
- Bounds overlap/separation 연속 이동 회귀 fixture: 통과
- Composition transform full draw 유지 검증: 통과
- 변경 파일 ESLint: 통과
- 전체 `npm test`: 33개 verification 통과
- `npm run build`: 통과
- `git diff --check`: 통과
- 브라우저 QA: 사용자 요청이 없어 미실행

### Task 6 — Dirty Clip 적용 후 Position Drag 잔상 분석

- 상태: 완료
- 사용자 QA에서 non-center Anchor를 가진 일반 Layer를 이동할 때 이전 윤곽이 반복 arc와 수평선으로 누적되는 새 증상이 확인됐다.
- Renderer와 Selection은 source 네 모서리를 Anchor 기준으로 실제 transform하지만, `getPreviewNodeBounds()`는 `origin + anchor`를 AABB 중심으로 사용하는 pivot-centered 근사다.
- Anchor가 source 중앙이 아니면 실제 raster AABB와 Dirty AABB가 달라진다.
- 스크린샷에서는 파란 Anchor가 Selection 중심보다 왼쪽에 있어 실제 오른쪽 contour가 Dirty clear/clip 범위 밖으로 빠지는 조건이 확인된다.
- 직전 Dirty clip 수정은 정상 retained pixel을 보호했지만, 잘못된 AABB 때문에 Dirty 밖으로 오판된 이전 pixel도 보호해 기존 Bounds 결함을 잔상으로 드러냈다.
- `clearDirtyBounds()`의 device-pixel right/bottom rounding 부족도 별도 보조 결함으로 확인됐다.
- Playback Render 내부에 실제 Renderer transform과 동일한 `getRenderTransformBounds()`를 추가했다.
- `getPreviewNodeBounds()`가 Position, Transform Offset, non-center Anchor, 비균일/음수 Scale, Rotation을 반영한 four-corner AABB를 사용하도록 변경했다.
- `clearDirtyBounds()`를 `floor(left/top)`과 `ceil(right/bottom)` pixel edge 방식으로 수정했다.
- 기존 Dirty clip, `shouldDraw` 집합, painter order, Draw Plan, Cache/Runtime, Full/skip 경로는 유지했다.
- non-center Anchor 연속 왕복 이동, Scale/Rotation Geometry, 축소 pixelScale rounding 회귀 검증을 추가했다.

### Task 7 — Anchor Drag 중 정지 원 조사

- 상태: 조사 완료 / 제품 수정 없음
- Anchor Drag는 PointerMove마다 `anchor`와 보정된 `transformOffset`을 동일한 `DraftTransformSnapshot`으로 갱신한다.
- Selection Overlay와 실제 `PreviewAnchorControl`은 이 Snapshot의 `geometry.anchorWorld`를 소비하므로 코드상 Anchor Handle 갱신 경로는 끊기지 않는다.
- 반면 Motion Path Controller는 `snapshot.draft.changed.position`인 경우에만 Draft Snapshot을 전달한다. Anchor Drag에서는 이 조건이 false라 Motion Path가 Project 경로로 복귀한다.
- Motion Path Geometry도 `layer.anchor`와 `layer.transformOffset` 또는 Composition의 Project 값을 직접 사용한다. 따라서 Current Frame Point는 PointerUp Commit 전까지 이전 위치에 남는다.
- 화면에서 Anchor Handle과 겹쳐 보이던 Motion Path Current Frame Point가 Anchor Drag 때 분리되어 정지한 원으로 보이는 것이 현재 증상과 일치한다.
- 실제 Anchor Handle DOM과 Motion Path Current Frame Point의 시각 구분은 브라우저 QA를 실행하지 않아 검증하지 않았다.
- 최소 수정 경계는 Motion Path의 Draft Snapshot 수용 조건과 공통 Geometry 입력부다. Anchor 전용 UI 예외가 아니라 현재 프레임 Geometry가 동일한 Snapshot의 `anchor/transformOffset`을 소비하도록 해야 한다.

### Task 8 — Motion Path Anchor Draft 통합 수정

- 상태: 구현 및 정적 검증 완료 / 브라우저 QA 미실행
- Motion Path Controller가 target/item/local frame이 일치하는 Position, Anchor, Transform Offset Draft Snapshot을 공통 Geometry에 전달하도록 수정했다.
- Position 샘플 평가는 `changed.position`일 때만 기존 Draft Position을 사용하므로 Position Drag와 Animation 의미를 유지한다.
- 모든 Motion Path Point와 Polyline이 공유하는 Geometry는 Snapshot의 `anchor`와 `transformOffset`을 사용한다.
- Anchor Drag 중 Current Frame Point를 포함한 Motion Path 전체가 Commit을 기다리지 않고 같은 Draft Transform을 소비한다.
- PointerUp 후 Snapshot reset으로 기존 Project 값에 자연스럽게 복귀한다.
- 새 Runtime, State, Store, Draft, point별 예외 또는 숨김 처리는 추가하지 않았다.
- Motion Path Anchor Draft 결과와 동일 값을 Commit한 결과가 같은지 확인하는 회귀 fixture를 추가했다.
- Targeted Canvas Preview Integration verification, 변경 파일 ESLint, production build와 `git diff --check`가 통과했다.
- 브라우저 QA는 사용자 요청이 없어 실행하지 않았다.

## 다음 진행 조건

사용자가 요청하면 실제 Edge에서 Anchor Drag 중 `PreviewAnchorControl`과 Motion Path Current Frame Point가 PointerMove 동안 함께 움직이는지 확인한다.

## 현재 완료 판단

- Bounds 기준 QA: 완료
- Bounds 교차/분리 반복 및 1px 경계 확인: 완료
- 이전 QA의 선택 Layer 누락 가설: 기각
- 사용자 스크린샷 기반 collateral Layer 소실 구조 분석: 완료
- 구조적 원인: Dirty clip 부재로 확정
- 제품 수정: 완료
- 정적/회귀 검증: 완료
- 사용자 브라우저 QA: 기존 Layer 소실 문제 해결 확인
- 새 잔상 회귀 원인 분석: 완료
- 새 잔상 회귀 수정: 완료
- Anchor Drag 정지 원 정적 원인 조사: 완료
- Anchor Handle Draft 경로 단절: 발견되지 않음
- Motion Path Current Frame Point의 Anchor Draft 미소비: 코드상 확인
- Motion Path Anchor/Transform Offset Draft 통합 수정: 완료
- Anchor Draft 회귀 fixture 및 정적 검증: 통과
- 전체 `npm test`: 34개 verification 통과
- `npm run build`: 통과
- 브라우저 QA: 미실행
- Sprint 종료: 실제 QA 요청 전까지 구현 완료 상태

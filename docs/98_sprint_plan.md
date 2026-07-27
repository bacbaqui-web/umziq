# Naming & Responsibility Alignment Sprint

## 상태

- Task 0 PASS — Manifest와 caller/export 범위 확정
- Task 1 PASS — Selection Highlight 책임 명칭 정렬
- Task 2 PASS — Canvas Viewport Runtime 명칭 정렬
- Task 3 PASS — Canvas Engine 공개 이름 정렬
- Task 4 PASS — 미사용 Cutover 계약 제거
- Task 5 PASS — Animation compatibility 제거
- Task 6 PASS — 현재 문서 동기화
- Task 7 PASS — Old Name Audit
- Task 8 PASS — 최종 Build / Verification
- Sprint 완료
- Old Name Audit PASS
- Verification 41/41 PASS
- Build PASS
- Browser QA 미실행

## 기준

- `docs/00_rule.md`
- `docs/20_src_map.md`
- Naming & Responsibility Audit

## Sprint 목적

Architecture와 제품 동작을 유지하면서 실제 책임과 충돌하는 이름 및
미사용 compatibility 경계만 정리한다.

## 왜 지금 하는가

현재 책임은 정해졌지만 일부 이름은 과거 구조나 구현 방식인 Glow,
Composition, 별도 Engine과 Cutover를 계속 암시한다. 새 기능이 잘못된
이름을 기준으로 연결되기 전에 작은 범위로 정리한다.

## 범위

- `CanvasSelectionGlow*` → `CanvasSelectionHighlight*`
- `useCanvasViewportEngine` → `useCanvasViewportRuntime`
- `useLayerDocumentCanvasComposition` → `useLayerDocumentCanvasEngine`
- 미사용 Runtime Cutover 계약 제거
- `@/engines/animation` compatibility 경계 제거
- 직접 연결된 verification과 현재 코드 지도 동기화

## 범위 밖

- Naming Audit의 B/C/D 항목
- Architecture, 책임, 데이터 흐름과 제품 동작 변경
- Selection Highlight의 시각 효과, Cache와 성능 변경
- Frame Evaluation, Renderer와 Overlay 구조 변경
- Project schema, History와 Runtime 계약 변경
- 완료 문서의 역사적 용어 수정
- 새 기능, Store, Runtime과 Engine 추가
- Browser QA

## 공통 규칙

- Manifest 밖 변경은 금지한다.
- Rename/Delete는 책임을 명확히 한 결과이며 동작 변경을 포함하지 않는다.
- 각 Task는 독립 rollback 가능하게 유지한다.
- 완료 문서의 과거 이름은 역사 기록이므로 Old Name Audit에서 제외한다.
- Verification 수정은 이름과 경로 동기화만 허용하며 검증 의미를 바꾸지
  않는다.

## Manifest

| ID | 대상 | 현재 caller/export | Category | 최종 상태 | Task |
|---|---|---|---|---|---:|
| M1 | `CanvasSelectionGlow*` 파일·symbol·prop | Canvas direct selection, Preview Overlay, Canvas barrel, Screen Tone verification | Rename | `CanvasSelectionHighlight*` | 1 |
| M2 | `useCanvasViewportEngine.ts`와 Hook | Canvas composer 1곳 | Rename | `useCanvasViewportRuntime.ts` / Hook | 2 |
| M3 | `useLayerDocumentCanvasComposition.ts`와 Hook | Editor Composition Root, Canvas barrel, Canvas/Root verification | Rename | `useLayerDocumentCanvasEngine.ts` / Hook | 3 |
| M4 | `LayerDocumentRuntimeCutoverPreparationPort`, `LayerDocumentRuntimePreparationQueryPort` | 제품 0, verification 0, Render barrel export | Delete | 정의와 public export 제거 | 4 |
| M5 | `src/engines/animation/index.ts`, Render의 `@/engines/animation` import 3곳 | Render model/helper/adapter | Remove compatibility | `@/animation` 전환 후 compatibility 파일 제거 | 5 |
| M6 | 직접 영향받는 verification 이름과 경로 | M1~M5 검증 | Update | 검증 의미를 유지한 동기화 | 해당 Task |
| M7 | `docs/20_src_map.md` | 현재 코드 지도 | Update | 최종 canonical 이름과 경계 기록 | 6 |
| M8 | `docs/completed/*`의 과거 명칭 | 완료 이력 | Preserve | 당시 명칭 유지 | - |
| M9 | Naming Audit B/C/D 항목 | 현재 제품 | Preserve | 이번 Sprint 변경 0건 | - |

`buildCanvasSelectionScreenTone*`은 실제 알고리즘 책임을 정확히 표현하므로
M1의 Rename 대상이 아니다.

## Rollback 단위

| 단위 | 포함 변경 |
|---|---|
| R1 | Selection Glow → Highlight 파일·symbol·prop |
| R2 | Viewport Engine → Runtime 파일과 단일 caller |
| R3 | Canvas Composition → Canvas Engine 파일·barrel·Root·verification |
| R4 | Cutover 계약 정의와 Render export |
| R5 | Animation import와 compatibility 파일 |
| R6 | 현재 문서 동기화 |

---

## Task 0 — Manifest 확정

### 왜 필요한가

이번 Sprint의 변경 범위를 고정하고 구현 중 범위 확장을 막는다.

### 작업 내용

- M1~M9의 definition, caller와 public export를 다시 확인한다.
- active code/current docs와 completed-history의 검색 범위를 구분한다.
- Manifest 밖 후보는 이번 Sprint에 추가하지 않는다.

### 위험

- type-only caller나 path 문자열을 누락할 수 있다.
- completed 문서의 과거 용어를 현재 코드 잔여로 오판할 수 있다.

### 확인 방법

- definition/caller/export 정적 검색
- Manifest 대상과 Task 번호 대조

### 완료 조건

- 다섯 변경 대상과 실제 caller/export 일치
- Cutover 계약의 제품·verification caller 0건 재확인
- Manifest 밖 대상 0건

Task 0에서는 Build, Test, Lint, Checkpoint와 Git 작업을 수행하지 않는다.

---

## Task 1 — Selection Highlight 명칭 정렬

### 왜 필요한가

현재 구현은 blur Glow가 아니라 Screen Tone 기반 선택 강조이므로 실제
책임을 나타내는 이름으로 통일한다.

### 작업 내용

- M1의 파일, type, function, prop과 constant의 `Glow`를 `Highlight`로
  변경한다.
- Canvas barrel과 Screen Tone verification의 이름과 경로를 동기화한다.
- `buildCanvasSelectionScreenTone*` 이름은 유지한다.
- Screen Tone 알고리즘, alpha source, scratch cache와 출력은 변경하지
  않는다.

### 위험

- UI prop, public barrel이나 verification import에 old name이 남을 수 있다.
- Rename 과정에서 시각 효과나 Cache를 함께 변경할 수 있다.

### 확인 방법

- 새 symbol의 정의와 caller 연결 확인
- M1 및 M6 밖 제품 변경이 없는지 diff 검토

### 완료 조건

- `CanvasSelectionHighlight*`로 책임 명칭 통일
- 시각 출력과 Cache 계약 변화 0
- R1 독립 rollback 가능

---

## Task 2 — Canvas Viewport Runtime 명칭 정렬

### 왜 필요한가

Canvas 내부 Runtime composer를 독립 Panel Engine으로 오해하지 않게 한다.

### 작업 내용

- 파일과 Hook을 `useCanvasViewportRuntime`으로 변경한다.
- Canvas Engine 내부의 단일 caller를 동기화한다.
- zoom, pan, workspace state와 Controller 조립은 변경하지 않는다.

### 위험

- path 문자열을 직접 확인하는 verification을 누락할 수 있다.

### 확인 방법

- 새 Hook의 정의와 caller 확인
- M2 및 M6 밖 제품 변경이 없는지 diff 검토

### 완료 조건

- Viewport 동작 변화 0
- M2만 책임 명칭 변경
- R2 독립 rollback 가능

---

## Task 3 — Canvas Engine 공개 이름 정렬

### 왜 필요한가

Canvas Panel의 실제 Engine composer를 Group/Render composition 및 Editor
Composition Root와 구분한다.

### 작업 내용

- 파일과 Hook을 `useLayerDocumentCanvasEngine`으로 변경한다.
- Canvas barrel, Editor Composition Root와 관련 verification 경로를
  동기화한다.
- Hook의 입력, 반환값과 조립 책임은 변경하지 않는다.

### 위험

- Root, public barrel과 path 기반 verification까지 영향 범위가 넓다.
- 이름 변경을 구조 변경으로 확대할 수 있다.

### 확인 방법

- 새 Hook의 public export와 Root caller 연결 확인
- M3 및 M6 밖 제품 변경이 없는지 diff 검토

### 완료 조건

- Canvas Engine 입력과 출력 변화 0
- M3/M6만 변경
- R3 독립 rollback 가능

---

## Task 4 — 미사용 Cutover 계약 제거

### 왜 필요한가

과거 전환용 계약이 현재 Render public Runtime처럼 보이는 오해를 없앤다.

### 작업 내용

- `LayerDocumentRuntimeCutoverPreparationPort`를 제거한다.
- `LayerDocumentRuntimePreparationQueryPort`를 제거한다.
- `src/render/index.ts`의 두 public export를 제거한다.
- 다른 Runtime, Draft와 Frame Evaluation 계약은 변경하지 않는다.

### 위험

- type-only caller를 누락하면 최종 Build가 실패할 수 있다.

### 확인 방법

- 두 계약의 caller와 export 제거 확인
- M4 밖 Render 계약 변경이 없는지 diff 검토

### 완료 조건

- 두 Cutover 계약의 active definition/caller/export 0건
- 제품 Runtime 계약 변화 0
- R4 독립 rollback 가능

---

## Task 5 — Animation compatibility 제거

### 왜 필요한가

순수 Animation 모듈이 독립 Panel Engine처럼 보이는 compatibility 경계를
제거한다.

### 작업 내용

- Render caller 3곳을 `@/animation`으로 전환한다.
- `src/engines/animation/index.ts`를 제거한다.
- Animation 계산, API와 결과는 변경하지 않는다.

### 위험

- 누락 export 또는 순환 import가 최종 Build에서 발견될 수 있다.

### 확인 방법

- 세 caller의 canonical import 확인
- M5 밖 Animation/Render 변경이 없는지 diff 검토

### 완료 조건

- `@/animation`이 유일한 canonical 경계
- Animation 계산 변화 0
- R5 독립 rollback 가능

---

## Task 6 — 현재 문서 동기화

### 왜 필요한가

현재 코드 지도와 최종 canonical 이름을 일치시킨다.

### 작업 내용

- `docs/20_src_map.md`의 현재 파일명과 책임을 갱신한다.
- `docs/98_sprint_plan.md`의 진행 상태를 간단히 기록한다.
- completed 문서의 역사적 이름은 변경하지 않는다.
- Architecture를 새로 설명하거나 변경하지 않는다.

### 위험

- 완료 이력을 현재 용어로 덮어쓸 수 있다.
- 문서 수정이 Architecture 변경으로 확대될 수 있다.

### 확인 방법

- current docs 변경이 M1~M7에 직접 연결되는지 검토
- completed 문서 변경 0건 확인

### 완료 조건

- 현재 코드와 `20_src_map.md`의 이름 일치
- 완료 문서 변경 0건
- R6 독립 rollback 가능

---

## Task 7 — Old Name Audit

### 왜 필요한가

Rename/Delete 누락으로 active code나 현재 문서에 과거 이름이 남는 것을
막는다.

### 작업 내용

active code와 current docs에서 다음 이름을 검색한다.

- `CanvasSelectionGlow`
- `useCanvasViewportEngine`
- `useLayerDocumentCanvasComposition`
- `LayerDocumentRuntimeCutoverPreparationPort`
- `LayerDocumentRuntimePreparationQueryPort`
- `@/engines/animation`

`docs/completed`는 역사 기록이므로 검색 판정에서 제외한다.

### 위험

- 부분 문자열이나 historical fixture를 제품 잔여로 잘못 판정할 수 있다.
- old name이 verification 문자열에 남으면 Rename 누락을 숨길 수 있다.

### 확인 방법

- `src`, `scripts`, `docs/00_rule.md`, `docs/architecture`,
  `docs/20_src_map.md`, `docs/97_next_sprint.md`,
  `docs/98_sprint_plan.md`를 대상으로 검색
- `docs/completed` 제외 여부 확인
- 이 계획의 Manifest, Task 제목과 검색어 목록에 있는 변경 전 이름은
  예상된 계획 기록으로 별도 표시하고, 제품/current architecture의 누락과
  구분한다.

### 완료 조건

- 여섯 old name의 active code/current docs 의도하지 않은 잔여 0건
- `docs/98_sprint_plan.md`의 계획 기록에 남은 예상 hit 목록 명시
- completed-history만 제외된 검색 결과
- Manifest 밖 변경 0건

---

## Task 8 — 최종 Build / Verification

### 왜 필요한가

모든 Rename/Delete가 실제 import, public boundary와 기존 제품 계약을
깨지 않았는지 한 번에 검증한다.

### 작업 내용

- Task 7 Old Name Audit 결과를 최종 확인한다.
- 전체 Verification을 실행한다.
- Build를 실행한다.
- 실패하면 원인이 발생한 Task 범위에서만 수정하고 다시 검증한다.

### 위험

- path/symbol을 직접 검사하는 verification이 새 이름과 동기화되지 않았을
  수 있다.
- 실패를 해결하면서 Manifest 밖 리팩토링을 추가할 수 있다.

### 검증

- Old Name Audit
- `npm run test`
- `npm run build`

### 완료 조건

- Old Name Audit PASS
- 전체 Verification PASS
- Build PASS
- 제품 동작과 Architecture 변경 0
- Manifest 밖 변경 0건

### 실행 결과

- 첫 Verification은 삭제된 `src/engines/animation/index.ts`를 계속 읽는
  `verifyEngineImportBoundaries.ts` 때문에 중단됐다.
- M5/M6 범위에서 verification을 canonical `src/animation` 경계 검사로
  동기화했다.
- Old Name Audit: PASS
- `npm run test`: 41/41 PASS
- `npm run build`: PASS
- 기존 Node experimental loader 경고와 500kB 초과 bundle 경고는 남았다.

## 성공 조건

- 다섯 A 항목의 이름과 실제 책임이 일치한다.
- dead Cutover와 Animation compatibility 경계가 남지 않는다.
- active code/current docs의 의도하지 않은 old name 0건
- completed 문서의 역사 기록 보존
- Build와 전체 Verification PASS
- 제품 동작과 Architecture 변화 0
- Manifest 밖 변경 0건

## Sprint 완료 조건

- Task 0~8 PASS
- R1~R6 독립 rollback 가능
- Old Name Audit, Build와 Verification PASS

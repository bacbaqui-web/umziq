# Pre-Feature Responsibility Boundary Cleanup Sprint

## 상태

- Sprint 완료
- Task 0 PASS — Manifest/caller 및 Preserve 경계 확정
- Task 1 PASS — Properties 전용 이름 정렬 및 공유 Preparation 계약 보존
- Task 2 PASS — Project Controller/Source Store 책임 폴더 정렬
- Task 3 PASS — Properties Engine/Controller 책임 폴더 정렬
- Task 4 PASS — Timeline Controller 책임 폴더 정렬
- Task 5 PASS — Playback Runtime 이름/위치 정렬, Scheduler 구조 보존
- Task 6 PASS — Render Source Runtime Cache 책임 폴더 정렬
- Task 7 PASS — legacy ProjectSource Offline Migration 경계 격리
- Task 8 PASS — 코드 지도 동기화 및 old path audit 완료
- Task 9 PASS — 전체 Verification 41/41 및 Build 통과
- Browser QA 미실행 — 이번 Cleanup Sprint 범위에서 제외

## 기준

- `docs/01_rule.md`
- `docs/20_src_map.md`
- Naming & Responsibility Audit의 B 후보 중 승인된 1~3번

## Sprint 목적

새 기능 개발 전에 잘못된 이름과 폴더 때문에 현재 책임을 오해할 수 있는
경계를 정리한다. Architecture와 제품 동작은 바꾸지 않는다.

## 범위

1. Properties 전용 `LayerDocumentPanel*` 이름을 Properties 책임으로 정렬
2. `adapters`에 잘못 놓인 Controller, Store, Cache와 Runtime을 실제 owner
   위치로 이동
3. legacy ProjectSource 계열을 Offline Migration 폴더로 격리

## 범위 밖

- Public API/barrel 재설계
- Render identity와 Frame Evaluation 명칭 정리
- `src/engines/project` 전체 구조 변경
- 제품 기능, UI, schema, History, Runtime 동작 변경
- 완료 문서의 역사적 경로 일괄 수정
- Browser QA

기존 barrel의 구조, 책임과 export 항목 수는 유지한다. Task 1에서는
Properties 전용 exported identifier를 canonical 이름으로 교체하며, 그
외 Task는 symbol 추가·삭제 없이 경로만 동기화한다.

## 공통 규칙

- Manifest 밖 변경은 금지한다.
- 파일 이동과 Rename은 동작 변경 없이 수행한다.
- 각 Task는 독립 rollback 가능하게 유지한다.
- verification의 경로·symbol은 동기화하되 검증 의미는 바꾸지 않는다.
- completed 문서는 역사 기록으로 Preserve한다.
- 새 폴더 책임을 만들지 않고 이미 존재하는 `controllers`, `state`와 domain
  root를 사용한다.

## Manifest

### A. Properties 책임 명칭

| 대상 | 최종 상태 | 비고 |
|---|---|---|
| Properties 전용 `LayerDocumentPanelCapability*` | `LayerDocumentPropertiesCapability*` | Rename |
| `LayerDocumentPanelSourceDescriptor` | `LayerDocumentPropertiesSourceDescriptor` | Rename |
| `LayerDocumentPanelTypeData` | `LayerDocumentPropertiesTypeData` | Rename |
| `LayerDocumentPanelPlacementSummary` | `LayerDocumentPropertiesPlacementSummary` | Rename |
| `LayerDocumentPanelDescriptor*` | `LayerDocumentPropertiesDescriptor*` | Rename |
| `LayerDocumentPanelCommand*` | `LayerDocumentPropertiesCommand*` | Rename |
| `buildLayerDocumentPanelDescriptor` | `buildLayerDocumentPropertiesDescriptor` | Rename |
| `prepareLayerDocumentPanelCommand` | `prepareLayerDocumentPropertiesCommand` | Rename |
| `layerDocumentPanelDescriptorHelpers.ts` | `layerDocumentPropertiesDescriptorHelpers.ts` | Rename |
| `layerDocumentPanelCommandAdapter.ts` | `layerDocumentPropertiesCommandPreparationAdapter.ts` | Rename |

### Properties Preserve

다음 계약은 Canvas Draft도 함께 연결하므로 Properties 전용 이름으로 바꾸지
않는다.

- `LayerDocumentPanelPreparationPort`
- `LAYER_DOCUMENT_PANEL_PREPARATION_PORT`
- `layerDocumentPanelPreparationAdapter.ts`

Properties 전용 model은 `layerDocumentPropertiesModel.ts`로 분리하고, 위
공유 port 계약은 현재 이름과 책임을 유지한다.

### B. 실제 owner 위치로 이동

| 현재 파일 | 최종 위치 | 실제 책임 |
|---|---|---|
| `project/adapters/layerDocumentPsdPreparedSessionController.ts` | `project/controllers/` | prepared PSD session lifecycle |
| `project/adapters/layerDocumentPsdTreeController.ts` | `project/controllers/` | PSD Tree Project command orchestration |
| `project/adapters/layerDocumentSourceRuntimeResolutionStore.ts` | `project/state/` | Source resolution mutable Store |
| `properties/adapters/layerDocumentPropertiesController.ts` | `properties/controllers/` | Properties Controller |
| `properties/adapters/useLayerDocumentPropertiesEngine.ts` | `properties/` root | Properties Panel Engine |
| `timeline/adapters/layerDocumentTimelineInteractionController.ts` | `timeline/controllers/` | Timeline interaction Controller |
| `timeline/adapters/layerDocumentTimelineNavigationController.ts` | `timeline/controllers/` | Timeline navigation Controller |
| `timeline/adapters/layerDocumentTimelinePlaybackAdapter.ts` | `timeline/state/layerDocumentTimelinePlaybackRuntime.ts` | 현재 Runtime 구현 전체를 변경 없이 이동 |
| `render/adapters/layerDocumentSourceRuntimeResourceCache.ts` | `render/state/` | Source Runtime resource Cache |

### C. Offline Migration 격리

다음 11개 파일을 `src/models/offlineMigration/` 아래로 이동한다.

- `compositionModel.ts`
- `timelineItemModel.ts`
- `selectionModel.ts`
- `projectSourceModel.ts`
- `projectSourceNormalization.ts`
- `projectSourceValidation.ts`
- `projectSourceToLayerDocumentMigration.ts`
- `projectSourceMigrationIdentity.ts`
- `projectSourceMigrationInputValidation.ts`
- `projectSourceMigrationLayerBuilder.ts`
- `projectSourceMigrationSourceBuilder.ts`

`@/models/offlineMigration` public surface는 유지하며 runtime Editor/Engine이
legacy 구현을 직접 import하지 않는 계약도 유지한다.

## Rollback 단위

| 단위 | 변경 |
|---|---|
| R1 | Properties 전용 명칭 정렬 |
| R2 | Project Controller/Store 3개 이동 |
| R3 | Properties Engine/Controller 2개 이동 |
| R4 | Timeline Controller 2개 이동 |
| R5 | Timeline Playback Runtime 파일명과 위치 정렬 |
| R6 | Render Source Runtime Cache 이동 |
| R7 | Offline Migration 11개 파일 일괄 이동 |
| R8 | 현재 문서 동기화 |

---

## Task 0 — Manifest와 caller 확정

### 목적

이번 Sprint의 정확한 이동·Rename 범위를 고정한다.

### 작업 내용

- Manifest definition, caller, public export와 verification path를 재확인한다.
- Preserve 계약과 completed-history 제외 목록을 고정한다.
- Manifest 밖 후보는 다음 Sprint로 보낸다.

### 정적 확인

- definition/caller/export 검색
- runtime Editor/Engine의 legacy import 0건 확인

### 완료 조건

- Manifest와 실제 코드 일치
- Public barrel 재설계 대상 0건
- Task 1 canonical identifier 교체 외 공개 책임/항목 수 변화 0건
- 범위 밖 후보 추가 0건

---

## Task 1 — Properties 책임 명칭 정렬

### 목적

Properties 전용 계약이 범용 Panel 계약처럼 보이는 오해를 제거한다.

### 작업 내용

- Manifest A의 Properties 전용 파일·symbol·함수를 Rename한다.
- model 파일에서 Properties 전용 계약과 공유 Preparation port를 구분한다.
- Properties barrel과 관련 verification을 동기화한다.
- Preserve 3개 계약은 이름과 역할을 유지한다.

### 위험

- 공유 Draft port까지 Properties로 Rename하면 실제 책임을 숨길 수 있다.
- Timeline verification이 Properties preparation을 fixture로 사용한다.

### 정적 검증

- Properties Controller
- Panel Preparation
- Properties PSD Integration
- Consumer Ports
- Timeline 관련 preparation fixture
- 변경 파일 lint, build, `git diff --check`

### 완료 조건

- Properties 전용 `LayerDocumentPanel*` 잔여 0건
- 공유 Preparation port 3개 Preserve
- 제품 동작 변화 0
- Properties 전용 exported identifier만 canonical 이름으로 교체하며
  barrel의 책임과 export 항목 수 변화 0
- R1 독립 rollback 가능

---

## Task 2 — Project Controller와 Source Store 위치 정렬

### 목적

Project adapter로 오해되는 Controller와 Store를 실제 책임 폴더로 이동한다.

### 작업 내용

- Project Controller 2개를 `project/controllers`로 이동한다.
- Source Runtime Resolution Store를 `project/state`로 이동한다.
- Project barrel과 caller path만 동기화한다.

### 위험

- PSD Tree Engine과 Source lifecycle verification이 이전 경로를 직접 참조한다.

### 정적 검증

- PSD Tree Controller
- Source Preparation/Resolution
- Project Open/Reconnect/Lifecycle
- Properties PSD Integration
- 변경 파일 lint, build, `git diff --check`

### 완료 조건

- 세 파일의 owner와 폴더 일치
- 공개 symbol과 동작 변화 0
- R2 독립 rollback 가능

---

## Task 3 — Properties Engine과 Controller 위치 정렬

### 목적

Properties Panel Engine과 Controller가 Adapter처럼 보이는 오해를 제거한다.

### 작업 내용

- `useLayerDocumentPropertiesEngine.ts`를 Properties root로 이동한다.
- `layerDocumentPropertiesController.ts`를 `properties/controllers`로
  이동한다.
- barrel, Editor Root와 verification path를 동기화한다.

### 위험

- Editor Root와 Engine boundary verification이 경로 문자열을 검사한다.

### 정적 검증

- Properties Controller
- Editor Root
- Engine Import Boundaries
- Properties PSD Integration
- 변경 파일 lint, build, `git diff --check`

### 완료 조건

- Properties Engine ↔ Panel 경계 유지
- Controller 동작 변화 0
- R3 독립 rollback 가능

---

## Task 4 — Timeline Controller 위치 정렬

### 목적

Timeline interaction/navigation 수명 조정자가 Adapter처럼 보이는 오해를
제거한다.

### 작업 내용

- Interaction Controller와 Navigation Controller를
  `timeline/controllers`로 이동한다.
- Timeline Engine, barrel과 verification path를 동기화한다.

### 위험

- Timeline UI boundary와 harness가 경로를 직접 검사한다.

### 정적 검증

- Timeline Controller Harness
- Timeline UI Boundary/Integration
- Public Keyframes/Reorder
- Engine Import Boundaries
- 변경 파일 lint, build, `git diff --check`

### 완료 조건

- 두 Controller의 owner와 폴더 일치
- Timeline intent/command 변화 0
- R4 독립 rollback 가능

---

## Task 5 — Timeline Playback Runtime 위치 정렬

### 목적

Playback Runtime이 Adapter처럼 보이지 않도록 파일명과 위치를 실제 책임에
맞춘다.

### 작업 내용

- `layerDocumentTimelinePlaybackAdapter.ts`를
  `timeline/state/layerDocumentTimelinePlaybackRuntime.ts`로 이동한다.
- 파일명, import, barrel과 caller 경로만 동기화한다.
- Window scheduler를 포함한 현재 파일 내부 구현은 그대로 유지한다.
- 기존 public factory와 Runtime port는 유지한다.

### 위험

- path 기반 verification이나 직접 import를 누락할 수 있다.
- 파일 이동을 Runtime/Scheduler 구조 개선으로 확대할 수 있다.

### 정적 검증

- Playback Helpers
- Timeline Controller/UI Integration
- Project Lifecycle
- Editor Root
- current frame/Undo 계약 verification
- 변경 파일 lint, build, `git diff --check`

### 완료 조건

- currentFrame/range/isPlaying/clock owner 변화 0
- scheduler 동작 변화 0
- 파일 내부 Runtime/Lifecycle 구현 변화 0
- public API 변화 0
- R5 독립 rollback 가능

---

## Task 6 — Render Source Runtime Cache 위치 정렬

### 목적

stateful resource Cache를 변환 Adapter와 구분한다.

### 작업 내용

- `layerDocumentSourceRuntimeResourceCache.ts`를 `render/state`로 이동한다.
- Render barrel과 caller path만 동기화한다.
- 등록, suspend, invalidate와 dispose 로직은 변경하지 않는다.

### 위험

- Import/Refresh/Reconnect와 Preview Runtime이 동일 Cache를 공유한다.

### 정적 검증

- Preview Runtime Cache
- Preview Backing Scale Lifecycle
- Project Open/Reconnect
- Consumer Ports
- Runtime Metrics
- 변경 파일 lint, build, `git diff --check`

### 완료 조건

- Cache 수명과 dispose 횟수 변화 0
- public API 변화 0
- R6 독립 rollback 가능

---

## Task 7 — Offline Migration 격리

### 목적

legacy ProjectSource 모델을 현재 canonical model로 오해할 가능성을 제거한다.

### 작업 내용

- Manifest C의 11개 파일을 `src/models/offlineMigration`으로 함께 이동한다.
- 내부 상호 import와 offline barrel 경로를 동기화한다.
- `@/models/offlineMigration` 외 runtime import 금지 계약을 유지한다.

### 위험

- 11개 파일이 서로 참조하므로 일부만 이동하면 alias가 깨진다.
- 과거 프로젝트 변환 결과가 달라져서는 안 된다.

### 정적 검증

- ProjectSource → LayerDocument Migration
- LayerDocument Legacy Removal
- Engine Import Boundaries
- Schema/Normalization 관련 verification
- 변경 파일 lint, build, `git diff --check`

### 완료 조건

- legacy 11개 파일의 `src/models` 루트 잔여 0건
- runtime Editor/Engine legacy import 0건
- migration 결과 변화 0
- R7 일괄 rollback 가능

---

## Task 8 — 문서 동기화와 Old Path Audit

### 목적

현재 코드 지도와 실제 경계를 일치시키고 이동 누락을 찾는다.

### 작업 내용

- `docs/20_src_map.md`를 현재 이름과 경로로 갱신한다.
- `docs/98_sprint_plan.md`에 진행 상태를 간단히 기록한다.
- completed 문서는 변경하지 않는다.
- 이전 파일 경로와 Properties 전용 old symbol을 검색한다.

### 정적 확인

- Manifest old path의 active code/current docs 잔여 0건
- 의도하지 않은 Properties 전용 `LayerDocumentPanel*` 잔여 0건
- completed-history 제외 확인

### 완료 조건

- 현재 코드와 `20_src_map.md` 일치
- Manifest 밖 변경 0건
- R8 독립 rollback 가능

---

## Task 9 — 최종 Verification / Build

### 목적

모든 Rename과 Move가 기존 제품 계약을 유지했는지 최종 확인한다.

### 작업 내용

- Task 8 Old Path Audit을 재확인한다.
- 전체 Verification과 Build를 실행한다.
- 실패 시 원인이 발생한 rollback 단위에서만 수정한다.

### 검증

- Old Path Audit
- `npm run test`
- `npm run build`
- `git diff --check`

### 완료 조건

- 전체 Verification PASS
- Build PASS
- Old Path Audit PASS
- 제품 동작, schema와 Architecture 변화 0
- Public barrel 재설계와 공개 책임/항목 수 변화 0
- Manifest 밖 변경 0건

## Deferred Work — Playback Runtime / Scheduler Responsibility Refactoring

이번 Sprint에서는 계획만 남기고 구현하지 않는다.

후속 Playback Refactoring Sprint에서 다음을 별도로 검토한다.

- Runtime과 Scheduler 책임 분리
- Playback Lifecycle 정리
- Clock/Listener ownership 검토
- Dispose 구조 검토
- Browser Scheduler 추상화 필요 여부

이 작업은 새로운 책임 분리와 구조 리팩토링이므로 현재 Cleanup Sprint
범위에 포함하지 않는다.

## Browser QA

이번 Sprint에서는 수행하지 않는다. 제품 기능 변경이 없으며 사용자가
별도로 요청하기 전까지 자동 실행하지 않는다.

## Sprint 완료 조건

- Task 0~9 PASS
- R1~R8 독립 rollback 가능
- Verification, Build와 Old Path Audit PASS
- Public API 재설계 0건
- Task 1 canonical identifier 교체 외 공개 책임/항목 수 변화 0건
- Browser QA 미실행

# LayerDocument Render Optimization Reconnection

## 상태

- Sprint 1~3 완료
- 구성: Sprint 1~3
- 목표: 기존 Render 최적화를 현재 LayerDocument 구조에 다시 연결
- 기준: `00_rule.md`, `44_preview_runtime_optimization.md`,
  `50_measured_preview_interaction_runtime_optimization.md`,
  `56_layer_document_architecture.md`,
  `59_render_runtime_optimization_architecture_audit.md`

## 공통 규칙

- 새 Renderer, Engine, Store, Runtime을 만들지 않는다.
- 기존 Full/Fast Renderer, Dirty Region과 Cache를 제거하지 않는다.
- Project 저장 구조, History와 LayerDocument 의미를 변경하지 않는다.
- PointerMove Draft, PointerUp Project/History 1회 계약을 유지한다.
- Preview/Export 경계와 Full/Fast 출력 의미를 유지한다.
- Project/Timeline/Scene은 UI 기준 위→아래 순서를 사용한다.
- Canvas painter만 아래→위로 그린다.
- Full Render 우회, 강제 refresh와 전체 redraw로 해결하지 않는다.
- 동일 Fixture의 수치로 Before/After를 판단한다.
- 각 Sprint 완료 후 한 번만 결과를 보고한다.

## 고정 Fixture와 측정값

### Fixture

- `drag_test.psd`: flat Layer
- `layer_test.psd`: 4000×4000 Layer와 중첩 Group
- fast-render / full-render
- Position / WH Scale
- Glow OFF / ON
- playback / seek / Draft / commit

### 필수 측정값

- frame p95
- Composition Cache hit/miss
- Dirty full/skip/partial
- drawImage/skipped
- Surface create/reuse/dispose
- renderer/Preview generation/reuse
- Project update/History commit
- tracked Runtime resource

### 기능 확인

- PSD Tree와 Timeline 순서
- Canvas pixel 적층
- Direct Selection 최상단 우선
- Draft/Properties/Overlay 동기화
- PointerUp Commit과 Undo/Redo
- full/fast 출력 정확성

---

## Sprint 1 — Baseline + Observation + Metrics

### 목적

현재 LayerDocument 제품의 최적화 전 상태를 신뢰할 수 있는 수치로
기록한다.

### 작업 내용

- `00_rule.md`의 Render 동결을 이번 계획 범위에서만 최소 해제한다.
- legacy ProjectSource/TimelineItem profiling identity를 현재
  `layerDocumentId`와 Source identity로 교체한다.
- 동작을 바꾸지 않는 관찰용 Metrics를 실제 제품 경로에 연결한다.
- frame reset과 baseline 수명을 확정한다.
- painter identity, Dirty Region과 Composition Cache 회귀 fixture를
  추가한다.
- 고정 Fixture의 Before 수치를 기록한다.

### 완료 조건

- 모든 필수 측정값이 실제 제품 경로에서 수집된다.
- 계측 전후 제품 출력이 동일하다.
- 현재 painter identity/cache 회귀가 수치로 재현된다.
- PointerMove Project/History 0회, PointerUp 각 1회가 유지된다.

### 종료 보고

- 변경된 파일
- Baseline 수치
- 발견한 병목
- 계측으로 인한 회귀 여부
- Sprint 2 진행 가능 여부

### 결과

- 정적 Before: painter clone 6, Dirty full/skip/partial 1/0/1,
  Composition Cache hit/miss 0/4, Surface create/reuse 2/2,
  drawImage 8
- production headless Position Drag 3회: frame p95 중앙값 29.897ms,
  main-thread task 126.229ms, scripting 74.7ms, paint 15.949ms
- LayerDocument/Source identity, 고정 viewport와 Undo 복원: PASS
- Sprint 2 진행: 승인

---

## Sprint 2 — Painter Identity Recovery

### 목적

UI 순서와 Canvas 적층을 유지하면서 Scene/Composition identity와 기존
Cache 재사용을 복구한다.

### 작업 내용

- Canvas controller의 recursive Scene/Frame clone을 제거한다.
- Canvas2D traversal이 배열을 복제하지 않고 뒤에서 앞으로 순회한다.
- 중첩 Composition children에 같은 painter 계약을 적용한다.
- Direct Selection은 canonical top→bottom 후보를 유지한다.
- Evaluation identity와 visual result identity를 분리한다.
- static PSD의 frame-only 변화는 표시 결과가 같으면 재사용한다.
- source/Transform/opacity/animation/effect/child/timed source 변화는
  정확하게 invalidate한다.
- Sprint 1과 동일 Fixture의 Before/After를 비교한다.

### 완료 조건

- painter clone 0
- 동일 Composition reference 유지
- Dirty skip/partial과 Composition Cache hit 회복
- static PSD의 불필요한 frame invalidation 감소
- PSD Tree/Timeline/Canvas 순서와 full/fast pixel 결과 정상
- frame p95가 Baseline보다 악화되지 않음
- stale frame과 Cache resource leak 없음

### 종료 보고

- 변경된 파일
- Before/After 수치
- 성능 개선 여부
- 기능·출력·memory 회귀 여부
- Sprint 3 진행 가능 여부

### 결과

- 정적 Before→After: painter clone 6→0, Dirty skip 0→1,
  Composition Cache hit 0→1, drawImage 8→7
- production headless: main-thread task 126.229→116.266ms,
  scripting 74.700→69.221ms, paint 15.949→15.330ms,
  pointer event 비용 6.311→5.813ms
- frame p95 29.897→30.891ms는 측정 범위가 겹쳐 중립으로 판정
- painter/Direct Selection 순서, identity, Undo 복원: PASS
- Sprint 3 진행: 승인

---

## Sprint 3 — Quality + Production QA

### 목적

Preview Quality/Memory 정책을 실제 Runtime과 일치시키고 최종 성능을
검증한다.

### 작업 내용

같은 Fixture로 다음 두 정책을 비교해 하나만 유지한다.

1. LayerDocument Source Runtime에 source Preview bitmap cache 재연결
2. backing-scale-only 정책으로 단순화

선택 기준:

- frame p95
- source/raster 비용
- memory 사용과 dispose
- 구현 복잡도
- Preview/Export original source 경계

선택 후:

- UI의 `0 B` 허위 표시를 제거한다.
- auto/원본/상/중/하와 실제 Runtime 동작을 일치시킨다.
- Import/Refresh/Delete/Reconnect lifecycle을 검증한다.
- 동일 production Fixture로 최종 Before/After를 측정한다.
- 관련 영구 문서와 Source Map을 갱신한다.

### 완료 조건

- Preview Quality UI와 source/backing/memory 정책이 일치한다.
- 선택하지 않은 정책의 dead code를 남기지 않는다.
- full/fast 기능, pixel 결과와 Export original source 경계 정상
- frame p95 회귀 없음
- Cache/Surface/Source resource leak 없음
- 문서와 실제 코드 일치

### 종료 보고

- 변경된 파일
- 최종 Before/After 수치
- 선택한 Quality/Memory 정책과 근거
- 성능 개선 여부
- 전체 회귀 여부
- Sprint 최종 완료 판단

### 결과

- `backing-scale-only` 정책을 채택했다. Source bitmap은 원본을 유지하고
  Preview Quality는 Canvas/offscreen backing scale만 조정한다.
- 실제 backing size: 원본 1080×1920, 상 810×1440, 중 540×960,
  하 270×480. 자동은 현재 16GB 환경에서 원본을 선택했다.
- flat fast-render Baseline→최종: frame p95 29.897→30.150ms로 중립,
  main-thread task 126.229→121.403ms, scripting 74.700→72.991ms,
  paint 15.949→15.628ms, pointer event 6.311→6.070ms로 개선됐다.
- final full-render frame p95는 29.663ms였고 fast/full pixel hash가
  일치했다.
- `layer_test.psd` production headless 3/3: nested fast-render frame p95
  57.861ms, Glow ON fast-render 58.752ms. 두 조건 모두 Import,
  composition 진입과 Position Draft가 유효했다.
- Import/Refresh/Delete/Reconnect resource lifecycle과 quality 자동 선택
  verification: PASS. 허위 `0 B`와 사용하지 않는 preview memory 정책
  코드는 제거했다.
- 전체 정적 검증과 production headless QA가 통과하여 Sprint를 완료한다.

---

## 진행 현황

| Sprint | 상태 |
|---|---|
| Sprint 1 — Baseline + Observation + Metrics | 완료 |
| Sprint 2 — Painter Identity Recovery | 완료 |
| Sprint 3 — Quality + Production QA | 완료 |

## 전체 완료 조건

- 기존 Render 구조를 유지한 채 LayerDocument 연결이 복구된다.
- 기존 Dirty/Composition/Surface/Source Cache가 실제 제품 경로에서
  재사용된다.
- painter 순서 때문에 Scene identity가 깨지지 않는다.
- static Layer가 표시 결과 변화 없이 불필요하게 다시 생성되지 않는다.
- Metrics와 Production Fixture가 현재 LayerDocument identity를 사용한다.
- Preview Quality UI와 실제 memory 정책이 일치한다.
- 기능과 출력 정확성을 유지하며 최종 frame p95가 Baseline보다
  악화되지 않는다.

# Editor / Project Owner / Panel Engine Architecture Simplification

## 1. 상태

- 단계: Sprint A·B 완료 / Sprint C 미시작
- 구성: 독립 종료 가능한 Sprint A, B, C
- 목적: Layer Document 전환 중 생긴 구조를 기존 기능을 유지하며 단순화
- 기준: `00_rule.md`, `56_layer_document_architecture.md`,
  `57_layer_document_persistence_project_lifecycle.md`

Sprint A·B만 구현했다. Sprint C와 Render 후속 Sprint는 시작하지 않았다.

---

## 2. 목표 구조

```text
Editor
├─ Project Owner
├─ Editor Composition Root
├─ PSD Tree Engine ↔ PSD Tree Panel
├─ Canvas Engine ↔ Canvas Panel
├─ Timeline Engine ↔ Timeline Panel
└─ Properties Engine ↔ Properties Panel
```

> Project Owner가 하나의 프로젝트를 소유하고, 사용자는 Panel과 짝을
> 이루는 Engine들을 통해 프로젝트를 편집한다.

- Project Owner는 Project Data의 유일한 소유자다.
- Project Owner의 state와 History에는 Project Data만 들어간다.
- Source Runtime과 Selection Runtime은 Owner 내부의 project-scoped
  Runtime 모듈이지만 Project Data나 History가 아니다.
- Drawing, Text, Audio는 독립 Panel이 생기기 전까지 Engine으로 분류하지
  않는다.
- Playback은 Timeline Engine Runtime으로 통합한다.
- Animation은 상태를 소유하지 않는 순수 모듈로 재분류한다.
- Render는 이번 계획에서 제외하며 현재 구조와 공개 API를 유지한다.

Engine은 독립 Panel과 짝을 이룰 때만 사용한다. Panel이 없는 기능에는
Engine 이름을 붙이지 않는다.

---

## 3. History와 Runtime 원칙

### History 대상

History snapshot은 `LayerDocumentProject`만 기록한다.

- Layer 생성/삭제와 Duplicate
- Transform과 Placement
- Animation과 Keyframe
- Effect와 Modifier
- Text, Drawing, Audio 데이터
- Source Registry 변경

### History 대상 아님

- current frame과 runtime playback range
- `isPlaying`, clock, transport
- Layer/Source Selection과 active Group
- Timeline/Canvas zoom, scroll, pan
- Hover, Panel UI 상태
- Draft와 선택된 keyframe
- Cache, Source Runtime resource와 모든 Engine Runtime

Undo/Redo는 Project snapshot만 교체한다. 이후 Runtime은 과거 값으로
복원하지 않고 새 Project에 대한 유효성만 보정한다.

### Undo/Redo 이후 Runtime 보정

- 현재 Layer Selection이 존재하면 유지하고, 없으면 유효한 active
  Group/Root Layer로 보정한다.
- 현재 Source Selection이 없어진 Source를 가리키면 `null`로 만든다.
- active Group이 없거나 Group이 아니면 Root Group으로 보정한다.
- selected keyframe이 없어진 Layer/keyframe을 가리키면 해제한다.
- Timeline current frame/range가 새 active Group 범위를 벗어나면 clamp한다.
- Draft, playback과 Panel Runtime은 필요할 때 cancel/reset/recompute하되
  과거 snapshot 값으로 복원하지 않는다.

삭제 Undo로 Layer가 복원되더라도 과거 Selection을 자동 복원하지 않는다.
현재 Selection이 유효하면 그대로 유지하고 유효하지 않을 때만 위 규칙으로
보정한다.

### A1 Baseline과 A4 정리 결과

A1 조사 당시 `LayerDocumentOwnerHistorySnapshot`은 Project와 함께 다음
Runtime session을 저장하고 Undo/Redo에서 복원했다.

- `layerSelection`
- `sourceSelection`
- `activeGroupLayerDocumentId`
- `playback.currentFrame`
- `playback.range.startFrame/endFrame`

`selectedTransformKeyframe`과 acknowledged Source status는 이미 별도
Runtime session이며 snapshot에는 없다.

A4에서 snapshot의 session과 Runtime 복원 metadata를 제거했다. Source
Runtime reconcile은 before/after Project의 Source 차이에서 계산하며,
History에는 Project snapshot과 origin/label/affected ID만 둔다.

---

## 4. 최종 상태 소유권

| 데이터 | 최종 소유자 | 저장 | History |
|---|---|---|---|
| `LayerDocumentProject` | Project Owner | 포함 | 포함 |
| Transaction/replace | Project Owner 내부 모듈 | 해당 없음 | 해당 없음 |
| Undo/Redo stack | Project Owner History | 제외 | 해당 없음 |
| Dirty/savepoint/lifecycle | Project Owner Lifecycle | 제외 | 제외 |
| Source resource/resolution | Project Owner Source Runtime | 제외 | 제외 |
| Layer/Source Selection | Project Owner Selection Runtime | 제외 | 제외 |
| active Group | Project Owner Selection Runtime | 제외 | 제외 |
| current frame/range | Timeline Engine Runtime | 제외 | 제외 |
| `isPlaying`/clock/transport | Timeline Engine Runtime | 제외 | 제외 |
| Timeline zoom/scroll/drag | Timeline Engine Runtime | 제외 | 제외 |
| Canvas viewport/hover/cache | Canvas Engine Runtime | 제외 | 제외 |
| Properties input/focus Draft | Properties Engine Runtime | 제외 | 제외 |
| shared Transform Draft | Editor Runtime port | 제외 | 제외 |

Project Owner는 외부에서 하나의 경계지만 내부는 다음 작은 책임으로
유지한다.

```text
Project Owner
├─ Project State / Replace
├─ Transaction
├─ History
├─ Lifecycle / Persistence
├─ Source Runtime
└─ Selection Runtime
```

Source Runtime과 Selection Runtime은 project-scoped Runtime이지 Project
Data나 History snapshot이 아니다. Panel별 Runtime은 Owner가 소유하지
않는다.

`Selection Runtime`은 단순한 공개 책임명이다. 현재의
`layerSelection`, `sourceSelection`, `activeGroupLayerDocumentId`를
상호배타적인 단일 값으로 합치지 않는다. Layer와 Source는 동시에 선택될
수 있고 active Group은 별도의 편집 범위이므로, 이를 하나의 union으로
통합하는 것은 이름 변경이 아니라 별도 제품 동작 변경이다.

---

## 5. Timeline Runtime 공유

```text
Timeline Engine Runtime
  ├─ currentFrame
  ├─ runtime playback range
  ├─ isPlaying / clock
  ├─ transport
  └─ read / subscribe / command port
                  ↓
Editor Composition Root
  ├─ Timeline ViewProps
  ├─ Canvas frame input / seek command
  ├─ Properties frame input
  └─ PSD refresh/cache frame input
```

- Canvas와 Properties는 Timeline Engine을 import하지 않는다.
- Root는 값을 저장·복사·계산하거나 새 Playback Runtime을 만들지 않는다.
- Root는 Timeline Runtime의 `read/subscribe` 결과를 현재 render 입력으로
  전달하고 Timeline command port를 주입하는 wiring만 수행한다.
- New/Open/Replace/active Group 변경은 Root가 Timeline Runtime의
  reset/clamp command로 연결한다.
- Undo/Redo 후 current frame은 그대로 유지하며 유효 범위를 벗어날 때만
  clamp한다.

---

## 6. Render 제외 규칙

이번 계획에서는 다음을 수정하지 않는다.

- Render 구조와 명칭
- Render 파일 위치와 public export
- Full/Fast Render 동작
- Canvas2D Draw
- Dirty Region
- Composition/Surface/Source Runtime Cache
- Preview/Export 경계

Playback 전용 코드만 Timeline으로 이동한다. 현재 `playback-render`
디렉터리의 Render 책임과 Canvas/Project의 Render 의존성은 후속 Render
Sprint까지 예외로 유지한다. 이번 완료 조건에 Render import 제거를
포함하지 않는다.

현재 Render가 사용하는 `playback-render` public export와 Animation import
경로도 동결한다. 이번에는 playback 상태/command의 소유권만 Timeline으로
옮기며, Render가 소비하는 helper와 compatibility export의 물리적 정리는
후속 Render Sprint에서 수행한다.

---

## 7. 공통 규칙

- 기능, UI와 저장 schema를 변경하지 않는다.
- Layer Document 단일 편집 원본과 Persistence 계약을 유지한다.
- Engine은 다른 Panel Engine의 상태나 내부 구현을 직접 수정하지 않는다.
- Composition Root는 wiring만 하고 제품 계산과 mutation을 구현하지 않는다.
- Composition Root에 current frame용 state, ref, cache, store나 복제
  Runtime을 만들지 않는다.
- 새 Manager, Coordinator, Service, Event Bus, 전역 Store를 만들지 않는다.
- 사용자 action 1회당 History 1회를 유지한다.
- PointerMove Draft / PointerUp Commit을 유지한다.
- 호환 adapter는 전환 중에만 사용하고 Sprint C 완료 시 제거한다.
- Browser QA는 사용자가 요청한 경우에만 수행한다.
- 각 Sprint는 독립적으로 정적 검증을 통과하고 종료할 수 있어야 한다.

---

# Sprint A — Architecture 기준과 Project Owner

## 목표

최종 용어와 소유권을 확정하고 Project Owner를 Editor 아래의 작은 공개
경계로 만든다. History를 Project Data 전용으로 정리한다.

## 완료 상태

- Project Owner 외부 API와 내부 책임 경계가 명확하다.
- History snapshot에는 `LayerDocumentProject`만 있다.
- Selection과 active Group은 History가 아닌 Runtime으로 보정된다.
- 기존 Playback/Animation/cutover는 호환 상태로 정상 동작한다.
- Sprint B를 시작하지 않아도 제품이 정상 상태다.

## Task A1 — Baseline과 History Inventory

### 목적

책임 이동 전 행동 계약과 History에 섞인 Runtime을 확정한다.

### 작업 내용

- Project/History/Selection/Lifecycle/Source/Draft/Playback fixture 분류
- History snapshot, entry metadata, effect, Runtime session 구분
- Undo/Redo가 현재 복원하는 모든 session 값 기록
- Render는 회귀 감시만 하고 구조 분석·변경하지 않음

### 정적 검증

- 기존 verification 결과 기록
- New → Import → Select → Transform → Undo/Redo → Save/Open 기준 확인

### 완료 조건

- Project Data와 Runtime History 복원을 구분할 수 있다.
- 제거 대상 Runtime 목록이 누락 없이 고정된다.

### Gate A1

- 상태: PASS
- 핵심 발견: A1 조사 당시 snapshot은 Project와
  `layerSelection`·`sourceSelection`·`activeGroupLayerDocumentId`·
  `playback.currentFrame/range`를 함께 저장하고 Undo/Redo에서 복원한다.
- 구분 결과: A1에서 entry metadata와 snapshot을 구분했고, A4에서 cache
  policy·Source invalidation ID를 제거해 origin/label/affected ID만 남겼다.
- 검증 보강: Project Owner fixture는 A4 이후 Project-only snapshot과
  Undo/Redo의 현재 Runtime 유지·최소 보정을 고정한다.
- 정적 검증: Project Owner, Consumer Cutover, Persistence, Lifecycle,
  Save, Open, Source Runtime verification PASS.

## Task A2 — 용어와 헌법 확정

### 목적

Project Owner, Panel Engine, History와 Runtime 원칙을 공식화한다.

### 작업 내용

- Core/Domain Engine 분류 제거
- Project Owner는 Engine이 아니라는 규칙 추가
- Engine ↔ 독립 Panel 원칙 추가
- History는 Project Data만 저장한다고 명시
- Selection/active Group/playback/Draft는 History 제외
- Render 후속 Sprint 분리 명시

### 정적 검증

- `00_rule.md`와 56·57 Architecture 문서의 용어·소유권 충돌 검사

### 완료 조건

- Project Data, History, Runtime이 한 가지 의미로 사용된다.

### Gate A2

- 상태: PASS
- 핵심 결과: `00_rule.md`와 56·57 문서가 Project Owner/Panel Engine,
  Project-only History, 복합 Selection Runtime과 Render 동결 원칙으로
  일치한다.
- 충돌 검색: 대상 세 문서의 Core/Domain·Project Engine 혼용은 0건이며,
  `20_src_map.md`와 과거 완료 문서의 현행/역사 용어는 범위 밖으로 보존했다.

## Task A3 — Project Owner 공개 경계와 내부 모듈

### 목적

기존 Project Engine owner를 Editor 아래의 Project Owner로 재분류한다.

### 작업 내용

- 외부에 하나의 Owner read/command/effect port 제공
- Project State/Replace, Transaction, History, Lifecycle/Persistence,
  Source Runtime, Selection Runtime으로 내부 분리
- Panel Runtime을 Owner 공개 책임에서 제외
- 기존 진입점은 임시 호환 adapter로 위임

### 정적 검증

- Owner instance 1개
- Project transaction/replace/lifecycle/source fixture
- Load 실패 원자성, Source dispose-once, History 1회

### 완료 조건

- Owner 내부 책임이 하나의 거대 hook으로 합쳐지지 않는다.
- Panel Runtime은 Owner state에 들어가지 않는다.

### Gate A3

- 상태: PASS
- 핵심 결과: Editor 아래 Project Owner 인스턴스 1개와 단일
  read/command(effect result) port를 두고 기존 Project Engine/cutover
  진입점은 무상태 compatibility adapter로 위임했다.
- 책임 경계: State/Replace, Transaction, History, Lifecycle/Persistence,
  Source Runtime, Selection Runtime의 기존 소형 모듈을 유지했으며 Panel
  Runtime은 Owner port에 포함하지 않았다.

## Task A4 — Project-only History

### 목적

Undo/Redo가 Project Data만 복원하도록 History 계약을 바로잡는다.

### 작업 내용

- `LayerDocumentOwnerHistorySnapshot`에서 session 제거
- before/after는 `LayerDocumentProject`만 clone/validate
- Selection/active Group/playback을 현재 Runtime 값으로 유지
- Undo/Redo 후 현재 Runtime을 새 Project에 대해 normalize
- Source Runtime reconcile은 Project Source diff에서 계산

### 정적 검증

- Transform/Placement/Animation/Source Undo/Redo
- Undo/Redo 전후 current frame/range/Selection/active Group 불변
- 존재하지 않는 Selection/Group/keyframe 최소 보정
- Draft cancel, Cache invalidation과 Source restoration

### 완료 조건

- History snapshot에 Runtime이 없다.
- Undo/Redo는 Project만 바꾸고 Runtime은 유효성만 보정한다.
- Project Owner가 Runtime을 History에 저장하지 않는다.

### Gate A4

- 상태: PASS
- 핵심 결과: History before/after는 `LayerDocumentProject`만 저장하고,
  Undo/Redo는 현재 Selection/active Group/playback/runtimeSession을 target
  Project에 대해 유지 또는 최소 보정한다.
- Source reconcile: Source 존재 diff로 suspend/restore와 분기 폐기 GC를
  계산하며 History에는 Runtime/cache state를 저장하지 않는다.

## Task A5 — Composition Root와 Panel Port

### 목적

Owner와 Panel Engine 조립을 Root의 wiring으로 정리한다.

### 작업 내용

- Canvas/Timeline/Properties/PSD Tree에 최소 port 주입
- shared Transform Draft를 저장되지 않는 Editor Runtime port로 조립
- Owner effect와 Runtime validity command 연결
- Timeline `read/subscribe`를 Canvas/Properties 입력으로 직접 연결
- Owner hook에서 Panel ViewProps 조립 제거

### 정적 검증

- Owner/Engine instance 각 1개
- Root wiring, StrictMode dispose/recreate
- Draft publish → Canvas/Properties 동일 표시
- Root-owned current frame state/ref/store 0

### 완료 조건

- Root만 전체 의존성 조립을 알고 제품 계산은 하지 않는다.
- Panel Engine이 Owner 내부 구현을 import하지 않는다.

### Gate A5

- 상태: PASS
- 핵심 결과: Owner hook은 단일 Project Owner만 만들고, Root가 별도 Editor
  Runtime/Panel port를 주입해 Canvas/Timeline/Properties/PSD Tree Engine
  각 1개와 ViewProps를 조립한다.
- Runtime: shared Transform Draft와 owner effect/validity 연결 및 StrictMode
  dispose/recreate를 유지한다. 동일 playback read/subscribe
  port를 Timeline과 Canvas/Properties frame input에 전달하며 Root는 frame을
  저장하지 않는다.
- 다음 Sprint: Sprint A 완료. Sprint B는 사용자 승인 전 시작하지 않는다.

## Sprint A 검증

- Project/History/Selection/Persistence/Source/Draft verification
- `npm run lint`
- `npm test`
- `npm run build`
- `git diff --check`
- 결과: 전체 PASS (`npm test` 38개 verification)

## 최위험 Task

Task A4. History에서 session 전체를 제거하면서 Source Runtime reconcile과
현재 Runtime 유효성 보정을 정확히 유지해야 한다.

---

# Sprint B — Playback과 Panel 없는 Engine 재분류

## 목표

Playback을 Timeline Runtime으로 옮기고 Animation, Drawing, Text, Audio의
불필요한 Engine 명칭을 제거한다. Render와 cutover는 그대로 유지한다.

## 완료 상태

- current frame/range/isPlaying/clock/transport는 Timeline Runtime 소유다.
- Canvas, Timeline, Properties는 같은 current frame을 표시한다.
- Undo/Redo는 current frame/range를 변경하지 않는다.
- Animation은 순수 모듈이다.
- Drawing/Text/Audio는 독립 Panel이 생길 때까지 active Engine이 아니다.
- Sprint C를 시작하지 않아도 제품이 정상 상태다.

## Task B1 — Playback을 Timeline Runtime으로 통합

### 목적

저장되지 않는 playback 상태와 command를 Timeline Engine에 모은다.

### 작업 내용

- currentFrame, range, isPlaying, clock, scheduler, transport 이전
- Timeline read/subscribe/command port 제공
- Root가 Canvas/Properties/PSD refresh에 frame input 전달
- Root가 Canvas seek intent에 playback command 전달
- New/Open/Replace/active Group/Undo/Redo 후 reset 또는 clamp
- Owner playback action/model/session 호환 필드 제거
- Render가 소비하는 기존 playback helper/public export는 유지

### 정적 검증

- play/pause/seek/step/range/loop
- Project replace와 active Group 전환
- Undo/Redo 후 current frame/range 불변 또는 범위 clamp
- Timeline/Canvas/Properties frame 일치
- React subscription과 StrictMode clock dispose
- Timeline 외 current frame mutation authority 0

### 완료 조건

- current frame Runtime 이전이 완료된다.
- Undo/Redo가 frame을 변경하지 않는다.
- Timeline/Canvas/Properties가 같은 frame을 사용한다.
- Canvas/Properties는 Timeline Engine을 import하지 않는다.

### Gate B1

- 상태: PASS
- 핵심 결과: Timeline Runtime이 currentFrame/range/isPlaying/clock/scheduler/
  transport를 단독 소유하며 Owner playback session/action/model은 제거됐다.
- wiring: Root가 같은 read/subscribe/command port를 Timeline, Canvas,
  Properties, PSD cache와 Canvas seek에 전달하고 frame 사본을 만들지 않는다.
- validity: Project/Group/Undo/Redo 전환 후 현재 frame/range를 유지하고 새
  duration을 벗어난 경우에만 clamp한다.
- 다음 Task: B2 진행

## Task B2 — Animation을 순수 모듈로 재분류

### 목적

Panel과 장기 상태가 없는 Animation 계산에서 Engine 명칭을 제거한다.

### 작업 내용

- keyframe/evaluation/frame conversion/modifier 계산을 순수 모듈로 이동
- 편집 transaction은 Owner command로 유지
- Timeline/Properties는 순수 Animation API 사용
- Render의 기존 Animation import 경로는 compatibility entry로 유지

### 정적 검증

- animation/keyframe/modifier/motion-path fixture
- 순환 import와 Runtime/Project state 소유 여부 확인

### 완료 조건

- Animation은 순수 계산 모듈이며 편집 원본을 만들지 않는다.
- Render 전용 compatibility entry는 후속 Render Sprint까지 남을 수 있다.

### Gate B2

- 상태: PASS
- 핵심 결과: `src/animation/index.ts`가 keyframe/evaluation/frame
  conversion/modifier/motion-path 계산의 단일 pure public entry이며 state,
  Runtime authority, Project 편집 원본을 소유하지 않는다.
- compatibility: Render 파일과 import는 변경하지 않고
  `src/engines/animation/index.ts`의 thin re-export로 기존 경로를 유지한다.
- 경계: 비-Render 소비자는 `@/animation`을 사용하며 계산 구현 중복과
  models↔Animation 순환 import가 없다. 편집은 계속 Owner command다.
- 다음 Task: B3 진행

## Task B3 — Drawing/Text/Audio Engine 명칭 제거

### 목적

독립 Panel이 없는 placeholder 책임을 기존 경계로 돌린다.

### 작업 내용

- Type별 데이터/transaction은 Layer Document와 Owner command에 유지
- Properties Type section/capability로 query와 command 연결
- 현재 placeholder Render 연결은 변경하지 않음
- 미래 독립 Panel 생성 시 Engine 승격 조건 문서화

### 정적 검증

- Drawing/Text transaction
- Audio unsupported capability
- 기존 placeholder 표시 회귀 감시

### 완료 조건

- Drawing/Text/Audio가 active Engine 목록에서 제거된다.
- Layer Type schema와 미래 확장 계약은 유지된다.

### Gate B3

- 상태: PASS
- 핵심 결과: Drawing/Text/Audio query·preparation·capability를
  `src/layer-types/index.ts` 단일 public entry로 재분류하고 기존 Engine
  경로를 제거했다.
- 계약: Properties Type section과 cutover compatibility가 같은 지원 API를
  소비하며 Drawing/Text는 기존 Owner transaction, Audio는 기존
  unsupported 결과를 유지한다.
- Render: placeholder 경로와 Render 파일·구조·이름·public export는
  변경하지 않았다.
- 다음 Sprint: Sprint B 완료. Sprint C는 사용자 승인 전 시작하지 않는다.

## Sprint B 검증

- Timeline playback/Animation/Properties Type verification: PASS
- Render 관련 기존 검증은 변경 없이 회귀 감시만 수행: PASS
- `npm run lint`: PASS
- `npm test`: PASS, 40 verification
- `npm run build`: PASS
- `git diff --check`: PASS

## 최위험 Task

Task B1. Owner session에 결합된 playback을 Timeline Runtime으로 옮기면서
Canvas·Properties 동기화와 Runtime lifecycle을 유지해야 한다.

---

# Sprint C — cutover와 의존성 제거

## 목표

`src/cutover`의 비-Render 책임을 한 경로씩 최종 소유자에게 이전하고
Panel Engine 간 직접 의존성, compatibility와 dead code를 제거한다.

## 완료 상태

- `src/cutover` active code가 없다.
- Root는 wiring만 담당한다.
- Panel Engine 간 직접 import가 없다.
- 현재 Render 구조와 의존성은 후속 Sprint 대상으로 유지된다.
- 코드, 검증과 문서가 최종 구조와 일치한다.

## Task C1 — Panel별 cutover 경로 이전

### 목적

소비 경로를 하나씩 이전해 각 단계가 정상 상태로 끝나게 한다.

### 작업 내용

1. Timeline projection/intent → Timeline Engine
2. Properties evaluation/command → Properties Engine
3. Canvas Draft/commit → Canvas Engine + shared Draft port
4. PSD import/runtime registration → PSD Tree Engine + Owner Source command
5. Project/History commit → Project Owner

현재 Render public port는 동결된 의존성으로 주입하고 내부를 변경하지 않는다.

### 정적 검증

- 경로별 old/new port parity
- transaction/history count
- Draft/Source registration 원자성
- Render 파일 diff 0

### 완료 조건

- `cutover`에 제품 계산과 mutation이 남지 않는다.
- 각 경로 전환 후 제품이 독립적으로 정상 동작한다.

### Gate C1

- 상태: 대기
- 핵심 위험: History 중복, Draft commit 누락, Source 부분 등록
- 다음 Task: 다섯 경로 parity PASS 후 진행

## Task C2 — cutover 삭제와 Root 확정

### 목적

남은 wiring을 Root로 옮기고 `src/cutover`를 제거한다.

### 작업 내용

- Owner/Panel Engine/현재 Render public port를 Root에서 연결
- cutover model/adapter/assembly import 제거
- 새 Coordinator/Service 없이 Root를 작은 wiring section으로 유지

### 정적 검증

- `src/cutover` active import 0
- Root 제품 계산/mutation 0
- Owner/Engine instance와 StrictMode lifecycle

### 완료 조건

- `src/cutover`가 삭제된다.
- Root는 port 주입만 수행한다.

### Gate C2

- 상태: 대기
- 핵심 위험: assembly를 다른 이름으로 재생성
- 다음 Task: Root 책임 검사 후 진행

## Task C3 — Panel Engine 의존성과 compatibility 정리

### 목적

최종 Panel 경계를 우회하는 import와 비활성 코드를 제거한다.

### 작업 내용

- Panel Engine 간 runtime/type import 제거
- Feature re-export 제거
- 확인된 비활성 비-Render controller 제거
- ProjectSource offline migration 유지
- Project/Drawing/Text/Audio의 이전 Engine alias 제거
- Playback/Animation의 Render 호환 entry는 후속 Sprint 대상으로 기록
- Render 관련 import, barrel, 파일과 이름은 제외

### 정적 검증

- Panel Engine import graph
- orphan/dead import
- Render 호환 예외를 제외한 legacy alias 0
- offline migration fixture

### 완료 조건

- Panel Engine은 Owner port와 허용된 순수/Render API만 소비한다.
- 비-Render 호환 경로가 없다.

### Gate C3

- 상태: 대기
- 핵심 위험: type-only contract 중복과 Render 범위 침범
- 다음 Task: 단일 contract와 Render diff 0 확인 후 진행

## Task C4 — 문서와 전체 검증

### 목적

헌법, Source Map, Architecture 문서와 검증을 실제 구조에 맞춘다.

### 작업 내용

- `00_rule.md`, `20_src_map.md`, 56·57 문서 갱신
- Core/Domain/cutover 경로 assertion 수정
- 제품 행동 assertion 유지
- 완료 Architecture 문서 작성
- Render 후속 Sprint 필요성 기록

### 정적 검증

- 전체 verification
- `npm run lint`
- `npm test`
- `npm run build`
- `git diff --check`
- 500줄 이상 TypeScript/TSX 확인

### 완료 조건

- 문서, 검증과 실제 파일 책임이 일치한다.
- Persistence, Source reconnect, Project-only History, Draft와 기존 Render
  계약이 유지된다.

### Gate C4

- 상태: 대기
- 핵심 위험: 구조 assertion 수정 중 행동 검증 약화
- 다음 Task: 전체 PASS 후 프로그램 종료

## Sprint C 검증

- 전체 제품 행동 verification
- Panel Engine boundary/dead code verification
- Render 파일과 책임 변경 0 확인
- lint/test/build/diff check
- Browser QA는 사용자 요청 시 별도 수행

## 최위험 Task

Task C1. `cutover`의 transaction, Draft, Source registration을 한 경로씩
옮기면서 원자성과 History 횟수를 유지해야 한다.

---

## 8. 전체 완료 조건

- Project Owner가 Editor 아래의 유일한 Project 경계다.
- Project Owner 내부 책임은 작은 모듈로 분리된다.
- History snapshot은 `LayerDocumentProject`만 저장한다.
- Selection, active Group, playback과 모든 Runtime은 History에서 제외된다.
- Undo/Redo는 Project만 복원하고 Runtime은 유효성만 보정한다.
- Timeline Runtime이 playback 상태와 command를 소유한다.
- Canvas와 Properties는 Root가 전달한 같은 current frame을 사용한다.
- shared Transform Draft는 저장되지 않는 Editor Runtime이다.
- Panel Engine은 Canvas, Timeline, Properties, PSD Tree다.
- Animation은 순수 모듈이며 Drawing/Text/Audio는 Panel 생성 전까지
  Engine이 아니다.
- Render가 사용하는 Playback/Animation compatibility entry는 후속 Render
  Sprint까지 기술적 예외로 유지될 수 있다.
- `src/cutover`와 Panel Engine 간 직접 import가 없다.
- Render 구조, 이름, 파일, 책임과 동작은 변경되지 않는다.
- 각 Sprint 종료 시 독립적으로 빌드·검증 가능한 정상 상태다.

---

## 9. 진행 현황

| Sprint | Task | 상태 | Gate |
|---|---|---|---|
| A | A1 Baseline/History Inventory | 완료 | PASS |
| A | A2 용어/헌법 | 완료 | PASS |
| A | A3 Project Owner 경계 | 완료 | PASS |
| A | A4 Project-only History | 완료 | PASS |
| A | A5 Composition Root/Port | 완료 | PASS |
| B | B1 Timeline Playback | 완료 | PASS |
| B | B2 Animation 순수 모듈 | 완료 | PASS |
| B | B3 Drawing/Text/Audio 재분류 | 완료 | PASS |
| C | C1 Panel별 cutover 이전 | 대기 | - |
| C | C2 cutover 삭제/Root 확정 | 대기 | - |
| C | C3 Panel 의존성/compatibility | 대기 | - |
| C | C4 문서/전체 검증 | 대기 | - |

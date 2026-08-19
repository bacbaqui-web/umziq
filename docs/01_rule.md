# 움직(UMZIQ) Constitution

## 1. 제품 철학

- After Effects를 참고하되 숏폼 제작에 필요한 기능을 가볍고 쉽게 만든다.
- 현재 필요한 책임을 명확하게 구현하고 불필요한 범용화는 피한다.
- 기능을 추가할 때 기존 계약과 사용자 결과를 가능한 한 유지한다.
- 구조는 이름이나 파일 수가 아니라 데이터 소유권과 책임으로 판단한다.
- 동일한 의미의 편집 원본을 여러 곳에 만들지 않는다.

## 2. Project와 Layer Document

- Layer Document 하나는 Project 안의 작업 Layer 하나다.
- Layer별 편집 데이터의 유일한 원본은 Layer Document다.
- Project는 Layer Document 집합, Project metadata와 Source descriptor를
  소유할 수 있다.
- Project 밖에 Timeline Item, Canvas Layer, Render Item이나 Panel Data를
  또 다른 편집 원본으로 만들지 않는다.
- 모든 저장 데이터는 Plain Data여야 한다.
- Runtime 객체는 Project와 Layer Document에 저장하지 않는다.
- 새 Layer Type은 같은 Project와 Layer Document 구조를 확장한다.
- 구체 구조는 `docs/architecture/10_project_architecture.md`를 따른다.

## 3. Nexus

- Nexus는 움직 내부 Project 세계의 본진이자 canonical Project를 소유하고 변경하는
  유일한 authority다.
- UI와 Engine은 Project object를 직접 mutation하지 않는다.
- 모든 저장 변경은 공개 command와 검증된 transaction을 통한다.
- 여러 영역을 바꾸는 작업도 하나의 Project transaction으로 조합한다.
- 사용자 action 한 번은 History 한 건만 만든다.
- Nexus는 Panel Runtime, playback, Draft, viewport와 Cache를
  소유하지 않는다.
- Nexus는 Gateway, Platform Adapter, Browser/OS API, File/Handle과 제품 workflow를
  import하거나 호출하지 않는다.
- Engine에는 Nexus 전체가 아니라 필요한 Read, Transaction, Replace, History와
  Selection Port만 공개한다.

## 4. Panel과 Engine

- Engine은 독립 Panel과 명확한 편집 책임이 있을 때만 둔다.
- Panel은 사용자 Intent를 담당 Engine의 command로 전달한다.
- Panel Engine은 다른 Panel Engine의 내부 구현이나 상태를 직접 수정하지
  않는다.
- Engine은 Project Data를 소유하지 않는다.
- Engine은 담당 Panel의 Tool State, Draft, Cache와 계산 결과처럼 저장되지
  않는 Runtime만 소유할 수 있다.
- 독립 Panel이 없는 기능은 순수 모듈이나 기존 책임 안에 둔다.
- 새로운 Engine은 전체 구조를 더 단순하게 만들 때만 추가한다.

## 5. Editor Root

- Editor Root는 Nexus, 현재 플랫폼 Gateway, Runtime과 Panel Engine을 각각 한 번
  생성하고 조립한다.
- 공유값은 원래 소유자를 구독해 필요한 Panel에 전달한다.
- Editor Root는 공유값의 사본, 두 번째 Nexus나 Runtime을 만들지 않는다.
- Editor Root에서 Project 계산, 제품 mutation, workflow와 기능 구현을 하지
  않는다.
- Gateway 전체를 Engine에 Service Locator로 전달하지 않고 Controller가 필요한 최소
  capability Port만 주입한다.

## 6. Gateway

- Gateway는 움직 밖의 저장소, 파일, 장치, 권한, clipboard와 OS capability로 나가는 공식
  Architecture 경계다.
- Gateway는 하나의 거대한 런타임 객체가 아니라 capability별 작은 Port와 Platform
  Adapter의 집합이다.
- Gateway 외부 capability 계약과 플랫폼별 구현은 Gateway public boundary에서 찾을 수
  있어야 한다.
- Platform Adapter는 Project mutation, 제품 workflow, History와 UI state를 소유하거나
  변경하지 않는다.
- Nexus와 Gateway는 서로 import하거나 호출하지 않는다. 양쪽이 필요한 사용자 흐름은
  Engine Controller가 각각의 최소 Port를 사용해 소유한다.
- Platform Adapter는 Editor Root에서 현재 플랫폼에 맞게 한 번 조립한다.
- 실제 제품 기능이 없는 미래 capability와 플랫폼 Adapter를 미리 만들지 않는다.
- Port는 구조상의 실행 계층이 아니라 Controller와 Nexus, Gateway 또는 Runtime 사이의
  interface다.

## 7. Runtime

- Runtime은 저장되지 않는 현재 작업 상태다.
- Draft, Cache, decoded resource, Canvas, playback, Selection과 UI state는
  Runtime이다.
- Runtime은 Project Data를 대신하는 편집 원본이 될 수 없다.
- Project가 바뀌면 Runtime은 유효성에 맞춰 reconcile, invalidate, rebuild
  또는 dispose한다.
- PointerMove와 연속 입력은 Draft만 변경한다.
- PointerUp 또는 명시적 확정에서만 Project를 commit한다.
- Cancel은 Draft를 폐기하고 committed Project로 돌아간다.

## 8. History

- Undo/Redo는 Project Data만 복원한다.
- Selection, active Group, current frame, playback, Draft, Cache와 Panel
  state는 History 대상이 아니다.
- Undo/Redo 뒤 Runtime은 과거로 복원하지 않고 현재 Project에 맞게 최소한으로
  보정한다.
- 현재 frame은 Undo/Redo 때문에 과거 편집 시점으로 이동하지 않는다.
- 세부 계약은 `docs/architecture/13_history_draft_architecture.md`를 따른다.

## 9. Architecture 원칙

- 작업 전에 `docs/architecture/README.md`의 읽기 순서와 작업별 라우팅 표로
  관련 canonical 문서를 선택한다.

- Project: `docs/architecture/10_project_architecture.md`
- Render: `docs/architecture/11_render_architecture.md`
- Timeline과 Playback: `docs/architecture/12_timeline_playback_architecture.md`
- History와 Draft: `docs/architecture/13_history_draft_architecture.md`
- Canvas와 Overlay: `docs/architecture/14_canvas_overlay_architecture.md`
- Source: `docs/architecture/15_source_architecture.md`
- Animation: `docs/architecture/16_animation_architecture.md`
- Project File Workflow:
  `docs/architecture/17_project_file_workflow_architecture.md`
- Platform Gateway:
  `docs/architecture/18_platform_gateway_architecture.md`
- Architecture와 현재 코드가 다르면 현재 사실은 `docs/20_src_map.md`에 기록하고,
  해소 작업이 승인된 경우에만 `docs/98_sprint_plan.md`에 범위를 정한다.

## 10. 문서 체계

- AI 코딩 에이전트의 공통 작업 태도와 절차는 저장소 루트의
  `AGENTS.md`를 따른다. 이 파일은 문서 체계상 00번 역할을 한다.
- 제품, 설계와 작업 기록 Markdown은 `docs/` 아래에 둔다. 도구가 정해진
  위치에서 읽는 지침 파일은 예외다.
- `docs/01_rule.md`는 변하지 않는 제품 철학과 운영 원칙만 담는다.
- `docs/architecture/10~19_*.md`는 계속 갱신되는 영구 설계 법전이다.
- `docs/20_src_map.md`는 현재 파일 위치와 책임을 기록한다.
- `docs/completed/001_*.md`부터 세 자리 연속 번호로 완료된 기능과 Sprint의 역사
  기록을 쌓는다.
  `docs/completed/README.md`를 색인으로 사용하며 현재 설계는 원문이 아니라
  Architecture를 따른다.
- `docs/97_next_sprint.md`는 다음 Sprint 초안이다.
- `docs/98_sprint_plan.md`는 현재 Sprint 하나의 계획과 상태만 담는다.
- `docs/99_recent_task.md`는 작업을 멈춘 시점의 가장 최근 Task 한 건만
  보고한다. 작업을 계속하는 동안 매 Task마다 갱신하지 않으며, 루트
  에이전트만 갱신한다.
- Architecture를 Sprint 문서에 반복하지 않고 필요한 문서를 참조한다.
- 파일을 이동하거나 이름을 바꾸면 모든 문서 참조도 함께 갱신한다.

## 11. 움직 구현 원칙

- 하나의 파일은 하나의 주된 책임을 갖는다.
- 기본 의존 방향은 `Engine → Composer → Controller → Helper`다.
- Engine은 Panel 기능의 공개 경계이며 command, ViewModel과 ViewProps를 외부에
  제공한다.
- Composer는 관련된 여러 Controller 조립과 공개 API 구성만 담당한다. 제품
  계산, Project mutation과 독립적인 Runtime 책임을 추가하지 않는다.
- Composer는 Controller 사이의 실행 순서, 조건과 비즈니스 규칙을 결정하지
  않는다. 여러 단계로 이어지는 하나의 사용자 흐름은 그 흐름을 소유하는 하나의
  Controller가 담당하며, Composer는 독립 Controller를 조립해 공개 ViewProps와
  command를 구성하기만 한다.
- Controller는 하나의 사용자 동작 또는 하나의 Runtime 수명을 담당하며 해당
  책임에 필요한 순수 Helper를 사용한다.
- Helper는 저장 상태, UI state와 Runtime을 소유하지 않는 순수 계산만 담당한다.
- Controller가 다른 Controller나 Composer를 직접 조립하거나 참조하지 않는다.
- Composer가 다른 Composer를 직접 조립하거나 참조하지 않는다.
- 여러 Controller를 함께 구성해야 하면 Controller wrapper가 아니라 Composer를
  둔다.
- 작은 Engine은 별도 Composer 파일 없이 Composer 역할을 겸할 수 있다. 여러
  Controller 조립이나 공개 API 구성이 커져 한 파일 한 책임을 흐리면 명시적인
  Composer로 분리한다.
- Adapter는 서로 다른 공개 계약 사이의 변환만 담당하며 새로운 상태 원본이나
  제품 정책을 만들지 않는다.
- Engine과 Controller는 외부 capability를 위한 `window`, `document`, `navigator`와
  File System Access API를 직접 사용하지 않는다. DOM presentation과 Audio/Render 같은
  Platform Runtime API는 명시적인 UI/Runtime Adapter 경계에서 사용할 수 있다.
- 관련 없는 파일과 제품 동작을 함께 변경하지 않는다.
- 추측성 패치, 임시 예외, 강제 refresh와 중복 Runtime을 만들지 않는다.
- 구조 변경 전 현재 데이터 흐름과 책임을 실제 코드로 확인한다.
- 새 파일이나 책임 변경은 `docs/20_src_map.md`에 반영한다.
- 현재 Sprint의 범위와 금지 사항은 `docs/98_sprint_plan.md`를 따른다.

## 12. 움직 검증 원칙

- CRG는 실제 코드 연결과 변경 영향 확인에 사용하되 제품 의도와 Architecture의
  authority로 사용하지 않는다.
- 정적 검증은 실제 Browser QA 통과를 의미하지 않는다.
- QA는 사용자가 명시적으로 요청했을 때만 수행한다.
- 요청된 Browser QA는 headless를 우선한다.
- 실제 Chrome QA는 사용자가 명시적으로 요청한 경우에만 기존 Chrome 환경의
  새 창에서 수행한다.
- QA를 위해 별도 브라우저 앱이나 사용자 프로필을 만들지 않는다.
- Project alias를 해석하는 검증은 `npm test` 또는
  `node scripts/runVerificationSuite.mjs`를 사용한다.
- 정적 검증과 실제 Browser·picker·microphone·출력 QA 결과를 구분해 보고한다.

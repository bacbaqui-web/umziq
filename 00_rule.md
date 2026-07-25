1. 프로젝트 철학

- After Effects를 참고하되 숏폼 제작에 필요한 기능만 가볍고 쉽게 만든다.
- 현재 필요한 기능을 단순하게 구현하며, 불필요한 범용화는 하지 않는다.
- 기존 기능을 가능한 한 유지하면서 새로운 기능을 추가한다.
- `Layer Document` 하나는 프로젝트 안의 작업 레이어 하나를 의미한다.
- Project는 `Layer Document`들의 집합이다.
- `Layer Document`는 프로젝트의 유일한 편집 대상이며 모든 저장 데이터를 소유한다.
- 모든 UI와 Engine은 선택된 같은 `Layer Document`를 읽고 수정한다.
- Project는 `Layer Document`를 제외한 편집 데이터를 소유하지 않는다.
- Layer Document 외부에 Timeline State, Canvas Layer, Panel Data, Render Item 등 또 다른 편집 원본을 만들지 않는다.
- Project에 저장되는 편집 데이터의 유일한 소유자는 항상 `Layer Document`다.

2. 프로젝트 구조

### Layer Document 최상위 철학

- `Layer Document` 하나는 프로젝트 안의 작업 레이어 하나를 의미한다.
- 프로젝트의 유일한 편집 대상은 `Layer Document`다.
- Project는 `Layer Document`들의 집합이다.
- 모든 저장 데이터는 `Layer Document`가 소유한다.
- Canvas, Timeline UI, 모든 Panel과 모든 Engine은 선택된 같은 `Layer Document`를 읽고 수정한다.
- 모든 UI와 Engine은 같은 `Layer Document`를 읽고 수정한다.
- Panel끼리는 직접 통신하거나 서로의 상태를 수정하지 않는다.
- Engine끼리는 다른 Engine의 상태나 내부 구현을 직접 수정하지 않는다.
- `Layer Document`가 변경되면 각 화면은 같은 `Layer Document`를 다시 읽어 파생 결과를 계산한다.
- 동일한 편집 데이터를 별도 Store, Timeline Item, Render Item, Panel State에 중복 저장하지 않는다.
- Timeline State, Canvas Layer, Panel Data, Render Item은 편집 원본이 될 수 없으며 `Layer Document`에서 파생하거나 저장되지 않는 Runtime으로만 존재할 수 있다.

### Layer Document 구조

- `Layer Document`는 모든 Layer가 공유하는 공통 영역과 Layer Type별 확장 영역으로 구성한다.
- `Layer Document`는 자신의 ID, 사용자 표시 이름, revision, Layer Type을 직접 소유한다.
- 사용자 표시 이름은 Source 이름과 분리된 Layer 편집 데이터이며 Source에 저장하지 않는다.
- 공통 영역은 Source 참조, Transform, Placement, Animation, Effect, Modifier다.
- Placement는 시작 시간, 길이, 순서, 표시 여부, Source Offset, Alias, 부모 Group처럼 Layer의 배치에 필요한 값만 가진다.
- `Timeline`은 UI와 담당 Engine의 이름이며 저장 데이터 영역의 이름으로 사용하지 않는다.
- Timeline UI는 `Layer Document.common.placement`를 표시하고 수정한다.
- Type별 확장 영역은 PSD, Drawing, Text, Audio, Video, Shape, Group 등 해당 Layer Type에 필요한 데이터만 가진다.
- `type`과 Type별 확장 데이터는 서로 불일치할 수 없도록 discriminated union 또는 동등한 검증 구조를 사용한다.
- 새로운 Layer Type은 Project 저장 구조나 선택 구조를 새로 만들지 않고, `Layer Document`에 Type별 데이터 영역과 담당 Engine/Panel/Renderer 연결만 추가한다.
- File, FileHandle, ImageBitmap, Canvas, AudioNode, Decoder, GPU Resource, Render Cache 같은 Runtime 객체는 `Layer Document`에 저장하지 않는다.

### Source

- PSD Tree는 PSD와 외부 미디어의 원본 Source를 관리한다.
- `Layer Document`는 Source를 참조하는 작업 객체이며 PSD 레이어 자체가 아니다.
- Source는 원본 identity, 경로, fingerprint/version, availability, Refresh/Reconnect 정보만 담당한다.
- Transform, Placement, Animation, Effect, Modifier와 Layer Type별 편집 데이터는 Source에 저장하지 않는다.
- 같은 Source를 참조하는 여러 `Layer Document`는 원본 Resource를 공유할 수 있지만 편집 데이터는 서로 독립적이다.
- 외부 원본이 없는 Drawing, Text, Shape 등의 Layer는 Source 참조가 없을 수 있다.

### Duplicate와 Timeline UI

- Duplicate는 같은 Source를 참조하는 새로운 `Layer Document`를 생성한다.
- Duplicate된 `Layer Document`의 Transform, Placement, Animation, Effect, Modifier와 Type별 데이터는 원본과 독립적이다.
- Duplicate는 새 `Layer Document` 생성, 배치, 선택 변경을 하나의 Project Transaction과 History 1회로 처리한다.
- Timeline UI와 Timeline Engine은 Layer를 소유하지 않고 `Layer Document.common.placement`만 표시하고 수정한다.
- Timeline UI와 Timeline Engine은 별도의 Layer 사본이나 편집 원본을 만들지 않는다.

### Panel과 Engine

- Properties는 특별한 중심 Panel이 아니며, Transform, Drawing, Text, Audio, Video, Effect, Modifier Panel과 동일한 규칙을 따른다.
- 모든 Panel은 선택된 `Layer Document` 하나를 읽고 자신이 담당하는 영역만 수정한다.
- Engine은 Project Data를 소유하지 않는다.
- Engine은 Runtime Cache, Draft, Tool State, Preview 계산 결과처럼 Project에 저장되지 않는 Runtime 데이터만 소유할 수 있다.
- Engine이 소유하는 Runtime 데이터는 `Layer Document`의 대체 편집 원본이 될 수 없다.
- Project에 저장되는 데이터는 반드시 `Layer Document`에 저장한다.
- Engine은 `Layer Document`의 자신이 담당하는 영역에 대한 Command와 Query를 제공한다.
- Engine의 개수는 고정하지 않는다.
- Engine은 프로젝트 공통 기능을 담당하는 Core Engine과 특정 Layer Type의 독립 기능을 담당하는 Domain Engine으로 구분한다.
- Core Engine은 Project, Timeline, Canvas, Playback, History처럼 여러 Layer Type이 함께 사용하는 공통 책임을 담당한다.
- Domain Engine은 Drawing, Text, Audio처럼 특정 Layer Type의 독립적인 편집 책임을 담당한다.
- 향후 Video, Shape 등 새로운 Layer Type도 같은 기준에 따라 Domain Engine을 둘 수 있다.
- Domain Engine은 기능의 수가 많다는 이유만으로 추가하지 않는다.
- 다음 조건을 모두 만족할 때만 Domain Engine을 추가한다.
  - 담당하는 `Layer Document` 영역과 책임이 명확하다.
  - 다른 Engine의 내부 구현과 강하게 섞이지 않는다.
  - 독립적인 Command와 Query 흐름으로 성장할 수 있다.
  - Engine 추가가 중복이나 직접 연결을 늘리지 않고 전체 구조를 더 단순하게 만든다.
- Engine 간 연결과 의존성 주입은 Composition Root에서 수행한다.
- 여러 영역을 함께 변경하는 새 Layer 생성, Duplicate, 삭제, Group 이동, Source 교체는 Project Transaction으로 조합한다.
- 사용자 Action 한 번은 History 한 번만 생성한다.
- 위 조건을 충족하지 않는 작은 기능은 기존 담당 Engine 또는 Controller에 둔다.
- 새로운 Engine을 추가하거나 기존 Engine의 책임을 변경할 때는 책임, 데이터 흐름, 공개 Command/Query, Engine Boundary를 문서에 먼저 명시한다.
- 프로젝트 문서에서는 Engine을 다른 구조명으로 완곡하게 부르지 않고 Core Engine 또는 Domain Engine으로 명확히 표현한다.

3. 데이터 규칙

- 프로젝트에 저장되는 데이터는 항상 Plain Data로 유지한다.
- 데이터 구조가 변경되어도 기존 프로젝트는 normalize를 통해 안전하게 열려야 한다.

4. 문서 체계와 번호 규칙

- `00_rule.md`는 프로젝트 전체 운영 규칙을 담는다.
- `20_src_map.md`는 현재 소스 구조, 파일 책임, 문서 지도를 담는다.
- `40~96_*.md`는 완료된 기능 또는 완료된 Sprint를 나중에 다시 이해하기 위한 영구 기능 문서다.
- `97_next_sprint.md`는 다음 Sprint를 시작하기 전의 계획 초안과 인수인계를 담는다.
- `98_sprint_plan.md`는 현재 진행 중인 Sprint 하나의 계획과 진행 상황만 담는다.
- `99_recent_task.md`는 루트 에이전트가 작업을 멈추는 시점 기준, 바로 직전 Task 한 건의 결과만 담는다.
- `40~96` 영구 문서는 작성 순서대로 1씩 증가시킨다.
- 완료된 Sprint마다 `40~96` 범위에 영구 문서 하나를 만든다.
- Sprint 결과를 단일 history 문서에 누적하지 않는다.
- `98_sprint_plan.md`와 `99_recent_task.md`는 진행용 문서이므로 누적 보관하지 않는다.
- 완료된 기능의 이유, 설계, Task 과정, 결과, QA, 알려진 한계를 영구 문서에 정리한다.
- 파일 이름을 변경하면 모든 문서 내부 참조도 함께 갱신한다.

5. 작업 규칙

- 하나의 .ts 또는 .tsx 파일은 하나의 주된 책임만 가진다.
- UI는 프로젝트 데이터를 직접 수정하지 않고 담당 Engine을 통해 변경한다.
- 문제는 먼저 담당 Engine 안에서 해결한다.
- 새로운 기능은 기존 구조에 추가하는 것을 우선으로 하며, 구조 변경은 마지막 선택으로 한다.
- 관련 없는 파일은 수정하지 않는다.
- 새 파일을 추가하거나 파일의 책임이 변경되면 20_src_map.md를 함께 업데이트한다.
- Composer는 여러 Controller 조립과 공개 API 구성만 담당하며 제품 계산이나 mutation을 구현하지 않는다.
- Controller는 다른 Controller나 Composer를 import하지 않는다. 여러 Controller를 조립하기 위한 Controller import는 Composer에서만 한다.
- Composer는 다른 Composer를 import하지 않는다.
- Controller 하나를 연결하기 위해 기계적으로 Composer를 추가하지 않는다.

6. 서브에이전트 활용 규칙

- 감독관은 루트 에이전트만 수행하며, 서브에이전트는 작업자 역할만 수행한다.
- 감독관은 `98_sprint_plan.md`의 Task 순서대로 지시, 검토, 재지시를 담당한다.
- 작업자는 맡은 Task만 수행하고, Task 외 의사결정이나 Sprint/QA/다음 Task 판단을 하지 않는다.
- 작업 중 문제가 발생하면 작업자는 해결 방향을 임의로 판단하지 않고 감독관에게 보고한다.
- 서브에이전트는 기본 1명만 사용하며, 하위 서브에이전트 생성은 금지한다.
- 서브에이전트에는 전체 대화 맥락을 넘기지 않고 필요한 Task 지시와 관련 파일 목록만 전달한다.
- QA는 사용자가 명시적으로 요청했을 때만 진행하고, 자동 검증은 Task 성격에 맞게 필요한 범위에서 수행한다.
- 감독관은 작업자의 응답이 늦다는 이유만으로 재촉하지 않는다.
- 감독관은 시간 간격을 기준으로 중간보고를 강제하지 않는다.
- 감독관은 응답이 없다는 이유만으로 작업자를 중단하거나 새 작업자로 교체하지 않는다.
- 작업자는 조사 완료, 구현 완료, 검증 완료, 진행 불가 상태처럼 안전한 단계가 바뀔 때만 보고한다.
- 작업 중 문제가 생기거나 진행할 수 없는 경우에는 즉시 감독관에게 보고한다.
- 명시적인 오류, 중단 상태, 진행 불가 보고가 없으면 감독관은 작업자가 계속 진행 중인 것으로 본다.
- 빌드, 테스트, 코드 탐색처럼 시간이 오래 걸리는 작업은 정상적인 대기 상태로 인정한다.
- 작업자는 `99_recent_task.md`를 직접 작성하거나 수정하지 않는다.
- 작업자는 완료 결과와 발견사항을 감독관에게 직접 보고한다.
- 감독관은 작업을 계속 진행하는 동안 매 Task마다 `99_recent_task.md`를 작성하지 않는다.
- 감독관은 작업을 멈추는 시점에 현재까지의 직전 작업 결과를 `99_recent_task.md`에 작성한다.
- `99_recent_task.md`는 루트와 서브 사이의 통신 문서가 아니라 사용자 또는 외부 AI 검토용 보고서다.
- `99_recent_task.md`에는 멈춘 시점 기준으로 가장 최근에 수행한 Task 한 건만 기록한다.
- 이전 Task 내용은 누적하지 않고 문서 전체를 교체한다.
- Sprint 진행 상태는 계속 `98_sprint_plan.md`를 기준으로 관리한다.

7. 작업 종료 규칙

- npm run lint
- npm test
- npm run build
- git diff --check
  를 작업 성격에 맞는 범위에서 실행한다.
- QA는 사용자가 명시적으로 요청했을 때만 실행한다.
- 작업을 멈추는 시점이라면 루트 에이전트가 `99_recent_task.md`에 가장 최근 Task 한 건만 기록한다.
- 500줄 이상인 .ts 또는 .tsx 파일이 있다면 리팩토링 제안 항목에 파일명과 현재 줄 수만 기록한다. 리팩토링은 진행하지 않는다.

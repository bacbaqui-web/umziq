# Architecture 계약과 회귀 Baseline Sprint 완료 기록

## 결과

- 최종 목표 용어를 Nexus, Gateway, Editor Root, Menu Engine, Visual Engine과 Audio
  Engine으로 확정했다.
- Persistence를 별도 실행 계층이 아닌 pure Helper + Storage Capability Port + Platform
  Adapter 책임군으로 고정했다.
- Nexus와 Gateway는 서로 직접 통신하지 않고 Controller가 필요한 최소 Port를 각각
  사용한다는 의존 방향을 Constitution과 Architecture에 반영했다.
- 현재 구현 이름과 목표 Architecture 이름을 구분했다. 제품 코드 rename과 이동은 하지
  않았다.

## Architecture 문서

- Architecture 10: Nexus, Editor Root와 Engine 관계
- Architecture 11: Menu Export Controller, encoder Runtime과 destination Gateway 구분
- Architecture 15: Source Access, Library Reconnect와 Open 자동 준비 구분
- Architecture 17: Menu Project Session과 Persistence 책임
- Architecture 18: Gateway, capability Port와 Platform Adapter 계약
- Architecture README: 읽기 순서와 작업별 routing

## 회귀와 경계 Baseline

- 기존 characterization에 Export 성공의 최종 frame progress를 추가했다.
- 동일 Source runtime-only Reconnect 전후 Project 불변을 직접 검증해 History 0 의미를
  고정했다.
- `verifyPlatformBoundaryBaseline.ts`가 현재 Platform type/API, Project façade 의존과
  Controller instance 의존 파일 목록을 exact baseline으로 고정한다.
- `verifyEngineImportBoundaries.ts`의 Engine 목록에 Drawing과 PSD Tree를 포함했다.
- baseline 항목은 제거 예정 Sprint 2~10과 연결되며 새 위반 파일은 자동 실패한다.

## 검증

- 같은 Light 서브에이전트가 Task 1~4를 순서대로 독립 검토했다.
- ESLint 통과
- verification suite 66개 통과
- TypeScript/Vite build는 이번 Sprint와 무관한 기존 `src/engines/psd-tree`의 누락 export,
  type과 implicit any 오류 7건으로 완료하지 못했다. 직전 056 기록과 같은 기존 blocker다.
- Markdown link 검사와 `git diff --check` 통과
- 실제 Browser picker, PSD/Audio 파일, microphone/device, codec와 export destination 수동
  QA는 실행하지 않았다. 이번 Sprint는 제품 동작을 변경하지 않아 완료 조건에는 포함하지
  않았다.

## 후속

다음 Sprint는 Project Owner의 동작을 보존하며 Nexus로 전환한다. Gateway 구현, Menu
Engine 이동과 다른 Engine rename은 해당 후속 Sprint 전까지 시작하지 않는다.

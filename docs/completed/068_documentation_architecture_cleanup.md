# 문서·Architecture 정리 완료 기록

## 상태

- 완료
- 코드와 제품 동작 변경 없음

## 목적

Nexus·Gateway·Editor Root·Menu·Visual·Audio 전환이 끝난 뒤 canonical 문서에 남은 옛
명칭, 전환기 설명과 완료 Sprint 중복을 제거한다.

## 완료 내용

- `docs/01_rule.md`에서 범용 에이전트 절차를 줄이고 움직 고유 Architecture와 검증
  원칙을 남겼다.
- Project Architecture의 목표/전환 표를 현재 공식 용어 정의로 교체했다.
- Timeline과 Animation 문서의 Composition Root, Properties Engine과 Audio Effects
  Engine 표현을 Editor Root, Visual Engine과 Audio Engine으로 통일했다.
- Drawing 계약을 Project, Render, History, Canvas와 저장 책임 본문에 통합했다.
- `17_persistence_lifecycle_architecture.md`를
  `17_project_file_workflow_architecture.md`로 바꾸고 Save/Open/Project Session 책임을
  직관적인 현재형으로 설명했다.
- Source Map에서 `src/engines/project/`가 독립 Panel Engine이 아니며,
  `src/engines/psd-tree/`가 현재 Editor Root에서 조립되지 않는 과거 경계임을 명시했다.
- 완료 Roadmap을 `97·98`에 중복하지 않고 다음 Sprint와 현재 Sprint 상태 문서로
  초기화했다.
- Completed 원문은 보존하고 Architecture 파일 rename 때문에 필요한 링크만 갱신했다.

## 문서 원칙

- 현재 계약은 `docs/01_rule.md`와 `docs/architecture/`가 소유한다.
- 현재 구현 위치는 `docs/20_src_map.md`가 소유한다.
- 완료 과정과 검증 결과는 `docs/completed/`만 소유한다.
- `97`은 다음 Sprint 초안, `98`은 현재 Sprint 하나, `99`는 최근 Task 한 건만 담는다.

## 남은 구조 판단

- `src/engines/project/`의 core/workflow 코드를 Architecture 이름에 맞게 이동하는 작업은
  코드 리팩터링이므로 이번 문서 정리에서 수행하지 않았다.
- 사용되지 않는 `src/engines/psd-tree/`의 제거 또는 Library 흡수도 별도 코드 정리에서
  실제 import와 회귀 검증을 거쳐 결정한다.

## 검증

- canonical 문서의 옛 Architecture 명칭 검색 통과
- Markdown 85개 파일의 상대 링크 존재 여부 검사 통과
- Completed 001~068 연속 번호와 색인 확인 통과
- `git diff --check` 통과

문서만 변경했으므로 제품 lint, test, build와 실제 Browser QA는 실행 대상이 아니다.

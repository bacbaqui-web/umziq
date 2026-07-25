# 프로젝트 운영 규칙 정리 및 다음 작업 제안

## 이번 작업

제품 코드는 수정하지 않고 `00_rule.md`의 운영 규칙을 정리했다.

### Sprint 문서 작성

- `98_sprint_plan.md`는 구현에 필요한 설계와 제약을 유지하되 반복을 줄인다.
- 공통 철학과 제약은 문서 앞부분에 한 번만 작성한다.
- Task는 목적, 작업 내용, 정적 검증, 완료 조건과 Task 전용 규칙만 담는다.
- `00_rule.md`와 영구 Architecture 문서는 다시 설명하지 않고 참조한다.
- Gate는 PASS/FAIL, 발견 문제, 수정 사항, 다음 Task 진행 여부만 기록한다.

### 브라우저 QA

- QA는 사용자가 요청했을 때만 수행한다.
- 요청된 QA는 헤드리스 브라우저를 기본으로 사용한다.
- 실제 Chrome은 사용자가 명시적으로 요청했을 때만 사용한다.
- 별도 앱 인스턴스나 사용자 프로필을 만들지 않는다.
- 실제 Chrome QA는 기존 프로필의 새 창에서 진행하고 기존 창과 탭은
  건드리지 않는다.

## 현재 프로젝트 상태

`Layer Document Architecture Migration`은 구현, 정적 검증과 실제
Browser QA까지 완료됐다.

- Project의 편집 원본은 Layer Document 집합으로 통일됐다.
- Canvas, Timeline, Properties와 PSD Tree가 같은 Layer Document를 본다.
- Duplicate는 Source를 공유하는 독립 Layer Document를 생성한다.
- Legacy 편집 원본과 양방향 쓰기 구조는 제거됐다.
- 현재 가장 큰 구조적 한계는 제품 save/load 흐름이 없다는 점이다.
- 앱을 다시 열면 빈 Source Registry와 project-root Group에서 시작한다.
- 기존 형식 migration은 검증된 offline 경계에만 있고 제품 load 흐름에는
  연결되지 않았다.

## 다음 작업 제안

### 1순위: Layer Document Persistence & Load Integration

현재 구조를 다시 뜯기 전에 저장과 불러오기 경계를 완성하는 것을
추천한다. 이후 Drawing, Text, Audio 기능을 추가해도 같은 Project
Document 형식으로 저장할 수 있어야 하기 때문이다.

권장 범위:

- 현재 Layer Document Project의 직렬화/역직렬화 계약
- schema version, normalize와 validation
- Source 참조 저장과 Runtime Resource 분리
- 저장 실패 및 불러오기 실패 시 현재 Project 보존
- 불러오기 성공 시 Project/Session/History의 원자적 교체
- 현재 형식과 offline legacy migration의 명시적 진입점
- 저장 후 재실행 결과가 동일한지 검증하는 round-trip fixture

이 단계에서는 자동 저장, 클라우드 저장, 최근 파일 목록 같은 부가
기능은 제외하는 것이 좋다.

### 이후 순서

1. Persistence와 Load 경계 완성
2. PSD Refresh/Reconnect 및 Source 누락 복구 QA
3. Drawing Layer의 실제 기능 시작
4. 같은 패턴으로 Text와 Audio 기능 확장

## 감독관 의견

다음 Sprint는 `Layer Document Persistence & Load Integration`이 가장
적절하다. 현재 아키텍처의 단일 저장 원본 계약을 실제 파일 수명까지
완성한 뒤 Domain 기능을 추가하면 재작업과 데이터 유실 위험을 줄일 수
있다.

이번 작업에서는 `98_sprint_plan.md`를 변경하거나 다음 Sprint 구현을
시작하지 않았다.

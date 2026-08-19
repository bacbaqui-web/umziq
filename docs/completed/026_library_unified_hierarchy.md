# Library Unified Hierarchy Sprint 완료 보고

## 완료 내용

- Project 행을 왼쪽 제목, 오른쪽 파란 `+ PSD`와 초록 `+ 오디오`로 정리
- Project 선택 시 project-root, Cut/내부 선택 시 해당 Cut을 Audio import 부모로 사용
- Audio 파일 다중 선택과 순차 prepare/confirm 지원
- import 시 선택에 따라 Project의 `psd/`, `audio/` 폴더로 파일을 복사하고
  `relativePathHint` 기록
- Library 표시 계층을 Source Tree 조립에서 canonical LayerDocument
  `parent/order` projection으로 전환
- Cut, Group, visual Layer, Audio Layer의 before/inside/after 이동을 공통
  Owner transaction으로 처리
- 정확한 LayerDocument 삭제, 공유 Source 보존, 마지막 placement Source 제거와
  Undo/Redo 경로 유지
- project-root와 최상위 Cut만 삭제 보호하고 내부 Group은 자식과 함께 삭제
- draggable 행 안의 action button은 native drag 시작을 차단해 클릭을 보장

## 검증

- ESLint: PASS
- 전체 Verification: 51/51 PASS
- TypeScript 및 Production Build: PASS
- `git diff --check`: PASS

## 수동 확인

- 실제 마우스의 중첩 Group drop 위치와 표시선 감각
- 브라우저 폴더 권한 창과 실제 disk의 `psd/`, `audio/` 복사 결과
- 다중 Audio picker와 각 파일 재생

## 다음 작업

- Audio Properties 세부 UX 개선

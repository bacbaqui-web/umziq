# Naming Cleanup Sprint 계획 수정 보고

## 수정 내용

- Task 순서를 Rename 3건 → Cutover 제거 → Animation compatibility 제거
  순서로 변경했다.
- Task 0은 Manifest와 caller/export 재확인만 수행하도록 단순화했다.
- Task 0의 Build, Test, Lint, Checkpoint와 Git 작업을 제거했다.
- 문서 동기화 뒤 별도 Old Name Audit Task를 추가했다.
- 최종 검증을 Old Name Audit, 전체 Verification, Build로 분리했다.
- Browser QA를 Sprint 계획과 완료 조건에서 제거했다.

## 최종 Task 구성

Task 0부터 Task 8까지 총 9개다.

1. Manifest 확정
2. Selection Highlight 명칭
3. Canvas Viewport Runtime 명칭
4. Canvas Engine 명칭
5. Cutover 계약 제거
6. Animation compatibility 제거
7. 현재 문서 동기화
8. Old Name Audit
9. 최종 Build / Verification

## 현재 상태

- `docs/98_sprint_plan.md` 수정 완료
- 제품 코드 수정 없음
- Build/Verification/Browser QA 미실행
- 구현 미시작

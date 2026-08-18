# Untitled Project Save Controls 완료 보고

## 변경

- 앱 시작 직후에도 `저장` 버튼 활성화
- 첫 저장은 기존 Save Controller의 `.ziq` 위치 선택창 사용
- `.ziq` 저장 전에는 `다른 이름으로 저장` 비활성화
- `.ziq` 존재 여부와 관계없이 `닫기` 활성화
- 실제 저장·불러오기 작업 중에만 관련 버튼 비활성화

## 검증

- Project Lifecycle UI focused verification PASS
- 전체 Verification 51/51 PASS
- ESLint, TypeScript, Production Build PASS
- `git diff --check` PASS

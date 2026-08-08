# 움직(UMZIQ) 브랜드 및 New Project PSD Folder Import 완료 보고

## 최근 Task

제품명을 `움직`, 영문명을 `UMZIQ`으로 변경하고, `새 프로젝트`에서 폴더를
선택해 폴더 안의 PSD 파일을 모두 자동 불러오는 흐름을 구현했다.

## 변경

- 브라우저 제목을 `움직 - 숏폼애니 제작기`로 변경했다.
- npm package와 새 Project identity를 `umziq` 기준으로 변경했다.
- 기본 Project 이름을 `움직 프로젝트`로 변경했다.
- 저장 확장자를 `.sfep`에서 `.ziq`로 변경했다.
- 저장·열기 picker, fallback input, sample Project와 verification을 `.ziq`
  계약으로 변경했다.
- Project container format을 `umziq-project`로 변경했다.
- persistence codec 공개 함수의 `Sfep` 명칭을 `Ziq`로 변경했다.
- `새 프로젝트` 버튼이 폴더 선택 창을 연다.
- 선택 결과에서 `.psd` 파일만 상대 경로 이름순으로 정렬한다.
- PSD가 없으면 현재 프로젝트를 유지하고 안내 메시지를 표시한다.
- PSD가 있으면 새 프로젝트를 만든 뒤 기존 PSD 준비·등록 경계로 모두 자동
  불러온다.
- 기존 PSD 패널의 개별 파일 불러오기와 미리보기 흐름은 유지한다.

## 검증

- ESLint: PASS
- 전체 Verification: 41/41 PASS
- Production Build: PASS
- `git diff --check`: PASS
- Browser QA: 미실행

## 남은 위험

- 이전 `.sfep` 파일은 새 `.ziq` picker와 `umziq-project` container 계약에서
  열리지 않는다.
- 폴더 선택은 브라우저의 `webkitdirectory` 지원에 의존한다.
- 실제 운영체제 폴더 선택 대화상자와 실 PSD 다중 import는 수동 확인이 남았다.

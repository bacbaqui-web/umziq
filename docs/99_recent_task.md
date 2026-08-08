# Pre-Feature Responsibility Boundary Cleanup 완료 보고

## 최근 Task

Task 9 최종 Verification / Build를 완료했다.

## Sprint 결과

- Properties 전용 계약을 `LayerDocumentProperties*` 명칭으로 정렬했다.
- 공유 Canvas Draft Preparation 계약 3종은 기존 이름과 책임을 보존했다.
- Project, Properties, Timeline의 Controller·Store·Runtime 파일을 실제 책임
  폴더로 이동했다.
- Playback은 파일명과 위치만 Runtime 책임에 맞췄으며 내부 Scheduler와
  lifecycle은 변경하지 않았다.
- Render Source Runtime Resource Cache를 `render/state`로 이동했으며 Cache
  동작과 수명은 변경하지 않았다.
- legacy ProjectSource 변환 파일 11개를 `models/offlineMigration` 경계로
  격리했다.
- `20_src_map.md`와 현재 진행 문서의 경로를 실제 코드와 동기화했다.

## 검증

- 전체 Verification: 41/41 PASS
- 변경된 Source/Script ESLint: PASS
- Production Build: PASS
- `git diff --check`: PASS
- 이전 활성 경로와 Properties 전용 이전 명칭: 0건
- Manifest 밖 제품 코드·구조 변경: 0건
- Browser QA: 계획에 따라 미실행

## 실패 후 수정

Task 2 파일 이동 후 Project Controller가 다른 Controller 내부 경로를 직접
참조하는 경계 위반을 발견했다. 새 구조를 만들지 않고 기존 Project public
boundary의 type export를 사용하도록 경로만 보정했으며, 이후 Engine Import
Boundary와 전체 Verification이 통과했다.

## 남은 위험과 후속 작업

- 저장소 밖에서 비공개 과거 내부 경로를 직접 사용한다면 경로가 깨질 수
  있으나, 저장소 내부 caller와 공개 진입점은 모두 검증됐다.
- 실제 브라우저 조작 회귀는 이번 Sprint 범위에서 확인하지 않았다.
- Playback Runtime과 Window Scheduler의 책임 분리는 후속
  `Playback Runtime / Scheduler Responsibility Refactoring`에서 검토한다.
- Node experimental loader 경고와 Vite 500 kB 초과 chunk 경고는 기존
  경고이며 이번 Sprint에서 변경하지 않았다.

## 판단

이번 Cleanup Sprint의 목표는 달성됐다. 현재 책임이 이름과 폴더에서 더
명확하게 보이며, 다음 기능 Sprint를 시작할 수 있다.

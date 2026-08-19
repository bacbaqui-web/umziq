# Library Hover Preview

## 상태

- 구현 및 자동 검증 완료

## 목적

Library의 파일과 레이어 내용을 선택 전에 빠르게 확인할 수 있도록 PSD 미리보기와
같은 방향의 hover card를 제공한다.

## 결과

- 레이어는 runtime PSD surface와 실제 픽셀 크기를 표시한다.
- 그룹은 현재 자식 순서·표시·transform을 반영한 합성 이미지를 표시한다.
- 오디오는 runtime waveform cache를 재사용해 파형, 길이, 채널, sample rate를 표시한다.
- 빈 레이어와 missing 원본은 카드 안에서 구분해 안내한다.
- 카드는 포인터 오른쪽 위 45도 방향에 표시하고 viewport 밖으로 나가지 않는다.
- 180ms hover delay를 적용하고 포인터가 떠나면 즉시 닫힌다.
- preview surface는 hover가 실제로 시작되기 전에는 만들지 않는다.
- PSD 미리보기와 Library visual preview는 같은 공통 card, 크기 계산, 빈 레이어 안내를 사용한다.

## 검증

- Library hover preview focused verification PASS
- 전체 Verification 52/52 PASS
- ESLint, TypeScript, Production Build PASS
- `git diff --check` PASS

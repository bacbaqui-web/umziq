# Recent Task — 외부 그라데이션 스크린톤 Glow

## 수정

- Source Alpha 직접 선택과 transparent fallthrough는 유지했다.
- 원래 실루엣 내부에는 선택 표시를 그리지 않는다.
- 실루엣 바로 바깥 2px는 빈틈없는 파란 외곽선으로 표시한다.
- Alpha 바깥 14px를 세 구간으로 나누어 점 밀도를 50%, 25%, 12.5%로
  줄이는 하프톤 Glow를 적용했다.
- 하프톤 scratch를 원본 Alpha 해상도로 만들어 기존 1/2 해상도보다 점
  크기를 절반으로 줄였다.
- Blur 대신 고정 Bayer 디더 패턴을 사용한다.
- Alpha fingerprint당 tone 결과를 한 번 생성하고 Draft 중에는 완성된
  한 장을 Projection으로 이동한다.
- Preview/Export와 Project/History 계약은 변경하지 않았다.

## 성능 특성

최초 선택 시 Alpha readback과 선형 시간의 거리/tone 생성이 한 번 발생한다.
이후에는 Blur나 거리 재계산 없이 `drawImage` 한 번으로 표시한다.

## 검증

- ESLint, Build, `git diff --check` 통과
- 전체 Verification 42개 통과
- Browser QA는 요청되지 않아 미실행

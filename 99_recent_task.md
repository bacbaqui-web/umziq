# 최근 작업 보고 — Task 9.9.10 Gizmo Readout 최상위 표시

## 작업 상태

- Sprint: Canvas Visual Layer Selection
- 최근 Task: Task 9.9.10
- 결과: 완료 / 감독관 검토 완료
- Sprint 상태: 구현 완료 / QA 대기
- 수정 후 Edge QA: 미실행

## 원인

`PreviewGizmoControls`의 기존 DOM paint 순서는 다음과 같았다.

`Handles → Readouts → Anchor`

동일한 stacking context에서 뒤에 렌더된 Anchor가 W Scale 조절 중 나타나는 현재 수치 창 위에 그려졌다.

## 수정 내용

공통 paint 순서를 다음과 같이 변경했다.

`Handles → Anchor → Readouts`

따라서 Readouts가 마지막에 렌더되어 다음 UI가 모든 Gizmo visual보다 앞에 표시된다.

- Position drag readout
- Scale X/Y/XY readout
- Rotation readout
- Opacity readout
- 직접 숫자 입력창

W만을 위한 예외 처리는 추가하지 않았다.

## 유지된 내용

- 수치 창 위치와 시각 스타일
- 표시 값 계산
- pointer event와 입력 처리
- Handle, Anchor와 Connection Hit Layer interaction
- Draft/Commit/Runtime/History 계약
- Drag cursor shield

## 감독관 검토

- Handles가 Readouts보다 먼저 렌더됨: 확인
- Anchor가 Readouts보다 먼저 렌더됨: 확인
- 모든 Transform readout이 공통 계층 사용: 확인
- 별도 z-index 예외나 기능 변경 없음: 확인

## 정적 검증

- `npm run lint`: 통과
- `npm test`: 38개 verification 통과
- `npm run build`: 통과, 307 modules
- `git diff --check`: 통과

위 결과는 정적 검증이며 수정 후 실제 Edge QA 통과를 의미하지 않는다.

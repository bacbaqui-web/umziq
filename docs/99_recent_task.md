# Audio QA Follow-up 완료 보고

## 최근 Task

실제 Audio 사용 QA에서 확인된 Library 조작과 Timeline 재생 문제를 보완했다.

## 변경

- imported Audio 아이콘을 단일 8분음표 모양으로 교체했다.
- Audio import 프레임 수를 올림 처리하고, Audio가 더 길면 Cut과 상위 Group의
  재생 길이를 함께 늘려 Timeline에서 뒤가 잘리지 않게 했다.
- 음소거된 Audio는 Timeline 행과 트랙을 흐리게 표시한다.
- Library의 Audio 탐색을 전체 계층 재귀 탐색으로 바꾸고, 행 내부 버튼의
  pointer 이벤트가 드래그에 가로막히지 않게 해 삭제와 실행 취소 경로를 복구했다.

## 검증

- ESLint: PASS
- 전체 Verification: 50/50 PASS
- TypeScript 및 Production Build: PASS
- `git diff --check`: PASS
- Browser Audio/포인터 QA: 사용자 확인 필요

## 다음 작업

- 모든 Library 항목에 같은 이동 규칙을 적용하는 작업은 별도 Task로 진행한다.
- Audio Properties 개선도 별도 Task로 진행한다.

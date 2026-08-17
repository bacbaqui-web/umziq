# Audio QA Follow-up 완료 보고

## 범위

실제 사용 QA에서 확인된 Audio Library와 Timeline 문제 중 다음 항목을 수정했다.

- imported Audio 아이콘을 단일 8분음표 모양으로 변경
- 긴 Audio를 불러올 때 Cut과 상위 Group의 재생 길이를 Audio 끝까지 확장
- 음소거된 Audio Timeline 행과 트랙을 흐리게 표시
- 중첩된 Cut 안의 Audio도 Library 이름 변경, 음소거, 삭제 명령이 정확히 찾도록 수정
- 드래그 가능한 Library 행 안의 동작 버튼이 pointer 이벤트에 가로막히지 않도록 수정

## 검증

- ESLint: PASS
- 전체 Verification: 50/50 PASS
- TypeScript 및 Production Build: PASS
- `git diff --check`: PASS

## 다음 작업으로 분리

- 모든 Group, visual Layer, Audio Layer에 동일한 Library 이동 규칙 적용
- Audio Properties의 세부 UI와 조작 방식 개선

## 수동 확인 항목

- 새로 불러온 10초 초과 Audio가 Timeline에서 끝까지 재생되는지
- Audio 음소거 시 Timeline 행과 트랙이 흐려지고 해제 시 복원되는지
- Audio 삭제 뒤 실행 취소로 같은 위치와 설정으로 복원되는지

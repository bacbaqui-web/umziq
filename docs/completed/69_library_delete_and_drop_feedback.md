# Library Delete and Drop Feedback 완료 보고

## 문제

일반 visual Layer 삭제는 Layer transaction의 결과에서 Source Registry까지 직접
변경해 Owner의 변경 경계와 맞지 않았다. 드래그 위치는 얇은 선만 표시되어 실제
도착 순서를 알아보기 어려웠다.

## 수정

- visual, group, audio 삭제를 하나의 Source-aware transaction으로 통합했다.
- 후속 정정: PSD visual Layer 단독 삭제는 Layer transaction을 사용해 PSD Source와
  cache identity를 유지하고, Audio가 포함된 subtree만 Source-aware transaction을 사용한다.
- 하위 Layer가 있는 Group은 subtree 전체를 한 History 작업으로 삭제한다.
- 마지막 Audio Source는 같이 삭제하고 PSD node Source metadata는 유지한다.
- 액션 버튼의 pointer event가 click을 취소하지 않게 수정했다.
- before/after 드롭 위치에 대상 행 높이만큼 빈 공간을 열고 170ms easing으로
  주변 행이 밀려나게 했다.

## 검증

- Source가 연결된 visual child를 포함한 Group 삭제와 undo를 검증한다.
- shared Audio Source와 마지막 Audio Source 삭제 규칙을 함께 검증한다.
- 전체 QA, TypeScript build, `git diff --check`를 수행한다.

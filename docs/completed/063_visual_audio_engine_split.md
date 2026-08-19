# Visual·Audio Engine 재편 Sprint 완료 기록

## 결과

- Properties Engine을 Visual Engine으로, Audio Effects Engine을 Audio Engine으로 전환했다.
- Audio 기본 속성의 read, draft, normalize, validation과 transaction authority를 Audio Engine으로 이동했다.
- Visual Engine에서 Audio Controller, Helper, View model과 command branch를 제거했다.
- Audio 기본 속성과 ordered effects를 하나의 Audio Panel에 구성했다.
- Audio 선택 시 Audio Panel, 그 외 선택 시 같은 Inspector 위치의 Visual Panel을 표시한다.

## 검증

- ESLint 통과
- 전체 verification suite에서 변경 구간 검증 통과
- 같은 Light 서브에이전트가 Engine 소유권과 transaction authority를 순차 감사했다.

## 후속

Sprint 8에서 Library Recording의 Browser microphone 의존을 Gateway로 이동한다.

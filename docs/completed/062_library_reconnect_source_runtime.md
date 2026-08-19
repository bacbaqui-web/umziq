# Library Reconnect·Source Runtime 중립화 Sprint 완료 기록

## 결과

- Missing Source 표시와 명시적 Reconnect command를 Menu에서 Library Engine으로 이동했다.
- Reconnect Controller가 `SourceAccessPort`로 Source를 선택하고 읽도록 바꿨다.
- Source Runtime의 공개 resolution에서 Browser `File`과 `FileSystemFileHandle`을 제거했다.
- 성공 전 모든 취소·실패·stale 경로에서 선택한 Source reference를 해제한다.
- Menu와 Library는 서로 참조하지 않고 Editor Root가 필요한 Port만 각각 주입한다.

## 검증

- ESLint 통과
- 전체 verification suite 통과
- 같은 Light 서브에이전트가 공개 타입, 소유권 이동과 resource 수명을 순차 감사했다.

## 후속

Sprint 7에서 Properties/Audio Effects를 Visual/Audio Engine으로 재편한다.

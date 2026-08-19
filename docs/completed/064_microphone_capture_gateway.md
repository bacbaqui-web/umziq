# Library Recording·Microphone Gateway Sprint 완료 기록

## 결과

- neutral bytes/session/device 계약의 `MicrophoneCapturePort`를 추가했다.
- `getUserMedia`, `MediaRecorder`, stream, analyser와 Blob 처리를 Web Gateway로 이동했다.
- deterministic Fake microphone Gateway를 추가했다.
- Project recording adapter와 Library UI에서 Browser microphone API를 제거했다.
- 녹음 시작·정지·취소·stale·재시도·unmount의 기존 dispose 수명을 유지했다.

## 검증

- ESLint 통과
- 전체 verification suite 68개 통과
- 같은 Light 서브에이전트가 Browser 누수와 capture session 수명을 감사하고 승인했다.
- 실제 Browser microphone/devicechange QA는 자동 검증으로 대체하지 않았으며 최종 수동 QA 대상이다.

## 후속

Sprint 9에서 Export workflow를 Menu Controller로 옮기고 destination I/O를 Gateway로 분리한다.

# Audio 프로젝트 재열기 및 재연결

## 상태

- 구현 및 자동 검증 완료

## 문제

- `.ziq`를 다시 열거나 Audio의 재연결 버튼을 눌렀을 때 파일은 선택됐지만 `Load runtime preparation is not implemented for audio` 오류가 발생했다.
- 프로젝트 열기용 Linked Source 준비 경로가 PSD만 구현되어 있었다.

## 결과

- 저장된 Audio Source ID를 유지한 채 선택한 파일을 다시 디코딩한다.
- 실제 파일의 SHA-256 지문을 계산해 저장된 지문과 대조한다.
- 디코딩된 Audio resource를 Editor Audio Runtime에 등록한다.
- 프로젝트 자동 복구와 수동 재연결이 같은 Audio 준비 경로를 사용한다.
- 실패하거나 작업이 취소되면 준비된 디코딩 resource를 폐기한다.

## 검증

- Audio Linked Source 준비, 지문 계산, Runtime preflight/register/resolve, ownership transfer/dispose를 검증한다.
- 기존 Project Open 검증과 전체 QA를 함께 통과한다.

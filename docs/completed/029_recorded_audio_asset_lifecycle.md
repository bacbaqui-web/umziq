# Recorded Audio Asset Lifecycle 완료 보고

## 목적

직접 녹음한 파일은 임시 메모리에만 남기지 않고 프로젝트와 함께 보관하며,
프로젝트 전환 시 Runtime 자원이 남지 않게 한다.

## 구현

- 녹음을 멈춘 뒤 프로젝트의 `audio/` 폴더에 파일을 기록한다.
- 저장된 상대 경로를 Audio Source locator에 기록한다.
- 마지막 recorded Audio Layer 삭제가 성공하면 `audio/` 원본도 삭제한다.
- 같은 Source를 사용하는 Layer가 남아 있으면 원본은 삭제하지 않는다.
- 삭제 함수는 정확한 `audio/<파일명>` 경로만 허용한다.
- 닫기 시 보유한 Project directory handle을 해제한다.
- 프로젝트 identity 변경과 unmount에서 진행 중 Recorder와 prepared import를 취소한다.
- Owner의 project replace/invalidate 경계에서 Audio 재생과 decoded resource를 정리한다.

## 검증

- Project asset directory 복사·삭제·잘못된 경로 거부 검증
- TypeScript build 검증
- 전체 QA 및 `git diff --check` 검증

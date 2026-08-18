# 확인형 녹음창과 최종 파일 저장 완료 기록

## 결과

Library 직접 녹음은 이제 녹음을 멈춰도 Project 폴더를 즉시 쓰지 않는다. 녹음 Blob,
임시 File과 decoded resource는 중앙 확인 Dialog가 열린 session에만 유지되며 사용자가
`확인`을 눌렀을 때만 Project `audio/` 폴더의 충돌 없는 파일명으로 저장된다. 저장된
실제 상대경로를 Source locator에 기록한 뒤 기존 Audio Source+Layer Owner transaction
한 건으로 확정한다.

## 구현

- `libraryRecordingSessionController`가 마이크 요청, 녹음, 임시 준비, 검토, 다시 녹음,
  저장과 오류 복구 순서를 소유한다.
- 직접 녹음을 열면 아직 마이크를 요청하지 않은 `ready` 설정 화면을 먼저 표시한다.
  사용자가 자동 보정을 고르고 `녹음 시작`을 눌렀을 때 선택값을 필수 MediaStream
  constraint로 넣어 마이크를 처음 요청하며, 승인된 뒤 MediaRecorder와 녹음 시간이
  시작된다. 녹음 중에는 보정 설정을 변경하지 않는다.
- React Adapter는 Controller snapshot을 Library ViewProps에 연결하고 Project 교체와
  unmount에서 session을 dispose한다.
- Editor Recording Asset Store Adapter가 확인된 File만 `audio/`에 저장하고 실제
  collision-safe 이름을 prepared command locator에 반영한다.
- 녹음 정지와 다시 녹음 N회 동안 file write/Owner History는 0이며 이전 prepared
  resource만 exactly-once 폐기된다.
- 파일 저장 실패는 prepared review를 유지해 재시도할 수 있다. Runtime registration
  retry는 이미 저장한 파일을 다시 쓰지 않는다.
- 확인형 Dialog는 녹음 결과 재생, 다시 녹음, 취소, 확인, busy와 오류 상태를 표시하며
  안전한 상태에서 Escape/닫기를 cancel과 동일하게 처리한다.
- 직접 녹음 Source는 같은 fingerprint라도 각 확정 원본 locator를 유지하도록 별도
  recorded Source identity를 사용한다.
- 확정 원본은 Layer 삭제와 Undo/Redo에서 물리 삭제하지 않는 기존 정책을 유지한다.

## 검증

- `scripts/verifyLibraryRecordingSession.ts`
  - stop/retry/cancel/stale dispose의 file 0, Owner confirm 0
  - retry prepared exactly-once dispose
  - confirm file 1, locator 일치, Owner confirm 1
  - 저장 실패 후 재시도, Owner 거부와 Project replacement cleanup
  - Owner commit 뒤 Runtime registration pending session의 unmount dispose
  - collision-safe 저장 결과 Adapter 연결
- `scripts/verifyLayerDocumentAudioRecording.ts`
- `scripts/verifyProjectAssetDirectoryRuntime.ts`
- 전체 `npm run qa` 통과
- `git diff --check` 통과

## 미실행 수동 QA

실제 브라우저의 마이크 권한 승인/거부, MediaRecorder codec, 녹음 결과 청감, 다시 녹음,
Escape/닫기와 File System Access의 실제 `audio/` 저장은 수동으로 실행하지 않았다.

## 후속 개선 — 실시간 음파와 파형 재생

- 녹음 중 MediaStream은 화면 표시 전용 Analyser를 통해 시간순으로 누적되는 음파를
  제공하며, 표시 폭을 넘으면 이전 기록부터 왼쪽으로 흐른다.
- 빨간 녹음 헤드와 초록·노랑·빨강 세로 dB 미터를 표시하고 `-6 dB`를 권장선으로
  안내하며 0 dB 부근은 클리핑 구간으로 표시한다.
- 음파 read port만 Dialog에 전달하며 MediaStream과 AudioContext 소유권은 Recorder
  Runtime에 유지한다.
- 녹음 확인에서는 임시 File을 decode해 전체 파형을 만들고 재생 위치를 밝기로
  구분한다.
- 파형 클릭으로 재생 위치를 이동하며 기본 브라우저 Audio UI는 사용하지 않는다.
- 파형은 Runtime 표시 데이터이므로 Project, History와 `.ziq`에는 저장하지 않는다.
- 전체 `npm run qa` 63개와 `git diff --check`를 다시 통과했다.

## 후속 개선 — 녹음 편집과 키보드 재생

- Dialog 제목을 `녹음`으로 정리하고, 확인 전에 최종 파일명을 지정할 수 있게 했다.
- 기본 이름은 로컬 날짜·시간·초가 포함된 `움직_녹음_YYMMDD_HHMMSS` 형식이며
  확정 파일은 WAV로 저장된다.
- 좌우 trim 손잡이와 초록색 범위 테두리는 제거했다. 파형 안을 드래그해 구간을
  선택하고 `구간 삭제`로 제외하는 한 가지 편집 방식만 제공한다. 편집 중에는
  원본 임시 녹음을 직접 덮어쓰지 않고, 확인할 때 선택 결과를 새 WAV로 만든다.
- 삭제한 구간은 빨간 표식으로 남기지 않고 원본 파형 안에서 비워 둔다. 표시 재생
  길이에서는 즉시 빠지고 재생도 삭제 구간을 건너뛴다.
- 삭제 버튼은 항상 표시하되 유효한 파란 선택 영역이 있을 때만 활성화한다.
- 0 dB 경계선과 -6 dB 권장선을 파형 위에 표시하고, 0 dB에 닿아 클리핑되는 표본은
  빨간색으로 표시한다.
- 확인 전 볼륨을 -24~+12 dB로 조절해 그대로 미리 듣고, 확정 WAV 표본에도 같은 gain을
  적용한다.
- 파일명 입력 같은 편집 요소에 포커스가 있지 않을 때 Space로 재생·정지를 전환하고,
  `Ctrl+Z`와 macOS `Command+Z`로 직전 구간 삭제를 되돌린다.
- 편집된 WAV를 다시 decode/fingerprint 준비 경계에 통과시킨 뒤 기존 확인 transaction
  한 건으로만 Source와 Audio Layer를 확정한다.
- `scripts/verifyAudioRecordingEdit.ts`가 구간 삭제, gain 반영, WAV header, 파일명 정리와
  AudioContext 정리를 검증하며 전체 `npm run qa` 64개와 `git diff --check`를 통과했다.

## 후속 개선 — 브라우저 마이크 자동 보정 확인

- 녹음이 시작되면 마이크 Track의 `getSettings()` 결과로 소음 억제, 에코 제거,
  자동 음량 조절의 실제 켜짐/꺼짐 상태를 표시한다.
- 브라우저가 변경을 지원하는 항목은 `applyConstraints()`로 즉시 켜고 끌 수 있다.
  변경 후 요청값을 믿지 않고 `getSettings()`를 다시 읽어 실제 적용 결과를 표시한다.
- 특정 브라우저 이름을 판별하지 않고 `getSupportedConstraints()`와
  `getCapabilities()`를 사용한다. 지원하지 않거나 상태를 공개하지 않는 브라우저는
  `확인 불가`로 표시한다.
- 운영체제나 마이크 하드웨어 자체 처리는 범위 밖이며 Browser Track 처리만 표시한다.
- Recording Controller 회귀 검증, TypeScript, 관련 ESLint와 `git diff --check`를
  통과했다.

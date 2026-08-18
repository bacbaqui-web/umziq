# 확인형 녹음창과 최종 파일 저장 Sprint

## 상태

- 구현 및 자동 검증 완료
- 선행 완료: Sprint A~F
- 범위: Library 직접 녹음의 임시 보관, 다시 녹음, 확인 시 최종 저장

## 1. 목표

녹음을 끝내는 즉시 Project `audio/` 폴더에 파일을 쓰는 현재 동작을 바꾼다.
사용자가 녹음 결과를 확인하는 동안에는 녹음 Blob, File과 decoded resource를 session
임시 Runtime에만 보관하고, `확인`을 눌렀을 때만 최종 파일 저장과 Audio Layer 등록을
수행한다.

```text
Library Recording Controller
├─ 녹음 시작/정지
├─ 임시 녹음 검토
├─ 다시 녹음 시 이전 임시 녹음 폐기
├─ 취소/닫기 시 임시 Runtime 정리
└─ 확인
   ├─ Project audio/ 폴더에 충돌 없는 이름으로 저장
   └─ Source + Audio Layer Owner transaction 1건
```

## 2. 현재 문제

- `useLibraryRecordingController.stop()`이 녹음 정지 직후
  `copyFilesIntoProjectAssets()`를 호출해 확인 전 파일을 원본 폴더에 남긴다.
- 검토 UI가 Library 내부의 작은 상태 행이라 녹음, 다시 녹음, 확인의 단계가 분명하지 않다.
- 다시 녹음 동작이 없어 마음에 들지 않는 녹음도 취소 후 처음부터 진입해야 한다.
- 임시 녹음과 확정 원본, Undo용 suspended cache의 수명 경계가 명시되지 않았다.

## 3. 불변 계약

- `.ziq` schema와 Audio Source/Layer 모델은 바꾸지 않는다.
- 녹음 시작·정지·다시 녹음·취소 중 Project와 History는 변경하지 않는다.
- 확인 전에는 Project `audio/` 폴더에 파일을 만들지 않는다.
- 확인 시 충돌 없는 파일명으로 `audio/` 폴더에 저장한 뒤 Source locator에 실제
  `audio/<파일명>`을 기록한다.
- Source와 Audio Layer 등록은 기존 Project Owner transaction 한 건만 사용한다.
- 확인된 원본 파일은 Library에서 Layer를 삭제하거나 Undo/Redo해도 물리 삭제하지 않는다.
- 선택한 Cut 또는 Project root 배치 규칙, decode metadata와 fingerprint 계산은 기존
  Audio import 경계를 재사용한다.
- Composer는 Controller 결과만 조립하며 실행 순서, 조건과 저장 규칙은 Recording
  Controller가 소유한다.
- Controller끼리 직접 참조하거나 다른 Controller를 생성하지 않는다.

## 4. 상태와 수명

```text
idle → requesting → recording → preparing → review → saving → idle
                         ↑             │
                         └─ 다시 녹음 ─┘
```

- `recording`: MediaRecorder와 stream만 존재한다.
- `preparing`: Blob을 File로 만들고 decode/fingerprint를 계산한다.
- `review`: prepared recording과 decoded resource는 session 임시 Runtime에만 존재한다.
- `다시 녹음`: review의 prepared resource를 dispose한 뒤 새 MediaRecorder를 시작한다.
- `취소/닫기/Project 교체/unmount`: recorder, stream, prepared resource를 exactly once
  정리한다. Project/History/파일 시스템 변경은 0이다.
- `saving`: `audio/`에 최종 파일을 쓰고 그 파일의 locator로 command를 만든 뒤 Owner
  transaction 1건을 확정한다.
- 확정 후 decoded resource는 Editor Audio Runtime 소유권으로 이동한다.

## 5. Task 계획

### Task 0 — Baseline과 실패 fixture

- 현재 start/stop/confirm/cancel/permission/decode/stale Cut 계약을 고정한다.
- stop 이후 파일 쓰기가 일어나는 현재 결함을 재현하는 fixture를 추가한다.
- 확인 전 History 0과 임시 resource dispose 횟수를 기록한다.

### Task 1 — 확인 시점 저장 Adapter

- prepared 녹음을 Project asset으로 확정하는 좁은 Adapter를 만든다.
- `audio/` 충돌 회피 이름과 실제 `relativePathHint`를 반환한다.
- 저장 실패 시 Project/History 0, prepared resource는 검토 상태에서 재시도할 수 있게
  유지한다.

### Task 2 — Recording Controller 상태 전환

- `stop()`에서는 decode된 임시 prepared 녹음만 만든다.
- `confirm()`이 최종 파일 저장과 기존 Audio import confirm을 순서대로 수행한다.
- `retry()`는 현재 임시 prepared를 폐기하고 새 녹음을 시작한다.
- 중복 클릭, stale async 결과, Project 교체와 unmount를 request token으로 차단한다.
- 성공한 확인만 History 1이며 나머지는 0이다.

### Task 3 — 확인형 녹음 Dialog

- Library 안의 작은 상태 행을 중앙 Dialog로 바꾼다.
- 권한 확인, 녹음 중, 분석 중, 검토, 저장 중, 오류 상태를 한 Dialog에서 표시한다.
- 검토 상태에 `다시 녹음`, `취소`, `확인`을 제공한다.
- busy 상태 중 중복 명령을 막고 Escape/닫기는 안전한 취소와 동일하게 처리한다.
- 기존 Library 색상과 공통 Dialog 디자인을 따른다.

### Task 4 — 검증과 문서 동기화

- 다시 녹음 N회 동안 파일 저장 0, 이전 prepared dispose exactly once를 검증한다.
- 취소/닫기/Project 교체/unmount에서 file 0, History 0을 검증한다.
- 확인 시 file 1, locator 일치, Source+Layer transaction 1을 검증한다.
- 파일명 충돌, 저장 실패 후 재시도, Owner 실패와 stale 결과를 검증한다.
- `docs/20_src_map.md`, 관련 Architecture, `docs/completed/`를 갱신한다.
- 전체 `npm run qa`와 `git diff --check`를 통과한다.

## 6. 완료 조건

- 확인 전에는 Project `audio/` 폴더에 녹음 파일이 없다.
- 다시 녹음과 취소가 임시 녹음만 정확히 정리한다.
- 확인한 녹음만 원본 파일과 Audio Layer로 남는다.
- 확인된 원본은 Library 삭제와 Undo/Redo에서 물리 삭제되지 않는다.
- 자동 검증이 모두 통과하고 실제 브라우저 마이크/권한/파일 저장 수동 QA의 미실행
  여부를 완료 문서와 최종 보고에 명시한다.

## 7. 구현 결과

- `libraryRecordingSessionController`가 request/start/stop/review/retry/confirm과
  stale·dispose 수명을 하나의 workflow로 소유한다.
- stop은 임시 prepared recording만 만들고, confirm에서만 Editor Recording Asset
  Store를 거쳐 `audio/` 저장 후 기존 Audio prepared Owner confirm을 호출한다.
- 다시 녹음, 취소, Project 교체와 unmount는 확인 전 Runtime만 exactly-once
  폐기한다.
- Library의 작은 상태 행을 녹음 결과 재생, 다시 녹음, 취소와 확인을 제공하는 중앙
  Dialog로 교체했다.
- 녹음 중에는 MediaStream Analyser 음파를 실시간 표시하고, 검토 상태에서는 임시
  파일의 전체 파형·재생 위치·파형 클릭 seek를 제공한다.
- 검토 상태는 `움직_녹음_YYMMDD_HHMMSS` 기본 파일명, 초록색 범위의 양끝 trim,
  내부 구간 선택·즉시 제거와 편집 Undo를 제공하며 확인할 때만 편집 결과를 WAV로
  만든다. Space는 입력 요소를 제외한 Dialog 안에서 재생·정지를 전환한다.
- 파일 저장 실패는 검토 상태를 유지해 다시 시도할 수 있고, Owner 이전 실패는
  Project/History를 변경하지 않는다. Runtime registration retry는 파일을 다시 쓰지
  않는다.
- 편집 Adapter focused verification과 전체 `npm run qa` 64개, `git diff --check`를
  통과했다.
- 실제 브라우저 마이크 권한, MediaRecorder codec, 오디오 재생과 File System Access
  수동 QA는 실행하지 않았다.

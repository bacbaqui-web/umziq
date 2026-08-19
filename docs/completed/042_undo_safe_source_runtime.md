# Undo-safe Source Runtime과 원본 보존

## 결과

Library에서 visual/audio Layer 또는 Source를 삭제해도 PSD, 가져온 Audio와 직접
녹음한 Project `audio/` 원본을 물리 삭제하지 않는다. 같은 Project session에서는
삭제된 visual/audio decoded resource를 suspended cache에 보관하고 Undo 시 같은
resource identity를 다시 사용한다.

## 구현

- Audio Runtime store를 active/suspended collection으로 분리했다.
- Owner effect의 `sourceInvalidationIds`와 `sourceRestorationIds`가 visual/audio에
  대칭적으로 suspend/restore를 전달한다.
- 삭제 시 audition과 Timeline playback handle만 즉시 정지하고 waveform과 decoded
  resource는 유지한다.
- Refresh/Reconnect의 `sourceDisposalIds`만 targeted dispose를 수행한다.
- 공유 Audio Source의 placement 하나만 삭제할 때 Source Runtime 전체가
  invalidate되지 않도록 no-source-diff transaction을 preserve 처리했다.
- History branch 도달 가능성과 cache 폐기를 분리했다. suspended cache는 Project
  Close/Open/New/Replace 또는 Editor dispose까지 유지된다.
- recorded Audio Layer 삭제 후 Project asset을 `removeEntry`하던 Library 경로를
  제거했다.
- Project asset 복사는 기존 파일을 덮어쓰지 않고 충돌 없는 이름과 실제 상대경로를
  사용한다.

## 검증

- `scripts/verifyUndoSafeSourceRuntime.ts`
  - shared Audio placement 삭제 시 Source와 decoded identity 유지
  - 마지막 placement 삭제 시 재생 즉시 정지, decoded resource 미폐기
  - Undo/Redo/Undo에서 동일 identity와 waveform 복원
  - Project replacement와 Editor dispose의 dispose-once
  - Library physical delete 경로 부재
- 기존 visual suspended cache 검증은 History branch 제거 뒤에도 Project session
  종료까지 resource를 유지하도록 갱신했다.
- Project asset 검증은 충돌 없는 `audio/voice (2).wav` 복사와 locator를 고정했다.

실행 결과:

```text
npm run qa     통과 (lint + 56 verification scripts + build)
git diff --check 통과
```

## 수동 QA 잔여

정적 검증은 실제 Browser File System Access, AudioContext와 Finder의 파일 존재를
대신하지 않는다. 실제 PSD/Audio 삭제·Undo, 재생 중 삭제, Project 교체와 Finder
원본 보존은 Browser QA가 필요하다.

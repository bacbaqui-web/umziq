# Timeline Layer 선택 Intent와 Pointer 상호작용 정리 완료 기록

## 결과

Timeline Layer의 강제 선택과 일반 클릭 토글을 서로 다른 command로 분리했다. 일반
클릭만 같은 Layer의 선택을 해제하며, 우클릭·이동·trim·keyframe 조작은 대상 Layer를
선택한 상태로 유지한다. Library와 Timeline은 기존 Owner Layer selection을 그대로
공유한다.

## 구현

- `selectTimelineItem()`은 항상 지정 Layer를 선택하는 command로 고정했다.
- `toggleTimelineItemSelection()`은 이름 영역, 빈 행과 일반 클릭에서만 선택·재클릭
  해제를 담당한다.
- context menu, 이동·trim 시작과 keyframe 작업은 강제 선택 경로를 사용한다.
- 공통 Pointer session이 시작 X와 완료 session을 기준으로 실제 Pointer 이동 여부를
  기록하고, Runtime이 완료 결과를 한 번만 소비하도록 했다.
- Track clip은 이동 전 선택 상태와 Pointer 완료 결과로 클릭/드래그를 구분한다.
  Component 내부 `timingClickRef`와 3px 판정은 제거했다.
- trim 핸들은 이동량과 관계없이 선택을 유지하며 완료 결과를 즉시 소비한다.
- Library의 일반 Visual Layer와 Audio Layer 모두 같은 Owner Layer selection ID를
  selected 상태로 투영하고 재클릭 시 `null`로 해제하는 계약을 고정했다.
- Selection과 Pointer Draft는 Project payload와 History를 변경하지 않는다.

## 검증

- `scripts/verifyLayerDocumentTimelineControllerHarness.ts`
  - 강제 선택, 일반 재클릭 해제, drag 선택 유지
  - 선택 interaction의 Project·History 변화 0
- `scripts/verifyTimelinePointerDragSession.ts`
  - Pointer 이동/무이동 완료 결과와 terminal cleanup
- `scripts/verifyLayerDocumentTimelineAudioTiming.ts`
  - move click 토글, 실제 move 선택 유지, trim 시작·끝 선택 유지
- `scripts/verifyLayerDocumentLibraryAudio.ts`
  - Visual·Audio Layer 선택 투영과 Library 재클릭 해제
- focused verification 통과
- 전체 `npm run qa` 통과
  - ESLint 통과
  - Verification 64/64 통과
  - TypeScript/Vite build 통과
- `git diff --check` 통과
- 기존 Vite 500 kB chunk 경고만 있으며 오류는 아니다.

## 미실행 수동 QA

실제 Browser에서의 Pointer capture, 우클릭 메뉴, clip click과 move·trim 후 발생하는
브라우저 click 순서는 수동으로 실행하지 않았다.

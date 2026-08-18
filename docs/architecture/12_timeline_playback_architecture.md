# Timeline & Playback Architecture

## 상태와 역할

Timeline은 Layer Document의 배치와 Animation을 보여주는 UI다. Timeline
Engine은 Timeline Panel의 command, projection과 재생 Runtime을 담당한다.

## Placement와 Timeline 구분

`Timeline`은 UI와 Engine의 이름이다. 저장되는 데이터 영역의 이름은
`LayerDocument.common.placement`다.

Placement가 소유하는 값:

- 부모 Group
- 순서
- 시작 시간과 길이
- Source offset
- 표시 여부
- Alias

Timeline row는 Placement와 Animation의 projection이며 별도 Layer 사본이나
편집 원본이 아니다.

Audio row도 같은 `layerDocumentId`와 Placement를 사용한다. waveform은 decoded
Audio Runtime에서 계산하는 session projection이며 Project나 History에 저장하지
않는다. Audio move/trim은 visual Layer와 같은 Draft→단일 transaction 규칙을
따르고 trim-start는 `sourceOffsetFrames`를 함께 조정한다.

## Timeline Runtime

저장되지 않는 다음 값은 Timeline Runtime이 소유한다.

- current frame
- runtime playback range
- isPlaying
- playback clock
- transport
- Timeline zoom과 scroll

이 값은 Project와 History에 들어가지 않는다.

## 공유 방식

Canvas와 Properties는 Timeline Engine을 직접 import하지 않는다. Composition
Root가 Timeline Runtime을 구독하고 current frame 등 필요한 값만 공개 port로
전달한다.

Composition Root는 값을 복사해 보관하거나 두 번째 frame Runtime을 만들지
않는다.

```text
Timeline Runtime
→ Composition Root wiring
├─ Timeline Panel
├─ Canvas Engine
├─ Properties Engine
└─ Frame Evaluation
```

모든 소비자는 같은 frame 값을 사용한다.

Editor Audio Runtime도 이 Timeline Runtime의 read/subscribe를 Composition Root
public port로 받아 play/pause/seek/range/loop를 동기화한다. 일반 재생 중 별도
Audio frame timer나 두 번째 current-frame owner를 만들지 않는다. Library의
single-active 미리 듣기는 저장되지 않는 별도 audition session이다.

## Playback

Playback은 Timeline Runtime의 transport와 clock 기능이다.

1. transport가 재생을 시작한다.
2. clock이 current frame을 진행시킨다.
3. Frame Evaluation이 같은 Project와 새 frame을 계산한다.
4. Preview Renderer가 Editor Canvas를 갱신한다.

Playback은 Project를 mutation하거나 History를 만들지 않는다.

## Timeline 편집

Move, trim, reorder, visibility와 Alias 변경은 Placement command다.

- PointerMove 동안 필요한 임시값은 Timeline Draft로 유지한다.
- 확정 전에는 Project와 History를 변경하지 않는다.
- PointerUp/확정 시 Project transaction 한 번으로 commit한다.
- Cancel은 Draft만 폐기한다.

Animation과 keyframe 편집은 `docs/architecture/16_animation_architecture.md`를
따른다.

## 공통 Pointer Drag Session

Timeline의 Playhead, Playback Range, Layer move/trim, Keyframe, 입뻥긋 clip과
가속·감속 clip은 같은 Pointer Drag Session Controller로 DOM 수명을 관리한다.

- 공통 Controller는 활성 session 하나, pointer ID, pointer capture와 global
  listener cleanup을 소유한다.
- `pointerup`, buttons-zero, blur, document leave, hidden visibility와 lost capture는
  마지막 유효 Draft를 정상 종료한다.
- `pointercancel`, 명시적 reset, session 교체와 unmount는 Draft를 취소한다.
- terminal event가 겹쳐도 commit 또는 cancel은 정확히 한 번만 실행한다.
- clientX를 frame/clip/range로 바꾸는 계산과 Owner command는 기존 동작별
  Controller에 남는다. 공통 Controller는 Project나 제품 모델을 알지 않는다.

Playhead와 Playback Range는 Timeline Runtime만 갱신하므로 Project History를 만들지
않는다. Layer, Keyframe과 Modifier clip은 move 동안 Draft만 갱신하고 변경된 정상
종료에서만 기존 Owner intent 한 건을 commit한다.

## Project 교체와 Undo/Redo

New/Open/Replace는 playback을 안전하게 정지시키고 새 Project 범위를
reconcile한다. current frame과 range는 가능한 한 유지하되 새 duration
밖이면 clamp한다.

Undo/Redo는 Project만 복원하며 current frame을 과거 값으로 되돌리지 않는다.

## Group과 Navigation

active Group과 breadcrumb는 Editor Selection Runtime이다. Timeline은 이를
사용해 현재 scope를 투영하지만 History에 저장하지 않는다. 존재하지 않는
Group은 Project 교체나 Undo 뒤 유효한 scope로 보정한다.

## 불변 조건

- Timeline은 Layer를 소유하지 않는다.
- Placement만 저장 데이터다.
- playback과 viewport state는 Runtime이다.
- current frame의 단일 소유자는 Timeline Runtime이다.
- Panel 간 공유는 Composition Root wiring을 통한다.
- Timeline intent는 Renderer를 직접 호출하지 않는다.

## 관련 Architecture

- Project: `docs/architecture/10_project_architecture.md`
- History/Draft: `docs/architecture/13_history_draft_architecture.md`
- Animation: `docs/architecture/16_animation_architecture.md`
- Render: `docs/architecture/11_render_architecture.md`

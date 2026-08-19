# History & Draft Architecture

## 한 문장 정의

History는 확정된 Project Data만 복원하고, Draft는 사용자 조작 중의 임시값만
보관한다.

## Project Transaction

저장 데이터 변경은 Nexus의 검증된 transaction을 통한다.

- Transform, Animation, Effect와 Modifier
- Placement
- Layer 생성, Duplicate, 삭제와 Group 이동
- Source import, refresh, replace와 delete
- Type별 Text, Drawing과 Audio 데이터

Transaction은 성공 시 새 `LayerDocumentProject`를 만들고 실패 시 Project,
History와 Selection을 부분 변경하지 않는다.

## History

History snapshot에는 `LayerDocumentProject`만 들어간다.

포함:

- Layer Document 전체
- Project metadata
- Source descriptor

제외:

- Selection과 active Group
- current frame, playback range, clock와 transport
- Draft와 선택된 keyframe
- Canvas zoom/pan과 Timeline zoom/scroll
- Hover, Panel UI state와 Cache
- File, handle와 decoded Source resource

사용자 action 한 번은 History 한 건만 만든다.

## Undo와 Redo

Undo/Redo는 Project snapshot만 교체한다. Runtime을 과거 값으로 복원하지
않는다.

Source descriptor가 History에서 사라졌다가 복원될 수 있으므로 현재 Project
session의 decoded visual/audio resource는 active와 suspended 상태로 나눠 관리한다.
삭제와 Redo는 active resource를 suspended로 옮기고 Undo는 같은 resource identity를
active로 되돌린다. History branch가 바뀌어 descriptor snapshot이 더 이상 도달
가능하지 않아도 Project를 닫거나 교체하기 전에는 suspended resource를 폐기하지
않는다. Cache 자체는 여전히 History snapshot에 포함되지 않는다.

Project 교체 후에는 최소한의 유효성 보정만 수행한다.

- 삭제된 Layer를 가리키는 Selection 정리
- 사라진 active Group을 유효한 scope로 변경
- Project에 없는 Draft와 keyframe selection 폐기
- Source/Render Cache invalidate 또는 reconcile
- duration 밖 frame/range clamp

현재 frame을 과거 편집 시점으로 이동시키지 않는다.

## Draft

Draft는 PointerMove나 연속 입력 중 Project Commit 전에 사용하는 Runtime
값이다.

```text
PointerDown
→ committed 값으로 Draft 시작
→ PointerMove에서 Draft만 갱신
→ Canvas/Visual/Overlay가 같은 Draft를 읽음
→ PointerUp에서 Project transaction 1회
→ Draft 폐기
```

Cancel, Escape, scope 변경과 Nexus effect는 Draft를 폐기하고 committed
Project로 돌아간다.

Timeline의 DOM drag 수명은 공통 Pointer Drag Session Controller가 관리한다.
정상 `pointerup`뿐 아니라 buttons-zero, window blur, document leave, hidden
visibility와 lost pointer capture도 마지막 유효 Draft를 한 번 확정한다.
`pointercancel`, 명시적 reset, 새 session 교체와 unmount는 Draft를 폐기한다.
여러 terminal event가 연이어 발생해도 commit/cancel은 총 한 번만 실행된다.
제품별 Draft 계산과 Project transaction은 각 Engine/Controller의 기존 책임이다.

## Shared Transform Draft

Canvas와 Visual Panel이 같은 Transform을 동시에 표시해야 하므로 Transform
Draft는 Editor session의 공유 Runtime이다. Project Data가 아니며 새 Store나
History 원본이 아니다.

포함 가능한 값:

- Position
- Scale
- Rotation
- Opacity
- Anchor

Layer, Selection, Handle, Motion Path와 Visual Panel은 활성 Draft가 있으면 같은
Draft snapshot을 소비한다.

Brush와 Eraser의 PointerMove는 Drawing Engine의 stroke Draft만 갱신한다. PointerUp은
`replace-drawing-document` transaction 한 건을 만들고 cancel과 stale selection은
History를 만들지 않는다. 페인트통 한 번과 PSD→Drawing 변환도 각각 History 한 건이다.

## Panel별 Draft

Timeline trim이나 Panel 고유 입력처럼 다른 Panel과 공유할 필요가 없는
임시값은 해당 Engine Runtime이 소유한다. 공통 Draft로 과도하게 확장하지
않는다.

Audio의 gain/timing/source offset/fade와 Effect parameter도
연속 입력 중에는 해당 Engine Draft만 바꾸고 확정 시 Nexus transaction 한 건을
만든다. effect add/delete/reorder/bypass와 Audio mute/rename 같은 단발 command도
사용자 action당 History 한 건이다. audition, waveform, 녹음 prepared session과
export 진행 상태는 History에 들어가지 않는다.

공통 Numeric Draft Controller는 Visual/Audio/Modifier가 함께 쓰는
focused input과 문자열 Draft 수명만 소유한다. selection id, selected revision,
global/local frame 또는 reset revision이 달라지면 scope를 교체하고 Draft를
폐기한다. 이 Controller는 숫자 clamp, Transform Preview와 Project command를
모르며 제품별 확정은 각 Visual/Audio/Modifier Controller가 담당한다.

- Visual 연속 change는 shared Transform Preview만 갱신하고 blur/Enter의 의미 있는
  변경만 commit한다.
- Audio와 Modifier 연속 change는 문자열 Draft만 갱신하고 확정 시 기존 Nexus
  command 한 건을 보낸다.
- Escape, scope 변경, stale/invalid/no-op은 Draft를 폐기하고 History를 만들지 않는다.

## Persistence와 Dirty

Draft는 Save 대상이 아니다. Save는 작업 시작 시점의 committed Project
snapshot만 직렬화한다.

Project의 dirty/clean은 History 위치가 아니라 canonical Project digest와
savepoint 비교로 판단한다.

## 불변 조건

- Runtime은 History에 들어가지 않는다.
- PointerMove는 Draft, 확정은 Transaction이다.
- 하나의 사용자 action은 History 한 건이다.
- Draft와 committed Project를 동시에 mutation하지 않는다.
- Undo/Redo 후 Runtime은 복원이 아니라 유효성 보정만 한다.

## 관련 Architecture

- Project: `docs/architecture/10_project_architecture.md`
- Timeline: `docs/architecture/12_timeline_playback_architecture.md`
- Project File Workflow: `docs/architecture/17_project_file_workflow_architecture.md`

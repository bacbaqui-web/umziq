# Animation Architecture

## 한 문장 정의

Animation은 Layer Document에 저장되고, 현재 frame의 값을 계산하는 순수
평가 모듈이 이를 `EvaluatedScene`에 반영한다.

## 저장 구조

Layer별 Animation, keyframe, curve와 modifier 설정은 해당 Layer Document가
소유한다. Timeline row나 Renderer에 별도 원본을 만들지 않는다.

Animation이 없는 값은 Layer Document의 기본 Transform/Property를 사용한다.

## 편집

Timeline과 Visual Panel은 같은 Animation command 계약을 사용한다.

- keyframe 생성/삭제
- keyframe 시간과 값 변경
- interpolation/curve 변경
- animatable property 상태 변경
- modifier 설정 변경

사용자 action 한 번은 Project transaction과 History 한 건으로 commit한다.
드래그나 연속 입력 중 임시값은 Draft로 유지한다.

## Frame Evaluation

```text
Layer Document 기본값
+ current frame
+ Animation / Keyframe
+ Modifier
+ 활성 Draft
→ 현재 Layer 결과
→ EvaluatedScene node
```

평가 함수는 Project를 mutation하지 않는 순수 계산이다. Renderer 종류,
Canvas, Selection과 History를 알지 못한다.

Preview와 Accurate Renderer는 Animation을 각각 다시 계산하지 않고 같은
`EvaluatedScene` 결과를 사용한다.

## Modifier

Modifier는 저장된 property와 current frame을 입력으로 계산 결과를 만든다.
Modifier 적용 순서와 결과는 Renderer 경로에 따라 달라지지 않는다.

`LayerDocument.common.modifiers`의 `LayerModifier`가 저장과 실행의 canonical
authority다. `layerModifierDefinition.ts`의 typed Definition registry는 각
Modifier type의 기본값, 정규화·검증, Visual editor, Timeline projection과
evaluation kind를 한곳에서 연결한다. Definition은 Project나 React state를
소유하지 않고 Project 변경도 수행하지 않는다.

과거 `ModifierInstance`와 animation registry는 오래된 source migration과
호환 검증을 위한 legacy projection 경계에만 남는다. Preview/Accurate Render는
저장된 `LayerModifier`를 다른 runtime 원본으로 복제하지 않고 canonical
Definition의 evaluation kind를 따라 같은 평가 경로에서 계산한다.

Modifier Library의 과거 구현 기록은
`docs/completed/001_modifier_library.md`에 보존한다.

`입뻥긋(기본)`은 연결 Audio를 한 번 분석해 만든 전환 frame을 Modifier 안에
저장한다. 분석 결과는 수많은 keyframe이 아니라 이동·길이 조절이 가능한
하나의 Timeline 수식 클립으로 projection한다. 클립 내부 전환선은 Runtime
Draft로 조절하고 pointer up에서 Modifier transaction 한 건으로 확정한다.
재생과 출력은 저장된 전환 frame을 같은 opacity 평가 함수로 계산하므로 원본
Audio를 다시 분석하지 않는다. `반전`은 수식 클립 안에서 계산된 opacity의
`0`과 `100`을 맞바꾸며 클립 밖의 기본 opacity에는 영향을 주지 않는다.
`초당 반복수`는 감지된 음성 구간은 유지하면서 구간 내부의 열림·닫힘 전환
간격을 다시 계산하며, 연결된 Audio를 같은 Controller 경계에서 재분석한다.

Audio 연결 시 PCM 분석과 source-local frame 계산은 Animation pure helper가
담당하고, Visual Modifier Controller가 decoded-audio Read Port와 Nexus의
`set-modifiers` command를 조합한다. Editor Root는 이 Port를 연결할 뿐
분석하거나 Modifier 배열을 직접 변경하지 않는다.

Visual Engine 안에서 Modifier 숫자 Draft, toggle, 입뻥긋 Audio 연결과
가속·감속 property/curve는 하나의 Modifier Controller가 소유한다. Visual과
Audio Engine의 Controller를 참조하지 않으며 canonical
`LayerModifierDefinition`의 기본값·정규화·descriptor를 계속 사용한다.

`가속·감속`은 선택한 위치·크기·회전·투명도의 기존 keyframe 평가 frame만
수식 클립 범위 안에서 재배치한다. 박스 시작과 끝은 원래 frame과 정확히
일치하고, 범위 밖의 시간은 변경하지 않는다. 네 가지 preset 곡선은
부드럽게/강하게 가속하거나 감속하는 pure progress 함수로 평가한다.

입뻥긋과 가속·감속 row는 `TimelineFormulaClip` shell을 공유한다. shell은
label, box, 양끝 trim handle, Draft와 exactly-once commit을 담당하고 각
Modifier row는 opacity segment/transition handle 또는 curve preview만 주입한다.
Pointer 수명은 Timeline 공통 Pointer Drag Session Runtime을 사용하므로 move
중 History 0, 변경된 정상 종료 1, no-op/cancel 0 계약이 같다.

## Motion Path

Motion Path는 Animation 원본이 아니라 Editor projection이다.

- keyframe과 curve를 여러 frame에서 sample한다.
- current point는 현재 `EvaluatedScene`과 Draft를 따른다.
- polyline, sample, current/keyframe point는 공통 geometry를 사용한다.
- Motion Path UI state는 Project와 History에 저장하지 않는다.

## Timeline과 Visual

Timeline은 keyframe의 시간과 curve를 보여주고 Visual Panel은 현재 frame의
값을 보여준다. 두 Panel은 서로 직접 갱신하지 않고 같은 Project, current
frame과 Draft를 다시 평가한다.

## Anchor와 Transform Origin

Anchor는 Transform의 공통 편집 값이다. Canvas와 Visual Panel에서 수정할 때
같은 Draft/Commit 계약을 사용한다. Animation 지원 여부는 property 계약에서
명시하며 UI만으로 새로운 track 의미를 만들지 않는다.

## 불변 조건

- Animation 원본은 Layer Document에만 저장한다.
- Modifier 저장 원본은 `LayerModifier`이며 Definition과 UI에 별도 원본을 만들지 않는다.
- current frame은 Timeline Runtime이 소유한다.
- 평가는 순수하며 Project를 변경하지 않는다.
- Renderer별 Animation 평가 경로를 만들지 않는다.
- Motion Path는 Editor projection이며 작품 pixel이 아니다.

## 관련 Architecture

- Timeline: `docs/architecture/12_timeline_playback_architecture.md`
- History/Draft: `docs/architecture/13_history_draft_architecture.md`
- Render: `docs/architecture/11_render_architecture.md`
- Canvas/Overlay: `docs/architecture/14_canvas_overlay_architecture.md`

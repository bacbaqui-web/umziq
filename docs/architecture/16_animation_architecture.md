# Animation Architecture

## 한 문장 정의

Animation은 Layer Document에 저장되고, 현재 frame의 값을 계산하는 순수
평가 모듈이 이를 `EvaluatedScene`에 반영한다.

## 저장 구조

Layer별 Animation, keyframe, curve와 modifier 설정은 해당 Layer Document가
소유한다. Timeline row나 Renderer에 별도 원본을 만들지 않는다.

Animation이 없는 값은 Layer Document의 기본 Transform/Property를 사용한다.

## 편집

Timeline과 Properties는 같은 Animation command 계약을 사용한다.

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

Modifier Library의 과거 구현 기록은
`docs/completed/40_modifier_library.md`에 보존한다.

## Motion Path

Motion Path는 Animation 원본이 아니라 Editor projection이다.

- keyframe과 curve를 여러 frame에서 sample한다.
- current point는 현재 `EvaluatedScene`과 Draft를 따른다.
- polyline, sample, current/keyframe point는 공통 geometry를 사용한다.
- Motion Path UI state는 Project와 History에 저장하지 않는다.

## Timeline과 Properties

Timeline은 keyframe의 시간과 curve를 보여주고 Properties는 현재 frame의
값을 보여준다. 두 Panel은 서로 직접 갱신하지 않고 같은 Project, current
frame과 Draft를 다시 평가한다.

## Anchor와 Transform Origin

Anchor는 Transform의 공통 편집 값이다. Canvas와 Properties에서 수정할 때
같은 Draft/Commit 계약을 사용한다. Animation 지원 여부는 property 계약에서
명시하며 UI만으로 새로운 track 의미를 만들지 않는다.

## 불변 조건

- Animation 원본은 Layer Document에만 저장한다.
- current frame은 Timeline Runtime이 소유한다.
- 평가는 순수하며 Project를 변경하지 않는다.
- Renderer별 Animation 평가 경로를 만들지 않는다.
- Motion Path는 Editor projection이며 작품 pixel이 아니다.

## 관련 Architecture

- Timeline: `docs/architecture/12_timeline_playback_architecture.md`
- History/Draft: `docs/architecture/13_history_draft_architecture.md`
- Render: `docs/architecture/11_render_architecture.md`
- Canvas/Overlay: `docs/architecture/14_canvas_overlay_architecture.md`

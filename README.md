# Shortform Editor

PSD 문서를 composition/layer 구조로 가져와 Canvas 2D 프리뷰, transform/keyframe 편집,
timeline 재생과 undo/redo를 제공하는 React 기반 숏폼 편집기입니다.

## 실행

Node.js 24 환경을 기준으로 합니다.

```bash
npm install
npm run dev
```

프로덕션 결과 확인:

```bash
npm run build
npm run preview
```

## 검증

```bash
npm test       # 13개 Engine/helper/command/PSD/history 검증
npm run lint   # ESLint
npm run build  # TypeScript + Vite production build
npm run qa     # lint + test + build 전체 실행
```

`npm test`에는 Engine import 경계, Animation command/evaluation, Playback/Render,
Canvas geometry/interaction, Properties, PSD Tree, Timeline interaction,
합성 PSD binary import/replacement, Project history undo/redo 검증이 포함됩니다.

## 구조

앱은 다음 일곱 Engine으로 나뉩니다.

- `project`: PSD import/refresh, composition tree, project command/history
- `animation`: transform/property track/keyframe command와 평가
- `playback-render`: frame/range/playback과 render frame 생성
- `psd-tree`: PSD tree view/selection/picker/reorder
- `canvas`: viewport, guide, gizmo, pointer interaction과 Canvas 출력 조립
- `properties`: property view model, numeric draft와 animation command adapter
- `timeline`: timeline view, playback UI와 item/keyframe interaction

`src/editor/useEditorCompositionRoot.ts`가 일곱 Engine의 유일한 앱 조립 지점입니다.
Engine 외부 코드는 `src/engines/<engine>/index.ts` 공개 façade만 사용합니다.

상세한 현재 구조는 `src_map.md`, 리팩토링 기록은 `refactor_plan.md`와
`recent_task.md`를 참고하세요.

## 현재 범위

- 브라우저 reload 이후 편집 상태 persistence/export는 아직 제공하지 않습니다.
- 프로덕션 build는 정상 완료되지만 단일 JS chunk가 Vite의 500 kB 경고 기준을 넘습니다.

# Recent Task Report

## 1. Task 정보

- Task 번호: Task 17
- Task 이름: 대형 파일 마무리 · 테스트 기반 · Final QA
- 전체 리팩토링 진행 단계: 17 / 17
- 작업 상태: 완료
- 종료 판단: Seven-engine 구조 리팩토링 완료

## 2. 최종 구조 확인

- `src/editor/useEditorCompositionRoot.ts`가 Project, Animation, Playback & Render,
  PSD Tree, Canvas, Properties, Timeline 일곱 Engine을 조립하는 유일한 앱 지점이다.
- Engine 외부 코드는 각 `src/engines/<engine>/index.ts` 공개 façade만 사용한다.
- Core → UI, UI → UI, 외부 → Engine 내부, Controller → Controller 직접 import는 0이다.
- 500줄 이상 TS/TSX 파일은 남아 있지 않다. 가장 큰 파일은 PSD merge helper 486줄이며
  단일 책임의 순수 merge 로직이라 추가 분해하지 않았다.
- Composition Root는 367줄이지만 상태 생성이 아니라 Engine port wiring만 담당한다.

## 3. Task 17 변경

- 미사용 Shell/Editor/Preview/Timeline compatibility alias 파일과 façade의 구형 이름을 제거했다.
- Timeline View가 compatibility 상수/type 파일 대신 Timeline 공개 façade를 직접 사용하도록 정리했다.
- Vite 기본 README와 미사용 template asset을 제거하고 프로젝트 실행·검증·구조 문서로 교체했다.
- Engine 경계 검사가 정해진 내부 폴더만 검사하던 공백을 수정해 모든 façade 하위 구현 경로를 검사한다.
- 모든 검증을 실행하는 `scripts/runVerificationSuite.mjs`, `npm test`, `npm run qa`를 추가했다.
- 합성 PSD binary를 실제 `ag-psd` parser에 통과시키는 `verifyPsdPipeline.ts`를 추가했다.
- Project snapshot, undo/redo, drag transaction과 UI session reset을 검증하는
  `verifyProjectHistory.ts`를 추가했다.

## 4. 자동 QA 범위

총 13개 검증 스크립트가 다음을 확인한다.

- Engine façade/import/Core/UI/Controller 경계
- Animation track/evaluation/frame/motion/selection/value와 command mutation
- Playback frame/range와 Render frame/canvas adapter
- Canvas viewport/coordinate/guide/selection/gizmo/interaction
- Properties numeric draft/parse/clamp/view model
- PSD Tree drop/order/view model/file picker adapter
- Timeline breadcrumb/layout/duration/source/move/resize/snap/reorder/keyframe/auto-scroll/split
- PSD binary parse, nested composition, layer/timeline/render record, 같은 이름 replace/cleanup
- Project History snapshot canvas 보존, undo/redo, drag transaction, session reset

## 5. 최종 검증 결과

- `npm run lint`: 성공
- `npm test`: 13 / 13 성공
- `npm run build`: 성공, 226 modules
- `npm run qa`: 성공
- `git diff --check`: 성공
- production preview HTML entry와 JS asset HTTP 응답: 성공
- Engine import boundary 독립 재검사: 성공

Build의 단일 JS chunk 616.02 kB 경고는 실패가 아니며 기존 기능 범위와 동일하다.

## 6. 환경상 실행하지 못한 QA

현재 세션에 인앱 브라우저 대상이 없어 실제 UI pointer/keyboard smoke와 screenshot visual
regression은 실행하지 못했다. 외부 브라우저 자동화로 우회하지 않고 다음을 자동 검증으로 대체했다.

- PSD picker 이후의 parser/import/project record 경로: 합성 PSD binary 검증
- Timeline/Canvas drag 계산: interaction helper 검증
- drag history 1회 처리와 undo/redo: Project History transaction 검증
- 프로덕션 배포물 기동: preview entry/asset HTTP 검증

따라서 브라우저별 pointer capture, File System Access API 권한 UI, 실제 Canvas pixel visual은
제품 배포 전 수동 smoke 항목으로 남지만 구조 리팩토링 완료를 막는 코드 결함으로 보지 않는다.

## 7. 알려진 후속 범위

- persistence/export가 없어 reload 시 편집 상태와 runtime file binding이 사라진다.
- 단일 JS chunk가 Vite 500 kB 경고 기준을 넘으므로 필요하면 code splitting을 별도 진행한다.
- 실제 브라우저 visual regression 자동화는 별도 테스트 인프라 범위다.

이 항목들은 Seven-engine 리팩토링 범위 밖의 제품 기능·성능·테스트 인프라 작업이다.

## 8. 다음 작업자 메모

- 구조 기준 문서는 `src_map.md`, 계획과 결정 기록은 `refactor_plan.md`다.
- 앱 조립 기준 파일은 `src/editor/useEditorCompositionRoot.ts`다.
- Engine 외부에서는 반드시 `@/engines/<engine>` façade만 사용한다.
- 변경 후 `npm run qa`와 `git diff --check`를 실행한다.
- 다음 큰 기능 후보는 persistence/export이며, 번들 최적화는 별도 성능 작업으로 다룬다.

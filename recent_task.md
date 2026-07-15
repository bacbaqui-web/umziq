# Recent task report

> 작성일: 2026-07-16
> 독자: 다음 작업을 이어갈 ChatGPT/Codex
> 목적: 오랜만에 프로젝트를 다시 열었을 때 구현 범위와 마지막 작업 지점을 빠르게 복원한다.

## 조사 신뢰도

이 폴더에는 `.git`이 없어 커밋 메시지와 diff를 확인할 수 없다. 아래 task 구분은 현재 코드, 파일별 수정 시각(주로 2026-03-16~19), 서로 연결된 기능 묶음으로 재구성했다.

- **확인됨**: 현재 코드에서 직접 동작 경로를 확인한 내용
- **추정**: 수정 시각과 파일 묶음상 같은 작업 단위였을 가능성이 높은 내용
- 수정 시각은 복사/압축 해제 시 바뀔 수 있으므로 실제 개발 순서를 완전히 보증하지 않는다.

## 현재 상태 요약

현재 단계는 “PSD 기반 숏폼 모션 편집기의 핵심 인터랙션 프로토타입”이다. PSD import부터 계층 탐색, Canvas 렌더링, transform/keyframe, timeline 편집, PSD refresh diff 표시까지 한 앱 안에서 연결되어 있다. production build는 성공하지만 lint 1건이 남아 있고 자동화 테스트, 저장, 최종 결과물 export는 없다.

### 검증 결과

| 검사 | 결과 | 비고 |
|---|---|---|
| `npm run build` | 성공 | Vite 7.3.1, 161 modules, JS 약 603 kB(minified) |
| `npm run lint` | 실패 | `TimelineItemTrackRow.tsx:92`, effect 안의 동기 setState 1건 |
| 테스트 | 없음 | test 파일과 npm test script 모두 없음 |
| Git 이력 | 확인 불가 | 현재 폴더에 `.git` 없음 |

## Task 1. React/Vite 편집기 골격과 핵심 도메인 구축

상태: **완료된 기반 작업**
시점 추정: 2026-03-16 이전/초기

한 작업:

- React 19 + TypeScript + Vite 앱을 만들고 `@/` alias 구성.
- 화면을 PSD 트리 / 프리뷰 / 속성 / 타임라인의 4영역 grid로 구성.
- `Composition`, `Layer`, `TimelineItem`, `RenderItem`, keyframe 타입 정의.
- master/main/sub composition 계층과 master 기본 1080×1920, 30fps 정책 추가.
- 패널 좌우/상하 resize 구현.
- 전역 편집 상태를 `useEditorState`, 선택 파생값을 `useEditorSelectionModel`로 분리.

현재 결과:

- 앱 진입부터 네 패널 렌더까지 구조가 정리되어 있다.
- 상태는 모두 React 메모리에 있고 persistence는 없다.
- `useEditorShellFeatures.ts`가 대부분의 기능 의존성을 조립하는 중심 파일이다.

## Task 2. PSD import와 컴포지션/렌더 모델 변환

상태: **핵심 기능 구현 완료**
시점 추정: 2026-03-16, 2026-03-19에 source metadata 보강

한 작업:

- `ag-psd`로 브라우저에서 PSD를 parse.
- PSD 그룹을 sub composition으로 재귀 변환하고 일반 레이어를 편집 Layer로 변환.
- layer canvas를 `RenderDrawable`로 보존하고 comp별 `RenderItem` 생성.
- PSD 계층과 같은 순서의 timeline item/meta record 생성.
- 복수 PSD 이름순 import, 같은 파일명 재import 시 기존 main 교체.
- File System Access API가 있으면 file handle을 보존하고, 없으면 `<input type=file>` fallback 사용.

현재 결과:

- 여러 PSD를 하나의 master composition 아래에서 다룰 수 있다.
- PSD 트리에서 master/main/sub 구조 탐색, main 정렬, 삭제가 된다.
- 텍스트/shape 등 PSD 특수 레이어를 편집 가능한 네이티브 객체로 보존하는 구조는 아니며, 현재 렌더 핵심은 `ag-psd` canvas다.

## Task 3. Canvas 프리뷰, 카메라, 가이드 구축

상태: **핵심 기능 구현 완료**
시점 추정: 2026-03-16

한 작업:

- Canvas 2D에서 layer와 중첩 sub composition을 재귀 합성.
- timeline start/duration에 따라 활성 render item을 필터링.
- position/scale/rotation/opacity keyframe 선형 보간.
- fit zoom, wheel zoom, pan, reset, center, 1:1 camera 명령.
- 1080×1920 숏폼 프레임 overlay와 safe-zone guide 추가.
- resize observer로 workspace 크기 변경에 대응.

현재 결과:

- 선택 composition과 playhead frame의 화면을 실시간 렌더한다.
- 렌더 엔진은 브라우저 Canvas/DOM 객체에 의존한다.
- export용 오프스크린 렌더 파이프라인은 아직 없다.

## Task 4. 프리뷰 transform gizmo와 키프레임 편집

상태: **폭넓게 구현됨, 테스트 필요**
시점 추정: 2026-03-16~18

한 작업:

- 선택 layer/subComp의 bounding overlay와 anchor 표시.
- position 직접 이동, scale x/y/xy, rotation, opacity handle drag.
- anchor 이동 시 화면 위치를 유지하도록 transform offset 보상.
- 속성 track on/off에 따라 static 값 변경 또는 현재 frame keyframe 생성.
- scale link, 숫자 직접 입력, drag readout 구현.
- position motion path와 keyframe 점 선택/프레임 이동 구현.
- drag 시작~종료를 하나의 undo history 항목으로 묶는 capture 흐름 추가.

현재 결과:

- Properties 패널과 Preview gizmo가 같은 transform action 계층을 사용한다.
- layer와 composition, static과 animated, master 특수 상태의 분기가 많아 회귀 위험이 높은 영역이다.
- 좌표/anchor/keyframe 수학에 자동화 테스트가 없다.

## Task 5. 타임라인 탐색과 재생

상태: **구현 완료**
시점 추정: 2026-03-17~18

한 작업:

- ruler scrub, hover frame, playhead, reset/step/play/pause 구현.
- 선택 item의 `startFrame`을 고려한 local frame 계산.
- 선택한 comp/layer 경로 breadcrumb 표시.
- 부모와 형제 composition을 오가는 switcher 추가.
- 속성 track이 켜진 선택 item 아래에 property row와 keyframe 점 표시.
- 컴포지션 duration 및 playback in/out range 편집.

현재 결과:

- master/main/sub 어느 단계에서도 timeline을 열고 오갈 수 있다.
- 재생은 `setInterval` 기반이며 playback range 끝에서 멈춘다.
- 오디오 sync나 실제 미디어 clock 기반 재생은 없다.

## Task 6. 타임라인 item/keyframe 직접 편집

상태: **구현 완료, 수동 QA 필요**
시점 추정: 2026-03-18~19

한 작업:

- item 순서 drag, 시간축 이동, 시작/끝 resize.
- item rename, duplicate, playhead 기준 split.
- timeline 순서 변경 시 render item 순서도 함께 갱신.
- keyframe 선택과 drag를 통한 frame 이동.
- row 높이/layout을 item/property 종류별로 분리하고 overlay 좌표 공유.
- 속성별 공통 색상 토큰을 Properties와 Timeline에 적용.

현재 결과:

- 일반적인 숏폼 clip 편집 조작의 UI 골격은 갖췄다.
- 같은 source를 duplicate/split한 인스턴스와 transform source 공유가 의도한 편집 모델인지 다음 설계에서 재확인할 필요가 있다. 현재 transform은 source entity에 있고 timing은 timeline instance에 있다.
- `TimelineItemTrackRow`의 source delete decision 초기화 effect가 현재 유일한 lint error다.

## Task 7. 컴포지션별 undo/redo

상태: **구현됨**
시점 추정: 2026-03-18

한 작업:

- comp별 past/future snapshot history 추가, 최대 100개.
- `Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z` 연결.
- drag/range edit 같은 연속 입력을 begin/dirty/commit으로 한 snapshot 처리.
- undo/redo 시 comps/meta/timeline/render/master 상태와 selection 복원.
- PSD import/refresh처럼 구조가 크게 바뀌는 작업에서는 history 전체 초기화.

현재 결과:

- 텍스트 입력 중 브라우저 기본 undo를 방해하지 않도록 keyboard target을 거른다.
- history가 메모리 전용이고 테스트되지 않았다.

## Task 8. PSD refresh와 원본 변경 동기화

상태: **가장 최근에 집중 구현된 기능, 우선 QA 대상**
시점 추정: 2026-03-19 14:37~15:11

한 작업:

- layer/subComp에 `sourcePath`, `sourceFingerprint`, `sourceSyncStatus` 추가.
- 파일 핸들이 있으면 원본 PSD를 다시 읽고, 없으면 재선택 요청.
- refresh된 PSD와 기존 프로젝트를 source path 기준으로 병합.
- 기존 항목의 사용자가 편집한 transform/timing을 가능한 한 보존.
- 원본 변경을 `updated`, 추가를 `new`, 삭제 후보를 `deletePending`으로 표시.
- 타임라인에서 변경 상태 승인, 삭제 후보 keep/delete 결정 UI 추가.
- 원본을 못 찾은 항목의 `missing` 상태와 layer/subComp 실제 삭제 처리.
- main comp refresh 후 meta/timeline/render/selection/master timeline을 함께 재구축.

근거가 되는 최근 수정 파일:

- `src/editor/actions/psdRefreshHelpers.ts` (가장 큰 병합 로직)
- `src/editor/actions/useProjectActions.ts`
- `src/editor/actions/projectActionHelpers.ts`
- `src/editor/import/psdCompositionBuilder.ts`
- `src/editor/import/psdLayerConverter.ts`
- `src/editor/types/types.ts`, `psdSourceTypes.ts`
- `src/features/timeline/timelineSourceSyncUtils.ts`
- `src/features/timeline/components/TimelineItemTrackRow.tsx`
- `src/features/psdtree/components/PsdTree.tsx`, `PsdTreeNode.tsx`

현재 결과와 위험:

- 코드 경로는 완성되어 있고 build도 통과한다.
- `psdRefreshHelpers.ts`가 약 900줄로 복잡하며 자동화 테스트가 없다.
- rename/move/reparent/동일 이름 형제/레이어 타입 변경 같은 PSD 변화별 병합 결과를 실제 파일 fixture로 검증해야 한다.
- refresh/import는 기존 undo history를 지운다.
- file handle은 state가 아니라 ref에 있어 앱 reload 후 복구되지 않는다.

## 다음 시작점 제안

가장 먼저 할 일:

1. `TimelineItemTrackRow.tsx:92` lint error 해결.
2. 실제 PSD fixture 세트를 준비해 import → 사용자 transform/timing 편집 → PSD 수정 → refresh 시나리오를 수동/자동 검증.
3. `psdRefreshHelpers`, transform 좌표 수학, keyframe 배열, timeline split/resize부터 unit test 추가.
4. 프로젝트 저장 형식과 canvas/file handle 재연결 전략 결정.
5. 그 다음 영상/프레임 export 요구사항과 렌더 아키텍처 설계.

재개 시 읽을 파일 순서:

1. `src_map.md`
2. `src/editor/types/types.ts`
3. `src/editor/useEditorShellFeatures.ts`
4. `src/editor/actions/useProjectActions.ts`
5. `src/editor/actions/psdRefreshHelpers.ts`
6. `src/features/timeline/components/TimelineItemTrackRow.tsx`

## 다음 ChatGPT에게 남기는 핵심 메모

- 이 보고서의 task 순서는 Git 이력이 아니라 코드/mtime 기반 추정이다. 사실처럼 커밋 이력을 만들어내지 말 것.
- master comp는 `comps`에 저장된 실체가 아니라 파생 모델이며 transform 일부가 별도 state다.
- PSD entity, timeline instance, render item은 서로 다른 모델이다. 한쪽만 수정하면 UI/렌더가 어긋난다.
- keyframe frame은 composition 화면 frame과 timeline item local frame을 구분해야 한다.
- PSD refresh가 현재 가장 최근이자 위험도가 높은 기능이다. 새 기능보다 먼저 회귀 테스트를 붙이는 것이 좋다.
- 현재 build 성공은 확인됐지만 lint/test/persistence/export까지 완료된 상태는 아니다.

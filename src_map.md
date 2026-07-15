# Shortform Editor source map

> 점검 기준: 2026-07-16, 현재 작업 폴더의 소스 코드 기준
> 대상: `src` 전체와 실행/빌드 설정. 이 문서는 다음 작업자가 코드를 빠르게 찾기 위한 지도다.

## 1. 프로젝트 한눈에 보기

브라우저에서 PSD 파일을 불러와 Photoshop 그룹을 컴포지션으로, 픽셀 레이어를 레이어로 변환하고, 세로형 숏폼 캔버스에서 배치·애니메이션을 편집하는 React 프로토타입이다.

현재 구현된 큰 기능은 다음과 같다.

- 여러 PSD import, 같은 이름 PSD 교체, PSD 트리 탐색/정렬/삭제
- PSD 그룹 → 중첩 컴포지션, 픽셀 레이어 → 캔버스 drawable 변환
- PSD 재선택/파일 핸들을 통한 refresh 및 원본 변경 상태 표시
- Canvas 2D 기반 중첩 컴포지션 렌더링
- position, scale, rotation, opacity 정적 값 및 키프레임 편집
- 프리뷰 gizmo, anchor 이동, motion path/keyframe 드래그
- 타임라인 재생/스크럽, 항목 이동·리사이즈·정렬·복제·분할·이름 변경
- 컴포지션 이동 breadcrumb/switcher, 재생 범위/길이 편집
- 컴포지션 단위 undo/redo (`Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z`)

현재 없는 큰 기능은 프로젝트 저장/불러오기, 영상·이미지 export, 오디오, 텍스트 편집, 자동화 테스트다. 새로고침하면 메모리 상태는 사라진다.

## 2. 실행 구조와 핵심 데이터 흐름

```text
main.tsx
  └─ App.tsx
      └─ EditorShell.tsx
          └─ useEditorShellController
              ├─ useEditorShellModels
              │   ├─ useEditorState            원본/편집/UI 상태 + history
              │   └─ useEditorSelectionModel   선택 대상과 화면용 파생 모델
              └─ useEditorShellFeatures
                  ├─ useProjectActions          PSD import/refresh/delete/reorder
                  ├─ useTransformActions        값/키프레임 변경
                  ├─ useTimelineController      재생/항목/키프레임 상호작용
                  ├─ usePreviewController       캔버스/viewport/gizmo 상호작용
                  └─ useEditorShellLayout       패널 resize
                      ↓ props 조립
          └─ EditorShellLayout
              ├─ PsdTree
              ├─ PreviewWorkspacePane
              ├─ PropertiesPanel
              └─ TimelinePanel
```

PSD 데이터가 화면에 도달하는 경로:

```text
File / FileSystemFileHandle
  → psdParser (ag-psd)
  → psdCompositionBuilder
      ├─ Composition / Layer 트리
      ├─ CompositionMeta 사전
      ├─ TimelineItem 사전
      └─ RenderItem + HTMLCanvasElement 사전
  → useEditorState
  → selection model / timeline / property model
  → previewRenderer(Canvas 2D) + React overlay UI
```

편집 입력이 반영되는 경로:

```text
Properties / Timeline / Preview pointer event
  → feature controller 또는 interaction hook
  → transformActions / keyframeActions / compositionActions
  → setComps 또는 master 전용 state 변경
  → selection/geometry 재계산
  → Canvas 다시 렌더 + 패널 props 갱신
```

## 3. 핵심 데이터 모델

`src/editor/types/types.ts`가 프로젝트 도메인의 중심이다.

| 모델 | 역할 |
|---|---|
| `Composition` | `master` / PSD 루트인 `main` / PSD 그룹인 `sub` 컴포지션. 자식·레이어·transform·keyframe·원본 sync 상태를 보유한다. |
| `Layer` | PSD 픽셀 레이어의 편집 모델. 위치/anchor/scale/rotation/opacity 및 속성별 keyframe을 보유한다. |
| `CompositionMeta` | 해상도, FPS, duration, 원본 파일명, 레이어 수. |
| `TimelineItem` | 특정 컴포지션 타임라인에 놓인 layer/subComp 인스턴스. 시작 프레임과 길이는 여기 있다. |
| `RenderItem` | 화면 합성용 항목. `TimelineItem.sourceId`와 연결되며 drawable 또는 하위 comp를 참조한다. |
| `RenderDrawable` | `ag-psd`가 만든 레이어 canvas와 PSD 좌표/visible 상태. |
| `TimelineSelection` | 현재 타임라인에서 선택한 item/source를 가리킨다. |
| `SelectedKeyframe` | 대상 종류, 대상 ID, 속성, frame으로 선택 키프레임을 식별한다. |

중요한 ID 연결:

- `TimelineItem.compId`: 이 항목이 놓인 타임라인의 컴포지션 ID
- `TimelineItem.sourceId`: 실제 `Layer.id` 또는 `Composition.id`
- `TimelineItem.targetCompId`: subComp 렌더링 시 들어갈 컴포지션 ID
- `RenderItem.sourceId`: `TimelineItem.sourceId`와 연결
- `sourcePath`: PSD 계층에서 동일 엔티티를 refresh 전후에 찾는 안정 키
- `sourceFingerprint`: PSD 내용/크기/위치 등의 변경을 감지하는 값
- `sourceSyncStatus`: `normal | updated | new | deletePending | missing`

## 4. 디렉터리별 파일 책임

### 앱 진입점과 셸

- `src/main.tsx`: React root 생성, 전역 CSS 로드, `App` 마운트.
- `src/app/App.tsx`: 현재는 `EditorShell`만 렌더하는 최상위 앱.
- `src/editor/EditorShell.tsx`: controller가 만든 props를 layout에 전달하는 얇은 경계.
- `src/editor/useEditorShellController.ts`: models와 features를 순서대로 조립해 layout props를 반환.
- `src/editor/useEditorShellModels.ts`: `useEditorState`와 `useEditorSelectionModel`을 연결.
- `src/editor/useEditorShellFeatures.ts`: 앱의 composition root. 프로젝트/transform/timeline/preview/layout hook을 연결하고 네 패널의 전체 props와 undo/redo·재생 effect를 만든다. 기능 연결을 추적할 때 가장 먼저 볼 파일.
- `src/editor/EditorShellLayout.tsx`: 좌측 PSD 트리, 중앙 프리뷰, 우측 속성, 하단 타임라인의 CSS grid 배치 및 resize separator.
- `src/editor/useEditorShellLayout.ts`: 세 패널 크기 드래그, 최소/최대 크기, 전역 mousemove/mouseup 처리.
- `src/editor/editorShellConstants.ts`: master/숏폼 해상도(1080×1920), 30fps, timeline 배율, 패널 최소 크기, 속성 목록/라벨.

### 상태와 파생 모델

- `src/editor/state/useEditorState.ts`: 모든 변경 가능한 상태의 단일 저장소 역할. comps/meta/timeline/render, master transform, selection, drafts, playback, preview, panel, drag/readout 상태와 PSD 파일 핸들 ref를 보유한다. 컴포지션별 최대 100개 snapshot의 undo/redo 및 연속 drag history capture도 담당.
- `src/editor/state/useEditorSelectionModel.ts`: 원본 state에서 master 가상 컴포지션, 전체 ID map, 현재 comp/layer/subComp, transform 대상, meta, timeline items와 노출할 property row를 계산.
- `src/editor/state/useEditorPropertyModel.ts`: playhead/local frame에서 선택 대상 transform을 평가하고 입력창용 draft 문자열/수치를 계산.
- `src/editor/models/projectModelHelpers.ts`: master comp/meta/timeline 생성, 트리 탐색, ID map 수집, 선택 복원, 순서 변경, render 순서 동기화, 컴포지션 subtree record 제거.

### 공통 타입

- `src/editor/types/types.ts`: 핵심 도메인 타입과 `createPropertyTrackState`.
- `src/editor/types/editorViewTypes.ts`: timeline row/selection, preview overlay/motion path, gizmo handle, selected keyframe 등 화면 모델.
- `src/editor/types/transformActionTypes.ts`: layer/composition transform 대상과 static/animated 편집 모드.
- `src/editor/types/psdSourceTypes.ts`: browser file handle을 포함한 PSD import source와 메모리 저장 정보.

### PSD import 파이프라인

- `src/editor/import/psdParser.ts`: `File.arrayBuffer()`를 읽어 `ag-psd.readPsd` 결과로 변환.
- `src/editor/import/psdLoader.ts`: parser와 composition builder를 잇는 공개 진입점.
- `src/editor/import/psdCompositionBuilder.ts`: PSD children을 순회한다. 그룹을 sub composition, 일반 레이어를 layer/timeline/render item으로 만들고 comp별 meta/timeline/render record를 완성.
- `src/editor/import/psdDocumentFactory.ts`: 기본 30fps/5초 meta와 기본 composition transform 생성.
- `src/editor/import/psdLayerConverter.ts`: PSD 레이어를 편집 `Layer`와 canvas `RenderDrawable`로 변환하고 source fingerprint 계산.
- `src/editor/import/psdImportHelpers.ts`: 이름/slug/ID/path/hash/opacity/stacking order와 drawable flatten 유틸.

### 프로젝트 액션과 PSD 동기화

- `src/editor/actions/useProjectActions.ts`: UI에서 호출하는 PSD 진입 액션. import, comp 진입, refresh source 재확보, main 삭제/재정렬, sync 상태 승인/삭제 결정을 state 변경으로 연결.
- `src/editor/actions/projectActionHelpers.ts`: 여러 PSD를 이름순 import하고 같은 이름의 기존 main을 교체하며 master timeline과 선택을 재구축.
- `src/editor/actions/psdRefreshHelpers.ts`: refresh의 핵심 병합 엔진. `sourcePath`와 fingerprint를 기준으로 기존 사용자의 transform/timing을 보존하면서 updated/new/deletePending을 판정하고 composition/timeline/render record를 병합. 승인, missing 표시, 실제 삭제도 처리.
- `src/editor/actions/compositionActions.ts`: 중첩 composition/layer를 불변 방식으로 갱신하고 순서를 바꾸는 재귀 helper.
- `src/editor/actions/editorActions.ts`: composition/keyframe/transform 순수 액션을 한 경로로 재수출하는 barrel.

### Transform/keyframe 액션

- `src/editor/actions/transformActions.ts`: composition tree에 position/scale/rotation/opacity, scale link, property track enabled 값을 반영하는 순수 함수.
- `src/editor/actions/keyframeActions.ts`: 속성별 keyframe upsert, 이동, 선택 keyframe 삭제를 composition tree에 적용.
- `src/editor/actions/keyframeTrackHelpers.ts`: keyframe 배열의 정렬된 upsert/move/remove 제네릭 연산.
- `src/editor/actions/keyframeTargetHelpers.ts`: layer/composition의 속성별 keyframe list를 타입 안전하게 교체.
- `src/editor/actions/transformPropertyActionHelpers.ts`: 선택 keyframe 생성/일치 확인과 transform draft 초기화.
- `src/editor/actions/useTransformActions.ts`: 하위 transform hook들을 조립해 shell이 사용하는 단일 API 제공.
- `src/editor/actions/useTransformValueActions.ts`: static/animated 값 적용 hook을 묶음.
- `src/editor/actions/useStaticTransformValueActions.ts`: 속성 track이 꺼진 정적 transform 값을 layer/subComp/master에 적용.
- `src/editor/actions/useAnimatedTransformValueActions.ts`: track이 켜진 속성 값을 현재 local frame keyframe으로 생성/갱신.
- `src/editor/actions/useTransformInputActions.ts`: 프리뷰 readout/속성 입력값을 보정하고 anchor/offset 좌표 규칙을 반영.
- `src/editor/actions/useTransformCommitActions.ts`: 프리뷰 숫자 입력 commit을 적절한 edit mode와 값 액션으로 전달.
- `src/editor/actions/useTransformPropertyActions.ts`: property track toggle과 keyframe 명령을 조립.
- `src/editor/actions/useTransformPropertyToggleActions.ts`: 속성 track on/off, 초기 keyframe 구성, draft/선택 정리.
- `src/editor/actions/useTransformPropertyKeyframeActions.ts`: position keyframe 저장과 현재 선택 keyframe 삭제.

### 프리뷰 계산/렌더 엔진 (`src/editor/preview`)

- `previewEngine.ts`: camera/format/guide/motion/coordinate/evaluation/renderer 전체 공개 barrel.
- `previewGeometry.ts`: geometry/evaluation만 다시 내보내는 축소 barrel.
- `previewCamera.ts`: zoom clamp, 중앙 pan, world↔screen, pointer→composition 좌표 변환.
- `previewCoordinateMath.ts`: 회전/anchor/transform geometry, 축 투영, anchor 이동 시 offset 보상 계산.
- `previewValueEvaluation.ts`: 프레임 사이 keyframe 값을 선형 보간해 layer/composition transform 평가.
- `motionPathGeometry.ts`: local frame map, ruler frame, layer/subComp overlay, position motion path 계산.
- `guideGeometry.ts`: 9:16 숏폼 프레임과 safe-zone guide 선/라벨 geometry 계산.
- `previewRenderer.ts`: 활성 timeline 범위를 거른 뒤 Canvas 2D에 layer와 중첩 comp를 transform/opacity 순서대로 합성.
- `previewFormatting.ts`: 시간, rotation, scale, position readout 표시 문자열.

### 프리뷰 controller/hooks

- `src/features/preview/hooks/usePreviewController.ts`: viewport, scene geometry, canvas renderer, transform/motion-path interaction을 조립하는 프리뷰 진입 controller.
- `usePreviewViewport.ts`: viewport 값, refs, resize, camera command, pan interaction을 조립.
- `usePreviewViewportCommands.ts`: reset/center/1:1/zoom 명령.
- `usePreviewWorkspaceResize.ts`: `ResizeObserver`로 workspace 크기 추적.
- `usePreviewCanvasRenderer.ts`: scene 데이터가 바뀔 때 `drawRenderItems` 호출.
- `usePreviewSceneGeometry.ts`: 활성 render item, source별 local frame, 선택 overlay/motion path를 memo 계산.
- `usePreviewOverlayState.ts`: 직접 숫자 입력, hover, pending handle/motion-path 상태와 전역 입력 종료 처리.

### 프리뷰 pointer interaction

- `src/features/preview/interaction/usePreviewTransformInteractions.ts`: anchor와 각 transform handle interaction을 조립.
- `usePreviewHandleInteractions.ts`: move/scale/rotation/opacity interaction을 선택 속성 상태에 맞춰 조립.
- `usePreviewDirectMoveInteraction.ts`: 대상 클릭 선택과 position 직접 드래그; history capture와 static/animated 값 적용.
- `usePreviewAnchorInteraction.ts`: anchor drag 및 시각 위치 유지용 transformOffset 보상.
- `usePreviewScaleInteraction.ts`: x/y/xy scale handle drag와 readout.
- `usePreviewRotationInteraction.ts`: 원형 rotation handle drag와 각도 정규화/readout.
- `usePreviewOpacityInteraction.ts`: 방사형 opacity handle drag와 0~100 clamp/readout.
- `usePreviewMotionPathInteractions.ts`: motion path 점 선택 및 position keyframe frame/value 드래그.
- `usePreviewPanInteractions.ts`: space/middle mouse pan, wheel zoom, 관련 전역 pointer/key 상태.
- `previewPointerMath.ts`: pointer context와 drag 시작 snapshot 생성.
- `previewInteractionMath.ts`: position/scale/opacity/rotation drag 수치 계산.
- `previewHandleEditModes.ts`: enabled property에 따라 각 gizmo가 static/animated 중 어느 방식으로 쓸지 결정.

### 프리뷰 React 컴포넌트/geometry/type

- `src/features/preview/components/PreviewWorkspacePane.tsx`: 중앙 workspace 최상위 UI. controls, viewport, canvas, interaction overlay 연결.
- `PreviewWorkspaceControls.tsx`: zoom 표시, reset/center/1:1, 숏폼 프레임/safe-zone 토글.
- `PreviewViewportLayers.tsx`: 실제 canvas와 guide layer 적층.
- `PreviewGuideLayers.tsx`: 숏폼/safe-zone SVG guide 렌더.
- `PreviewInteractionOverlay.tsx`: 선택 대상이 있을 때 overlay event 영역 제공.
- `PreviewOverlay.tsx`: overlay view model 생성 후 gizmo와 motion path 배치.
- `PreviewGizmoLayer.tsx`: active gizmo layer로 전달하는 얇은 wrapper.
- `PreviewGizmoActiveLayer.tsx`: backdrop과 controls 적층.
- `PreviewGizmoBackdrop.tsx`: 선택 bounding box/회전된 사각형/중심 표시.
- `PreviewGizmoControls.tsx`: anchor, handles, readout 묶음.
- `PreviewGizmoHandles.tsx`: move/scale/rotation/opacity 실제 SVG/HTML hit target.
- `PreviewAnchorControl.tsx`: anchor 표시/drag target.
- `PreviewGizmoReadouts.tsx`: 드래그 값과 직접 입력 UI.
- `PreviewMotionPathLayer.tsx`: motion path 선, keyframe 점, drag readout.
- `src/features/preview/geometry/previewOverlayGeometry.ts`: domain overlay를 viewport 좌표의 view model로 변환.
- `previewOverlayHelpers.ts`: handle 위치/커서/반경 descriptor.
- `previewViewportValues.ts`: fit zoom, 실제 preview 크기/offset, guide geometry 계산.
- `src/features/preview/types/previewControllerTypes.ts`: preview controller가 받는 transform target의 경량 타입.
- `previewGizmoLayerTypes.ts`: gizmo component props 계약.
- `previewGizmoTypes.ts`: point/line/handle/hover 타입과 handle 크기.

### Properties 패널

- `src/features/properties/components/PropertiesPanel.tsx`: 선택/PSD 상태 메시지, transform section, keyframe section을 배치.
- `PropertiesInfoPopover.tsx`: 현재 comp의 크기/FPS/duration/source 정보 팝오버.
- `PropertiesPropertyRow.tsx`: 속성별 on/off, 숫자 입력, keyframe 상태/색상, scale link 등 실제 편집 행.
- `src/features/properties/sections/PropertiesTransformSection.tsx`: 네 속성 row를 구성.
- `PropertiesKeyframeSection.tsx`: 선택 keyframe 정보, position 저장, 선택 keyframe 삭제 UI.
- `src/features/properties/types/propertiesPanelTypes.ts`: 패널과 하위 row의 props 계약.
- `src/features/propertyVisualTokens.ts`: 속성별 색상/아이콘/시각 토큰을 properties와 timeline에 공통 제공.

### PSD 트리

- `src/features/psdtree/components/PsdTree.tsx`: File System Access API 우선, file input fallback으로 PSD import/refresh. main comp drag 상태 관리.
- `PsdTreeNode.tsx`: master/main/sub 계층 재귀 렌더, comp 선택, main refresh/delete, main 간 drag reorder.
- `src/features/psdtree/model/psdTreeTypes.ts`: tree/drop/source action props 타입.

### 타임라인 controller와 유틸

- `src/features/timeline/hooks/useTimelineController.ts`: playback, item, keyframe interaction을 조립하고 frame/local frame/폭/선택 항목을 계산.
- `useTimelinePlayback.ts`: ruler scrub, reset, step, play/pause, frame clamp와 선택 항목 local frame 계산.
- `useTimelineItemInteractions.ts`: item reorder, 좌우 resize, 이동, 선택, 복제, split, rename. timeline과 render 순서를 같이 맞춤.
- `useTimelineKeyframeInteractions.ts`: keyframe 선택과 pointer drag로 frame 이동, history capture.
- `src/features/timeline/timelineSelectionPath.ts`: breadcrumb 문자열과 부모/형제 composition switcher 모델.
- `timelineSelectionUtils.ts`: item/property row 선택 여부 판정.
- `timelineSourceSyncUtils.ts`: item이 가리키는 layer/subComp의 source sync 상태 조회.
- `timelineTrackRowLayout.ts`: item/property row 높이와 top 좌표 계산.
- `timelineUiConstants.ts`: row/gap/duration editor 치수.
- `src/features/timeline/types/timelineTypes.ts`: TimelinePanel 전체 props 계약.
- `timelineInteractionTypes.ts`: move/resize/keyframe drag 중인 interaction union.

### 타임라인 컴포넌트

- `src/features/timeline/components/TimelinePanel.tsx`: header, ruler, rows의 최상위 배치.
- `TimelineHeader.tsx`: transport, breadcrumb, comp switcher 조립.
- `TimelineTransportControls.tsx`: reset/step/play, duplicate/split 버튼과 현재 시간.
- `TimelineSelectionBreadcrumb.tsx`: 현재 선택 경로 표시.
- `TimelineCompositionSwitcher.tsx`: 부모/형제 comp로 이동하는 팝오버형 선택 UI.
- `TimelineRuler.tsx`: tick/playhead/hover, scrub, 전체 duration 및 playback range split editor.
- `TimelineDurationSplitEditor.tsx`: duration과 in/out 경계를 드래그/숫자 입력으로 편집.
- `TimelineTrackRows.tsx`: item/property row와 overlay를 같은 layout으로 적층.
- `TimelineItemTrackRow.tsx`: item 이름/가시성/sync 상태, 선택, rename, DnD reorder, move/resize, deletePending 결정을 표시.
- `TimelinePropertyTrackRow.tsx`: 속성명과 해당 keyframe 점을 렌더하고 선택/drag 시작.
- `TimelineTrackOverlays.tsx`: 전체 row 위 playhead, hover line, 드래그 guide를 렌더.

### 스타일과 설정

- `src/app/index.css`: body/root reset, 폰트와 전역 box sizing.
- `src/app/App.css`: Vite 기본 스타일 잔재. 현재 import되지 않아 실제 화면에는 적용되지 않는다.
- `src/shared/assets/react.svg`, `public/vite.svg`: Vite 템플릿 잔재. 현재 앱에서 사용하지 않는다.
- `index.html`: Vite HTML 진입점과 `#root`.
- `vite.config.ts`: React plugin과 `@` → `src` alias.
- `tsconfig.json`: app/node TypeScript project reference.
- `tsconfig.app.json`: 브라우저 소스의 strict TypeScript 및 alias 설정.
- `tsconfig.node.json`: Vite 설정용 Node TypeScript 설정.
- `eslint.config.js`: TypeScript/React hooks/refresh lint 규칙, `dist` 제외.
- `package.json`: Vite/React/TypeScript scripts와 `ag-psd` 의존성.
- `package-lock.json`: 실제 설치 버전 잠금.
- `.gitignore`: node/build/editor 생성물 제외.
- `README.md`: 아직 Vite 기본 안내문으로, 프로젝트 설명은 이 문서가 대신하고 있다.

## 5. 상태 소유권과 수정 시 주의점

- `useEditorState`는 앱 전체 상태를 한 hook에 모아 둔다. 새 전역 편집 상태는 여기서 시작하지만, 파생 가능한 값은 selection/property/feature hook에서 계산하는 편이 현재 구조와 맞다.
- master comp는 `comps` 배열에 저장되지 않고 `useEditorSelectionModel`이 가상으로 만든다. master transform은 별도 state다. 일반 comp 수정 코드로 master를 다루면 누락될 수 있다.
- timeline 인스턴스의 시간은 `TimelineItem`, 실제 transform은 `Layer`/`Composition`, 픽셀은 `RenderItem`에 분리되어 있다. reorder/delete/refresh 시 세 구조를 함께 동기화해야 한다.
- 화면에 보이는 frame은 선택 item의 `startFrame`을 뺀 local frame과 다를 수 있다. keyframe 편집은 `selectedTransformLocalFrame`을 사용한다.
- PSD refresh는 ID가 아니라 `sourcePath`를 우선 안정 키로 사용한다. import ID 생성 규칙이나 source path를 바꾸면 refresh 병합도 함께 수정해야 한다.
- canvas 객체는 JSON 직렬화 대상이 아니어서 현재 history snapshot은 render record를 별도 얕은 clone 방식으로 다룬다. 향후 저장 기능에서는 픽셀 원본 재로딩 전략이 필요하다.
- drag 한 번에 undo snapshot 하나를 만들기 위해 begin/mark/commit history capture가 여러 interaction hook에 전달된다. pointer 종료/취소 경로에서 commit 누락을 주의해야 한다.

## 6. 현재 검증 상태와 알려진 경계

- `npm run build`: 성공. TypeScript와 production Vite build가 통과한다.
- 번들 경고: minified JS 약 603 kB로 Vite의 500 kB 경고 기준을 넘는다. `ag-psd`와 편집기 코드가 단일 chunk에 들어간다.
- `npm run lint`: 실패 1건. `TimelineItemTrackRow.tsx:92`의 effect 내부 동기 `setShowDeleteDecision(false)`가 `react-hooks/set-state-in-effect`에 걸린다.
- 테스트 파일과 test script가 없다. 수학/refresh/타임라인 편집 로직의 회귀를 자동으로 막는 장치가 없다.
- `.git` 디렉터리가 없어 이 폴더만으로 커밋/branch/과거 diff를 확인할 수 없다.
- 프로젝트 persistence/export가 없다. 브라우저 reload 시 state와 file handle ref가 사라진다.
- File System Access API가 없는 브라우저에서는 file input fallback을 쓰므로 원본 파일 핸들을 보존하지 못하고 refresh 때 재선택해야 한다.
- README, 버전 `0.0.0`, Vite 로고 등 초기 템플릿 정리가 아직 남아 있다.

## 7. 다음 작업자가 읽을 추천 순서

1. `src/editor/types/types.ts`
2. `src/editor/useEditorShellFeatures.ts`
3. `src/editor/state/useEditorState.ts`
4. `src/editor/state/useEditorSelectionModel.ts`
5. 작업 영역에 따라 아래 중 하나
   - PSD: `psdCompositionBuilder.ts` → `useProjectActions.ts` → `psdRefreshHelpers.ts`
   - Preview: `usePreviewController.ts` → `usePreviewSceneGeometry.ts` → `previewRenderer.ts`
   - Timeline: `useTimelineController.ts` → 세 interaction hook → components
   - Transform: `useTransformActions.ts` → static/animated actions → preview interactions

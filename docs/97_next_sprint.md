# Next Sprint Backlog

> 상태: Sprint A·B·C·D·E·F 완료
> 현재 Sprint: 없음
> 다음 권장 Sprint: 확인형 녹음창과 최종 파일 저장
> 완료 기록: `docs/completed/81_undo_safe_source_runtime.md`,
> `docs/completed/82_timeline_pointer_drag_runtime.md`,
> `docs/completed/83_modifier_definition_formula_clip.md`,
> `docs/completed/84_library_engine_responsibility_split.md`,
> `docs/completed/85_project_lifecycle_presentation_split.md`,
> `docs/completed/86_properties_type_controller_split.md`

## 0. 남은 실행 순서

1. **후속 기능 — 확인형 녹음창과 최종 파일 저장**

각 Sprint는 하나씩 진행한다. 한 Sprint의 구현, focused verification, 전체
`npm run qa`와 문서 동기화를 끝낸 뒤 다음 Sprint를 `docs/98_sprint_plan.md`로
승격한다. 서브에이전트는 동시에 한 명만 사용한다.

## 1. 공통 구조 원칙

- 한 파일은 하나의 주된 책임만 가진다.
- 기본 의존 방향은 `Engine → Composer → Controller → Helper`다.
- Engine은 Panel의 공개 경계만 제공한다.
- Composer는 Controller 조립과 ViewProps 구성만 담당한다.
- Controller는 하나의 사용자 동작이나 Runtime 수명만 담당한다.
- Helper는 저장 상태와 Runtime을 소유하지 않는 순수 계산만 담당한다.
- Controller끼리 또는 Composer끼리 직접 조립·참조하지 않는다.
- UI Panel Engine끼리 직접 참조하지 않는다.
- 저장 변경은 Project Owner의 공개 command와 transaction만 사용한다.
- Composition Root에는 port 조립만 남기고 제품 계산과 mutation을 넣지 않는다.

## 2. Sprint D — Library Engine Responsibility Split

### 목적

`useLayerDocumentLibraryEngine.ts`, `LibraryNode.tsx`와 `LibraryPanel.tsx`에 섞여 있는
PSD·Audio import, 녹음, 파일 복사 확인, 선택, 이름 변경, 삭제, 미리듣기,
hover preview와 drag/drop 책임을 분리한다. 사용자 동작은 바꾸지 않는다.

### 목표 구조

```text
useLayerDocumentLibraryEngine
└─ useLayerDocumentLibraryComposer
   ├─ LibraryPsdImportController
   ├─ LibraryAudioImportController
   ├─ LibraryRecordingController
   ├─ LibraryAssetCopyController
   ├─ LibraryDragController
   ├─ LibraryHoverPreviewController
   └─ LibraryNodeCommandController
```

순수 tree projection과 drop target 계산은 Helper로 둔다. Node UI는 Project,
PSD/Cut, Group, Visual Layer와 Audio Layer presentation으로 나눈다. 녹음 저장 방식은
이번 Sprint에서 바꾸지 않고 현재 동작을 `LibraryRecordingController`로 옮기기만 한다.

### 완료 조건

- Library Engine은 Composer를 호출하고 공개 `viewProps`와 command만 노출한다.
- Controller끼리 직접 참조하지 않는다.
- import, recording, prompt, drag와 hover Runtime이 Project 교체/unmount에서 정리된다.
- 기존 PSD/Audio 다중 import, 선택, 이름 변경, 삭제, Undo, preview와 drag 동작이 유지된다.
- 관련 focused verification과 전체 `npm run qa`, `git diff --check`가 통과한다.

## 3. Sprint E — Project Lifecycle Presentation Split

### 목적

기존 Project Lifecycle·Save·Open Controller 계약은 유지하면서 큰
`ProjectLifecycleBar.tsx`에서 시작 화면, 새 프로젝트 Dialog, Missing Source,
폴더 picker와 출력 UI 책임을 분리한다.

### 목표 구조

```text
Project Lifecycle Core Controllers       # 기존 책임 유지
projectLifecycleUiComposer
├─ ProjectLifecycleToolbar
├─ ProjectStartScreen
├─ NewProjectDialog
├─ MissingSourceBanner
└─ ProjectExportDialog
```

브라우저 폴더 선택과 `psd/`·`audio/` 폴더 준비는 Directory Adapter로 옮긴다.
Component는 받은 ViewModel과 intent만 사용하며 Project Replace나 저장 계산을 하지 않는다.

### 완료 조건

- Core Project controller와 Owner 계약이 바뀌지 않는다.
- Start/New/Open/Save/Close/Missing/Reconnect/Export UI 결과가 유지된다.
- 취소·실패·stale picker가 현재 Project와 Runtime을 보존한다.
- Component에 File System Access와 Project mutation이 남지 않는다.
- 관련 focused verification과 전체 `npm run qa`, `git diff --check`가 통과한다.

## 4. Sprint F — Type-specific Properties Controllers

### 목적

Properties Engine과 큰 단일 Controller에 섞여 있는 Visual, Audio, Modifier와 숫자
Draft 책임을 분리한다. Audio Effects Engine은 현재 독립 구조를 그대로 유지한다.

### 목표 구조

```text
useLayerDocumentPropertiesEngine
└─ useLayerDocumentPropertiesComposer
   ├─ VisualPropertiesController
   ├─ AudioPropertiesController
   ├─ ModifierPropertiesController
   └─ NumericDraftController
```

선택된 Layer type에 맞는 ViewModel과 command만 Panel에 전달한다. Visual과 Audio는
서로의 내부 state를 참조하지 않으며 Numeric Draft는 Project를 변경하지 않는다.

### 완료 조건

- Visual transform/animation, Audio gain·mute·timing·fade와 Modifier 편집 결과가 유지된다.
- 연속 입력은 History 0, 정상 확정은 1, Escape/cancel은 0을 유지한다.
- Audio Properties와 Audio Effects Engine 사이 직접 참조가 없다.
- 선택 변경, revision 변경과 reset에서 Draft가 안전하게 폐기된다.
- 관련 focused verification과 전체 `npm run qa`, `git diff --check`가 통과한다.

## 5. 리팩토링 완료 후 후속 기능 — 확인형 녹음창

Sprint D·E·F가 모두 끝난 뒤 별도 Sprint로 계획한다.

- 녹음창에서 만든 녹음은 사용자가 `확인`하기 전까지 session 임시 cache에만 둔다.
- `다시 녹음`은 이전 임시 녹음을 폐기하고 새 임시 녹음으로 교체한다.
- `취소`와 녹음창 종료는 임시 녹음을 정리하며 Project와 History를 변경하지 않는다.
- `확인`할 때만 최종 녹음을 Project `audio/` 폴더에 충돌 없는 파일명으로 저장한다.
- Source locator와 Audio Layer 등록은 Project transaction 한 건으로 처리한다.
- 확정된 녹음은 Library에서 삭제해도 실제 `audio/` 파일을 지우지 않는다.
- 확인 전 임시 cache, 확정 원본과 Undo용 suspended cache의 수명을 구분한다.

## 6. 공통 금지 사항

- 여러 Sprint를 동시에 구현하지 않는다.
- 서브에이전트를 두 명 이상 동시에 실행하거나 하위 에이전트를 만들지 않는다.
- 동작 변경과 책임 분해를 섞지 않는다.
- 새 Project 원본, 두 번째 Owner, 두 번째 Timeline clock과 중복 Cache를 만들지 않는다.
- Controller가 다른 Controller를 직접 생성하거나 조립하지 않는다.
- Runtime Cache를 Project 또는 History에 저장하지 않는다.
- 테스트용 `test/` asset을 Git에 포함하지 않는다.
- Browser 수동 QA를 실행하지 않았다면 자동 QA로 대체됐다고 보고하지 않는다.

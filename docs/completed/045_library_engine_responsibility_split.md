# Library Engine Responsibility Split 완료 기록

## 완료 범위

- 큰 `useLayerDocumentLibraryEngine`을 Composer 호출만 남긴 얇은 facade로
  변경했다.
- PSD import/refresh, Audio multi-import, Recording, asset-copy 확인, drag,
  hover preview와 node command를 독립 Controller로 분리했다.
- PSD preview, Library tree와 drop/keyboard 계산을 순수 Helper로 분리했다.
- Composer는 독립 Controller에 최소 port를 주입하고 `LibraryViewProps`와 외부
  PSD import command를 조합하기만 한다.
- `LibraryPanel`의 Project header, tree, recording review, asset-copy dialog와
  hover preview presentation을 분리했다.
- `LibraryNode`의 종류별 identity, 공통 row/action/name editor/tree connector를
  분리하고 재귀 tree dispatch만 남겼다.
- 기존 구조 위치를 전제하던 정적 검증을 실제 책임 파일 기준으로 갱신하고
  Library responsibility boundary 검증을 추가했다.

## 구조

```text
useLayerDocumentLibraryEngine
└─ useLayerDocumentLibraryComposer
   ├─ useLibraryPsdImportController
   ├─ useLibraryAudioImportController
   ├─ useLibraryRecordingController
   ├─ useLibraryAssetCopyController
   ├─ useLibraryDragController
   ├─ useLibraryHoverPreviewController
   └─ createLibraryNodeCommandController
```

Composer는 Controller 실행 순서·조건·비즈니스 규칙을 결정하지 않는다. PSD,
Audio, Recording처럼 여러 단계가 있는 흐름은 각 Controller 하나가 picker/request,
prepare, confirm/cancel과 cleanup 전체를 소유한다. Controller끼리 직접 import하지
않으며 Helper는 React state나 Runtime resource를 소유하지 않는다.

## Runtime owner와 dispose 경로

| Runtime/Draft | owner | 정상 종료 | cancel/failure | Project replace/unmount |
|---|---|---|---|---|
| PSD prepared import/refresh | PSD Import Controller + 기존 prepared session | Owner confirm 후 transferred session clear | prepared cancel, History 0 | active session cancel, external caller `false` 완료 |
| Audio multi-import prepared list | Audio Import Controller | 선택 순서대로 각 Owner confirm | partial prepare/confirm 실패 시 남은 resource cancel | request token 폐기와 active prepared cancel |
| MediaStream/MediaRecorder/review prepared | Recording Controller | stop 후 review, Owner confirm | permission/empty/decode/cancel에서 recording/prepared dispose | recording과 prepared 전체 cancel |
| asset-copy prompt Promise | Asset Copy Controller | `원본 위치 유지` 또는 `프로젝트에 복사` 결과 전달 | 새 요청은 이전 요청 lifecycle cancel | pending Promise를 cancel 결과로 완료하고 prompt 제거 |
| drag candidate/drop target | Drag Controller | drop 또는 drag end에서 clear | invalid/self/stale target은 command 없음 | candidate/ref/state clear |
| hover delay/pending preview | Hover Preview Controller | pointer move/end에서 갱신/clear | 빠른 이동은 최신 pending preview만 사용 | timer와 pending preview clear |
| visual/audio node command | Node Command Controller | 기존 Project/Audio command port로 전달 | invalid node는 command 없음 | 저장 Runtime 없음 |

Project와 History는 계속 Project Owner만 변경한다. Layer/Source 삭제는 descriptor와
LayerDocument만 바꾸고 원본 파일 및 Undo용 active/suspended Source cache 계약은
유지한다.

## 보존한 계약

- `.ziq` schema와 저장 포맷을 변경하지 않았다.
- Library node ID, `layerDocumentId`/`sourceId` 선택 의미와 canonical
  `parentLayerDocumentId/order` 순서를 유지했다.
- PSD preview 이름 편집·제외·크기·순서, refresh와 confirm/cancel 의미를 유지했다.
- 여러 Audio 파일의 선택 순서와 한 파일당 한 번 confirm을 유지했다.
- visual/audio 선택, 잠금, 보임/음소거, 재생, 이름 변경, 삭제와 History 경계를
  유지했다.
- drag 120ms 안정화와 before/inside/after/keyboard 이동 규칙을 유지했다.
- visual/group/audio/empty/missing hover 결과, 180ms delay와 위치를 유지했다.
- Library class/색/icon/연결선/행 높이와 공개 `LibraryViewProps` 동작을 유지했다.
- 제품 기능, Project Lifecycle UI와 확인형 다시 녹음 UX를 추가하지 않았다.

## 주요 파일

- `src/engines/library/useLayerDocumentLibraryEngine.ts`
- `src/engines/library/composers/useLayerDocumentLibraryComposer.ts`
- `src/engines/library/controllers/*`
- `src/engines/library/helpers/*`
- `src/engines/library/models/libraryEngineModel.ts`
- `src/features/library/components/LibraryPanel.tsx`
- `src/features/library/components/LibraryTree.tsx`
- `src/features/library/components/LibraryNode.tsx`
- `src/features/library/components/LibraryNodeIdentity.tsx`
- `src/features/library/components/LibraryNodeActions.tsx`
- `src/features/library/components/LibraryNodeRow.tsx`
- `src/features/library/components/LibraryTreeConnector.tsx`
- `scripts/verifyLibraryResponsibilitySplit.ts`

## 자동 검증

- 기존 Library Project/controller, PSD prepare/preview/refresh, Audio
  import/recording/reload와 hover preview fixture
- Library tree flatten/find, node/drop 유효성, inside hysteresis와 keyboard target
- Engine facade, Composer/Controller/Helper/UI presentation import/책임 경계
- Controller 간 직접 참조 금지와 Helper의 React/Handle/Runtime 비소유
- Project lifecycle, Source runtime, Undo-safe active/suspended cache와 History 회귀
- 전체 `npm run qa`
- `git diff --check`

## 실행하지 않은 수동 QA

- Browser File System Access에서 실제 PSD/Audio 여러 파일 선택, 원본 위치 유지와
  Project asset 복사 확인
- 실제 microphone permission 허용/거부, MediaRecorder 녹음/정지/추가/취소
- AudioContext 미리듣기와 visual/group/audio/empty/missing hover 표시
- pointer drag로 same/cross-parent before/inside/after 이동과 120ms 체감 확인
- Project replace/close 도중 import/recording/prompt/hover가 화면과 resource에서
  남지 않는지 브라우저 확인

정적 자동 검증은 위 Browser API와 실제 pointer/audio UX를 대신하지 않는다.

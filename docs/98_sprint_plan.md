# Library + Audio Foundation Sprint

## 상태

- Sprint 계획 수립 완료
- Task 0~7 완료
- Task 5를 Library audition 선행 계약으로 Task 4보다 먼저 구현
- Task 4 완료
- Browser QA 미실행

## 기준

- `docs/01_rule.md`
- `docs/architecture/10_project_architecture.md`
- `docs/architecture/12_timeline_playback_architecture.md`
- `docs/architecture/13_history_draft_architecture.md`
- `docs/architecture/15_source_architecture.md`
- `docs/architecture/17_persistence_lifecycle_architecture.md`
- `docs/20_src_map.md`

## Sprint 목적

현재 PSD 전용으로 보이는 PSD Tree를 Project의 모든 외부 파일과 그 파일에서
생성된 Layer를 관리하는 Library Panel로 전환한다. 최상위 PSD Group 하나를
하나의 Cut으로 해석하고, Cut별 Audio Layer import와 직접 녹음, Library
미리 듣기·음소거, Cut/파일 순서 변경, Timeline playback과 Audio Effect
기반을 추가한다.

첫 Audio Effect는 Noise Gate 기반 `소음 줄이기`로 제한한다. 외부 VST
plug-in hosting은 구현하지 않고 움직 내부 Audio Effect만 지원한다.

## 확정 제품 결정

### Library

- 화면의 `PSD 트리` 명칭을 `라이브러리`로 변경한다.
- Library는 현재 Project에 등록된 PSD, Audio와 이후 Image/Video Source를
  관리하는 Panel이다.
- 최상위 imported PSD Group 하나를 하나의 Cut으로 표시한다.
- Cut 아래에는 PSD Layer와 해당 Cut에 배치된 Audio Layer를 함께 표시한다.
- 같은 Audio Source를 여러 Cut에서 사용해도 Source Registry에는 한 번만
  등록하고 각 사용 위치는 독립 Audio LayerDocument로 저장한다.
- Library의 이름 변경은 disk 파일명을 바꾸지 않고 Project 안의 표시 이름만
  변경한다.

### Audio 표시와 행 command

- imported Audio와 움직에서 직접 녹음한 Audio를 서로 다른 아이콘으로
  표시한다.
- 두 Audio 아이콘은 기존 visual Layer 아이콘과 구분되는 초록색 계열을
  사용한다.
- 색만으로 의미를 전달하지 않고 imported/recorded 아이콘 형태도 다르게
  유지한다.
- visual Layer 행의 자물쇠/눈동자 열은 그대로 유지한다.
- Audio Layer 행의 같은 열에는 미리 듣기 재생/정지와 음소거 버튼을 둔다.
- Library 미리 듣기는 저장되지 않는 Runtime이며 동시에 하나만 재생한다.
- 음소거는 Project Data이며 Owner transaction과 History 대상이다.

### Cut과 순서

- 별도 Cut 저장 entity를 먼저 만들지 않는다.
- 현재 최상위 PSD Group LayerDocument와 placement order를 Cut identity와
  순서의 기준으로 재사용한다.
- Cut 순서 변경은 최상위 Group placement order를 한 transaction으로
  변경하며 해당 Cut의 PSD Layer와 Audio Layer는 함께 따라간다.
- Audio를 다른 Cut으로 옮기는 것은 Audio LayerDocument의 parent Group을
  변경하는 transaction이다.
- Library 표시 순서와 실제 Timeline/Project 순서를 서로 다른 원본으로
  저장하지 않는다.

### Audio Properties와 Effect

- 기존 Properties Engine은 선택된 Audio Layer의 기본 설정을 표시한다.
- 기본 설정은 표시 이름, 볼륨, 음소거, 시작 위치, 길이, source offset과
  fade in/out을 우선 대상으로 한다.
- Compressor, Reverb, Delay와 Noise Reduction은 별도 Audio Effects Panel의
  effect chain으로 확장한다.
- 독립 Audio Effects Panel을 추가할 때 `Audio Effects Engine`을 둔다.
- 첫 effect는 Noise Gate 기반 `소음 줄이기`다.
- 이번 Noise Gate는 완전한 음성 분리나 AI denoise를 약속하지 않는다.

## Architecture와 소유권

| 데이터/기능 | 소유자 |
|---|---|
| Audio 파일 identity, locator, fingerprint, provenance | Source Registry |
| Cut 소속, 순서, 시작, 길이, offset, 음소거 | Audio LayerDocument |
| 볼륨, fade, effect chain과 effect parameter | Audio LayerDocument |
| 현재 Project와 저장 변경 | Project Owner |
| decoded AudioBuffer와 waveform cache | Editor Audio Runtime |
| Library 미리 듣기 session | Editor Audio Runtime |
| current frame, playback range, clock와 transport | Timeline Runtime |
| Library projection과 사용자 intent | Library Engine |
| Audio 기본 설정 UI와 command | Properties Engine |
| effect chain Draft와 command | Audio Effects Engine |
| 최종 Audio rendering/mux | Export lifecycle |

다음 불변 조건을 유지한다.

- Project와 LayerDocument에는 Plain Data만 저장한다.
- File, MediaStream, AudioBuffer, AudioContext, AudioNode와 waveform bitmap은
  저장하거나 History에 넣지 않는다.
- Library, Timeline, Properties와 Audio Effects Engine은 Project object를
  직접 mutation하지 않는다.
- Panel Engine끼리 직접 import하거나 서로 새로고침을 요청하지 않는다.
- 모든 저장 변경은 Project Owner의 검증된 transaction을 통한다.
- current frame과 playback clock의 단일 소유자는 Timeline Runtime이다.
- Audio Runtime은 Timeline 공개 port를 구독하며 두 번째 clock을 만들지 않는다.
- Preview와 Export는 같은 effect data와 parameter 의미를 사용한다.

## 범위

1. PSD Tree → Library 책임과 이름 전환
2. Audio Source/Layer Plain Data, validation, normalize, migration과 persistence
3. Cut별 imported Audio 추가와 Source Runtime 등록
4. Library Audio 행, provenance 아이콘, 미리 듣기, 음소거, 이름 변경과 삭제
5. Audio decode/waveform/playback Runtime과 Timeline 동기화
6. Timeline Audio row, waveform, move/trim과 Cut 이동
7. Cut과 Audio 순서 변경
8. 움직 내 직접 녹음과 recorded Source 등록
9. Audio 기본 Properties
10. Audio Effects Panel/Engine 기반과 Noise Gate `소음 줄이기`
11. Preview와 Export의 Audio/effect 결과 일치 기반

## 범위 밖

- 외부 VST2/VST3/AU plug-in 검색, loading과 hosting
- AI 음성 분리와 AI noise suppression
- multi-track mixer, bus, send/return과 master channel
- MIDI, instrument와 software synthesizer
- pitch correction, time stretch와 spectral editor
- recording 장치 고급 routing과 monitoring mix
- Audio automation/keyframe 전체 구현
- Video/Image Source 기능 구현
- 별도 Cut schema/entity 도입
- Library와 Timeline에 서로 다른 순서 원본 저장
- 기존 완료 문서의 역사적 명칭 일괄 수정
- 사용자 승인 없는 실제 Browser QA

## 공통 구현 규칙

- 각 Task는 이전 Task의 공개 계약 위에서 독립적으로 검증 가능해야 한다.
- rename-only Task와 기능 Task를 섞지 않는다.
- 새 schema field는 normalize, validation, migration, round-trip fixture를 함께
  추가한다.
- Audio 작업 실패나 Cancel은 현재 Project와 기존 Runtime을 보존한다.
- prepared Audio resource는 confirm 전까지 Project 밖에 두고 실패/Cancel에서
  dispose한다.
- PointerMove와 drag 중에는 Draft만 변경하고 drop/confirm에서 transaction과
  History를 한 번만 만든다.
- Source가 다른 Layer에서 사용 중이면 단일 Layer 삭제와 Source 전체 삭제를
  구분한다.
- Project Replace/Open/Close/Delete/Reconnect에서 Audio resource와 playback을
  dispose-once로 정리한다.
- 새 파일과 변경된 책임은 `docs/20_src_map.md`에 반영한다.

---

## Task 0 — 현재 계약과 데이터 흐름 고정

### 목적

Library rename과 Audio 기능 전에 현재 PSD Tree, Source Registry, top-level
Group order, Timeline Runtime, Export Audio 경계를 실제 코드로 확정한다.

### 작업 내용

- PSD Tree public model/view props/command와 caller를 조사한다.
- 최상위 PSD Group과 placement order가 현재 저장되는 경로를 확정한다.
- Source import/refresh/delete/reconnect transaction과 Runtime registration을
  확인한다.
- Timeline playback clock/transport와 Export Audio 경계를 확인한다.
- 현재 Audio empty schema와 unsupported preparation의 교체 범위를 정한다.

### 완료 조건

- Library rename manifest와 public caller 목록 확정
- Audio schema/Runtime/Panel port manifest 확정
- 기존 dirty worktree와 충돌 파일 확인
- 추측성 compatibility layer 추가 0건

### 조사 결과 — 완료

- 조사 기준 commit은 `9758bc4`이며 Task 0 시작 시 worktree는 clean이었다.
- 제품 코드는 변경하지 않았고 compatibility layer도 추가하지 않았다.

#### Library rename manifest

- Panel Engine 공개 경계는 `src/engines/psd-tree/index.ts`,
  `models/psdTreeModel.ts`, `useLayerDocumentPsdTreeEngine.ts`와
  `adapters/layerDocumentPsdPreparedSourceAdapter.ts`다.
- Project Engine에 남은 Panel 이름 경계는
  `controllers/layerDocumentPsdTreeController.ts`,
  `models/layerDocumentSourcePreparationModel.ts`의 `PsdTree*` read/selection
  이름과 `helpers/layerDocumentSourceTreeHelpers.ts`다.
- Panel view 경계는 `src/features/psdtree/components/PsdTree.tsx`,
  `PsdTreeNode.tsx`, `PsdImportPreviewDialog.tsx`와
  `PsdRefreshSummaryCard.tsx`다. PSD import/refresh dialog는 Library 안의 PSD
  기능 이름으로 유지할 수 있지만 Panel/폴더/공개 props 이름은 Library로
  바꿔야 한다.
- 직접 caller는 `src/editor/useLayerDocumentPanelEnginePorts.ts`,
  `useEditorCompositionRoot.ts`, `EditorShellLayout.tsx`다.
  `useLayerDocumentEditorRuntime.ts`의 `newProjectPsdImport` bridge는 PSD import
  기능 경계이므로 Library rename과 별개로 유지한다.
- `PsdTreeSourceSelection`은 `src/models/layerDocumentSelectionModel.ts`부터
  Project Owner helper/adapter까지 Source 선택 identity로 누출되어 있다.
  같은 Audio Source를 여러 Cut에 배치하려면 Library 행 선택은
  `layerDocumentId`, Source file 선택은 `sourceId`로 분리해야 한다.
- 관련 verification은 `scripts/verifyEngineImportBoundaries.ts`,
  `verifyLayerDocumentConsumerPorts.ts`, `verifyLayerDocumentEditorRoot.ts`,
  `verifyLayerDocumentProjectOwner.ts`,
  `verifyLayerDocumentPsdTreeController.ts`와
  `verifyLayerDocumentSourcePreparation.ts`다.

#### 현재 Cut과 순서

- PSD import는 `src/engines/project/import/layerDocumentPsdImportAdapter.ts`에서
  PSD document Source를 참조하는 `role: "composition"` Group을 만들고,
  그 Group의 `common.placement.parentLayerDocumentId`와 `order`를 import 대상
  Group 아래에 저장한다. 이 최상위 composition Group이 Cut identity와 실제
  placement order로 재사용 가능하다.
- 하지만 현재 Library 후보 read model은
  `buildPsdSourceTreeReadModel()`에서 PSD document를 `displayName/sourceId`로
  정렬한다. `createLayerDocumentPsdTreeController()`도 Registry에는 order가
  없다는 전제로 이 순서를 canonical이라고 명시하며, confirmed tree의
  `canReorder`는 항상 false이고 drag handler는 no-op이다.
- 따라서 Task 1은 rename-only로 제한하고 순서 원본 전환은 하지 않는다.
  Cut order UI는 이후 Task에서 top-level composition Group의 placement order를
  직접 projection/transaction하는 계약으로 추가해야 한다.

#### Audio schema와 Panel port

- `src/models/layerDocumentModel.ts`의 Audio Source는 현재
  `mimeType`, `durationFrames`만 저장하며 Audio Layer data는 빈 object다.
  structure/source validation과 schema 1→2 migration도 이 최소 shape만
  허용한다.
- `src/layer-types/audioSupport.ts`의 query는 `dataSchema: "empty"`,
  command preparation은 `audio-domain-data-empty` unsupported만 반환한다.
- Properties descriptor에는 Audio type projection과 unsupported domain command
  분기가 이미 있지만 Audio 전용 기본 property/effect view 계약은 없다.
- Source tree는 Audio/Video/Unknown을 이미 `nonPsdSources` resource leaf로
  읽지만 Cut 아래 Audio Layer placement를 표현하지 못한다. Library public
  node에는 최소 `sourceKind`, `layerDocumentId`, `parentLayerDocumentId`,
  provenance와 type별 action capability가 필요하다.

#### Source와 Audio Runtime 경계

- Source import/refresh/reconnect/delete의 저장 경계는
  `LayerDocumentSourcePreparationPort`와 Project Owner source transaction이다.
  현재 `prepareSourceRegistryImport()`는 PSD document/node만 받아 Audio import를
  거부하므로 Task 2/3에서 범용 import 계약 또는 별도 Audio preparation을
  명시적으로 연결해야 한다.
- linked-file locator, fingerprint, resolution store와 reconnect file picker는
  Audio kind를 수용한다. 반면
  `LAYER_DOCUMENT_PROJECT_LINKED_SOURCE_PREPARATION`은 PSD document 외 kind를
  모두 unsupported로 반환하므로 Audio save/open/reconnect 준비가 새로 필요하다.
- 현재 `LayerDocumentSourceRuntimeResourcePort`는 source별 register/invalidate,
  suspend/restore와 dispose-once를 제공하지만 PSD logical-size resource와
  `createPsdResolver()`를 전제로 한다. AudioBuffer, waveform과 audition state는
  이 visual cache에 억지로 넣지 않고 별도 Editor Audio Runtime port로 둔다.
- Audio Runtime 공개 port의 최소 후보는 resource
  `prepare/register/resolve/invalidate/dispose`, audition
  `play/stop/read/subscribe`, Timeline sync 입력이다. Project/History에는
  `File`, `AudioBuffer`, `AudioContext`, `AudioNode`를 넣지 않는다.

#### Timeline clock과 Export Audio 경계

- `createLayerDocumentTimelinePlaybackRuntime()`이 current frame, range,
  transport와 repeating clock의 단일 owner다. 공개 port는
  `read/subscribe`와 `play/pause/toggle/seek/step/reset/setRange`를 제공한다.
  Audio Runtime은 이 port를 구독해야 하며 별도 current-frame owner를 만들면
  안 된다.
- 현재 `src/editor/projectExport.ts`는 Canvas frame만 렌더하고
  `canvas.captureStream()`의 video track만 MediaRecorder에 전달한다.
  MP4/WebM Audio track, offline Audio effect render와 mux 경계는 없다.
- GIF/WebP는 본질적으로 무음으로 유지한다. MP4/WebM은 이후 Export lifecycle에
  Audio render/stream port를 주입하고 video/audio가 같은 frame range와
  frameRate 의미를 사용하도록 확장해야 한다.

#### Task 1 고정 범위와 위험

- Task 1은 Panel/Engine/model/view/public prop와 verification의 Library rename만
  수행하고 PSD import/refresh 제품 용어는 기능 이름으로 유지한다.
- Source selection을 성급하게 Layer selection으로 통합하거나 Cut ordering을
  함께 구현하지 않는다. 둘은 Audio의 shared Source/multiple placement 계약이
  정해지는 Task 2 이후에 변경한다.
- 가장 큰 위험은 문자열 치환으로 `psd` 기능 이름까지 지워 PSD import 경계를
  흐리는 것, 그리고 `PsdTreeSourceSelection`을 compatibility alias로 남겨 active
  product의 이중 이름을 만드는 것이다.

---

## Task 1 — PSD Tree를 Library로 책임 전환

### 목적

PSD 전용 명칭을 Project file library 책임에 맞추되 기존 PSD 동작은 그대로
보존한다.

### 작업 내용

- `psd-tree`, `psdtree`, `PsdTree*`의 active product 경계를 Library 명칭으로
  정렬한다.
- Library Engine, model, feature component와 Project controller port 이름을
  동기화한다.
- 화면 명칭을 `라이브러리`로 변경한다.
- 기존 PSD import/refresh/delete/reconnect/selection UI를 보존한다.
- Engine import boundary와 verification path를 동기화한다.

### 완료 조건

- active product의 PSD 전용 Panel 책임 명칭 잔여 0건
- 기존 PSD 동작과 public 의미 변화 0
- Library Engine ↔ Library Panel 경계 성립
- 변경 파일 lint, 관련 verification, build와 `git diff --check` 통과

### 구현 결과 — 완료

- Panel Engine 경로를 `src/engines/library`로, Feature 경로를
  `src/features/library`로 전환했다.
- 공개 이름을 `LibraryViewProps`, `LibraryNodeViewModel`,
  `useLayerDocumentLibraryEngine`, `LayerDocumentLibraryController`와
  `createLayerDocumentLibrarySourceCommandAdapter`로 정렬했다.
- Source 선택 Runtime 이름과 discriminant를 `LibrarySourceSelection`과
  `library-source`로 전환하고 Owner/transaction/verification caller를 함께
  동기화했다. 이 선택은 저장 Project가 아니라 session Runtime이므로 Project
  schema migration은 필요하지 않다.
- Editor Composition Root, Panel port와 Shell prop을 `library` 이름으로
  연결하고 Panel root에 화면 접근성 이름 `라이브러리`를 부여했다.
- PSD import/preview/refresh/session 이름과 동작은 Library 내부의 PSD 기능으로
  유지했다. Audio, Cut ordering과 selection identity 재설계는 추가하지 않았다.
- `scripts/verifyLayerDocumentLibraryController.ts`와 Engine/import/consumer/root
  verification 경로를 현재 Library 구조로 동기화했다.

---

## Task 2 — Audio Source와 LayerDocument 계약

### 목적

빈 Audio schema를 실제 저장 가능한 최소 Audio Layer 계약으로 교체한다.

### 작업 내용

- Audio Source descriptor에 duration, channel count, sample rate와 provenance
  (`imported | recorded`)를 Plain Data로 정의한다.
- Audio Layer data에 gain, muted, fade와 effect chain 기본 envelope를 정의한다.
- Cut 소속과 timing은 기존 common placement를 재사용한다.
- normalization, structure/source validation, migration과 persistence codec을
  확장한다.
- Audio query와 Owner transaction preparation을 unsupported 상태에서 실제
  command 계약으로 전환한다.

### 완료 조건

- Audio Project save/open/save canonical round trip 일치
- unknown/legacy Audio data의 normalize 또는 구조화 거부 정책 명확화
- Runtime 객체 저장 0건
- 사용자 action 한 번당 transaction/History 한 건

### 구현 결과 — 완료

- Project schema를 3으로 올리고 Audio Source에 `durationFrames`,
  `channelCount`, `sampleRate`, `provenance(imported | recorded)`를 저장하는
  Plain Data 계약을 추가했다. 아직 decode하지 않은 값은 metadata를 `null`로
  둘 수 있으며 provenance는 반드시 명시한다.
- Audio Layer data는 `gain`, `muted`, `fadeInFrames`, `fadeOutFrames`를 저장한다.
  Cut 소속과 시작·길이·source offset은 별도 중복 필드 없이 기존
  `common.placement`를 그대로 사용한다.
- effect chain envelope는 모든 Layer가 이미 공유하는 순서 보존
  `common.effects: LayerEffect[]`를 Audio도 사용한다. Task 10 전까지 effect
  type별 DSP 의미는 추가하지 않았다.
- schema 1은 1→2→3, schema 2는 2→3으로 migration한다. 기존 Audio Source는
  `imported`와 미확정 metadata `null`, 기존 Audio Layer는 gain 1·unmuted·fade
  0의 중립값을 받는다. 현재 schema의 unknown Audio field와 잘못된 수치는
  구조 validation에서 거부한다.
- `audioSupport`를 unsupported placeholder에서 clone query와
  `replace-audio-document` preparation으로 전환했다. 최종 변경은 다른 domain과
  동일하게 Project Owner commit을 거쳐 action당 transaction/History 한 건을
  만든다.
- file picking, decode, Audio Runtime, UI, Timeline row, effect processing과
  Export audio는 이번 Task에 추가하지 않았다.

---

## Task 3 — Cut별 imported Audio 준비와 Confirm

### 목적

외부 Audio 파일을 현재 Cut에 안전하게 추가한다.

### 작업 내용

- WAV, MP3와 브라우저가 decode 가능한 후보 형식의 실제 지원 경계를 확정한다.
- 파일 metadata/fingerprint/decode를 수행하는 prepared Audio session을 만든다.
- 현재 선택 Cut 또는 명시적으로 선택한 Cut에 Audio Layer를 생성한다.
- Confirm 성공 시 Source descriptor/Audio Layer transaction과 Runtime
  registration을 일관되게 적용한다.
- Cancel/failure/stale confirm에서 prepared resource를 dispose한다.

### 완료 조건

- 성공 시 Source 1건과 Audio Layer 1건이 같은 action으로 생성
- 실패/Cancel 시 Project update, transaction과 History 0건
- 같은 Source 재사용 시 descriptor/resource 중복 생성 없음
- Missing/Reconnect에 필요한 fingerprint와 locator 저장

### 구현 결과 — 완료

- Library Project header에 PSD picker와 분리된 `오디오` 파일 입력을 추가했다.
  `audio/*` MIME 또는 MIME이 비어 있는 일반 Audio 확장자를 후보로 받고,
  실제 지원 여부는 브라우저 `decodeAudioData` 성공으로 판정한다. 특정 codec을
  모든 브라우저에서 지원한다고 가정하지 않는다.
- 준비 단계에서 ArrayBuffer를 한 번 읽어 SHA-256 fingerprint와 byte length를
  만들고, decode 결과에서 duration/channel count/sample rate를 얻는다. File과
  decoded Audio는 Project/History에 넣지 않고 prepared Runtime에만 둔다.
- explicit Cut을 우선하고, 없으면 선택 Layer와 active Group의 부모를 따라
  project-root 바로 아래 composition Cut을 찾는다. 유효한 Cut이 없으면 임의의
  첫 Cut에 넣지 않고 import를 거부한다.
- Confirm은 기존 Source import transaction을 Audio에도 열어 Source와 Audio
  Layer를 한 Owner action/History로 생성한다. 같은 fingerprint Source가 이미
  있으면 Source Registry record와 decoded Runtime resource를 중복 생성하지
  않고 새 Audio Layer만 같은 Source를 참조한다.
- Source에는 linked-file locator, suggested file name과 fingerprint를 남기고
  Confirm 후 session-only resolution에 File을 연결해 Missing/Reconnect 경계를
  유지한다.
- 별도 Audio Runtime store/registration port를 추가했다. stale prepared session,
  cancel, decode/validation/Owner 실패는 commit 0건이며 prepared resource를
  dispose-once로 정리한다. 재생, waveform, 녹음, Audio 행 관리, Properties,
  DSP와 Export는 추가하지 않았다.

---

## Task 4 — Library Audio 행과 file 관리 command

### 목적

Cut 아래에서 imported/recorded Audio를 구분하고 기본 관리 command를 제공한다.

### 작업 내용

- imported Audio와 recorded Audio 아이콘을 초록색 계열로 추가한다.
- visual Layer의 자물쇠/눈동자 열과 같은 위치에 Audio 재생/정지와 음소거를
  배치한다.
- 이름 변경, Layer 삭제, Source 전체 삭제와 Reconnect command를 연결한다.
- 사용 중 Source 삭제는 dependent Layer 범위를 보여주고 명시적으로 확인한다.
- Library selection과 Timeline/Properties selection identity를 동일한
  layerDocumentId로 유지한다.

### 완료 조건

- 아이콘 형태만으로 imported/recorded 구분 가능
- Library 미리 듣기 상태가 Project/History에 저장되지 않음
- 음소거와 이름 변경은 Owner transaction/History로 복원 가능
- Layer 삭제와 공유 Source 삭제 의미가 섞이지 않음

### 구현 결과 — 완료

- Cut의 PSD composition 행 아래에 Audio Layer를 placement order대로 투영한다.
  행 identity는 Source id가 아니라 `layerDocumentId`이므로 Library, Timeline,
  Properties가 같은 선택을 공유하며, 같은 Source를 여러 행이 사용해도 서로
  혼동하지 않는다.
- 불러온 Audio는 음표, 움직에서 녹음한 Audio는 마이크 형태를 사용하고 두
  아이콘 모두 초록색 계열로 표시한다. provenance는 Source Plain Data에서만
  읽으며 audition 상태는 Runtime에서 구독해 Project와 History에 저장하지 않는다.
- visual 행의 자물쇠/눈동자 열을 Audio 행에서는 재생·정지/음소거로 사용한다.
  재생은 Task 5의 single-active Audio Runtime에 연결하고 음소거는 Audio domain
  transaction으로 commit한다.
- 이름 변경과 휴지통은 정확한 `layerDocumentId`의 단일 Layer transaction이다.
  마지막 placement를 지울 때만 Source Registry record를 함께 제거하고, 공유
  placement가 남아 있으면 Source와 Reconnect locator를 보존한다. Source 전체
  삭제와 Reconnect는 기존 Source command를 계속 사용하며 행 휴지통과 섞지 않는다.
- fake projection/command 검증에서 imported/recorded 구분, 선택/재생 projection,
  audition 비영속성, mute/name undo·redo와 공유 Source 단일 행 삭제를 확인한다.

---

## Task 5 — Audio Runtime과 Library 미리 듣기

### 목적

Audio resource lifecycle과 동시에 하나만 재생되는 Library audition을 만든다.

### 작업 내용

- decoded AudioBuffer/resource registry와 waveform cache를 Editor Runtime에
  추가한다.
- 재생/정지/교체/seek와 상태 구독 public port를 정의한다.
- 다른 Audio 미리 듣기 시작 시 기존 audition을 정지한다.
- Project Open/Replace/Close, Source Refresh/Delete/Reconnect와 component
  cleanup에서 resource를 reconcile/invalidate/dispose한다.
- UI thread를 불필요하게 막지 않는 decode/waveform 생성 경계를 둔다.

### 완료 조건

- 동시에 활성 audition 1개 이하
- Project 교체 후 이전 Audio 재생 0건
- stale resource 재사용 0건
- resource dispose 중복 0건

### 구현 결과 — 완료 (Task 4보다 선행)

- Task 4의 Library 재생/정지 행 command가 의존할 Runtime 계약을 먼저 고정하기
  위해 Task 5를 선행했다. Library UI 행과 재생 버튼은 아직 추가하지 않았다.
- `EditorAudioRuntimePort`에 `play`, `stop`, `seek`, `read`, `subscribe`와
  Project/Source lifecycle command를 추가했다. Runtime 상태와 decoded resource는
  Project·History에 저장하지 않는다.
- 한 audition을 시작하면 기존 backend handle을 먼저 정지한다. Audio Layer의
  gain/muted를 backend gain에 반영하며 Project reconcile에서 변경된 값을
  재적용한다.
- Project replace/open/close의 `invalidate-all` Owner effect는 audition을 멈추고
  decoded registry를 비운다. Source refresh/delete/reconnect invalidation은 해당
  Source audition을 멈추고 resource를 dispose하며, Layer 삭제·Source 변경도
  Project reconcile에서 즉시 정지한다.
- 브라우저 backend는 AudioBufferSourceNode와 GainNode를 사용한다. Runtime
  핵심은 backend port에만 의존하므로 검증은 AudioContext 없이 fake backend로
  single-active, replace, seek, mute/gain, ended, invalidate, Project replace와
  dispose-once를 결정적으로 확인한다.
- Timeline clock 동기화와 waveform projection/cache 생성은 Task 6에 남겼다.
  Task 5에서는 두 번째 clock이나 persistent playback state를 만들지 않았다.

---

## Task 6 — Timeline Audio row와 playback 동기화

### 목적

Audio Layer를 Timeline에서 배치하고 하나의 playback clock으로 Canvas와 Audio를
동기화한다.

### 작업 내용

- Audio row와 waveform projection을 추가한다.
- move, trim, source offset과 Cut 이동 Draft/commit을 연결한다.
- Timeline play/pause/seek/range/loop에 Audio Runtime을 동기화한다.
- current frame의 두 번째 owner나 별도 persistent playback state를 만들지
  않는다.
- 음소거, gain과 fade를 Preview playback에 적용한다.

### 완료 조건

- Timeline current frame의 단일 authority 유지
- seek/pause/resume 뒤 Audio와 visual frame 동기화
- drag 중 History 0건, drop 시 History 1건
- hidden/muted/deleted Audio가 재생되지 않음

### 구현 결과 — 완료

- 기존 Timeline Layer projection을 그대로 사용하되 Audio 행에는 초록색 track과
  Runtime waveform peak projection을 표시한다. 파형은 decoded resource fingerprint
  기준 Runtime cache에서 읽고 Source offset과 trim 범위만 잘라 사용하며 Project와
  History에는 저장하지 않는다.
- 기존 timing Draft 경로를 Audio에도 적용한다. PointerMove는 Runtime draft만
  변경하고 PointerUp의 `set-timing` 한 번만 Owner/History에 commit한다. trim-start는
  source offset을 함께 움직이고, 양 끝 trim은 원본 Audio duration 범위를 넘지 않는다.
- Editor Audio Runtime이 기존 Timeline playback port의 `subscribe/read`만 구독한다.
  별도 timer나 current-frame owner 없이 play/pause/resume/seek/range와 loop의
  range-start frame jump를 감지해 Audio handle을 시작·정지·재탐색한다.
- 겹치는 Audio는 Runtime 내부의 여러 backend handle로 재생하되 Library audition은
  계속 하나만 허용한다. 일반적인 +1 frame tick에서는 재시작하지 않고 seek/loop 등
  불연속 frame에서만 재동기화한다.
- placement visible, muted, missing resource, deleted/out-of-range를 억제하고 gain,
  fade-in/fade-out을 매 frame backend gain에 반영한다. Audio 실패는 visual Timeline
  playback을 중단하지 않는다.
- fake backend/scheduler와 pure timing 검증에서 seek/pause/resume/loop, mute/delete/
  out-of-range, waveform offset projection, trim source clamp, drag 중 History 0건과
  release 1건을 확인한다.

---

## Task 7 — Cut과 Audio 순서 변경

### 목적

Library에서 Cut 순서와 Audio 소속/순서를 직접 변경한다.

### 작업 내용

- top-level Cut drag/drop으로 기존 placement order를 변경한다.
- Cut 전체 이동 시 child visual/Audio Layer 관계를 보존한다.
- Audio를 다른 Cut에 drop하면 parent Group과 필요한 local timing을 한
  transaction으로 갱신한다.
- 같은 Cut 안의 Audio 표시 순서는 canonical placement order에서 계산한다.
- invalid drop, self/descendant cycle과 stale drag를 거부한다.

### 완료 조건

- Library와 Timeline에서 Cut 순서 일치
- Cut 이동 후 child Audio 누락 0건
- Audio Cut 이동 후 source identity와 effect data 보존
- Undo/Redo 한 번으로 전체 reorder 복원

### 구현 결과 — 완료

- Library의 top-level PSD composition 행을 실제 Cut `layerDocumentId`와 연결하고,
  표시 순서를 project-root 직속 composition의 canonical `placement.order`로 계산한다.
  Cut drag/drop은 parent를 바꾸지 않고 sibling order만 한 Owner transaction으로
  정규화하므로 Cut 아래 visual/Audio child 관계는 그대로 유지된다.
- Audio 행은 같은 Cut의 Audio 앞/뒤 또는 다른 Cut 행 내부에 drop할 수 있다.
  destination의 visual sibling 순서는 보존하고 Audio 구간만 canonical order로
  계산한다. Cut 이동 시 Source identity, Audio domain/effect envelope와 sourceOffset은
  유지하며 target Cut duration에 필요한 start/duration clamp만 같은 transaction의
  최종 Project에 합친다.
- drag hover는 React Runtime draft인 dragged id/drop target만 바꾸므로 History 0건이다.
  유효한 drop에서만 Project Owner commit 한 번을 만들며 drag cancel, stale id,
  self/invalid target과 허용되지 않은 hierarchy drop은 commit하지 않는다.
- nested draggable event bubbling을 차단하고 `dataTransfer` move affordance를 연결했다.
  키보드는 focus된 Cut/Audio 행에서 `Alt+위/아래 화살표`로 같은 sibling 범위 순서를
  바꾸는 최소 접근성 대체 조작을 제공한다.
- 검증은 Cut/Timeline order 일치, child 보존, Audio same/cross-Cut 이동, timing clamp,
  Source/data 보존, 정확히 History 1건, undo/redo와 invalid/stale History 0건을 확인한다.

---

## Task 8 — 움직 내 직접 녹음

### 목적

브라우저 마이크 녹음을 현재 Cut의 recorded Audio로 추가한다.

### 작업 내용

- microphone permission, start/stop/cancel과 error state를 명시한다.
- 녹음 중 buffer/blob/stream은 prepared Runtime으로 유지한다.
- Confirm에서 recorded Source descriptor와 Audio Layer를 현재 Cut에 생성한다.
- recorded provenance, 자동 표시 이름과 전용 아이콘을 적용한다.
- Cancel, permission denial, track end와 Project 교체에서 MediaStream track을
  정리한다.

### 완료 조건

- 사용자 gesture와 permission 경계 명확화
- Cancel 시 Project update/History 0건
- 녹음 성공 시 imported Audio와 같은 playback/persistence 경로 사용
- recording stream과 object URL 누수 0건

---

## Task 9 — Audio 기본 Properties

### 목적

선택한 Audio Layer의 저장 가능한 기본 설정을 기존 Properties Panel에
제공한다.

### 작업 내용

- Audio 선택 시 Audio type section을 표시한다.
- gain, muted, start/duration/source offset과 fade in/out command를 제공한다.
- 연속 입력은 Draft, 확정은 Owner transaction 한 번으로 처리한다.
- 다른 Layer Type Properties와 selection/history 규칙을 공유한다.

### 완료 조건

- Audio 선택 시 visual Transform 전용 UI를 잘못 노출하지 않음
- Properties/Timeline/Library 선택 identity 일치
- Undo/Redo 뒤 Runtime이 현재 Project에 맞게 재평가
- 저장/재열기 후 동일한 Audio 기본 설정 복원

---

## Task 10 — Audio Effects Panel/Engine 기반

### 목적

오디오 기본 Properties와 분리된 effect chain 편집 경계를 만든다.

### 작업 내용

- Audio Effects Panel, Engine public view props와 command 계약을 추가한다.
- effect add/remove/reorder/enable/bypass와 parameter Draft/commit을 정의한다.
- effect chain은 Audio LayerDocument Plain Data에 저장한다.
- Engine은 Project를 소유하지 않고 Owner preparation/transaction port를
  사용한다.
- 다른 Panel Engine은 Audio Effects Engine을 직접 import하지 않는다.

### 완료 조건

- 독립 Panel ↔ Engine 책임 성립
- effect chain 저장 원본 1개
- effect reorder/parameter 확정 action당 History 1건
- Engine Import Boundary 검증 통과

---

## Task 11 — Noise Gate `소음 줄이기`

### 목적

첫 움직 내장 Audio Effect로 단순하고 예측 가능한 Noise Gate를 제공한다.

### 작업 내용

- UI는 `소음 줄이기` on/off와 강도 중심으로 제공한다.
- threshold, attack, release와 floor/range의 내부 parameter 계약을 정의한다.
- Preview는 AudioWorklet 또는 검증된 Audio graph 경계에서 처리한다.
- Export는 같은 parameter와 알고리즘 의미로 full audio를 처리한다.
- 강한 설정에서 음절 시작/끝 잘림과 pumping 위험을 제한한다.

### 완료 조건

- 무음/저레벨 구간 감쇠가 결정적으로 적용됨
- 발화 중 지속 소음까지 완전히 제거한다고 표시하지 않음
- Preview와 Export parameter/result 의미 일치
- bypass 시 원본 audio sample 의미 보존

---

## Task 12 — Export Audio 연결

### 목적

Timeline 배치와 effect chain이 적용된 Audio를 기존 영상 출력에 결합한다.

### 작업 내용

- Accurate frame scheduling과 같은 Timeline range/fps/duration을 사용한다.
- 각 Audio Layer의 start, duration, source offset, mute, gain, fade와 effect
  chain을 반영한다.
- MP4/WebM의 지원 codec/container 조합과 실패 결과를 명시한다.
- Preview Runtime의 임시 audition state는 Export에 반영하지 않는다.

### 완료 조건

- Preview와 Export의 Audio timing/effect 의미 일치
- muted/out-of-range Audio 제외
- 원본 decode 또는 encode 실패 시 불완전 파일을 성공으로 보고하지 않음
- Export 완료/취소/실패에서 encoder와 Audio resource 정리

---

## Task 13 — 문서 동기화와 최종 검증

### 목적

Library/Audio의 현재 구현 위치, 공개 경계와 회귀 결과를 문서와 검증에
반영한다.

### 작업 내용

- `docs/20_src_map.md`를 Library Engine, Audio Runtime, Audio Effects Engine과
  Source/Layer 계약에 맞게 갱신한다.
- canonical Architecture에 새 영구 계약이 생기면 해당 문서를 갱신한다.
- Audio schema/lifecycle/transaction/playback/effect/export fixture를 추가한다.
- active code의 old PSD Tree 책임 명칭과 Audio unsupported 경계를 audit한다.

### 최종 검증

- 변경 파일 ESLint
- Audio schema normalize/validation/migration/round-trip verification
- Audio prepare/confirm/cancel/resource lifecycle verification
- Library selection/delete/reorder/Source sharing verification
- Timeline playback/seek/trim/Cut 이동 verification
- Properties와 Audio Effects transaction/history verification
- Noise Gate Preview/Export parity fixture
- Engine Import Boundaries
- 전체 `npm run test`
- `npm run build`
- `git diff --check`
- Browser QA는 사용자 승인 시 별도 실행

### Sprint 완료 조건

- Task 0~13 PASS
- Library에서 PSD와 Audio Source/Layer 관리 가능
- imported/recorded Audio 구분, 미리 듣기와 음소거 동작
- Cut reorder와 Cut별 Audio 배치/이동 동작
- Timeline visual/audio 재생 clock 단일화 유지
- Audio 기본 Properties와 독립 Audio Effects Panel 경계 성립
- Noise Gate `소음 줄이기` Preview/Export 적용
- 저장/열기/Missing/Reconnect/Delete/Undo/Redo 회귀 통과
- 외부 VST hosting과 AI denoise 추가 0건
- Architecture, `docs/20_src_map.md`와 실제 코드 일치

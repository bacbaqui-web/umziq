# LayerDocument Architecture

## 1. 결과

Editor의 active 저장·편집·선택·History authority를 `LayerDocumentProject`로 통합했다.

```text
LayerDocumentProject
├─ metadata
└─ payload
   ├─ layerDocumentsById
   └─ sourceRegistry
```

Canvas, Timeline, Properties, PSD Tree는 서로의 상태를 수정하지 않는다. Composition Root가 동일 Project owner의 read/command port를 각 Engine에 주입하고, 모든 소비자는 같은 `layerDocumentId`를 기준으로 파생 모델을 읽거나 transaction을 요청한다.

이 문서는 현재 canonical 구조를 설명한다. Persistence envelope와 Project lifecycle 상세는 `57_layer_document_persistence_project_lifecycle.md`가 이어서 설명한다. `55_layer_type_future_engine_foundation.md`의 ProjectSource/Timeline Item 구조는 역사 기록으로만 남는다.

## 2. 저장 모델

### 2.1 Project

`LayerDocumentProject`는 Plain Data다.

- `metadata`: schema version, project id, project name. 현재 schema version은 2다.
- `payload.layerDocumentsById`: 모든 작업 Layer
- `payload.sourceRegistry.sourcesById`: 외부 원본 registry

Project는 LayerDocument와 Source Registry 외의 편집 원본을 저장하지 않는다. Timeline row, Canvas layer, panel state, evaluated scene과 renderer command는 모두 projection 또는 runtime이다.

현재 bootstrap은 Source Registry가 비어 있고 `project-root` 역할의 Group LayerDocument 하나만 있는 Project를 만든다.

### 2.2 LayerDocument

모든 LayerDocument는 다음 identity와 공통 영역을 직접 소유한다.

- `layerDocumentId`: canonical identity
- `name`, `revision`, `type`
- `common.source`: optional Source Registry reference
- `common.transform`
- `common.placement`
- `common.animation`
- `common.effects`
- `common.modifiers`
- `data`: Type별 discriminated data

Placement는 parent Group, order, start/duration, source offset, visibility, alias를 가진다. Timeline은 이 값을 표시하고 수정하는 UI/Engine 이름이지 저장 데이터 영역이 아니다.

### 2.3 Layer Type

현재 schema는 PSD, Drawing, Text, Audio, Video, Shape, Group, Unknown을 구분한다. `type`과 `data`는 validation 가능한 discriminated union이다.

- PSD: Source Registry의 PSD node를 참조하며 PSD 편집 metadata를 가진다.
- Group: 자식 scope, composition size/frame rate/duration 역할을 가진다.
- Drawing/Text: 최소 Plain Data와 placeholder renderer 경계가 있다.
- Audio: Source metadata와 future playback/editing 경계가 있다.
- Video/Shape: schema와 extension point가 있고 제품 편집/renderer는 아직 없다.
- Unknown: 알 수 없는 input을 안전하게 보존한다.

새 Type은 새 Project/selection/store를 만들지 않는다. LayerDocument의 Type data, Domain Engine command/query, panel descriptor, renderer adapter만 추가한다.

## 3. Source Registry와 lifecycle

Source Registry는 저장 가능한 외부 원본 descriptor와 reconciliation 상태만 설명한다.

- 모든 Source: `sourceId`, kind, display name, version, `refresh.status`
- linked document/audio/video: stable `linked-file` locator와 optional SHA-256 content fingerprint
- PSD node: `documentSourceId`, `sourceKey`, `sourcePath`, `visualFingerprint`
- reconciliation status: `normal`, `updated`, `new`, `deletePending`

File, FileSystemFileHandle, permission과 `unresolved`, `resolving`, `available`, `missing`, `error`는 Source Runtime Resolution port가 소유한다. Timeline, Properties, PSD Tree와 renderer는 이 runtime port를 주입받아 가용성을 읽는다. Missing 감지는 Project나 History를 변경하지 않는다.

Source는 Transform, Placement, Animation, Effect, Modifier나 사용자 Layer 이름을 소유하지 않는다. 같은 Source를 참조하는 여러 LayerDocument가 runtime 원본 resource를 공유해도 편집 데이터는 독립적이다.

PSD import는 prepare와 confirm을 분리한다.

```text
File 선택
→ ArrayBuffer 1회 읽기
→ 같은 buffer로 parse/analyze + SHA-256
→ Plain Data plan + prepared runtime
→ 사용자 confirm
→ Project transaction
→ runtime resource atomic registration
```

Cancel, failure, replacement에서는 준비된 runtime을 dispose한다. Confirm 성공 뒤에는 Source별 cache key로 runtime registry에 등록한다.

Refresh는 저장된 PSD source identity를 우선해 기존 LayerDocument를 유지한다. stable id가 없는 PSD node는 tree-path identity fallback을 사용한다. Source version/visual fingerprint가 바뀌면 해당 Source의 runtime만 invalidation하며 다른 PSD/import cache는 보존한다.

Source 삭제/교체/refresh, undo/redo, import confirm은 owner effect를 만들고 active assembly가 targeted runtime invalidation, suspend/restore 또는 orphan GC를 수행한다. Runtime resource는 dispose-once 계약을 가진다.

## 4. Identity

`layerDocumentId`가 다음 흐름의 동일 identity다.

- Project lookup
- selection과 active Group scope
- Timeline row/placement
- Canvas direct selection, glow, gizmo, motion path
- Properties target
- Transform Draft
- transaction과 History
- EvaluatedScene/PreviewScene node
- Layer result cache key

`sourceId`는 공유 가능한 외부 원본 identity다. 두 identity를 교환해서 사용하지 않는다.

`itemId`와 `renderItemId`라는 필드는 renderer projection의 derived compatibility 이름으로 일부 runtime 모델에 남아 있다. 저장 authority나 별도 편집 entity가 아니며 active command/selection은 `layerDocumentId`를 사용한다.

## 5. Owner, session, Draft, History

### 5.1 Project owner

Project Core Engine의 owner reducer가 모든 상태 전이를 담당한다.

- Project transaction commit
- Source lifecycle commit
- selection/active Group/playback session
- undo/redo
- owner effect 발행

Mutation은 total result를 반환한다. 실패하면 Project, session, History와 runtime registration이 부분 적용되지 않는다.

### 5.2 Session

선택 LayerDocument, active Group, current frame과 playback range는 Editor session이다. Panel별 선택 사본을 만들지 않는다. owner가 session을 Project와 함께 일관되게 전환하며 undo/redo 뒤에는 stale local UI/Draft를 비운다.

Project Lifecycle은 `untitled | file-backed`, `clean | dirty`, `idle | saving | loading` 세 축을 Project Engine runtime으로 관리한다. Dirty는 canonical Project digest와 savepoint digest의 일치 여부로 계산하므로 저장 중 생긴 후속 편집과 Undo로 savepoint에 돌아온 상태를 구분한다. 비동기 작업은 증가하는 operation token으로 stale 완료를 폐기한다.

Editor Shell의 lifecycle bar는 이 공개 상태와 command port만 소비한다. New/Open/Close는 Dirty일 때 discard confirmation을 먼저 통과하며 Cancel이면 owner, Runtime, Save target을 그대로 둔다. Save/Save As와 Open 오류는 code/message를 보존한 UI notice로 표시한다. Missing/Error Source는 Reconnect entry로 노출하지만 fingerprint mismatch와 legacy null fingerprint는 자동 승인하지 않고 확인 필요 상태로 남긴다.

검증된 Load/New candidate만 owner의 `replace-project` action으로 들어간다. 성공한 Replace는 새 Project의 기본 Session을 만들고 History와 runtime session을 비운 뒤 playback 정지, Draft/local UI 초기화와 Source Runtime 전체 invalidation effect를 발행한다. Cache port 자체는 dispose하지 않는다. 검증 또는 owner 교체 실패는 기존 owner state와 Runtime을 유지한다.

Save는 시작 시점의 Project를 Plain Data snapshot과 canonical `.sfep` bytes로 고정한다. Native File System API가 있으면 선택한 handle을 Save controller runtime에만 보관하고, 지원하지 않으면 `.sfep` Blob download를 사용하며 handle을 남기지 않는다. Save/Save As target과 savepoint는 write와 lifecycle token 확인이 모두 성공한 뒤에만 교체한다. 저장 write는 직렬화하므로 concurrent Save에서도 마지막 유효 작업이 최종 파일 상태가 되며 stale 완료는 savepoint를 이동하지 않는다.

Open은 native picker 또는 hidden `.sfep` file input으로 선택한 파일을 먼저 codec Load Candidate로 검증한다. Candidate가 유효한 경우에만 `projectId + locatorId` lookup으로 linked document 접근을 확인하고 새 Runtime resource를 준비한다. 준비가 끝난 같은 load token만 owner Replace를 수행하며, 기존 cache 전체 invalidation 뒤 새 resource를 atomic batch로 등록한다. 접근 불가 Source와 개별 preparation 실패는 각각 Missing/Error Runtime Resolution이 되고 Project는 Ready-Degraded로 열린다. 손상 파일과 stale 준비 결과는 기존 Project, Runtime과 Save target을 유지하고 준비 resource만 dispose-once 한다.

Reconnect는 Missing/Error인 linked document Source 하나를 기준으로 수행한다. 선택 파일의 실제 SHA-256/byte length가 저장 descriptor와 일치할 때만 document와 dependent PSD node의 기존 cache를 suspend하고 새 runtime batch를 등록한다. 성공하면 suspended resource를 dispose하고 `(projectId, locatorId)` local handle과 dependent Runtime Resolution을 함께 갱신하며 다른 Source cache는 보존한다. Fingerprint mismatch와 schema 1에서 이관된 null fingerprint는 자동 연결하지 않고 `refresh-source | replace-source` 확인 경계를 반환한다. Cancel, 권한 거부와 stale 결과는 기존 Runtime을 유지하고, parse 실패는 해당 dependent Source의 Error Runtime Resolution만 갱신한다.

### 5.3 Draft와 commit

Canvas/Properties/Timeline의 연속 입력은 PointerMove 동안 runtime Draft만 갱신한다.

```text
PointerDown
→ immutable committed base
→ PointerMove: Draft snapshot/read model
→ PointerUp: semantic intent
→ Project transaction 1회
→ History 1회
→ Draft clear
```

Transform Draft identity는 target `layerDocumentId`, global/local frame과 patch를 포함한다. Draft가 active인 동안 committed Project snapshot은 바뀌지 않는다. commit 결과가 Draft geometry와 같으면 preview dirty comparison도 clean으로 돌아간다.

### 5.4 History

한 사용자 action은 transaction과 History 한 건이다. Duplicate, delete, group move, Timeline placement commit, Transform/Animation/Effect/Modifier commit과 Source lifecycle이 같은 원칙을 따른다. Runtime Canvas/ImageBitmap/resource는 History나 Project snapshot에 들어가지 않는다.

## 6. Command와 read 흐름

```text
UI event
→ 담당 Engine command
→ semantic intent
→ injected Project owner port
→ validate + transaction
→ Project/session/history state 교체
→ owner effect
→ Engine read model 재계산
→ UI render
```

UI는 Project object를 직접 mutation하지 않는다. Engine도 다른 Engine 내부 구현이나 state를 import하지 않는다. 다영역 조합은 Composition Root의 port wiring 또는 Project transaction에서 수행한다.

Read 흐름:

```text
LayerDocumentProject + session + frame + Draft
→ Project/Runtime read adapter
→ Timeline / Properties / PSD Tree / Canvas read model
→ feature UI
```

## 7. Core Engine과 Domain Engine

Core Engine:

- Project: owner, transaction, History, Source lifecycle
- Playback/Render: frame evaluation과 renderer projection
- Canvas: viewport, selection, Draft interaction, preview/cache
- Timeline: placement/animation projection과 interaction
- Properties: 선택 LayerDocument의 값과 command
- PSD Tree: Source/Group tree와 import/refresh intent
- Animation: keyframe/effect/modifier 공통 계산

Domain Engine:

- Drawing
- Text
- Audio

Domain Engine은 해당 Layer Type 영역의 preparation, capability, command/query 경계를 가진다. Project를 소유하거나 Core Engine 내부를 import하지 않는다.

## 8. UI Engine별 계약

### Canvas

Canvas는 owner read port로 selected LayerDocument, scope, runtime input을 읽는다. direct selection, alpha hit, glow, gizmo와 motion path 모두 같은 `layerDocumentId`를 반환한다. PointerMove는 Draft, PointerUp은 semantic commit intent다.

### Timeline

Timeline은 active Group 자식 LayerDocument의 placement와 animation을 row/keyframe으로 projection한다. Source 가용성은 runtime resolution에서 읽는다. move/trim/reorder/visibility/alias는 별도 Timeline 저장 record가 아니라 LayerDocument transaction이다.

### Properties

Properties는 selected LayerDocument의 공통/Type data, matching Draft와 runtime Source resolution을 읽는다. numeric input은 로컬 문자열/Draft를 유지할 수 있지만 commit은 owner command를 통한다.

### PSD Tree

PSD Tree는 Source Registry의 PSD document/node와 Group graph를 projection하고 가용성은 runtime resolution에서 읽는다. import/refresh/delete/reorder/select intent만 만들고 Project mutation은 Project Engine에 위임한다.

## 9. Renderer boundary

Project data는 renderer resource를 포함하지 않는다.

```text
LayerDocument + Source Registry + Source Runtime Resolution + frame + Draft
→ LayerDocumentRuntimeInput
→ EvaluatedScene
├─ full-render: RenderFrame command
└─ fast-render: PreviewScene
→ RenderNodeVisualResolver
→ Canvas2D
```

Full/fast 경로는 node마다 다음 identity를 보존한다.

- `layerDocumentId`
- `sourceId`
- `sourceResourceCacheKey`
- `layerResultCacheKey`

Drawable visual은 네 key가 모두 있는 node-native request만 resolve한다. 이전 Project/runtime record fallback은 active renderer에 없다.

## 10. Cache 4층

### 10.1 Source runtime cache

정적 원본 pixel/resource를 `sourceId + sourceResourceCacheKey`로 보관한다. 같은 Source를 참조하는 LayerDocument가 공유한다. registration preflight/commit은 atomic이며 Source 또는 cache-key 단위 invalidation, suspend/restore, orphan GC, dispose-once를 제공한다.

### 10.2 Layer result identity

`layerResultCacheKey`는 `layerDocumentId`, revision, frame, quality, Source resource key와 Draft identity를 포함한다. Source 원본 key와 편집 결과 identity를 분리한다.

### 10.3 Composition preview cache

Fast renderer의 composition surface를 renderer mode, quality, scale, node id, size와 runtime id로 구분한다. 같은 node reference는 hit, child/ancestor 변화로 새 node reference가 생기면 miss/release한다. `beginFrame/endFrame`은 이번 frame에 사용하지 않은 entry를 퇴출한다.

Draft 중에는 committed composition snapshot 오염을 막기 위해 composition cache 전체를 bypass한다. commit 후에는 committed node/cache 경로로 복귀한다.

### 10.4 Surface pool

Surface는 quality, scale, logical size와 pixel size key로 pooling한다. acquire 때 transform/clear/size를 reset하고, release 뒤 같은 key에서 재사용한다. bounded pool은 LRU로 오래된 surface를 dispose하고 최종 dispose는 Canvas 크기를 0으로 만든다.

## 11. Dirty state와 incremental draw

Dirty state는 PreviewScene snapshot을 비교해 node별 dirty kind를 만든다.

- transform
- opacity
- visibility
- frame
- logical size
- source
- order
- hierarchy/composition

Fast Canvas draw plan은 다음 셋 중 하나다.

- `full`: 첫 frame, size/scale/composition render state 변화
- `skip`: 이전 scene과 동일
- `dirty`: 이전/새 bounds 합집합만 fractional-safe floor/ceil clear 후 교차 node 재draw

움직인 node와 dirty bounds에 겹치는 foreground는 다시 그리고, 떨어진 node는 유지한다. Composition render state가 바뀌면 부분 draw 대신 안전한 full draw를 선택한다.

## 12. Duplicate와 구조 변경

Duplicate:

1. 새 `layerDocumentId` 생성
2. 같은 Source reference 유지
3. 표시 이름을 sibling scope의 Layer name, placement alias, Source display name과 비교해 `name_2`, `name_3` 순서의 다음 빈 suffix로 저장
4. 기존 표시 이름이 `name_2`처럼 suffix를 가지면 `name_3`부터 증가
5. Transform/Placement/Animation/Effect/Modifier/Type data deep copy
6. 원본 바로 위 order 배치
7. 새 LayerDocument 선택
8. transaction/History 한 건

원본이 alias를 표시 중이면 새 suffix는 복제본 placement alias에 저장하고, 그렇지 않으면 복제본 LayerDocument name에 저장한다. Source Registry display name은 충돌 검사에만 사용하며 Duplicate로 변경하지 않는다.

Group subtree 구조 변경, delete, reorder도 graph/Source reference/selection validation을 통과해야 commit된다.

## 13. Offline migration boundary

이전 ProjectSource 형식은 active runtime bootstrap이 아니다. `src/models/offlineMigration/index.ts`만 명시적으로 이전 normalize/validation/migration API를 공개한다.

```text
이전 serialized input
→ offline validation/normalization
→ identity/source/layer builder
→ LayerDocumentProject
→ current validation
```

Active `src/models/index.ts`, Editor와 Engine은 이전 모델을 public authority로 export/import하지 않는다. migration 결과가 current schema를 통과한 뒤부터는 일반 LayerDocumentProject와 같다.

## 14. Engine boundary

- Feature UI → 담당 Engine public port만 사용
- Domain Engine → 필요한 Core port를 Composition Root에서 주입
- Engine → `src/cutover` import 금지
- Controller → 다른 Controller/Composer import 금지
- Composer → Controller 조립과 공개 API만 담당
- Project mutation → Project owner transaction만 수행
- runtime resource → Project/History/serialized data 진입 금지
- offline migration → active barrel/bootstrap 진입 금지

`src/cutover`는 현재 active wiring이지만 Engine 밖 Editor owner에서만 생성한다. 이름은 전환 역사를 반영할 뿐 이전 모델 fallback을 의미하지 않는다.

## 15. Layer Type 확장 방법

1. `LayerDocumentType`과 discriminated `data`에 Type 추가
2. normalize/validation/plain-data fixture 추가
3. 필요한 Source kind/lifecycle 정의
4. Domain Engine이 필요하면 명확한 command/query/capability port 추가
5. Properties panel descriptor/command 연결
6. Timeline capability projection 연결
7. Canvas/renderer content adapter 추가
8. Project transaction, duplicate, history, offline migration 정책 확인
9. Engine import boundary와 public fixture 추가

새 Type을 위해 별도 Project root, selection identity, Timeline entity 또는 renderer 저장 authority를 만들지 않는다.

## 16. 정적 검증 coverage

| 계약 | Public fixture coverage |
|---|---|
| schema/normalize/plain data | `verifyLayerDocumentSchema` |
| offline migration | `verifyProjectSourceLayerDocumentMigration` |
| owner/session/history/selection | `verifyLayerDocumentProjectOwner`, `verifyLayerDocumentTransactions` |
| Project Replace/lifecycle/savepoint/stale operation | `verifyLayerDocumentProjectLifecycle` |
| Save/Save As/native handle/Blob fallback/concurrent Save | `verifyLayerDocumentProjectSave` |
| Open/Load/linked Runtime/Ready-Degraded/stale Load | `verifyLayerDocumentProjectOpen` |
| Missing/Error read model/fingerprint reconnect/targeted cache | `verifyLayerDocumentProjectReconnect` |
| lifecycle UI command port/Dirty Cancel/오류 ViewModel/Missing entry | `verifyLayerDocumentProjectLifecycleUi` |
| duplicate/group/animation/effect/modifier | `verifyLayerDocumentTransactions`, consumer/controller fixtures |
| PSD import/second import/refresh | source preparation, consumer cutover, PSD Tree fixtures |
| schema 1→2 / Runtime Resolution / PSD 단일 buffer | schema, source preparation, `verifyLayerDocumentSourceRuntimeResolution` |
| Source targeted invalidation/GC/dispose-once | consumer cutover, `verifyLayerDocumentPreviewRuntimeCache` |
| full/fast node-native render | Canvas mode, `verifyLayerDocumentPreviewRuntimeCache` |
| previous scene reuse/child+ancestor invalidation | `verifyLayerDocumentPreviewRuntimeCache` |
| composition/surface cache and Draft bypass | `verifyLayerDocumentPreviewRuntimeCache` |
| full/skip/dirty fractional region draw | `verifyLayerDocumentPreviewRuntimeCache` |
| Canvas/Timeline/Properties/PSD Tree | 각 LayerDocument controller/UI boundary fixture |
| selection identity | Canvas, Timeline, Properties, owner fixtures |
| active public barrel/engine boundary | legacy-removal and import-boundary fixtures |

이 표는 정적/Node verification 범위다. Browser QA와 실제 PSD picker, drag/drop, Canvas pointer 조작 QA를 대신하지 않는다.

## 17. 500줄 이상 제품 파일 책임 판단

현재 `src`의 500줄 이상 TypeScript 제품 파일은 다음 10개다. 800줄 이상 제품 파일은 1개다.

| 파일 | 줄 수 | 현재 판단 |
|---|---:|---|
| `src/cutover/createLayerDocumentConsumerCutoverAssembly.ts` | 800 | Project/Canvas/Timeline/Properties/Source port 조립이 한 파일에 모여 있다. active wiring이지만 책임 축이 여러 개이므로 후속 분리 후보이며 알려진 부채로 유지한다. |
| `src/engines/properties/adapters/layerDocumentPropertiesController.ts` | 734 | 선택 LayerDocument의 raw input, Draft, commit 의미를 한 controller에서 일관되게 집계한다. 단일 input semantics 책임으로 현재 유지하되 Type별 command가 늘면 별도 helper/adapter로 분리한다. |
| `src/engines/timeline/helpers/layerDocumentTimelineViewModelHelpers.ts` | 598 | placement, animation, selection을 순수 Timeline projection으로 만드는 한 helper family다. 현재 유지하며 row/keyframe projection이 독립 성장할 때 분리한다. |
| `src/engines/timeline/useLayerDocumentTimelineEngine.ts` | 584 | Timeline controller와 public view/command 계약을 조립하는 Engine facade다. 계산은 helper에 있으므로 현재 유지하되 조립 축이 추가되면 composer 분리를 검토한다. |
| `src/editor/useLayerDocumentEditorOwner.ts` | 534 | Project owner, lifecycle/save/open/reconnect와 각 UI Engine/runtime port를 조립하는 제품 Composition 경계다. 현재 유지하되 persistence wiring이 독립 성장하면 composer 분리를 검토한다. |
| `src/engines/playback-render/renderers/fastPreviewRenderer.ts` | 528 | evaluated node 변환, previous-scene equality와 ancestor reuse라는 하나의 fast renderer 책임이다. 현재 유지하며 node-type별 equality 정책이 더 커지면 helper로 분리한다. |
| `src/engines/canvas/adapters/useLayerDocumentCanvasInteractionAdapter.ts` | 520 | Canvas handle/direct-selection/motion-path interaction을 동일 Draft/commit port에 연결한다. 현재 유지하며 interaction family가 독립적으로 성장하면 adapter를 분리한다. |
| `src/engines/project/import/layerDocumentPsdImportAdapter.ts` | 513 | PSD descriptor, Layer graph, prepared runtime을 한 import/refresh 경계에서 조립한다. 현재 유지하되 import/refresh 조립이 더 커지면 공통 builder 분리를 검토한다. |
| `src/models/layerDocumentStructureValidation.ts` | 510 | LayerDocument 공통 shape와 구조 validation을 담당하고 상위 validation이 결과를 집계한다. 현재 유지하되 Type별 검증이 커지면 validator 파일로 이동한다. |
| `src/engines/properties/adapters/useLayerDocumentPropertiesEngine.ts` | 503 | Properties controller와 React state/view props를 연결하는 Engine facade다. 현재 유지하며 Type별 UI session이 늘면 composer/controller 경계를 분리한다. |

500줄 이상 verification fixture는 여러 public 계약과 회귀 시나리오를 한 실행 단위에 모은 검증 aggregation이다. 제품 mutation/계산 책임과 구분하며 이 표의 제품 리팩토링 판단 대상에는 포함하지 않는다.

## 18. 알려진 한계

- linked audio/video의 persistence descriptor와 lifecycle 계약은 있으나 Runtime preparation은 아직 구현되지 않았다.
- preview memory estimate는 현재 빈 source 배열로 계산되며 quality build 상태는 `ready`, generation `0`인 골격이다.
- Draft active 동안 composition cache를 target 단위가 아니라 전체 bypass한다.
- composition cache와 dirty-region 최적화는 fast renderer 전용이다.
- app reload를 넘는 warm cache persistence는 없다.
- Photoshop stable layer id가 없거나 중복이면 PSD tree-path identity fallback을 사용하므로 원본 계층이 크게 바뀔 때 identity 보장이 약하다.
- Drawing/Text는 placeholder 수준이고 Audio 편집/재생은 future work다. Video/Shape는 extension point만 있다.
- `createLayerDocumentConsumerCutoverAssembly.ts`는 active wiring 책임이 800줄에 모인 리팩토링 부채다.
- `renderItemId`는 derived compatibility 이름일 뿐 저장 authority가 아니다.
- Browser QA와 실제 조작 QA는 이번 정적 검증 범위에서 수행하지 않았다.

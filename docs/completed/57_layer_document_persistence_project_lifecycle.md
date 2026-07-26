# LayerDocument Persistence와 Project Lifecycle

> **상태:** Persistence Sprint 완료 기록
>
> 현재 canonical 설계는
> `docs/architecture/17_persistence_lifecycle_architecture.md`를 따른다.

## 1. 목적과 문서 경계

이 문서는 `LayerDocumentProject`의 `.sfep` 저장/불러오기와 앱 실행 중
Project lifecycle 계약을 설명한다. Layer/Source 저장 모델은
`docs/completed/56_layer_document_architecture.md`, Editor Project Owner와 Panel Engine
구조는 `docs/completed/58_editor_project_owner_panel_engine_architecture.md`가 기준이며,
여기서는 persistence envelope, 외부 Source 복구, lifecycle command의
원자성만 상세화한다.

핵심 목표는 다음과 같다.

- 같은 유효 Project는 canonical bytes로 왕복한다.
- 파일·권한·parse·validation·stale operation 실패가 기존 Project를 부분 변경하지 않는다.
- 저장 파일에는 Plain Data descriptor만 있고 File, handle, decoded pixel 같은 Runtime은 없다.
- Load 뒤 Runtime을 재생성할 수 없더라도 Project는 Ready-Degraded로 열리고 Missing Source를 명시한다.
- 같은 Source를 공유하는 여러 LayerDocument는 하나의 reconnect 결과를 함께 사용한다.
- 새 Layer Type도 별도 저장 루트 없이 같은 envelope와 lifecycle을 재사용한다.

## 2. `.sfep` envelope와 schema

현재 파일은 UTF-8 JSON이며 최상위 envelope는 정확히 세 필드만 가진다.

```text
{
  format: "shortform-editor-project",
  containerVersion: 1,
  project: LayerDocumentProject
}
```

`containerVersion`은 파일 포장 형식, `project.metadata.schemaVersion`은 저장 모델 schema의 version이다. 두 version을 분리해 envelope dispatch 후 Project migration을 수행한다. 현재 Project schema는 2다.

Save 전에 Plain Data 여부와 전체 Project validation을 확인하고 object key를 재귀 정렬해 canonical JSON을 만든다. 출력은 2-space indentation과 마지막 newline을 사용한다. Load는 빈 파일, 64 MiB 초과, 잘못된 UTF-8/JSON, 256단계 초과 중첩, Layer/Source 각각 10,000개 초과, 잘못된 envelope/version, 알 수 없는 entity type과 Project validation 오류를 구조화된 `code`, `path`, `message`로 반환한다.

## 3. Descriptor와 Runtime Resolution

Source Registry에는 다시 연결할 수 있는 Plain Data descriptor만 저장한다.

- linked Source: stable `locatorId`, 추천 파일명, optional relative path hint
- content identity: SHA-256 `digestHex`와 `byteLength`
- PSD node: document Source 참조, source key/path, visual fingerprint
- reconciliation: normal/updated/new/deletePending

다음 값은 저장하지 않고 `LayerDocumentSourceRuntimeResolutionPort`가 앱 세션에서만 소유한다.

- `File`, `FileSystemFileHandle`
- permission
- unresolved/resolving/available/missing/error
- decoded PSD resource, Canvas/ImageBitmap, renderer cache

local handle은 `(projectId, locatorId)` key로 찾는다. New Project는 매번 고유한 non-empty `projectId`를 받아 다른 Project의 handle과 충돌하지 않는다.

## 4. Codec와 migration 순서

Load 순서는 고정되어 있다.

```text
bytes 제한/UTF-8/JSON
→ nesting과 envelope 검증
→ entity count 제한
→ Project schema dispatch와 migration
→ 알려진 Layer/Source type 확인
→ current normalize + validation
→ Load Candidate
```

Schema 1→2 migration은 순수 Plain Data 변환이다. 이전 경로/파일명은 linked locator hint로 옮기지만 이전 fingerprint나 available 표시는 신뢰하지 않는다. linked Source의 `contentFingerprint`는 `null`이 되며 실제 파일의 SHA-256을 확인하기 전에는 자동 연결할 수 없다. Migration은 파일 접근이나 Runtime resource 생성을 하지 않는다.

Save→Load→Save는 유효한 current Project에 대해 동일한 canonical bytes를
만든다. Codec가 Load Candidate를 반환하기 전에는 Project Owner, Runtime
Resolution, resource cache와 Save target을 변경하지 않는다.

## 5. Lifecycle과 Dirty

Lifecycle state는 세 축을 가진다.

- document: `untitled | file-backed`
- dirty: `clean | dirty`
- operation: `idle | saving | loading`

Dirty는 object identity나 UI flag가 아니라 canonical Project digest와 savepoint digest 비교로 계산한다. 따라서 Save가 진행되는 동안 후속 편집이 생기면 이전 snapshot 저장 성공 뒤에도 dirty이며, Undo로 savepoint 내용에 돌아오면 clean이다.

비동기 Save/Open은 증가하는 operation token을 사용한다. 더 최신 작업이
시작된 뒤 도착한 stale 결과는 Project나 savepoint를 교체하지 않는다.
검증된 New/Open candidate의 `replace-project`만 Editor Project Owner의
Project를 바꾸며,
성공 시 History와 project-scoped Runtime을 초기화하고 playback 정지,
Draft/local UI reset, Source Resolution reset과 Runtime cache invalidation을
기존 Owner effect 경계로 수행한다.

## 6. Save와 Save As

Save controller는 작업 시작 시점의 Project를 immutable Plain Data snapshot으로 복제하고 canonical `.sfep` bytes를 만든다.

- Native File System API: 선택한 writable handle을 controller runtime에만 유지한다.
- fallback: Blob download를 수행하며 지속 Save target을 남기지 않는다.
- Save: 기존 native target이 있으면 재사용하고, 없으면 target을 선택한다.
- Save As: 항상 새 target을 선택한다.

Write는 직렬화되며 token이 유효한 동안만 commit한다. write와 `markSaved`가 모두 성공해야 savepoint와 target을 갱신한다. Cancel, permission denial, encoding/write/download failure와 stale result는 구조화 오류를 반환하고 기존 savepoint/target을 보존한다.

## 7. Open과 Ready-Degraded

Open은 picker에서 얻은 `.sfep` bytes를 codec로 먼저 검증한다. 유효한 Project만 linked document Source를 순회한다.

1. `(projectId, locatorId)`로 session-local 파일 접근 확인
2. 접근 가능하면 실제 파일로 prepared Runtime 생성
3. 저장 fingerprint와 실제 SHA-256/byte length 일치 확인
4. resource batch preflight
5. 같은 load token에서 Project Owner Replace
6. Runtime batch 등록과 Resolution 반영

모든 Source가 준비되면 `ready`, 일부가 접근 불가이거나 준비에 실패하면 `ready-degraded`다. Ready-Degraded도 Plain Data Project 편집을 허용하며, 실패한 document Source와 dependent PSD node를 Missing/Error로 표시한다.

손상 파일, unsupported schema, stale load와 Project Owner Replace 실패는
기존 Project, Runtime과 Save target을 유지하고 prepared resource를
dispose한다. 성공한 native Open만 해당 파일 handle을 이후 Save target으로
commit한다.

## 8. Missing Source와 Reconnect

Reconnect read model은 Runtime Resolution이 Missing/Error인 linked document Source만 나열하며 display name, 추천 파일명, fingerprint policy, dependent Source와 dependent LayerDocument를 제공한다.

PSD document Source 하나를 여러 PSD LayerDocument가 참조해도 원본 Runtime은 Source 단위로 공유한다. Reconnect는 document Source와 dependent PSD node의 cache만 suspend한 뒤 새 batch를 등록한다.

- fingerprint 일치: 새 Runtime 등록, suspended resource dispose, Resolution과 local handle 갱신
- preflight/registration 실패: 기존 suspended Runtime 복구
- parse 실패: dependent Resolution을 Error로 표시
- Cancel/permission/stale: 기존 Runtime 유지
- fingerprint mismatch 또는 legacy `null`: prepared Runtime을 버리고 `refresh-source | replace-source` 확인 필요 결과 반환

Mismatch와 legacy fingerprint는 자동 승인하지 않는다. descriptor를 갱신하는 Refresh/Replace는 기존 Source lifecycle transaction의 명시적 사용자 확인 경계에서 수행한다.

## 9. Editor UI 경계

Shell의 lifecycle bar는 `useLayerDocumentEditorRuntime`이 제공하는
lifecycle/save/open/reconnect 공개 port만 사용한다. Project Owner state,
Draft, playback, Runtime cache를 직접 변경하지 않는다.

- New/Open/Close: dirty이면 discard confirmation
- Cancel: 현재 Project와 Save target 보존
- Save/Save As: clean/dirty/saving 상태와 구조화 오류 표시
- Open: loading과 Ready-Degraded notice 표시
- Missing/Error: Source 목록과 Reconnect entry 표시
- fingerprint 확인 필요: warning만 표시하고 자동 Refresh/Replace 금지

New command의 Project factory는 초기 bootstrap 호환 ID를 재사용하지 않고 매 호출마다 고유 `projectId`를 만든다.

## 10. Runtime 미저장과 재구축

`LayerDocumentProject`만 `.sfep`와 History snapshot에 들어간다. 다음 값은
Project/History/`.sfep`에 들어가지 않는다.

- File/handle/permission
- Source Runtime Resolution
- decoded PSD pixels와 prepared resource
- Canvas/ImageBitmap/surface/composition cache
- evaluated scene와 renderer command
- layer/source selection과 active Group
- current frame, playback range/clock/transport
- panel state, pointer Draft와 선택된 keyframe

Load는 descriptor와 외부 파일을 이용해 Runtime을 재구축한다. 외부 파일이 없으면 저장 데이터 자체를 훼손하지 않고 Missing/Error 상태로 남긴다. 이 분리로 canonical roundtrip은 브라우저 capability와 무관하며 Runtime dispose/rebuild가 Project serialization을 바꾸지 않는다.

## 11. 검증

| 계약 | verification |
|---|---|
| canonical roundtrip, Plain Data, envelope/limit/error | `verifyLayerDocumentProjectPersistence` |
| schema 1→2와 Runtime exclusion | `verifyLayerDocumentSchema`, `verifyLayerDocumentProjectPersistence` |
| lifecycle digest/savepoint/stale/Replace effect | `verifyLayerDocumentProjectLifecycle` |
| Save/Save As/native/fallback/concurrent failure | `verifyLayerDocumentProjectSave` |
| Open atomicity, Runtime rebuild, Ready-Degraded | `verifyLayerDocumentProjectOpen` |
| Missing shared dependency, fingerprint gate, targeted reconnect | `verifyLayerDocumentProjectReconnect` |
| UI port, Dirty Cancel, structured notice, unique New identity | `verifyLayerDocumentProjectLifecycleUi` |
| 기존 LayerDocument/Source/consumer regression | 전체 `npm test` verification suite |

이 검증은 Node 기반 정적/public fixture다. 실제 browser picker, 권한 prompt, download와 UI 조작 검증을 대신하지 않는다.

## 12. 제한과 향후 과제

- local handle registry는 현재 앱 세션 범위이며 reload 뒤에는 다시 연결해야 한다.
- linked audio/video의 descriptor와 lifecycle 계약은 있으나 Runtime preparation은 아직 구현되지 않았다.
- fingerprint mismatch/legacy null의 Refresh/Replace 선택 UI는 후속 구현 대상이다.
- Blob fallback Save는 같은 파일에 대한 지속 writable target을 제공하지 않는다.
- 실제 browser picker·permission·download 통합 검증은 별도 환경에서 수행해야 한다.

새 Layer Type은 `LayerDocument.type/data`, 필요한 Source descriptor와 기존
Panel command/capability를 추가하되 envelope, canonical codec, Project
Owner lifecycle, Dirty/savepoint, Ready-Degraded와 Reconnect port를 그대로
재사용한다. 독립 Panel이 생길 때만 짝을 이루는 Engine 추가를 검토하며,
별도 Project root, 저장 store 또는 Runtime 직렬화를 추가하지 않는다.

Render 구조, 명칭, 파일 위치, public export와 책임은 후속 Render Sprint
전까지 동결한다. Persistence는 Render Runtime을 저장하지 않는 현재 계약만
유지하며 Render 내부 구조를 변경하지 않는다.

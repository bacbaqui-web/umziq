# Editor Project Owner와 Panel Engine Architecture

> **상태:** Project Owner와 Panel Engine 전환 완료 기록
>
> 현재 canonical 설계는 `docs/architecture/10_project_architecture.md`를
> 따른다.

## 1. 목적과 문서 경계

이 문서는 Editor의 최종 runtime topology를 기록한다. 저장 데이터 구조와
transaction 규칙은 `docs/completed/017_layer_document_architecture.md`, `.sfep`와
Project lifecycle은
`docs/completed/018_layer_document_persistence_project_lifecycle.md`, 파일별 지도는
`docs/20_src_map.md`를 기준으로 한다.

핵심 결과는 하나의 Editor Project Owner, 하나의 Composition Root, 네 Panel
Engine과 동결된 Render boundary다. 전환용 조립 계층은 최종 실행 경로에서
제거됐다.

## 2. 최종 topology

```text
EditorShell
  └─ useEditorCompositionRoot
       ├─ useLayerDocumentEditorOwner
       │    └─ useEditorProjectOwner
       ├─ useLayerDocumentEditorRuntime
       │    ├─ Owner command/effect adapter
       │    ├─ lifecycle / save / open / reconnect
       │    ├─ Source resolution / resource registry
       │    ├─ shared Transform Draft
       │    └─ Timeline playback Runtime
       ├─ useLayerDocumentPanelEnginePorts
       │    ├─ Canvas read/command ports
       │    ├─ Timeline owner/playback ports
       │    ├─ Properties read/command ports
       │    └─ PSD Tree controller/source ports
       ├─ Canvas / Timeline / Properties / PSD Tree Engines
       └─ EditorShellLayout
            └─ Feature components
```

`useEditorCompositionRoot.ts`가 제품 Composition Root다. Owner와 Runtime을
한 번 만들고 각 Panel Engine을 한 번 생성한 뒤 serializable view props와
commands를 `EditorShellLayout`에 전달한다. 제품 계산이나 Project mutation은
Composition Root에 두지 않는다.

## 3. 책임과 authority

| 경계 | 소유하는 것 | 소유하지 않는 것 |
|---|---|---|
| Editor Project Owner | current Project, Project-only History, layer/source selection, active Group, keyframe/source session validity | playback, Draft, Source resource, Panel local state |
| Editor Runtime | lifecycle/save/open/reconnect, Source resolution/resource lifetime, shared Draft, Timeline playback Runtime, Owner effect 적용 | Project 저장 데이터 |
| Canvas Engine | preview projection/draw/cache, viewport/tool/interaction Runtime, Canvas commands | Project, Timeline clock |
| Timeline Engine | placement/animation view, pointer interaction, playback UI; Timeline Runtime은 주입된 단일 port | Layer 사본, Project History |
| Properties Engine | selected Layer descriptor, frame/Draft 반영 view, 담당 edit intent | selection authority, Project |
| PSD Tree Engine | Source/Group tree view와 import/refresh/delete UI flow | Source Runtime resource authority, Project |
| Playback/Render | evaluated scene, full/fast draw, Render cache | Project mutation, Editor selection |
| Feature UI | 표시와 사용자 intent 전달 | Engine state, Project mutation |

`EditorProjectOwnerPort`는
`LayerDocumentProjectOwnerPort`의 canonical Editor alias다. 별도
compatibility port나 live-port adapter가 없다.

## 4. 최종 public wiring

### Owner

`src/editor/project-owner/useEditorProjectOwner.ts`가 reducer를
`createEditorProjectOwnerPort`에 연결하고 안정적인 read/transition port를
만든다. `useLayerDocumentEditorOwner.ts`는 Owner 인스턴스를 정확히 한 번
생성한다.

`editorProjectOwnerCommandAdapter.ts`는 Panel의 semantic preparation을
Owner transition으로 전달하고 성공 effect를 Editor Runtime에 적용한다.
Project commit, selection/history, Draft clear, local UI reset와 Source cache
effect가 이 경계에서 조정된다.

### Editor Runtime

`useLayerDocumentEditorRuntime.ts`는 다음 session authority를 한 번 생성한다.

- Source runtime resource registry와 resolution store
- Owner command adapter
- shared Transform Draft session
- Timeline playback/clock runtime
- lifecycle/save/open/reconnect controllers

React StrictMode의 mount/unmount 재실행에서 live resource를 조기 dispose하지
않도록 deferred cleanup을 사용하고, 최종 cleanup에서는 resource와 playback을
각각 dispose한다.

### Panel port 변환

`useLayerDocumentPanelEnginePorts.ts`는 Owner/Runtime을 각 Panel의 최소
public port로 바꾼다.

- Canvas: read model, Draft/selection/keyframe/playback command
- Timeline: Project/scope/read/intent/source-status와 playback
- Properties: selected descriptor, global frame, matching Draft, panel/timeline
  command
- PSD Tree: tree read, prepared Source confirm/cancel, runtime registration,
  refresh/reconnect/delete

이 파일은 port 조립만 하며 domain 계산이나 Project mutation을 직접 하지
않는다.

## 5. Panel Engine boundary

현재 Panel Engine은 Canvas, Timeline, Properties, PSD Tree 네 개다.

- Panel Engine끼리 서로 import하지 않는다.
- Core Engine은 Editor 또는 Feature UI를 import하지 않는다.
- Engine은 Feature component를 export하지 않는다.
- Feature component는 `EditorShellLayout.tsx`가 직접 import한다.
- Engine의 UI-facing 계약은 각 Engine public barrel의 view props/command
  type이다.
- 다른 영역이 필요한 경우 Composition Root가 public port를 주입한다.

Canvas의 Feature contract는
`src/engines/canvas/models/canvasPreviewPaneModel.ts`의
`CanvasPreviewPaneProps`다. Properties와 Timeline도 각각 Engine model의
view props를 Feature가 소비한다. Feature 전용 type 파일을 Engine 계약의
authority로 사용하지 않는다.

## 6. 주요 command 흐름

```text
Feature event
  → Panel Engine command
  → injected semantic adapter
  → preparation
  → Editor Project Owner transition
  → Project + History commit
  → Owner effect
  → Draft/cache/local UI validity update
  → subscribed Panel read model 재계산
```

Pointer move처럼 연속적인 preview는 shared Draft만 변경한다. Pointer up 또는
확정 event에서만 Owner transaction으로 commit한다. PSD prepare 단계의
resource도 confirm 전까지 Project 밖에 있으며 cancel/failure에서 dispose된다.

여러 Panel을 건너는 동작은 Engine 간 호출이 아니라 Owner command와 주입된
Runtime port로 조합한다.

## 7. 제거된 전환 구조

최종 구조에서는 다음 전환 계층을 사용하지 않는다.

- `src/cutover`
- consumer assembly와 UI controller port adapter
- Project Owner compatibility React hook/live-port helper
- Feature-owned Properties contract
- Panel Engine barrel의 Feature component re-export
- non-Render `Cutover`/`assembly` 명칭과 임시 preparation port

검증 fixture는 제품 assembly를 재도입하지 않는다.
`scripts/helpers/createLayerDocumentVerificationPorts.ts`는 Node verification
환경에서 production과 같은 public adapter를 구성하는 test-only helper다.

## 8. Render compatibility 예외

Playback/Render의 구조와 public contract는 이번 구조 변경에서 동결했다.
따라서 아래 예외는 의도적으로 유지한다.

- `src/engines/animation/index.ts`: Render가 사용하는 compatibility entry
- `src/engines/playback-render` 내부
  `LayerDocumentRuntimeCutoverPreparationPort`

비-Render 코드는 순수 `src/animation` public entry를 사용한다. 이 예외를
일반 Editor/Panel compatibility의 근거로 확장하지 않는다. 제거와 명칭
정리는 별도의 후속 Render Sprint에서 Render regression 계약과 함께
수행한다.

## 9. 정적 검증 경계

`scripts/verifyEngineImportBoundaries.ts`는 다음 실제 경계를 검사한다.

- 제품 Composition Root와 Editor Runtime/Panel port 파일
- 네 native Panel Engine hook의 단일 wiring
- Engine 간/Feature 역방향 import 금지
- Engine barrel의 Feature re-export 금지와 Shell의 직접 Feature import
- 삭제된 `src/cutover`, Owner compatibility hook, Feature-owned contract 부재
- canonical Owner port와 최종 adapter wiring
- non-Render legacy 명칭 부재
- frozen Render compatibility entry 존재

행동 보존은 전체 verification suite가 Project-only History, Draft,
Timeline runtime, persistence, Ready-Degraded, Reconnect, PSD resource
lifecycle, Canvas/Render cache를 실제 fixture로 검증한다.

## 10. 남은 위험과 후속 범위

- Render compatibility 이름과 entry는 의도적으로 남아 있으며 후속 Render
  Sprint 전에는 변경하지 않는다.
- 대형 controller/helper/renderer 파일은 책임 분리 후보지만 이 architecture
  완료 과정에서는 행동 위험을 늘리지 않도록 분해하지 않았다.
- 실제 browser picker, permission prompt, download와 포인터 UI 조작은 Node
  verification이 대신하지 않는다.

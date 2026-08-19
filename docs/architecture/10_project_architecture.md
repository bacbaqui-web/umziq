# Project Architecture

## 상태

- 역할: Project와 Editor 전체의 영구 Architecture
- 기준: `docs/01_rule.md`
- 현재 구현 위치: `docs/20_src_map.md`
- 과거 전환 기록: `docs/completed/017_layer_document_architecture.md`,
  `docs/completed/019_editor_project_owner_panel_engine_architecture.md`

## 한 문장 정의

Nexus가 하나의 canonical Project를 소유하고, 사용자는 Panel과 짝을 이루는 Engine을
통해 Layer Document를 편집한다. Editor Root는 Nexus, Gateway, Runtime과 Engine을
조립한다.

## 공식 용어

- **Nexus**: canonical Project의 유일한 authority
- **Gateway**: 외부 플랫폼 capability로 나가는 공식 관문
- **Editor Root**: Nexus, Gateway, Runtime과 Engine을 한 번 조립하는 최상위 경계
- **Panel Engine**: 독립 Panel과 사용자 기능의 공개 경계
- **Port**: Controller가 Nexus, Gateway 또는 Runtime과 통신하는 interface
- **Adapter**: 외부 또는 Runtime 계약의 구체 구현

현재 실제 파일 위치는 `docs/20_src_map.md`를 따른다.

## 전체 구조

```text
Editor Root
├─ Nexus
│  ├─ LayerDocumentProject
│  ├─ Transaction
│  ├─ History
│  └─ Selection Runtime
├─ Gateway
├─ Editor Runtime
└─ Panel Engine ↔ Panel
   ├─ Menu
   ├─ Library
   ├─ Canvas
   ├─ Timeline
   ├─ Visual
   ├─ Audio
   └─ Drawing
```

Nexus는 Project의 유일한 mutation 경계다. Editor Root는 값을 소유하거나 복사하지
않고 Nexus, Gateway와 Runtime의 최소 Port를 Panel Engine에 연결한다. 이 구조와 용어가
현재 Architecture의 기준이다.

## Project와 Layer Document

`LayerDocumentProject`는 저장되는 Project root다.

```text
LayerDocumentProject
├─ metadata
└─ payload
   ├─ layerDocumentsById
   └─ sourceRegistry
```

Layer Document 하나는 Project 안의 작업 Layer 하나다. Layer별 편집 데이터의
canonical identity는 `layerDocumentId`이며 다음 두 영역으로 구성한다.

```text
LayerDocument
├─ id / name / revision / type
├─ common
│  ├─ source
│  ├─ transform
│  ├─ placement
│  ├─ animation
│  ├─ effects
│  └─ modifiers
└─ data
   └─ PSD / Drawing / Text / Audio / Video / Shape / Group
```

Canvas Layer, Timeline row, Visual Panel state와 Render item은 별도 편집 원본이
아니다. Layer Document에서 계산되는 projection이거나 저장되지 않는
Runtime이다.

현재 Project schema version은 3이다. Audio Source descriptor는 locator,
fingerprint, provenance(imported/recorded), duration/channel/sample-rate metadata를
저장한다. Audio Layer는 `layerDocumentId`로 선택하며 Cut 소속·순서·timing은
`common.placement`, gain/mute/fade는 Audio `data`, ordered effect chain은
`common.effects`에 저장한다.

## Identity

| Identity | 의미 |
|---|---|
| `projectId` | Project와 session resource를 격리한다. |
| `layerDocumentId` | 저장, 선택, command와 History의 Layer identity다. |
| `sourceId` | 공유 원본 descriptor와 Runtime resource identity다. |

Renderer 내부의 drawable 또는 command identity는 Project entity가 아니다.

## Nexus

Nexus는 움직 내부 Project 세계의 본진이자 외부에서 하나로 보이는 canonical
authority다. 내부 책임은 다음처럼 분리한다.

- Project state와 replace
- Project transaction
- Project-only History
- Selection Runtime과 Project 교체 후 유효성 보정

Nexus는 Project file workflow, Gateway, Source/Audio Runtime resource,
Panel별 Draft, viewport, playback clock, hover, Cache와 UI state를 소유하지 않는다.
Engine은 Nexus 전체가 아니라 자신의 사용자 흐름에 필요한 최소 Port만 사용한다.

## Panel과 Engine

- Engine은 독립 Panel과 편집 책임이 있을 때만 둔다.
- Panel은 Project object를 직접 mutation하지 않는다.
- Panel Engine은 자신의 command/query 계약만 공개한다.
- Panel Engine끼리는 서로의 내부 구현이나 상태를 직접 수정하지 않는다.
- 여러 영역을 함께 바꾸는 작업은 Nexus transaction으로 조합한다.
- 독립 Panel이 없는 기능은 순수 모듈이나 기존 책임 안에 둔다.

Library는 PSD 전용 Tree가 아니라 현재 Project의 PSD와 Audio Source/Layer를 관리하며
이후 Image/Video asset까지 확장할 Panel이다. 명시적 Missing Source Reconnect와 직접
녹음은 Library Controller 책임이다. Visual Engine은 visual Layer의 Transform,
Opacity, Animation과 Modifier를 담당하고 Audio Engine은 gain/mute/fade, Audio Source와
ordered effect chain을 담당한다.

Drawing은 Canvas 안의 전용 Toolbar Panel과 연속 Pointer Draft가 있으므로 독립 Panel
Engine이다. tool, color, size, active pointer와 stroke Draft만 소유하며, 확정 element,
새 Layer 생성과 PSD→Drawing 변환은 Nexus transaction으로 반영한다.

복합 Panel Engine 내부 책임은 다음 경계를 따른다.

```text
Engine facade
└─ Composer
   ├─ Controller
   │  └─ Helper
   └─ Controller
      └─ Helper
```

- Engine facade는 Composer 호출과 Panel 공개 결과만 남긴다.
- Composer는 독립 Controller의 결과를 ViewProps와 공개 command로 조합한다.
- Composer는 Controller 간 실행 순서, 조건이나 비즈니스 규칙을 결정하지 않는다.
- 여러 단계의 사용자 흐름은 하나의 Controller가 처음부터 cleanup까지 소유한다.
- Controller는 사용자 intent, 비동기 session과 Runtime 수명을 담당하되 다른
  Controller나 Feature UI를 직접 참조하지 않는다.
- Helper는 순수 입력→출력 계산이며 React state, File/Handle과 Runtime resource를
  소유하지 않는다.

Visual과 Audio Engine은 서로 참조하지 않는다. 선택 종류에 맞는 공개 ViewProps를 같은
Inspector 위치에 제공하며 Audio Engine이 기본 속성 transaction과 ordered effects를
함께 소유한다.

이 구조는 책임이 실제로 여러 개일 때만 적용하며 작은 Engine을 형식적으로
분해하지 않는다.

## Editor Root

Editor Root는 다음 작업만 한다.

1. Nexus, 현재 플랫폼 Gateway와 Editor Runtime을 한 번 생성한다.
2. Nexus/Gateway/Runtime의 공개 Port를 Controller가 필요한 최소 형태로 주입한다.
3. Timeline Runtime 같은 공유값을 구독해 필요한 Panel에 전달한다.
4. Panel ViewProps와 command를 UI에 연결한다.

Project 계산, mutation, frame 보관과 별도 편집 state 생성은 하지 않는다.

## Menu Engine

Menu Engine은 최상단 Menu Bar의 public boundary다. New, Open, Save, Save As, Close,
Project Session과 Export 진입을 담당한다. Persistence는 별도 실행 계층이 아니라
Save/Open Controller가 사용하는 순수 Helper, Gateway Storage Port와 Platform Adapter의
책임군이다. Export workflow는 Menu Export Controller가 소유하고 encoder는 Runtime,
destination I/O는 Gateway가 담당한다.

## Command 흐름

```text
사용자 Intent
→ Panel Engine command
→ 주입된 Project command 또는 Runtime command
→ Nexus transaction 또는 Draft 변경
→ 같은 Project/Runtime을 기준으로 projection 재계산
→ 각 Panel 갱신
```

Panel끼리 서로 새로고침을 요청하지 않는다.

## Duplicate와 구조 변경

Duplicate는 같은 Source를 참조하는 새 Layer Document를 만든다. Source
resource는 공유할 수 있지만 Transform, Placement, Animation, Effect,
Modifier와 Type별 데이터는 독립적이다.

Create, Duplicate, Delete, Group 이동과 Source 교체는 원자적인 Project
transaction이며 사용자 action 한 번에 History 한 건만 만든다.

## 저장 데이터와 Runtime

Project에는 Plain Data만 저장한다. File, handle, decoded resource, Canvas,
Draft, playback, Cache, Selection과 Panel state는 저장하지 않는다.

Project가 교체되면 Runtime은 새 Project에 맞춰 reconcile, invalidate,
rebuild 또는 dispose한다. Runtime은 Layer Document를 대신하는 원본이 될 수
없다.

## 불변 조건

- Layer별 편집 데이터의 단일 원본은 Layer Document다.
- Project mutation은 Nexus 경계를 통한다.
- Panel과 Engine은 같은 Project와 Selection을 기준으로 동작한다.
- Editor Root는 wiring만 수행한다.
- 저장 데이터와 Runtime을 섞지 않는다.
- Project schema 변경은 migration, normalize와 validation을 동반한다.

## 관련 Architecture

- Render: `docs/architecture/11_render_architecture.md`
- Timeline: `docs/architecture/12_timeline_playback_architecture.md`
- History와 Draft: `docs/architecture/13_history_draft_architecture.md`
- Source: `docs/architecture/15_source_architecture.md`
- Project File Workflow: `docs/architecture/17_project_file_workflow_architecture.md`

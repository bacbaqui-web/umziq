# Project Architecture

## 상태

- 역할: Project와 Editor 전체의 영구 Architecture
- 기준: `docs/01_rule.md`
- 현재 구현 위치: `docs/20_src_map.md`
- 과거 전환 기록: `docs/completed/56_layer_document_architecture.md`,
  `docs/completed/58_editor_project_owner_panel_engine_architecture.md`

## 한 문장 정의

Project Owner가 하나의 Project를 소유하고, 사용자는 Panel과 짝을 이루는
Engine을 통해 Layer Document를 편집한다.

## 전체 구조

```text
Editor
├─ Project Owner
│  ├─ LayerDocumentProject
│  ├─ Transaction
│  ├─ History
│  ├─ Lifecycle / Persistence
│  ├─ Source Runtime 연결
│  └─ Selection Runtime
├─ Editor Composition Root
└─ Panel Engine ↔ Panel
   ├─ PSD Tree
   ├─ Canvas
   ├─ Timeline
   └─ Properties
```

Project Owner는 Project의 유일한 mutation 경계다. Composition Root는 값을
소유하거나 복사하지 않고 Owner와 Runtime을 Panel Engine에 연결한다.

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

Canvas Layer, Timeline row, Properties state와 Render item은 별도 편집 원본이
아니다. Layer Document에서 계산되는 projection이거나 저장되지 않는
Runtime이다.

## Identity

| Identity | 의미 |
|---|---|
| `projectId` | Project와 session resource를 격리한다. |
| `layerDocumentId` | 저장, 선택, command와 History의 Layer identity다. |
| `sourceId` | 공유 원본 descriptor와 Runtime resource identity다. |

Renderer 내부의 drawable 또는 command identity는 Project entity가 아니다.

## Project Owner

Project Owner는 외부에서 하나의 경계로 보이되 내부 책임은 분리한다.

- Project state와 replace
- Project transaction
- Project-only History
- lifecycle과 persistence
- Source descriptor와 Runtime lifecycle 연결
- Selection Runtime과 Project 교체 후 유효성 보정

Project Owner는 Panel별 Draft, viewport, playback clock, hover, Cache와 UI
state를 소유하지 않는다.

## Panel과 Engine

- Engine은 독립 Panel과 편집 책임이 있을 때만 둔다.
- Panel은 Project object를 직접 mutation하지 않는다.
- Panel Engine은 자신의 command/query 계약만 공개한다.
- Panel Engine끼리는 서로의 내부 구현이나 상태를 직접 수정하지 않는다.
- 여러 영역을 함께 바꾸는 작업은 Project Owner transaction으로 조합한다.
- 독립 Panel이 없는 기능은 순수 모듈이나 기존 책임 안에 둔다.

## Composition Root

Composition Root는 다음 작업만 한다.

1. Owner와 Editor Runtime을 한 번 생성한다.
2. 공개 port를 Panel Engine이 필요한 형태로 변환한다.
3. Timeline Runtime 같은 공유값을 구독해 필요한 Panel에 전달한다.
4. Panel view props와 command를 UI에 연결한다.

Project 계산, mutation, frame 보관과 별도 편집 state 생성은 하지 않는다.

## Command 흐름

```text
사용자 Intent
→ Panel Engine command
→ 주입된 Project command 또는 Runtime command
→ Project transaction 또는 Draft 변경
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
- Project mutation은 Project Owner 경계를 통한다.
- Panel과 Engine은 같은 Project와 Selection을 기준으로 동작한다.
- Composition Root는 wiring만 수행한다.
- 저장 데이터와 Runtime을 섞지 않는다.
- Project schema 변경은 migration, normalize와 validation을 동반한다.

## 관련 Architecture

- Render: `docs/architecture/11_render_architecture.md`
- Timeline: `docs/architecture/12_timeline_playback_architecture.md`
- History와 Draft: `docs/architecture/13_history_draft_architecture.md`
- Source: `docs/architecture/15_source_architecture.md`
- Persistence: `docs/architecture/17_persistence_lifecycle_architecture.md`

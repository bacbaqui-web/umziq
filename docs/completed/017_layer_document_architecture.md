# LayerDocument Architecture

> **상태:** LayerDocument 전환 완료 당시 기록
>
> 현재 canonical 설계는 `docs/architecture/10_project_architecture.md`를
> 따른다.

## 1. 문서 경계

이 문서는 전환 완료 당시 `LayerDocumentProject`의 저장 authority, identity, domain
transaction, Runtime 분리와 Render projection 계약을 정의한다.

- Editor Project Owner, Composition Root와 네 Panel Engine의 최종 경계:
  `docs/completed/019_editor_project_owner_panel_engine_architecture.md`
- `.sfep`, Save/Open/Reconnect와 Project lifecycle:
  `docs/completed/018_layer_document_persistence_project_lifecycle.md`
- 현재 파일 위치와 책임:
  `docs/20_src_map.md`

삭제된 이전 구조나 전환 단계는 현재 architecture로 취급하지 않는다.

## 2. 저장 authority

`LayerDocumentProject`가 유일한 저장 root이며
`payload.layerDocumentsById`와 `payload.sourceRegistry`를 소유한다.
편집 가능한 Layer 하나의 canonical entity는 `LayerDocument`다.

```text
LayerDocumentProject
  metadata
  payload
    layerDocumentsById[layerDocumentId]
      id, name, revision, type
      common
        source, transform, placement
        animation, effects, modifiers
      data  // type별 discriminated data
    sourceRegistry.sourcesById[sourceId]
```

Canvas layer, Timeline row, Properties panel state와 Render item은 저장
entity가 아니다. 모두 LayerDocument 또는 저장되지 않는 Runtime에서
파생된다. `renderItemId` 같은 Render 필드는 renderer projection의
compatibility 이름일 뿐 저장 identity나 편집 authority가 아니다.

## 3. identity와 선택

- `layerDocumentId`: 저장, 선택, edit command, History의 canonical identity
- `sourceId`: 외부 원본 descriptor와 Source Runtime resolution identity
- `projectId`: 프로젝트와 session-local file handle을 격리하는 identity
- layer selection, source selection, active Group: 서로 다른 의미를 가진
  Editor Selection Runtime

layer selection과 source selection은 동시에 존재할 수 있다. active Group은
Timeline/Canvas scope를 정하지만 별도 Project entity를 만들지 않는다.

## 4. 공통 영역과 Type별 영역

모든 LayerDocument는 다음 공통 편집 영역을 가진다.

- `source`: optional Source Registry 참조
- `transform`: position, scale, rotation, opacity, anchor
- `placement`: parent, order, start, duration, source offset, visibility, alias
- `animation`, `effects`, `modifiers`

`type`과 `data`는 discriminated 구조로 항상 일치해야 한다. PSD, Drawing,
Text, Audio, Video, Shape, Group, Unknown은 같은 Project root와 선택,
transaction, History를 사용한다.

Drawing/Text/Audio 지원 코드는 `src/layer-types`의 순수 public entry다.
독립 Panel과 Runtime authority가 없으므로 Engine이 아니다. 새 Type도
독립 Panel이 실제로 생길 때만 별도 Panel Engine 승격을 검토한다.

## 5. Source와 편집 데이터

Source Registry는 원본 identity, locator hint, content fingerprint,
availability 복구에 필요한 reconciliation descriptor만 저장한다.
Transform, Placement, Animation, Effect, Modifier와 Type별 편집 데이터는
Source에 저장하지 않는다.

같은 Source를 여러 LayerDocument가 참조할 수 있다. 원본 resource는
공유하지만 각 LayerDocument의 편집 데이터는 독립적이다. Duplicate는
Source 참조를 유지한 새 LayerDocument를 만들고 공통/Type별 편집 데이터를
deep copy한다.

## 6. transaction과 History

UI와 Engine은 Project object를 직접 mutation하지 않는다. 모든 저장 변경은
검증된 Project transaction을 Project Owner command로 전달한다.

- content: Transform, Animation, Effect, Modifier
- placement: move, trim, reorder, visibility, alias
- structural: create, duplicate, delete, Group 이동
- source lifecycle: import, refresh, replace, reconnect 결과 반영, delete

사용자 action 하나는 Project transaction 하나와 History 한 건으로
commit한다. 실패한 preparation이나 transaction은 Project, History,
selection을 부분 변경하지 않는다.

History snapshot에는 `LayerDocumentProject`만 들어간다. Undo/Redo는 Project
snapshot만 교체하며 selection, active Group, playback, Draft, cache,
Source Runtime을 과거 값으로 복원하지 않는다. 현재 Runtime은 새 Project에
대해 유효성만 보정한다.

## 7. 저장되지 않는 Runtime

다음 값은 Project, `.sfep`, History에 들어가지 않는다.

- File, FileSystemFileHandle, permission
- decoded PSD resource, ImageBitmap, Canvas, AudioNode, GPU resource
- Source resolution과 renderer/source/surface/composition cache
- selection과 active Group
- current frame, playback range, clock, transport
- pointer/transform Draft, 선택된 keyframe, Panel local state

Runtime은 LayerDocument를 대체하는 편집 원본이 아니다. committed Project가
바뀌면 Runtime은 invalidate, reconcile, rebuild 또는 dispose된다.

## 8. Timeline과 Draft

Timeline row는 `LayerDocument.common.placement`의 projection이다. Timeline
Runtime이 current frame, playback range, playing state, clock와 transport를
한 곳에서 소유한다. Project/Group 전환과 Undo/Redo는 현재 frame과 range를
유지하고 새 duration 밖일 때만 clamp한다.

Canvas pointer move와 Properties 연속 입력은 shared Transform Draft를
사용한다. Draft는 preview에 즉시 반영되지만 Project와 History를 바꾸지
않는다. 완료 시점에만 transaction과 History 한 건으로 commit하며 cancel,
owner effect 또는 scope 변경 시 폐기한다.

## 9. Render projection과 cache

Playback/Render는 Project, Source descriptor, Source Runtime, frame, Draft를
node-native evaluated scene으로 투영한다. Full/Fast renderer는
`layerDocumentId`, `sourceId`, source resource key와 layer result key를
구분한다.

Preview cache는 다음 책임으로 분리된다.

1. Source runtime resource
2. frame/revision/Draft 기반 Layer result
3. fast composition surface
4. quality/scale/size 기반 surface pool

Draft 중 composition cache는 immutable committed snapshot과 섞이지 않도록
우회한다. Source 교체/삭제/Reconnect는 관련 Source와 dependent Layer만
targeted invalidation하고 resource를 dispose-once 처리한다.

## 10. Render compatibility 예외

Render 구조, 파일 위치, public export와 명칭은 후속 Render Sprint까지
동결한다. 따라서 다음 두 항목은 의도적으로 남아 있다.

- `src/engines/animation/index.ts`의 Render용 `@/engines/animation`
  compatibility entry
- `src/engines/playback-render` 내부의
  `LayerDocumentRuntimeCutoverPreparationPort`

이 예외는 Render 내부 계약에만 적용된다. Editor, Project Owner, Panel
Engine과 Feature UI에는 별도 compatibility/cutover 계층이 없으며 최종
public boundary를 직접 사용한다.

## 11. offline migration

이전 ProjectSource 문서를 LayerDocumentProject로 바꾸는 기능은
`src/models/offlineMigration/index.ts`의 명시적 offline-only boundary다.
bootstrap, active Editor와 Engine public barrel은 이전 모델을 import하거나
export하지 않는다.

현재 schema migration은 persistence codec가 Plain Data에만 수행한다.
migration은 File 접근, Runtime 생성 또는 UI state 변경을 하지 않는다.

## 12. 검증 계약

자동 검증은 최소한 다음을 보존한다.

- normalize/validation과 schema/offline migration
- transaction 원자성, Duplicate, Group, History, selection
- Draft commit/cancel과 Timeline frame authority
- PSD import/refresh/delete/reconnect와 Source Runtime dispose-once
- full/fast Render, dirty region, previous-scene reuse와 cache
- Core/Panel Engine import 경계, public entry와 최종 Editor wiring

실행 기준은 `npm test`, `npm run lint`, `npm run build`,
`git diff --check`다. Browser picker와 실제 UI 조작은 이 정적/public fixture
검증의 범위가 아니다.

## 13. 알려진 제한

- linked Audio/Video Runtime preparation은 구현되지 않았다.
- Video/Shape는 schema와 extension point 중심이다.
- legacy fingerprint가 없거나 mismatch인 Source의 Refresh/Replace 선택 UI는
  후속 구현 대상이다.
- Render compatibility 예외의 제거와 명칭 정리는 후속 Render Sprint
  범위다.

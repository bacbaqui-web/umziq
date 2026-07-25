# Layer Type Foundation + Future Engine Foundation

> **상태: Superseded**
>
> 이 문서는 LayerDocument 전환 전에 도입한 Foundation의 당시 결과를 보존한다. 현재 canonical 구조는 `56_layer_document_architecture.md`다. 아래의 과거 검증 결과는 당시 결과이며 현재 검증 개수나 active architecture를 뜻하지 않는다.

## 현재 해석

- Project 저장 루트는 `LayerDocumentProject`이며 `payload.layerDocumentsById`와 `payload.sourceRegistry`를 소유한다.
- 이전 Timeline Item의 배치 의미는 `LayerDocument.common.placement`로 통합됐다. Timeline UI는 저장 entity를 소유하지 않는다.
- 편집/선택 identity는 `itemId`가 아니라 `layerDocumentId`다.
- Source는 외부 원본 identity와 lifecycle만 소유하고, Transform/Placement/Animation/Effect/Modifier와 Type별 편집 데이터는 LayerDocument가 소유한다.
- Duplicate는 같은 Source를 참조하는 새 LayerDocument를 만든다. 새 `layerDocumentId`를 가지며 공통 영역과 Type별 데이터는 deep copy되어 원본과 독립적으로 편집된다.
- Drawing/Text/Audio Domain 경계의 의도는 유지되지만 현재 저장/command 연결은 모두 LayerDocument 계약을 사용한다.

아래 본문에서 ProjectSource, Timeline Item, item identity를 설명하는 부분은 현재 계약이 아니라 이전 Foundation의 역사적 설명이다.

## Sprint 결과

Project가 Layer Source를 소유하고 Timeline이 같은 Source를 여러 번 배치하는 canonical 구조를 도입했다.

```text
ProjectSource
→ TimelineItemReference
→ itemId Evaluation
→ Canvas / Properties
→ Drawing / Text / Audio Domain Engine
```

기존 PSD/Group은 compatibility adapter를 통해 기존 Renderer와 편집 의미를 유지한다.

## Project Source

`ProjectSourceDocument`는 다음 Plain Data를 소유한다.

- `sourcesById`
- `rootSourceIds`
- `timelineItemsByGroupId`
- `compositionMetaByGroupId`
- schema version

지원 Type:

- PSD
- Drawing
- Text
- Audio
- Group

Video, Shape와 알 수 없는 Type은 기존 identity 구조를 바꾸지 않고 확장하거나 안전하게 읽을 수 있는 경계를 갖는다.

Runtime canvas, bitmap, audio buffer, cache와 evaluated result는 Project Source에 저장하지 않는다.

## Source와 Timeline Item

Source와 배치의 identity를 분리했다.

- `sourceId`: 공유 원본
- `itemId`: Timeline의 개별 배치

Timeline Item은 alias, visibility, start, duration, source offset과 order를 소유한다.

같은 Source를 참조하는 여러 Item은 서로 다른 timing과 local frame으로 평가되며 Source Runtime은 공유한다.

## Project Transaction

새 Layer 생성은 다음을 한 transaction으로 처리한다.

```text
Source 생성
→ 최초 Timeline Item 배치
→ Selection 변경
→ History 1회
```

Timeline Item 삭제와 Project Source 삭제는 서로 다른 Command다.

Source 삭제는 참조가 있을 때 거부하거나 모든 참조를 제거하는 정책을 명시해야 한다.

미배치 Source는 유지한다.

## Timeline

Canonical Timeline은 다음을 `itemId` 기준으로 처리한다.

- active/local frame
- selection
- order/reorder
- delete
- alias
- visibility
- move/trim/split

Local frame:

```text
globalFrame - startFrame + sourceOffsetFrames
```

Move/resize PointerMove는 Draft만 변경하고 PointerUp에서 transaction을 한 번 commit한다.

## Canvas와 Renderer

Evaluated Scene, full-render command와 fast-render Preview Node가 `itemId`, `sourceId`, `sourceType`을 보존한다.

- PSD: 기존 Renderer
- Group: 기존 Composition Renderer
- Drawing: 회색 placeholder
- Text: `TEXT`
- Audio: `AUDIO`

Node/cache identity는 Item별로 구분하며 Source pixel/runtime은 공유한다.

Canvas 직접 선택과 Draft Transform도 선택 Item과 Source identity를 함께 보존한다.

## Properties

Properties는 선택 `itemId`로 placement를 찾고 `sourceId`로 Source를 읽는다.

- Source name과 Item alias를 분리 표시
- Type과 availability 표시
- PSD/Group은 기존 편집 UI 유지
- Drawing/Text는 최소 content와 공통 Transform을 읽기 전용 표시
- Audio는 source/duration placeholder와 visual Transform 미지원 표시
- 미구현 기능은 disabled/unsupported로 표시

Type 분기는 중앙 Source descriptor adapter가 담당한다.

## Domain Engine

다음 Domain Engine 골격을 추가했다.

- Drawing Engine
- Text Engine
- Audio Engine

각 Engine은 다음 경계를 가진다.

- Layer Commands
- Domain Commands
- Tool Commands
- Query
- capability/read model
- Core Project port
- Runtime/Draft 방향

Layer 생성과 삭제는 Project semantic Command에 위임한다.

Brush, Text editor/layout, Audio decoding/playback/waveform은 구현하지 않았으며 관련 Command는 typed `unsupported` 결과를 반환한다.

세 Domain Engine은 Composition Root에서만 Core Engine과 연결한다.

## AE 방식 Duplicate

Duplicate는 Project Source를 복제하지 않는다.

```text
원본 Item → sourceId A
복제 Item → sourceId A
```

복제 결과:

- 새 `itemId`
- 같은 `sourceId`
- 같은 timing, source offset, visibility
- 원본 바로 위 배치
- Item alias에 `_2`, `_3`, `_4` suffix
- History 1회
- 복제 Item 선택

Group subtree, Animation, Modifier, Effect와 Runtime resource는 복제하지 않는다.

## 검증 결과

- ESLint 통과
- Verification 54개 통과
- TypeScript/Vite production build 통과
- Engine Import Boundary 통과
- `git diff --check` 통과

Build에는 기존 번들 크기 경고가 남아 있지만 오류는 없다.

Browser QA와 실제 조작 QA는 사용자가 명시적으로 요청하지 않아 수행하지 않았다.

## 알려진 한계와 후속 기능

- Drawing Brush/Stroke/Tool 미구현
- Text editor/layout/font shaping 미구현
- Audio decoding/playback/waveform 미구현
- Drawing/Text canonical Transform mutation은 아직 읽기 전용
- Video/Shape는 확장 지점만 존재
- 다중 Group Source 삭제의 legacy History 호환 복원은 실제 기능 추가 전에 별도 회귀 확인 필요
- context menu와 placeholder의 실제 시각·pointer 동작은 Browser QA 필요

이번 Sprint 이후 Layer Type 기능은 이 Source/Item/Domain Engine 골격 안에 추가하며 Project/Timeline identity를 다시 설계하지 않는 것을 목표로 한다.

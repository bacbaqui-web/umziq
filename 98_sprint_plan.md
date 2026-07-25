# Current Sprint Plan

> 문서 번호: 98
> 상태: 계획 확정 / 구현 미시작
> Sprint 성격: Architecture Migration
> 제품 코드 변경: 미시작
> QA: 미실행 / 사용자 명시 요청 전에는 수행하지 않음

## Sprint

- 이름: Layer Document Architecture Migration
- 목표: 현재 `ProjectSource` 중심의 이중 구조를 `Layer Document` 중심의 단일 편집 원본으로 안전하게 전환한다.

---

## 1. Sprint 선언

이번 Sprint는 새 기능 개발 Sprint가 아니다.

현재 제품 동작을 가능한 한 유지하면서 프로젝트의 편집 원본과 identity를 `Layer Document` 하나로 통일하는 Architecture Migration Sprint다.

큰 구조를 한 번에 교체하지 않는다.

각 Task는 다음 순서를 따른다.

```text
작은 변경
→ 전용 정적 검증
→ 감독관 Gate 검토
→ 다음 Task 승인
```

Gate를 통과하지 못하면 다음 Task를 시작하지 않는다.

---

## 2. 최상위 철학

```text
Project
 ├─ Layer Document
 ├─ Layer Document
 ├─ Layer Document
 └─ ...
```

- 프로젝트의 유일한 편집 대상은 `Layer Document`다.
- `Layer Document` 하나는 프로젝트 안의 작업 레이어 하나를 의미한다.
- Project는 `Layer Document`들의 집합이다.
- 모든 저장 데이터는 `Layer Document`가 소유한다.
- Canvas, Timeline UI, 모든 Panel과 모든 Engine은 선택된 같은 `Layer Document`를 읽고 수정한다.
- 모든 UI와 Engine은 같은 `Layer Document`를 읽고 수정한다.
- Project는 `Layer Document`를 제외한 편집 데이터를 소유하지 않는다.
- Layer Document 외부에 Timeline State, Canvas Layer, Panel Data, Render Item 등 또 다른 편집 원본을 만들지 않는다.
- Project에 저장되는 편집 데이터의 유일한 소유자는 항상 `Layer Document`다.
- Panel끼리는 직접 통신하지 않는다.
- Engine끼리는 다른 Engine의 상태를 직접 수정하지 않는다.
- 모든 화면은 같은 `Layer Document`를 다시 읽어 파생 결과를 계산한다.

### Layer Document

```text
Layer Document
 ├─ 공통 영역
 │   ├─ Source
 │   ├─ Transform
 │   ├─ Placement
 │   ├─ Animation
 │   ├─ Effect
 │   └─ Modifier
 └─ Layer Type별 확장 영역
     ├─ PSD
     ├─ Drawing
     ├─ Text
     ├─ Audio
     ├─ Video
     ├─ Shape
     └─ Group
```

새 Layer Type은 Project 구조를 새로 만들지 않는다.

`Layer Document`의 Type별 데이터 영역과 담당 Engine/Panel/Renderer 연결만 추가한다.

### Source

- PSD Tree는 원본 Source를 관리한다.
- `Layer Document`는 Source를 참조하는 작업 객체다.
- Source는 원본 identity와 Refresh/Reconnect만 담당한다.
- Transform, Placement, Animation, Effect, Modifier와 Type별 편집 데이터는 `Layer Document`가 가진다.

### Placement와 Timeline UI

- `Placement`는 Layer Document가 저장하는 배치 데이터 영역의 이름이다.
- Placement는 시작 시간, 길이, 순서, 표시 여부, Source Offset, Alias, 부모 Group을 가진다.
- `Timeline`은 UI와 담당 Engine의 이름이다.
- Timeline UI는 `Layer Document.common.placement`를 표시하고 수정한다.
- 문서에서 Timeline은 UI/Engine을, Placement는 저장 데이터를 의미한다.

### Project Data와 Engine Runtime 경계

- Engine은 Project Data를 소유하지 않는다.
- Project에 저장되는 데이터는 반드시 `Layer Document`에 저장한다.
- Engine은 Runtime Cache, Draft, Tool State, Preview 계산 결과처럼 저장되지 않는 Runtime 데이터만 소유할 수 있다.
- Timeline State, Canvas Layer, Panel Data, Render Item은 편집 원본이 아니다.
- 이러한 값은 `Layer Document`에서 계산되는 파생 Read Model 또는 저장되지 않는 Runtime으로만 존재한다.
- Engine Runtime은 Project 저장, History snapshot, Duplicate 대상에 포함하지 않는다.
- Runtime이 Layer Document와 다른 값을 오래 유지해 두 번째 편집 원본처럼 동작하는 것을 금지한다.

### Duplicate

- Duplicate는 같은 Source를 참조하는 새 `Layer Document`를 만든다.
- Source Resource는 공유한다.
- 모든 편집 데이터는 독립적으로 복제한다.
- 생성, Placement 설정, 선택, History를 하나의 Transaction으로 처리한다.

---

## 3. 현재 구조와 전환 대상

현재 프로젝트에는 다음 구조가 함께 존재한다.

```text
Legacy Composition / Layer
        ↓ normalize
ProjectSourceDocument
        ↓ transaction
Legacy Timeline / Render compatibility projection
```

현재 `ProjectSource`는 다음 책임을 동시에 가진다.

- Source identity와 Refresh 상태
- Transform
- Animation
- Effect
- Modifier
- Drawing/Text/Audio Content

현재 Timeline Duplicate는 새 Item만 만들고 같은 `sourceId`를 사용한다. Transform도 Source가 소유하므로 원본과 복제본이 같이 움직인다.

이번 Sprint의 최종 구조:

```text
Source Registry
→ 원본 Resource와 Refresh 책임

Project Layer Documents
→ 저장되는 편집 데이터의 단일 원본

Editor Session / Draft / Playback
→ 저장되지 않는 편집 세션

Evaluated Scene / Render Result / Cache
→ Layer Document에서 계산되는 파생 Runtime
```

---

## 4. 마이그레이션 절대 원칙

- 새 구조를 Legacy와 `ProjectSourceDocument` 옆에 세 번째 쓰기 원본으로 추가하지 않는다.
- 전환 중에도 동일 데이터의 쓰기 원본은 한 시점에 하나만 허용한다.
- 새 schema 도입 후 모든 제품 쓰기는 가능한 한 빨리 `Layer Document` Transaction으로 통일한다.
- Legacy 구조가 필요한 동안에는 새 구조에서 Legacy로 향하는 read projection만 허용한다.
- Legacy에서 새 구조로 되돌아오는 양방향 reconciliation은 최종 구조로 인정하지 않는다.
- Runtime 객체는 Project Plain Data와 History에 저장하지 않는다.
- Project는 Layer Document 밖에 별도의 편집 상태를 저장하지 않는다.
- Engine Runtime은 Cache, Draft, Tool State, Preview 계산 결과에 한정한다.
- 사용자 Action 한 번은 History 한 번을 만든다.
- PointerMove는 Draft, PointerUp은 Commit 원칙을 유지한다.
- Source bitmap/decoder cache 공유는 유지하고 Layer 편집 결과만 독립시킨다.
- Architecture Adapter는 임시 전환 도구이며 Sprint 완료 시 제거하거나 제거 시점을 명확히 증명해야 한다.

---

## 5. Sprint 비목표

- Drawing 실제 편집 기능
- Text 실제 편집 기능
- Audio 실제 재생/편집 기능
- Video/Shape 실제 기능
- 새로운 Effect/Modifier 기능
- 새 UI 기능
- Renderer 출력 의도 변경
- Preview Pipeline 재설계
- 성능 최적화 자체
- 범용 Event Bus
- 거대한 전역 Store
- Engine 간 직접 mutation
- Panel 간 직접 refresh
- Legacy 구조를 영구 호환 계층으로 유지

---

## 6. 공통 Gate 규칙

각 Task는 Task 전용 검증 외에 작업 성격에 맞는 다음 정적 검증을 수행한다.

- 변경 파일 ESLint
- TypeScript/build 검증
- Task 전용 verification
- `git diff --check`
- Project Plain Data validation
- Engine import boundary 검증

정적 검증 통과를 Browser QA 통과로 기록하지 않는다.

Browser QA, 실제 PSD 조작 QA, 전체 자동 QA는 사용자가 명시적으로 요청했을 때만 수행한다.

감독관은 각 Gate에서 다음을 검토한다.

- `00_rule.md`의 Layer Document 철학과 일치하는가
- 편집 원본이 중복되지 않았는가
- Layer Document 외부의 Timeline State, Canvas Layer, Panel Data, Render Item이 편집 원본처럼 사용되지 않는가
- 책임이 Source, Layer, Runtime 사이에서 섞이지 않았는가
- 임시 Adapter가 제품 계약으로 굳어지지 않았는가
- 다음 Task가 현재 Gate 이전에는 시작될 수 없는가

---

## 7. Task 순서

## Task 1 — Layer Document 계약과 현재 Identity 지도 확정

> 진행 상태: 완료 / Gate 1 승인

### 목적

제품 변경 전에 새 저장 계약과 현재 identity 변환표를 확정한다.

### 작업

- `LayerDocument` 공통 영역 정의
- Layer Type별 discriminated union 정의
- Source 참조 계약 정의
- Group 관계와 Placement 계약 정의
- Project 최소 메타데이터 범위 정의
- 현재 `sourceId`, Timeline Item ID, Layer ID, Composition ID 매핑표 작성
- Animation target, Selection, Draft target, Render node identity 조사
- Split, Instance, Visibility, Alias, Group parent/order 정책 확정
- Runtime 제외 목록 확정
- Project Data와 Engine Runtime의 허용 목록/금지 목록 확정
- Timeline State, Canvas Layer, Panel Data, Render Item의 파생 방향 확정
- 기존 Fixture와 예상 migration 결과 명세

### 설계 결정

- 기본적으로 하나의 `Layer Document`가 하나의 Placement를 가진다.
- Placement는 `Layer Document` 공통 영역에 둔다.
- Group parent/order의 단일 원본은 `Layer Document.common.placement`를 우선 검토한다.
- Group 자식 목록은 가능한 한 Query에서 파생한다.
- Type별 데이터는 optional field 묶음이 아니라 discriminated union을 우선한다.
- 외부 원본이 없는 Layer는 Source 참조가 없을 수 있다.

### 정적 검증

- 계약 문서와 Type 초안의 필드 소유권 대조
- 모든 저장 필드의 단일 소유자 표 작성
- Layer Document 외부 편집 원본 부재 확인표 작성
- identity 충돌 목록 작성
- Group cycle과 invalid Type data 검증 시나리오 작성

### Gate 1 완료 조건

- 저장되는 모든 편집 데이터가 `Layer Document`의 정확히 한 영역에 속한다.
- Source와 Runtime이 Layer 편집 데이터와 분리된다.
- Project에 저장되는 편집 데이터가 모두 Layer Document 안에 존재한다.
- Engine Runtime은 Cache, Draft, Tool State, Preview 계산 결과로만 제한된다.
- `type`과 Type별 데이터 불일치를 차단할 방법이 확정된다.
- Group, Split, Duplicate, Visibility, Alias 정책이 다음 Task를 막지 않을 수준으로 확정된다.
- 감독관이 schema 구현을 승인한다.

### Gate 1 승인 결과

현재 코드의 Legacy `Composition/Layer`, `ProjectSourceDocument`, Timeline Item, Selection, Animation, Draft, Evaluated Scene, Render Item identity 흐름을 조사했다.

다음 계약을 승인한다.

- Project metadata는 `schemaVersion`, `projectId`, `name`만 허용한다.
- Project payload는 `layerDocumentsById`와 원본 Resource 인덱스인 Source Registry만 가진다.
- Source Registry는 편집 원본이 아니며 원본 identity, locator, fingerprint/version, availability, Refresh/Reconnect 정보만 가진다.
- File, FileHandle, parsed PSD, Canvas, Bitmap, Decoder 등은 저장되지 않는 Runtime Source Registry에 둔다.
- Layer Document는 `layerDocumentId`, `revision`, `type`, `common`, Type별 `data`로 구성한다.
- Layer Document는 Source와 독립적인 사용자 표시 `name`을 직접 소유한다.
- 공통 영역은 Source 참조, Transform, Placement, Animation, Effect, Modifier다.
- Placement의 단일 필드는 `parentLayerDocumentId`, `order`, `startFrame`, `durationFrames`, `sourceOffsetFrames`, `visible`, `alias`다.
- 부모와 순서는 Placement만 원본으로 저장하고 Group 자식 목록은 Query에서 파생한다.
- root는 `Group.data.role === "project-root"`인 정확히 한 Group Layer Document로 식별한다.
- 기본 불변식은 `Layer Document 하나 = Placement 하나`다.
- Duplicate는 같은 Source를 참조하는 새 Layer Document를 만들고 모든 편집 Plain Data를 독립 복제한다.
- Group Duplicate는 descendant Layer Document subtree 전체를 새 ID로 복제한다.
- Split은 오른쪽 구간용 새 Layer Document를 생성한다.
- Group Split은 오른쪽 Group descendant subtree 전체를 새 ID로 복제한다.
- linked Instance와 한 Layer Document의 다중 Placement는 이번 Sprint 비목표다.
- 사용자 visibility의 단일 원본은 Placement이며 Renderer visibility는 파생값이다.
- Engine Runtime 소유 범위는 Runtime Cache, Draft, Tool State, Preview 계산 결과로 제한한다.
- Runtime은 Project 저장, History, Duplicate, Migration 대상이 아니며 언제든 Layer Document에서 재생성 가능해야 한다.
- Editor 선택의 목표 identity는 `selectedLayerDocumentId`이며 Source ID와 Runtime ID를 선택/Animation target으로 사용하지 않는다.

현재 확인된 주요 전환 대상:

- Legacy와 canonical 문서의 양방향 reconciliation
- Source ID 중심 Selection/Animation/Draft/Render lookup
- Runtime Render Item을 포함하는 History snapshot
- Layer Document 외부의 Master Transform/Animation state
- `Composition.parentId`, children, Timeline group map, 배열 순서로 중복된 Group/Placement 관계

Gate 1 검토 결과, Task 2 Schema/Validation 구현을 승인한다.

---

## Task 2 — Layer Document Plain Data Schema와 Validation

> 진행 상태: 완료 / 보완 후 Gate 2 재승인

### 목적

새 Project 저장 원본이 될 `Layer Document` schema와 무결성 검증을 구현한다.

### 작업

- Layer Document 공통 Base
- PSD/Drawing/Text/Audio/Video/Shape/Group Type union
- Source 참조
- Transform/Placement/Animation/Effect/Modifier 공통 구조
- schema version
- ID uniqueness
- Source 참조 validation
- Group parent/cycle validation
- Type별 data validation
- Plain Data validation
- unknown/future Type 안전 처리
- Runtime 데이터 유입 차단
- Project Data를 Layer Document 외부에 저장하는 schema 차단

### 제한

- 이 Task에서는 기존 제품의 쓰기 경로를 전환하지 않는다.
- 새 schema를 기존 상태와 자동 양방향 동기화하지 않는다.
- 새로운 UI를 만들지 않는다.

### 정적 검증

- 유효한 모든 Layer Type Fixture 통과
- 잘못된 Type/data 조합 거부
- 중복 Layer ID 거부
- dangling Source 참조 검출
- Group cycle 검출
- Runtime 객체와 비직렬화 값 거부
- Timeline State/Canvas Layer/Panel Data/Render Item의 편집 원본 저장 거부
- normalize의 참조 안정성 검증
- 변경 파일 ESLint/build/`git diff --check`

### Gate 2 완료 조건

- schema가 `00_rule.md`의 공통 영역 + Type별 확장 영역과 일치한다.
- Invalid Project를 저장 전에 검출한다.
- 기존 제품 상태를 아직 변경하지 않는다.
- 새 schema가 세 번째 쓰기 원본으로 사용되지 않는다.
- 감독관이 migration 구현을 승인한다.

### Gate 2 승인 결과

다음 독립 Plain Data 경계를 구현했다.

- Layer Document 공통 영역과 PSD/Drawing/Text/Audio/Video/Shape/Group/Unknown concrete discriminated union
- Project metadata의 `schemaVersion`, `projectId`, `name` 닫힌 필드
- `layerDocumentsById`와 Source Registry만 허용하는 payload
- PSD document/node, Audio, Video, Unknown Source Registry union
- 새 schema 내부 normalize와 미래 Type의 `unknown` 보존
- Plain Data, exact field, schema version, ID, Type/data, Source kind, root Group, parent/cycle, sibling order, Transform/timing/Animation 무결성 validator

제품 Editor/Engine/UI/Timeline/Canvas/History 쓰기 경로에는 연결하지 않았고 Legacy migration도 시작하지 않았다.

감독관 재검증:

- Task 2 전용 Layer Document schema verification 통과
- 변경 파일 ESLint 통과
- 변경 범위 `git diff --check` 통과
- 작업자 `npm run build` 통과 보고 확인
- Browser QA와 실제 조작 QA 미실행

남은 위험:

- Unknown Type의 read-only capability 강제는 이후 Engine 전환 범위다.
- Source locator의 실제 저장 portability는 저장 기능 연결 시 다시 검토한다.
- `layerDocumentValidation.ts`와 전용 verification은 500줄을 넘지만 이번 Gate에서는 책임 분리 리팩토링을 수행하지 않는다.

Gate 2 검토 결과, Task 3 순수 migration 구현을 승인한다.

### Task 3.5 발견에 따른 Gate 2 재개방

Migration 전후 의미 비교에서 Layer Document에 독립 사용자 표시 이름이 없어 `alias ?? source.name` 계약을 보존할 수 없음이 확인됐다.

다음 schema 보완 후 Gate 2를 다시 검토한다.

- Layer Document top-level `name` 추가
- `name`은 non-empty Plain Data이며 Source display name과 독립
- PSD node의 원본 native visibility를 알 수 없는 경우를 표현하도록 `nativeVisible: boolean | null` 허용
- Source locator가 없는 경우 file name을 path로 위장하지 않고 `null` 허용 유지

### Gate 2 재승인 결과

- 모든 Layer Document에 독립 사용자 표시 `name` 추가
- 표시 계약을 `placement.alias ?? layerDocument.name`으로 확정
- PSD native visibility의 unknown 상태를 `boolean | null`로 표현
- Layer name exact-key/non-empty validation과 normalize 반영
- 강화된 schema verification과 감독관 재검증 통과

Gate 2 보완을 완료하고 재승인한다.

---

## Task 3 — 기존 ProjectSource 데이터의 순수 Migration

> 진행 상태: 완료 / 보완 후 Gate 3 재승인

### 목적

현재 프로젝트를 화면 결과 손실 없이 Layer Document 집합으로 변환하는 순수 migration을 만든다.

### 작업

- Legacy Composition/Layer와 `ProjectSourceDocument` 입력 계약 확정
- 기존 ProjectSource의 Source 정보 분리
- 기존 편집 데이터를 Layer Document 공통/Type별 영역으로 이동
- 기존 Timeline Item마다 독립 Layer Document 생성
- 동일 PSD/Audio Source 참조 공유
- Transform/Animation/Effect/Modifier deep Plain Data clone
- Placement의 timing/order/visible/alias 이동
- Group parent 관계 이동
- 결정적인 ID 발급과 충돌 처리
- unplaced source/layer 정책
- missing/unknown source 처리
- schema version migration
- migration 실패 시 원본 보존

### Migration 핵심

```text
현재
Timeline Item 1 ─┐
                 ├─ ProjectSource Transform 공유
Timeline Item 2 ─┘

Migration 후
Layer Document 1 ─┐
                  ├─ 같은 Source 참조
Layer Document 2 ─┘

Transform/Animation/Effect/Modifier는 각각 독립
```

### 정적 검증

- 단일 Layer 프로젝트 변환
- 같은 Source를 공유하는 복수 Item 변환
- Group 중첩 변환
- Animation/Effect/Modifier 보존
- missing Source 보존
- unknown Type 안전 변환
- ID 충돌 처리
- 입력 객체 불변성
- 반복 migration의 결정성
- migration 전후 화면 의미 비교 Fixture
- 변경 파일 ESLint/build/`git diff --check`

### Gate 3 완료 조건

- 모든 기존 Timeline Item이 독립 Layer Document로 변환된다.
- Source 참조만 공유되고 편집 데이터는 독립 복제된다.
- 기존 화면 순서, timing, visibility, Transform, Animation 의미가 보존된다.
- 실패 시 기존 프로젝트를 훼손하지 않는다.
- 감독관이 단일 쓰기 원본 전환을 승인한다.

### Gate 3 승인 결과

제품 State에 연결되지 않은 순수 `ProjectSourceDocument → LayerDocumentProject` migration을 구현했다.

확인된 변환:

- ProjectSource root Group을 유일한 `project-root` Group Layer Document로 변환
- Timeline Item별 독립 Layer Document와 Placement 생성
- 동일 Source 참조 공유와 Transform/Animation/Effect/Modifier/Type data deep Plain Data clone
- 반복 Group 배치의 descendant subtree를 ancestor placement path별로 독립 확장
- PSD document/node Source Registry 분리
- Drawing/Text/Audio/Video/Shape/Group/Unknown 변환
- missing/unknown 원본 상태 보존
- unplaced external Source의 Registry 유지
- source-less editable Source와 자식이 있는 unplaced Group의 명시적 실패
- 결정적 ID, 충돌 재시도, 입력 불변성

감독관 재검증:

- Task 3 전용 migration verification 통과
- 변경 파일 ESLint 통과
- 변경 범위 `git diff --check` 통과
- 작업자 `npm run build` 통과 보고 확인
- 제품 State/Engine/UI 연결 없음
- Browser QA와 전체 QA 미실행

의도적 초기값과 Task 3.5 검토 대상:

- ProjectSource에 없는 PSD native visibility는 Source 원본 사실의 중립값 `true`로 초기화
- 기존 Modifier에는 enabled 필드가 없어 현재 활성 의미를 보존하도록 `true`로 초기화
- 새 Layer revision은 `0`으로 초기화
- Audio 영속 경로가 없으면 file name을 locator 대체값으로 보존
- unplaced external Source의 편집 속성은 Placement가 없으므로 Layer로 생성하지 않음

Gate 3 검토 결과, migration 구현은 승인한다. 단일 쓰기 원본 전환 전 Task 3.5 독립 비교 Gate를 반드시 수행한다.

### Task 3.5 발견에 따른 Gate 3 재개방

다음 사용자 데이터 손실이 확인되어 migration 승인을 일시 철회한다.

- alias가 null인 Source-less Layer의 사용자 표시 이름 손실
- 비기본 Transform/Animation/Effect/Modifier를 가진 unplaced external Source의 편집 데이터 손실
- Source Registry가 없는 Layer의 non-default availability/sync 상태 손실 가능성
- Audio file name을 실제 locator path처럼 저장하는 의미 왜곡
- 알 수 없는 PSD native visibility를 `true`로 확정하는 원본 사실 왜곡

보완 원칙:

- 모든 생성 Layer Document의 `name`에 기존 `ProjectSource.name` 보존
- 표시 계약은 `placement.alias ?? layerDocument.name`
- unplaced external Source가 비기본 편집 데이터를 가지면 조용히 버리지 않고 구조화된 migration issue로 실패
- Source-less Layer의 `sourceVersion`은 Layer revision으로 보존하고 non-default availability/sync 상태는 명시적으로 처리
- Audio locator가 없으면 `path`와 reconnect path를 `null`로 유지
- PSD native visibility 정보가 없으면 `null`로 유지
- Fixture는 값 전체 deepEqual과 alias-null, unplaced edited source, duplicate basename, null duration, unknown raw를 검증

### Gate 3 재승인 결과

- 모든 생성 Layer의 `name`에 기존 ProjectSource name 보존
- Source-less Layer의 sourceVersion을 revision으로 보존
- 표현할 수 없는 Source-less availability/sync 상태는 구조화된 migration issue
- unplaced external Source의 비기본 Transform/Animation/Effect/Modifier는 구조화된 migration issue
- Audio locator가 없으면 path/reconnect path를 null로 유지
- PSD native visibility 입력 부재는 null로 유지
- Drawing/Text/Shape/Unknown raw와 Animation/Effect/Modifier 전체 값 deepEqual Fixture 추가
- 동일 basename Audio, empty Audio/null duration, alias null, future unknown fallback Fixture 추가
- 실제 `buildMasterComposition`/`buildMasterMeta`/`normalizeLegacyProjectSources` 경로 Fixture 추가
- source-less synthetic Master의 `legacyCompositionType: master`와 `sourceFileName: Project`를 project-root 의미로 보존
- project-root 외 identity-less Group의 표현 불가능 metadata는 계속 실패

강화된 migration verification과 감독관 재검증을 통과하여 Gate 3을 재승인한다.

---

## Task 3.5 — Migration 독립 검증 Gate

> 진행 상태: 완료 / 2차 Gate 3.5 승인

### 목적

다른 Engine을 변경하기 전에 migration 자체의 정확성을 독립적으로 판단한다.

### 작업

Task 3 Fixture를 기준으로 전환 전후 비교표를 작성한다.

비교 항목:

- Layer 수
- Source 참조 수
- Group/parent 관계
- Placement start/duration/order/visibility/alias
- Transform
- Animation Track/Keyframe
- Effect/Modifier
- Type별 데이터
- missing/unknown 상태
- 직렬화 결과

### 승인 판단

1. 의미 보존과 독립성이 모두 확인됨
   - Task 4 진행 승인

2. 화면 의미는 보존되지만 identity 또는 독립성이 불확실함
   - Task 3 수정

3. 기존 데이터 손실 가능성이 있음
   - Sprint 중단 및 migration 설계 재검토

### Gate 3.5 완료 조건

- 전환 전후 비교표가 존재한다.
- migration 이외의 변경이 비교 결과에 섞이지 않았다.
- 감독관이 Project Transaction 전환을 승인한다.

### 1차 Gate 3.5 결과

통과:

- Placement timing/order/visibility/alias/sourceOffset
- 반복 Group subtree 독립성
- Transform/Animation/Effect의 구조적 복제
- Source Registry 참조 공유
- missing/unknown 보존
- Plain Data, 입력 불변성, 결정성, ID 충돌 복구

차단:

- Layer Document name 부재로 표시 이름 복구 불가
- unplaced external Source의 비기본 편집 데이터 손실

추가 보완:

- Source-less 상태 보존
- native visibility의 unknown 표현
- Audio locator 의미
- 값 전체 deepEqual Fixture 강화

Task 4 진행을 승인하지 않는다. Task 2와 Task 3을 보완한 뒤 동일 비교를 다시 수행한다.

### 2차 Gate 3.5 결과

보완 후 동일 Fixture와 실제 virtual Master normalize Fixture를 다시 비교했다.

| 항목 | Before | After | 판정 |
|---|---|---|---|
| 사용자 표시 이름 | `alias ?? source.name` | `placement.alias ?? layerDocument.name` | 보존 |
| Timeline Item | ProjectSource 참조 배치 | 독립 Layer Document + Placement | 보존/독립화 |
| 반복 Group | 동일 Group 정의 재사용 | 배치별 descendant subtree 독립 ID | 보존/독립화 |
| Transform/Animation/Effect/Modifier | ProjectSource 편집 데이터 | Layer별 deep Plain Data clone | 보존 |
| Type별 data | Drawing/Text/Shape/Unknown 등 | 대응 Type union 전체 값 | 보존 |
| Source | PSD/Audio/Video 원본 | Source Registry 공유 참조 | 보존 |
| missing/unknown | Source 상태/raw | Registry 상태/unknown raw | 보존 |
| actual Master | source-less legacy master | source-less project-root Group Layer | 보존 |
| unplaced default external Source | ProjectSource만 존재 | Source Registry만 유지 | 보존 |
| unplaced edited external Source | 표현 가능한 Layer 없음 | 구조화된 issue로 중단 | 무손실 실패 |
| 입력/결정성 | Plain canonical input | 입력 불변/동일 결과 | 보존 |

Task 3.5 완료 조건을 충족하여 Gate를 승인한다.

단, Task 4에서 제품 State의 단일 쓰기 원본을 즉시 활성화하지 않는다. 기존 소비자 전환 전에 활성화하면 Legacy 편집 경로와 충돌하므로 Transaction 기반만 먼저 준비한다.

---

## Task 4 — Project Transaction 기반과 원자적 전환 준비

> 진행 상태: 완료 / 보완 후 Gate 4 승인

### 목적

Layer Document mutation의 순수 Transaction 기반을 완성한다.

Timeline, Canvas, Properties, Domain Engine이 아직 Legacy를 소비하므로 이 Task에서는 제품 State의 authority를 전환하지 않는다.

실제 단일 쓰기 원본 활성화는 Task 5~8의 소비 경계를 준비한 뒤 Task 9에서 원자적으로 수행한다.

### 작업

- Layer 생성 Transaction
- Layer 삭제 Transaction
- Duplicate Transaction
- Source 연결/교체 Transaction
- Group 이동 Transaction
- 공통 Layer update 경계
- Type별 Domain update 경계
- Transaction validation
- selection change 결과
- History entry 결과
- 이후 원자적 cutover가 사용할 read/query/commit port
- Legacy read projection에 필요한 데이터 계약

### Duplicate 계약

```text
새 Layer Document ID
+ 같은 Source 참조
+ 독립 공통 데이터
+ 독립 Type별 데이터
+ 원본 위 Placement order
+ 새 Layer 선택
+ History 1회
```

### 정적 검증

- create/delete/duplicate/source replace transaction
- Transaction 전후 schema validation
- Duplicate Source 참조 공유
- Duplicate 편집 데이터 reference 독립
- Transaction 실패 시 입력 불변
- 사용자 Action당 History entry 1개
- Transaction이 제품 State나 Legacy setter를 호출하지 않음
- Editor State에 세 번째 저장 원본을 추가하지 않음
- 변경 파일 ESLint/build/`git diff --check`

### Gate 4 완료 조건

- 새 Layer Document mutation의 순수 Transaction 경로가 완성된다.
- Duplicate가 새 Layer Document를 생성한다.
- 제품 State authority는 아직 Legacy에 유지되어 기존 기능을 깨지 않는다.
- Layer Document를 shadow write state로 추가하지 않는다.
- 양방향 동기화나 세 번째 편집 원본이 생기지 않는다.
- 감독관이 Selection/Timeline UI/Placement 전환을 승인한다.

### Gate 4 검토 결과

- 제품 State, Legacy authority, Editor/Engine/UI/History에 연결하지 않은 순수 Transaction 기반을 완성했다.
- create/delete/duplicate/source replace/Group move/name/common/domain update를 의미 단위 Command로 분리했다.
- Duplicate는 같은 Source를 공유하고 공통·Type별 편집 데이터는 독립 복제하며, Group subtree의 ID와 parent를 다시 연결한다.
- 모든 성공 결과는 selection change와 history entry 1개를 Plain Data로 반환하고, 모든 실패는 입력을 변경하지 않는 구조화된 결과를 반환한다.
- 1차 검토에서 누락된 Layer 이름 변경 Transaction을 보완했고 `name`과 `placement.alias`의 책임을 분리했다.
- 760줄 단일 구현을 helper, structural transaction, content transaction, 공개 re-export 경계로 책임 분리했다.
- Schema, Migration, Transaction 전용 verification과 변경 파일 ESLint, build, `git diff --check`가 통과했다.
- Browser QA와 실제 조작 QA는 실행하지 않았다.
- 제품 authority의 실제 전환은 Task 5~8의 소비 경계를 준비한 뒤 Task 9에서 원자적으로 수행한다.

---

## Task 5 — Selection과 Timeline UI/Placement 전환 준비

> 진행 상태: 완료 / 보완 후 Gate 5 승인

### 목적

Task 9의 원자적 전환에 사용할 Layer Document 기반 Selection/Timeline read model과 Placement Command adapter를 준비한다.

이 Task에서는 기존 제품 UI와 Legacy authority를 전환하지 않는다.

### 작업

- Layer Document Selection identity/read model을 `layerDocumentId` 기준으로 정의
- PSD Tree Source 선택과 Editor Layer 선택의 분리 계약
- Layer Document에서 Timeline UI row를 만드는 순수 read model
- start/duration/order/visible/alias/group Command를 Project Transaction으로 변환하는 adapter
- Duplicate/rename/reorder/delete/split intent의 Transaction 연결 계약
- stale selection 정규화 규칙
- sourceId fallback 없이 같은 Source의 여러 Layer를 구분하는 검증
- Task 9 Composition Root wiring에 필요한 public port
- 기존 Timeline UI, Editor Session, Legacy State에는 아직 연결하지 않음

### 정적 검증

- 같은 Source를 공유하는 여러 Layer 선택 구분
- Timeline read model row별 정확한 Layer 연결
- Duplicate 후 새 Layer 선택
- delete/undo/group 이동 후 stale selection 처리
- reorder/visibility/alias가 담당 Layer만 변경
- Timeline Command adapter가 Placement 외 Transform/Domain data를 수정하지 않음
- 제품 State/Legacy setter/React State 비연결
- 변경 파일 ESLint/build/`git diff --check`

### Gate 5 완료 조건

- 준비된 Selection/Timeline 계약이 같은 Layer Document ID를 사용한다.
- 같은 Source를 공유해도 각 Layer를 독립적으로 선택한다.
- Timeline read model과 Command adapter는 공통 Placement 영역 밖의 데이터를 수정하지 않는다.
- 제품 State authority는 Legacy에 유지되고 Layer Document shadow write가 없다.
- 감독관이 Animation/Draft/Canvas 전환 준비를 승인한다.

### Gate 5 검토 결과

- `layerDocumentId` Editor selection과 `sourceId` PSD Tree selection을 서로 다른 계약으로 분리했다.
- Project root 제외 정책, 계층·Placement 순서, `alias ?? name` 표시 계약을 가진 순수 Timeline read model을 완성했다.
- timing/visibility/alias/rename/delete/duplicate/reorder/reparent/split intent를 적용 전 Project Transaction으로 변환한다.
- Split은 같은 Source를 공유하는 독립 Layer Document와 Group subtree를 만들고, 좌우 timing/source offset을 History 1회로 원자 계산한다.
- 1차 검토에서 Placement 순서가 바뀐 주변 Layer의 revision과 History 영향 ID가 누락되는 문제를 발견했다.
- 보완 후 실제 저장 값이 바뀐 기존 Layer는 revision이 정확히 1 증가하고, 새 Layer는 revision 0을 유지하며, History 영향 ID는 실제 diff와 일치한다.
- 동일 값 Command는 `no-change` 구조화 실패로 처리하여 revision과 History를 만들지 않는다.
- Task 4/5 전용 verification, 변경 파일 ESLint, build, `git diff --check`가 통과했다.
- 제품 Timeline UI, Editor Session, Composition Root, Legacy State에는 연결하지 않았다.
- Browser QA와 실제 조작 QA는 실행하지 않았다.

---

## Task 6 — Animation, Draft, Canvas, Renderer 전환 준비

> 진행 상태: 완료 / Gate 6.5 보완 승인

### 목적

Task 9 원자적 전환에 사용할 Layer Document 기반 Animation, Draft, Evaluated Scene, Canvas, Renderer 입력 계약과 순수 adapter를 준비한다.

이 Task에서는 기존 Composition Root와 제품 Render Pipeline의 authority를 전환하지 않는다.

### 작업

- Animation target의 Layer Document ID 계약
- Draft Transform target의 Layer Document ID 계약
- Layer Document 기반 Evaluated Scene 입력을 만드는 순수 adapter
- Render node에 Layer identity를 끝까지 유지하는 계약
- Source Resolver를 Source 참조 해석에만 제한하는 경계
- Direct Selection/Glow/Gizmo/Motion Path가 소비할 Layer identity read model
- Source Cache와 Layer Result Cache key 분리
- Legacy source-as-layer fallback 없는 새 경로의 검증
- Task 9 Composition Root wiring에 필요한 public port
- 기존 Canvas/Render product wiring과 Legacy 경로는 아직 변경하지 않음

### Runtime 흐름

```text
Layer Document
→ Source 또는 Type별 데이터
→ Animation 평가
→ Transform/Effect/Modifier
→ Draft 합성
→ Evaluated Scene
→ Renderer
```

### 정적 검증

- 같은 Source를 참조하는 복제 Layer의 독립 Transform
- 독립 Animation/Effect/Modifier 평가
- Source bitmap/decoder 재사용
- Draft target identity
- PointerMove Project Update 0
- PointerUp Project Commit 1 / History 1
- Canvas selection candidate identity
- Cache invalidation key 구분
- 기존 Renderer mode/output contract 유지
- 제품 Render Pipeline/Composition Root/Legacy setter 비연결
- 변경 파일 ESLint/build/`git diff --check`

### Gate 6 완료 조건

- 준비된 Canvas/Render 계약이 선택된 Layer Document를 표시·수정 대상으로 사용한다.
- 준비된 Source Resolver는 원본 Resource 조회에만 사용된다.
- 편집 결과는 Layer별 독립이고 Source Resource는 공유된다.
- Draft/Commit port 계약이 Layer Document ID를 사용한다.
- 제품 authority는 Legacy에 유지되고 새 경로는 State를 소유하지 않는다.
- 감독관이 Runtime Identity 독립 검증을 승인한다.

### Gate 6 검토 결과

- Layer Document hierarchy를 기존 Animation helper와 `EvaluatedScene` union으로 연결하는 순수 준비 adapter를 완성했다.
- `layerDocumentId`는 Runtime target에서 Evaluated/Preview/Render/Direct Selection/Glow/Gizmo/Motion Path까지 유지된다.
- `sourceId`는 실제 Source Resource 해석과 Source cache key에만 사용하고, Source 없는 Layer는 `null`을 유지한다.
- Source cache key와 Layer result cache key를 분리하여 같은 Source를 공유하는 Layer의 결과가 섞이지 않게 했다.
- Draft는 `layerDocumentId + globalFrame + localFrame`이 모두 일치할 때만 적용하며 PointerMove 0 commit, PointerUp 1 transaction/History intent 계약을 준비했다.
- 1차 검토에서 Source 없는 Layer에 가짜 공통 Source ID를 넣은 문제와 기존 Preview identity 보존 경계를 발견해 보완했다.
- Layer Document는 `layerDocumentId`, ProjectSource canonical placement는 `itemId`, 구형 fallback은 기존 `renderItemId`를 사용한다.
- 59개 전체 정적 verification, 변경 파일 ESLint, build, `git diff --check`가 통과했다.
- 제품 Composition Root, Editor State, Canvas authority, Legacy State에는 연결하지 않았다.
- Browser QA와 실제 조작 QA는 실행하지 않았다.

---

## Task 6.5 — Runtime Identity 회귀 검증 Gate

> 진행 상태: 완료 / 2차 독립 검증 승인

### 목적

Panel 전환 전에 Runtime 전체가 Layer Document identity로 일관되게 동작하는지 독립 검증한다.

### 비교 항목

- Timeline UI 선택 Layer ID
- Canvas 선택 Layer ID
- Animation target ID
- Draft target ID
- Evaluated Scene Layer ID
- Render Source reference
- Direct Selection/Glow/Gizmo target
- Source Cache key
- Layer Result Cache key
- Project Update/History count

### Gate 6.5 완료 조건

- Source ID가 Layer 선택이나 Transform target으로 사용되는 경로가 남지 않는다.
- Layer identity와 Source identity가 Cache까지 명확하게 구분된다.
- 발견된 fallback이나 혼합 identity를 Task 6에서 수정했다.
- 감독관이 Panel/Domain Engine 전환을 승인한다.

### Gate 6.5 1차 독립 검증 결과

- Layer Document Runtime의 기본 identity 흐름, Source 없는 Layer의 `sourceId: null`, revision/History diff, 제품 State 비연결은 확인됐다.
- Direct Selection이 명시적 canonical marker 대신 `timelineById.has(node.itemId)` 우연 일치로 canonical/Legacy를 판별하는 결함을 발견했다.
- 공개 Motion Path helper가 `layerDocumentId`만 확인하고 global/local frame과 target 전체를 확인하지 않는 결함을 발견했다.
- Layer result cache key가 Source Refresh 의존성을 포함하지 않아 향후 Source 결과까지 캐시할 경우 stale 결과가 될 위험을 발견했다.
- 감독관은 Layer result cache가 Source 결과를 포함해도 안전하도록 `sourceResourceCacheKey`를 의존성에 포함하기로 결정했다.
- 위 세 항목을 Task 6에서 보완하고 blind-spot fixture를 추가한 뒤 Gate 6.5를 재검토한다.

### Gate 6.5 2차 독립 검증 결과

- Direct Selection은 `layerDocumentId`, `identityKind: canonical-placement`, truly Legacy를 명시적으로 구분한다.
- Legacy ID가 Timeline Item ID와 우연히 같아도 canonical로 오인하지 않고 Source 중복 모호성을 차단한다.
- 공개 Motion Path helper는 target kind, Layer ID, global frame, local frame 전체가 일치할 때만 Draft를 사용한다.
- Layer result cache key v2는 nullable `sourceResourceCacheKey`를 포함해 Source version/fingerprint 변경을 함께 무효화한다.
- 관련 전용 verification과 전체 59개 verification, ESLint, `git diff --check`가 통과했다.
- 독립 검증자가 새 결함 없이 Gate 6.5 승인 가능 의견을 냈고 감독관이 승인했다.

---

## Task 7 — 모든 Panel과 Domain Engine 전환 준비

> 진행 상태: 완료 / Gate 7 승인

### 목적

Task 9 원자적 전환에 사용할 Layer Document 기반 Panel descriptor와 Domain Engine Command/Query adapter를 준비한다.

이 Task에서는 기존 제품 Panel과 Composition Root의 authority를 전환하지 않는다.

### 작업

- Layer Document 기반 공통 Panel descriptor
- Transform Panel adapter → Transform 영역
- Drawing Panel/Engine adapter → Drawing 영역
- Text Panel/Engine adapter → Text 영역
- Audio Panel/Engine adapter → Audio 영역
- Effect Panel/Engine adapter → Effect 영역
- Modifier Panel/Engine adapter → Modifier 영역
- Video/Shape future capability 경계
- Panel 간 직접 refresh가 없는 Query/Command 계약
- Engine 간 직접 state mutation이 없는 Transaction adapter
- Task 9 Composition Root wiring에 필요한 public port
- 기존 제품 Panel/Composition Root/Legacy State에는 아직 연결하지 않음

### 정적 검증

- 같은 선택된 Layer Document로 모든 Panel descriptor가 생성됨
- Type별 잘못된 Panel capability 차단
- 각 Engine이 담당 영역만 수정
- Panel → 다른 Panel/Canvas 직접 호출 없음
- Domain Engine → Project 내부 setter 직접 접근 없음
- 한 Command당 Transaction/History 횟수
- 제품 Panel/Composition Root/Legacy setter 비연결
- Engine import boundary
- 변경 파일 ESLint/build/`git diff --check`

### Gate 7 완료 조건

- 준비된 Canvas, Timeline UI, 모든 Panel 계약이 같은 Layer Document를 읽고 수정 대상으로 사용한다.
- Engine이 Project Data 사본을 소유하지 않는다.
- Engine이 소유하는 데이터는 Runtime Cache, Draft, Tool State, Preview 계산 결과에 한정된다.
- Runtime 데이터가 Layer Document의 대체 편집 원본으로 사용되지 않는다.
- Panel과 Engine 사이 직접 상태 수정이 없다.
- 새로운 Layer Type은 Type별 영역과 연결점만 추가하면 된다.
- 제품 authority는 Legacy에 유지되고 준비 경로는 State를 소유하지 않는다.
- 감독관이 PSD Tree/Refresh 전환을 승인한다.

### Gate 7 검토 결과

- 선택된 `layerDocumentId + LayerDocumentProject` 하나에서 모든 Panel이 사용할 공통 descriptor와 capability를 파생한다.
- Layer name/alias와 Source display metadata를 분리하고 같은 Source를 공유하는 Layer의 Transform/Effect/Modifier/Type별 데이터를 독립적으로 유지한다.
- Transform, Drawing, Text, Effect, Modifier Command는 기존 semantic Transaction을 재사용하고 Audio/Video/Shape의 미지원 기능은 구조화된 future 경계로 차단한다.
- Transform Draft는 Task 6의 PointerMove 0 commit/History, PointerUp 1 commit intent 계약을 그대로 사용한다.
- Drawing/Text/Audio 기존 Domain Engine에 순수 Query/Transaction 준비 port만 추가했으며 새 Engine/Store/State/Runtime은 없다.
- 전용 fixture, 전체 60개 verification, 변경 파일 ESLint, build, Engine boundary, `git diff --check`가 통과했다.
- 제품 Panel, Composition Root, Legacy authority에는 연결하지 않았다.
- Browser QA와 실제 조작 QA는 실행하지 않았다.

---

## Task 8 — PSD Tree와 Source Refresh 경계 전환 준비

> 진행 상태: 완료 / 보완 후 Gate 8 승인

### 목적

Task 9 원자적 전환에 사용할 Source Registry Transaction, PSD Tree read model, Import/Refresh adapter를 준비한다.

이 Task에서는 기존 PSD Tree와 ProjectSource/Composition Root authority를 전환하지 않는다.

### 작업

- Source Registry/Runtime 경계 확정
- PSD Tree Source hierarchy
- Source stable identity
- Source version/fingerprint/availability
- Import → 새 Layer Document 생성 Transaction
- Refresh → Source-only update
- missing/reconnect
- 새 PSD node 처리
- Source 삭제와 참조 보호
- Source cache invalidation
- Task 9 Composition Root wiring에 필요한 public port
- 기존 PSD Tree/ProjectSource/Legacy State에는 아직 연결하지 않음

### Refresh 계약

Refresh가 변경할 수 있는 것:

- 원본 payload
- source version/fingerprint
- availability/sync status
- source runtime/cache

Refresh가 변경할 수 없는 것:

- Layer name
- Transform
- Placement
- Animation
- Effect
- Modifier
- Type별 데이터

### 정적 검증

- 동일 Source를 참조하는 복수 Layer Refresh
- Layer 편집 데이터 보존
- missing/reconnect
- 새 PSD node가 Timeline UI에 임의 배치되지 않음
- 참조 중인 Source hard delete 방지
- source version에 따른 cache invalidation
- 제품 PSD Tree/Composition Root/Legacy setter 비연결
- 변경 파일 ESLint/build/`git diff --check`

### Gate 8 완료 조건

- PSD Tree는 Source만 관리한다.
- Layer Document는 Source를 참조할 뿐 Source와 동일 객체가 아니다.
- Refresh 후 모든 참조 Layer가 새 원본을 사용하면서 편집 데이터는 유지된다.
- 제품 authority는 Legacy에 유지되고 Source 준비 경로는 State를 소유하지 않는다.
- 감독관이 History/Legacy 제거를 승인한다.

### Gate 8 검토 결과

- Source Registry 기반 PSD document/node 중첩 Tree와 Source 전용 selection read model을 완성했다.
- 실제 `file.psd/Group/Layer` sourcePath에서 PSD document root, 중첩 parent, orphan/ambiguous parent를 구분한다.
- Source+명시적 Layer import, 단일 Source lifecycle, PSD document 전체 batch Refresh, discovery, 참조 보호 delete를 순수 Transaction으로 준비한다.
- PSD batch Refresh는 document와 node update/create/deletePending 상태를 한 번에 검증하고 Layer edit data와 revision을 변경하지 않는다.
- PSD node의 `documentSourceId/sourceKey`는 stable identity로 보호한다.
- Import/delete는 History 1회, Refresh/missing/reconnect/discovery는 `clear-history` 1회 정책과 History entry 0개를 반환한다.
- Source version/fingerprint 변경은 모든 참조 Layer의 Source/Layer result cache key를 무효화한다.
- 1차 검토에서 실제 PSD 최상위 node를 orphan 처리할 수 있는 document root path 결함을 발견해 실제 migration형 fixture로 보완했다.
- 전체 61개 verification, 변경 파일 ESLint, build, `git diff --check`가 통과했다.
- 제품 PSD Tree, ProjectSource, Composition Root, Legacy authority에는 연결하지 않았다.
- Browser QA와 실제 조작 QA는 실행하지 않았다.

---

## Task 9 — History 단일 원본과 Legacy 제거

> 진행 상태: 완료 / Gate 9D 승인

### 목적

History와 저장 구조를 Layer Document 집합으로 통일하고 전환용 Legacy 경로를 제거한다.

### 작업

#### Task 9A — Layer Document owner와 History 준비

> 진행 상태: 완료 / 구조 보완 후 Gate 9A 승인

- Project Layer Document 단일 State owner
- Layer/Source Transaction atomic commit
- Layer/Source selection 동시 적용
- 사용자 Action당 History 1회
- Source lifecycle `clear-history` 정책
- Selection 복원/정규화
- Draft clear와 Playback 복원 경계
- Render Result/Cache/FileHandle/Bitmap/Canvas History 제외
- 아직 Composition Root 제품 authority 전환 없음

#### Gate 9A

- 새 owner는 Plain Layer Document Project만 저장한다.
- commit은 Project, Selection, History를 한 경계에서 적용한다.
- 기존 제품 State와 양방향 동기화하거나 shadow write하지 않는다.
- 감독관 승인 전 Root에 연결하지 않는다.

#### Gate 9A 검토 결과

- `LayerDocumentProject` 하나를 current Project로 소유하고 Layer/Source selection, Playback session, Plain History를 분리한 owner를 완성했다.
- Layer/Source Transaction의 stale `before`, schema, Plain Data, actual diff를 검증한 뒤 Project·Selection·History를 한 reducer transition으로 적용한다.
- Source lifecycle `clear-history`는 양 stack을 비우고 cache invalidation effect와 Draft clear를 반환한다.
- Undo/Redo는 Project, Layer/Source selection, Playback을 같은 snapshot으로 복원하고 Runtime 재계산 effect를 반환한다.
- Draft, Render result, cache, decoder, FileHandle, Bitmap, Canvas는 Project/History에 저장되지 않는다.
- 619줄 reducer를 공통 helper, Layer commit, Source commit, History restore, main reducer로 책임 분리했다.
- 전체 62개 verification, 변경 파일 ESLint, build, `git diff --check`가 통과했다.
- Composition Root와 기존 제품 State에는 연결하지 않았다.

#### Task 9B — 소비자 wiring 조립

> 진행 상태: 완료 / 구조 보완 후 Gate 9B 승인

- Task 5 Timeline/Selection adapter
- Task 6 Canvas/Render/Draft adapter
- Task 7 Panel/Domain adapter
- Task 8 PSD Tree/Source adapter
- 기존 UI View Props에 필요한 Layer Document read adapter
- Source Runtime Resource cache/resolver 경계
- Root cutover용 단일 조립 함수
- 아직 Composition Root 제품 authority 전환 없음

#### Gate 9B

- 모든 제품 consumer가 Layer Document owner 하나만 받을 준비가 된다.
- Source Runtime Cache는 저장 Project/History와 분리된다.
- Legacy write나 reconciliation이 조립 경로에 없다.
- 감독관 승인 후에만 Root cutover를 수행한다.

#### Gate 9B 검토 결과

- Timeline/Selection, Canvas/Render/Draft, Panel/Domain, PSD Tree/Source를 하나의 Layer Document owner에 연결하는 Root 조립 계층을 준비했다.
- 조립 계층은 별도 Engine, Store, Runtime authority를 만들지 않고 주입된 owner와 Runtime port만 사용한다.
- PointerMove는 Draft만 발행하고 Project/History를 변경하지 않으며, PointerUp은 Transform Transaction과 History를 각각 한 번만 생성한다.
- Transform Commit은 활성화된 Position/Scale/Rotation/Opacity 트랙을 `localFrame` keyframe으로 갱신하고, 비활성 트랙과 Anchor/Transform Offset은 base Transform으로 갱신한다.
- Animation과 Layer Document Transaction이 같은 keyframe replace/sort 원칙을 공유하며 하나의 원자 Transaction으로 처리된다.
- Source Runtime Resource cache와 Draft는 Project/History 밖에 있고 module singleton으로 소유되지 않는다.
- 1차 감독관 검토에서 Animation track을 우회하는 Transform Commit과 React owner의 stale read 가능성을 발견해 보완했다.
- 독립 검토에서 owner public identity가 state 변경을 전달하지 못할 위험을 추가로 발견해, live state getter와 state별 public port identity를 함께 보장하도록 보완했다.
- 전체 63개 verification, 관련 파일 ESLint, Engine boundary, build, `git diff --check`가 통과했다.
- Composition Root와 Legacy 제품 authority에는 아직 연결하지 않았고 Browser QA는 실행하지 않았다.

#### Task 9C — Composition Root 원자적 전환

> 진행 상태: 완료 / Gate 9C 승인

기존 UI 기능을 축소하거나 Legacy 모양의 shadow projection을 만들지 않기 위해,
Root 전환 전의 공개 계약 준비를 아래 내부 Gate로 나눈다. 각 단계에서는
제품 Root authority를 바꾸지 않고, 마지막 9C-5에서만 한 번에 전환한다.

##### Task 9C-1 — Session, Playback, PSD Runtime 계약

> 진행 상태: 완료 / 구조 보완 후 Gate 9C-1 승인

- 선택 Layer와 별개의 `activeGroupLayerDocumentId` Editor Session 계약
- active Group 기준 Breadcrumb, Timeline scope, Canvas scene scope
- owner 기반 current frame/range command/read
- `isPlaying`, Renderer Mode 등 저장되지 않는 Playback Runtime 분리
- PSD parse/prepare/confirm/cancel을 Plain Source/Layer Transaction과
  Runtime resource로 분리
- Import 성공 후 Runtime resource 등록, 실패/cancel 시 dispose
- Static PSD Source Alpha/bitmap은 frame/quality와 무관한 visual revision
  resource key로 재사용

##### Gate 9C-1

- Group 위치와 선택 Layer identity가 독립적이다.
- Playback frame/range의 저장되지 않는 세션 원본이 owner 하나다.
- PSD Runtime 객체가 Project/History에 들어가지 않는다.
- 다른 frame/quality에서도 같은 Static PSD resource가 재사용된다.
- 제품 Root는 아직 Legacy authority를 유지한다.

##### Gate 9C-1 검토 결과

- 선택 Layer와 별개의 `activeGroupLayerDocumentId`를 Editor Session에 추가하고, Breadcrumb·Timeline·Canvas가 같은 Group scope read model을 사용하도록 준비했다.
- active Group 변경 시 해당 Group의 duration/frame rate를 기준으로 current frame과 range를 정규화하며, History는 만들지 않고 Draft clear와 Render recompute effect만 반환한다.
- PSD parse 결과를 Plain Source/Layer command와 Runtime-only resource로 분리하고, owner Source Transaction 성공 뒤에만 Runtime cache로 소유권을 넘긴다.
- Static PSD visual resource key는 frame/quality와 무관하게 Source version/fingerprint로 재사용하고, time-varying future source는 frame/quality sampled key를 사용한다.
- 1차 검토에서 성공 후 재취소가 cache-owned Canvas를 파괴할 수 있는 Prepared resource 수명 결함, Runtime batch 부분 등록 위험, Prepared Refresh 인계 누락을 발견했다.
- Prepared resource를 one-shot lifecycle로 보완하고 batch 등록을 preflight 기반 원자 연산으로 변경했다. owner commit 뒤 등록 실패는 Project/History 추가 변경 없이 Runtime 등록만 재시도한다.
- Prepared Import/Refresh의 성공 후 중복 confirm/cancel, 반복 cancel, owner 실패, 첫/중간 batch 실패, retry, nested duplicate PSD identity를 fixture로 검증했다.
- 전체 63개 verification, 전체/대상 ESLint, Engine boundary, TypeScript/build, `git diff --check`가 통과했다.
- 기존 Root와 4개 제품 UI는 변경하지 않았고 Browser QA는 실행하지 않았다.

##### Task 9C-2 — 기존 Canvas UI 계약의 Layer Document-native 전환

> 진행 상태: 완료 / 구조 보완 및 독립 재검토 후 Gate 9C-2 승인

- 기존 `PreviewWorkspacePane`와 Gizmo/Anchor/Scale/Rotation/Opacity,
  Motion Path, Glow, Direct Alpha Hit UI를 그대로 유지
- Canvas 공개 read/command model을 `layerDocumentId`와 Layer Document
  Runtime scene/target/typed drawable resource 기준으로 확장
- PointerMove Draft 0 commit, PointerUp Transaction/History 1회
- 기존 Renderer와 Preview Quality를 재사용하되 Legacy Project/Render
  edit authority는 사용하지 않음

##### Gate 9C-2

- 기존 Canvas UI 기능과 출력 계약이 제거되거나 간소화되지 않는다.
- Canvas 제품 경로가 Layer Document owner에 연결될 준비가 된다.
- Legacy write/shadow projection 없이 정적 Canvas fixture가 통과한다.

##### Gate 9C-2 검토 결과

- 기존 `PreviewWorkspacePane`, Gizmo, Anchor, Scale, Rotation, Opacity,
  Motion Path, Glow, Direct Alpha Hit UI 계약을 유지한 채 Layer Document
  scene/target/resource 기반 read model과 interaction bridge를 준비했다.
- 일반 Transform PointerMove는 Draft만 발행하고 Project/History를
  변경하지 않으며, PointerUp은 owner Transaction과 History를 각각
  한 번만 생성한다.
- Motion Path는 재생 중인 frame과 다른 keyframe을 드래그해도 같은
  Draft Session의 지정-frame 값을 즉시 sample geometry에 반영하고,
  cancel 시 원래 값으로 복귀한다.
- Motion Path semantic commit은 일반 Transform commit과 분리해
  Position track이 비활성인 경우에도 base Position을 변경하지 않고
  track 활성화와 지정 localFrame keyframe 생성을 원자적으로 수행한다.
- 생성 또는 선택한 Motion Path keyframe identity는 저장 Project와
  History 밖의 owner Runtime Session에 보관하며, Placement·Source
  Offset 변경과 Undo/Redo 시 현재 Project 기준으로 정규화한다.
- full/fast Renderer는 Layer Document 모드에서 node-native visual
  resolver를 먼저 사용하며 resolver miss를 Legacy RenderItem
  fallback으로 우회하지 않는다.
- Source Runtime resource key와 frame/Draft별 Layer result key를
  분리하고, Direct Alpha Hit와 Glow가 같은 alpha descriptor와 painter
  order를 사용하도록 유지했다.
- 독립 검토에서 keyframe selection 누락, 지정-frame Draft 미표시,
  Placement 변경 후 stale globalFrame, 비활성 track의 base Position
  변경, 신규 keyframe 선택 누락을 순차적으로 발견해 모두 보완했다.
- 전체 64개 verification, ESLint, TypeScript/build, Engine boundary,
  `git diff --check`가 통과했다.
- Root 제품 authority에는 아직 연결하지 않았고 Browser QA는
  실행하지 않았다.

##### Task 9C-3 — 기존 Timeline UI 계약의 Layer Document-native 전환

> 진행 상태: 완료 / 구조 보완 및 감독관 검토 후 Gate 9C-3 승인

- 기존 Breadcrumb, Tab 지도, Group navigation, Ruler, Playback,
  Layer rows, keyframe rows, rename/reorder/resize/split/duplicate/delete 유지
- Hover/Scrub/Drag/Keyframe selection은 Runtime UI state로 유지
- Placement/Animation semantic commit은 Layer Document Transaction만 사용
- 사용자 Action 1회당 Transaction/History 1회

##### Gate 9C-3

- 기존 Timeline UI 기능이 유지된다.
- Timeline Item/ProjectSource를 새 저장 원본으로 재생성하지 않는다.
- Group scope, Layer selection, Placement, Animation이 같은 Layer Document
  identity를 사용한다.

##### Gate 9C-3 검토 결과

- 기존 Timeline React UI는 중립 `TimelineViewItem`을 사용하고,
  저장 쓰기는 Layer Document owner/Transaction으로만 연결했다.
- Playback은 owner session의 frame/range를 사용하는 외부 Runtime clock으로
  연결해 play/seek/step/reset이 실제 frame을 갱신한다.
- position/scale/rotation/opacity keyframe 이동·삭제, Group duration,
  rename/reorder/resize/split/duplicate/delete를 semantic command로 유지했다.
- Source 상태 확인은 저장 Project나 History를 변경하지 않는 Runtime
  acknowledgment로 분리했고, 실제 삭제 결정만 Source lifecycle command를
  사용한다.
- 재정렬은 유효한 `[0,1,2]` sibling 입력에서 전체 ID 순서, 정규화된
  order, 중복·유실 없음, Group 외부 불변을 검증했다. 비연속 order의
  잘못된 Project는 입력 검증을 완화하지 않고 `invalid-before`로 거부한다.
- 전체 68개 verification, ESLint, TypeScript/build, `git diff --check`가
  통과했다. 기존 Vite chunk-size 경고만 남아 있다.
- 작업 중 규칙과 달리 `npm run qa`가 한 차례 실행되었으나 Browser QA는
  실행하지 않았다. 이후 단계에서는 사용자 요청 전 `npm run qa`를
  실행하지 않고 필요한 정적 검증만 개별 수행한다.

##### Task 9C-4 — 기존 Properties/PSD Tree UI 계약의 Layer Document-native 전환

> 진행 상태: 완료 / 보완 및 독립 재검토 후 Gate 9C-4 승인

- Properties Numeric Focus/Input/Enter/Blur/Escape UX 유지
- Numeric string/focus는 Runtime UI state, transform preview는 공통 Draft,
  Enter/Blur는 Transaction 1회, Escape는 Project 0회
- 기존 Transform/Animation/Modifier 및 Type별 Panel 표시 유지
- PSD Tree prepare/confirm/cancel/refresh/remove UX와 Import Preview Runtime
  hierarchy/order 편집을 유지한다. 확정 Source 목록은 Layer Placement
  재정렬로 대체하지 않고 canonical name/id 표시순서를 사용한다.
- PSD Tree는 Source만, Properties는 선택 Layer Document만 수정

##### Gate 9C-4

- 기존 Properties와 PSD Tree UI 기능이 유지된다.
- Legacy History callback이나 ProjectSource write가 없다.
- Runtime draft와 Project commit의 경계가 명확하다.

##### Gate 9C-4 검토 결과

- Properties는 현재 frame의 Animation 평가값에 일치하는 공통 Draft를
  합성하고, Layer/revision/global-local frame 변경 시 stale input과
  Draft를 정리한다.
- Numeric/Modifier는 Input 중 Project 0회, 유효 Enter/Blur에서
  Transaction/History 1회, Escape·실패·무변경에서 Project 0회를
  유지한다. Anchor는 `transformOffset` 보정을 같은 Draft/Commit에
  포함한다.
- scaleLinked, position/scale/rotation/opacity track, keyframe 선택·삭제,
  Project root의 기존 Scale/Rotation/Opacity Animation, Wiggle `0/0`
  기본값과 Type별 Panel 계약을 보존했다.
- Properties와 PSD Tree는 좁은 Engine port만 소비하며 cutover assembly를
  역참조하지 않는다. 기존 React UI가 소비할 ViewProps hook/read model도
  Root 연결 전 준비했다.
- PSD Import Preview의 Runtime hierarchy/order, one-shot confirm,
  stale prepare dispose, register retry와 refresh summary를 Source 전용
  경계로 구현했다. 확정 Source 목록은 별도 저장 order 계약이 없으므로
  canonical name/id 순서를 유지한다.
- 최초 Import Source는 `normal`, Refresh의 기존·신규·누락 Source는 각각
  `updated`/`new`/`deletePending`으로 Project Registry와 Tree ViewModel에
  동일하게 저장·표시한다.
- 참조 중 Source hard delete는 `source-is-referenced`로 거부하며 Layer
  삭제로 바꾸지 않는다.
- 실제 controller → narrow adapter → cutover assembly → owner 통합
  fixture를 포함한 전체 71개 verification, ESLint, TypeScript/build,
  `git diff --check`가 통과했다. Browser QA와 `npm run qa`는 실행하지
  않았다.

##### Task 9C-5 — Composition Root 단일 전환

> 진행 상태: 완료 / 보완 및 독립 재검토 후 Gate 9C 승인

- 준비된 owner와 기존 4개 UI의 Layer Document-native wiring을
  Composition Root에 한 번에 연결
- Layer Document Project를 제품의 유일한 쓰기 authority로 전환
- 기존 Project/History/Selection/Render 저장 owner는 Root에서 제거
- Undo/Redo owner effect가 Draft, UI Runtime state, Playback, Render
  재계산을 한 경계에서 처리
- 단방향 bootstrap 외 migration/reconciliation/dual write 금지

##### Gate 9C-5 검토 결과

- Composition Root는 mount당 하나의 Layer Document owner를 lazy
  bootstrap하고 Canvas, Timeline, Properties, PSD Tree의 실제 ViewProps를
  모두 같은 owner에서 공급한다.
- Root의 Legacy Project/History/Selection/Canvas/Timeline/Properties/
  PSD Tree 활성 hook과 setter를 제거해 dual authority와 dual write가 없다.
- Draft publish/clear는 구독 revision을 발행하며, Draft clear와 Timeline/
  Properties local UI reset을 분리해 playback tick이 로컬 입력 상태를
  매 frame 초기화하지 않는다.
- Engine 내부의 cutover assembly 역참조를 제거하고 좁은 owner port를
  Root에서 주입한다.
- Layer commit과 새 Source import는 기존 Source cache를 보존한다.
  Source lifecycle은 대상 resource만 무효화하고, Source delete는
  suspend/Undo restore/Redo suspend로 runtime resource를 복구한다.
- 같은 Source를 공유하는 Duplicate는 `layerDocumentId`별 Transform,
  Animation, Draft, Selection, History가 독립적이다.
- 전체 72개 verification, ESLint, TypeScript/build, `git diff --check`가
  통과했다. 기존 Vite chunk-size 경고만 남았고 Browser QA 및
  `npm run qa`는 실행하지 않았다.
- History가 완전히 폐기된 뒤 suspended Source runtime을 정리하는 cache
  GC 정책은 Task 9D에서 보완한다.

#### Gate 9C

- 제품 쓰기 원본이 Layer Document Project 하나다.
- 부분 cutover, dual write, shadow reconciliation이 없다.
- 정적 통합 fixture에서 주요 사용자 Action이 새 경로만 사용한다.
- 기존 Canvas, Timeline, Properties, PSD Tree UI 기능이 유지된다.
- 감독관 승인 후 Legacy 제거를 수행한다.

#### Task 9D — Legacy 제거

> 진행 상태: 완료 / 보완 및 독립 재검토 후 Gate 9D 승인

- Legacy Composition/Layer 쓰기 제거
- `ProjectSourceDocument` 전환용 compatibility adapter/state 제거
- Legacy Timeline/Render snapshot 제거
- source-as-layer lookup/fallback 제거
- dead code와 임시 migration adapter 정리
- 저장 schema와 normalize 최종화
- History clear/branch 폐기 시 더 이상 Undo로 복원할 수 없는 suspended
  Source runtime을 즉시 prune/dispose하는 cache GC 정책 정리

#### Gate 9D 검토 결과

- Root에서 끊긴 Legacy editor/project/canvas/timeline/properties/PSD Tree/
  playback owner와 controller dependency closure를 제거했다.
- 활성 `@/models` 공개 barrel에서 Composition, TimelineItem,
  ProjectSource, Legacy Selection 계약을 제거하고 기존 저장본 변환은
  `@/models/offlineMigration` 단방향 경계로 격리했다.
- Renderer의 RenderItem/inputMode/source-as-layer fallback과 Preview/
  Properties의 잔여 Legacy mode/presentation 계약을 제거했다.
- PSD parser/analyzer/source identity/fingerprint와 Layer Document renderer/
  PreviewScene/EvaluatedScene/cache 같은 중립 Runtime 계약은 보존했다.
- History clear와 branch truncate는 더 이상 Undo/Redo에서 참조되지 않는
  suspended Source runtime만 prune/dispose하며 활성 Undo resource와
  dispose-once 계약을 보존한다.
- Validation과 offline migration 대형 파일을 책임별 모듈로 분리해
  모든 제품 파일을 800줄 미만으로 정리했다.
- 공개 기능 verification 30개, ESLint, TypeScript/build,
  `git diff --check`가 통과했고 활성 Legacy import/export/search 위반은
  0개다. Browser QA와 `npm run qa`는 실행하지 않았다.

### 정적 검증

- Duplicate/Transform/Animation/Effect Undo/Redo
- Group move/delete Undo/Redo
- PSD Refresh History 정책
- Runtime 객체 History 제외
- restore 후 schema validation
- restore 후 selection normalization
- Legacy setter/reconciliation/fallback 전역 검색
- Project 저장 원본 수 확인
- 변경 파일 ESLint/build/`git diff --check`

### Gate 9 완료 조건

- Project의 편집 원본은 Layer Document 집합 하나다.
- Project가 Layer Document 밖에 Timeline State, Canvas Layer, Panel Data, Render Item 편집 원본을 소유하지 않는다.
- History가 Layer Document와 필요한 Project Plain Data만 복원한다.
- Legacy와 ProjectSource 양방향 동기화가 제거됐다.
- 임시 Adapter가 제품 구조로 남지 않는다.
- 감독관이 문서화와 최종 검증을 승인한다.

---

## Task 10 — 문서 갱신과 최종 정적 검증

> 진행 상태: 완료 / 보완 및 독립 재검토 후 Gate 10 승인

### 목적

실제 구현과 프로젝트 헌법, 소스 지도, 영구 문서를 일치시키고 Sprint 완료 여부를 판단한다.

### 작업

- `20_src_map.md` 갱신
- Layer Document Architecture 영구 문서 작성
- 기존 ProjectSource/Layer Type 문서의 상태와 대체 관계 기록
- 최종 데이터 흐름과 Engine Boundary 문서화
- migration/rollback/known limitation 기록
- Sprint 진행 상태 갱신

### 최종 정적 검증

- 변경 파일 ESLint
- TypeScript/build
- 모든 Task 전용 verification
- Project schema/migration/transaction verification
- Selection/Timeline UI identity verification
- Draft/Animation/Renderer identity verification
- Panel/Engine boundary verification
- PSD Refresh verification
- History verification
- Layer Document-native Composition/Surface/Preview cache 회귀 fixture가
  기존 Legacy 상세 검증을 충분히 대체하는지 감사하고, 부족한 계약은
  공개 Runtime fixture로 보강
- `git diff --check`
- 500줄 이상 변경 파일 확인 및 리팩토링 제안 기록

### Gate 10 완료 조건

- 코드와 문서가 같은 Layer Document 철학을 설명한다.
- 모든 전용 verification이 통과한다.
- 정적 검증 결과를 QA 통과로 기록하지 않는다.
- Browser QA가 필요한 항목은 사용자 요청 전까지 미실행 상태로 명시한다.
- 감독관이 Sprint 구현 완료 또는 QA 대기 상태를 확정한다.

### Gate 10 검토 결과

- `20_src_map.md`를 단일 Layer Document owner, Session/Draft/Runtime,
  Source Registry, 네 UI, Renderer/cache 및 offline migration 경계에
  맞게 전면 갱신했다.
- `56_layer_document_architecture.md`를 현행 영구 문서로 추가하고,
  41/54는 cutover 전 역사 문서, 55는 superseded Foundation 문서로
  명시했다.
- 공개 Layer Document Runtime → Canvas 경로를 사용하는 cache fixture를
  추가해 fast previous-scene 재사용, source/result cache key-only
  invalidation, Composition/Surface cache, Draft bypass, retained dirty
  redraw와 dispose 계약을 검증했다.
- fixture가 발견한 fast preview source/result cache key 전파 누락을
  drawable/placeholder/composition에 일관되게 보완하고, 영향 child와
  ancestor만 재생성하며 무관 sibling은 재사용하도록 회귀 계약을 고정했다.
- 전체 31개 verification, ESLint, TypeScript/build, `git diff --check`가
  통과했다. Build에는 기존 753.03 kB chunk 경고만 남아 있다.
- 500줄 이상 제품 파일 8개의 유지/후속 분리 판단을 영구 문서에
  기록했고 800줄 이상 제품 파일은 0개다.
- Browser QA, 실제 조작 QA와 `npm run qa`는 사용자 요청이 없어
  실행하지 않았다. 정적 검증 결과를 QA 통과로 기록하지 않는다.

---

## 8. 최종 완료 조건

Sprint 구현 완료 기준:

- Project의 유일한 편집 대상이 Layer Document다.
- Layer Document는 공통 영역과 Type별 확장 영역을 가진다.
- Source는 원본 참조와 Refresh만 담당한다.
- Duplicate는 같은 Source를 참조하는 독립 Layer Document를 만든다.
- Timeline UI와 Timeline Engine은 `Layer Document.common.placement`만 표시하고 수정한다.
- Canvas는 선택된 Layer Document를 표시한다.
- 모든 UI와 Engine은 선택된 같은 Layer Document를 읽고 담당 영역만 수정한다.
- Engine은 Project Data를 소유하지 않고 담당 Layer 영역의 Command/Query만 제공한다.
- Engine은 저장되지 않는 Runtime Cache, Draft, Tool State, Preview 계산 결과만 소유할 수 있다.
- Source Resource는 공유되고 Transform/Animation/Effect/Modifier/Type별 데이터는 Layer별 독립이다.
- PointerMove는 Draft, PointerUp은 Commit/History 1회 원칙을 유지한다.
- History와 저장 원본은 Layer Document 중심으로 통일된다.
- Legacy Composition/Layer와 ProjectSource 양방향 쓰기 구조가 제거된다.
- 새로운 Layer Type은 Project 구조 변경 없이 Type별 데이터 영역과 연결점만 추가할 수 있다.

QA 완료 기준은 사용자의 요청에 따라 실제 Edge 조작으로 검증한다.

---

## 9. 현재 Sprint 상태

| Task | 상태 | Gate |
|---|---|---|
| Task 1 — 계약/Identity 지도 | 완료 | Gate 1 승인 |
| Task 2 — Schema/Validation | 완료 | Gate 2 재승인 |
| Task 3 — Migration | 완료 | Gate 3 재승인 |
| Task 3.5 — Migration 독립 검증 | 완료 | Gate 3.5 승인 |
| Task 4 — Transaction/원자적 전환 준비 | 완료 | Gate 4 승인 |
| Task 5 — Selection/Timeline UI/Placement 준비 | 완료 | Gate 5 승인 |
| Task 6 — Animation/Draft/Canvas/Renderer 준비 | 완료 | Gate 6.5 보완 승인 |
| Task 6.5 — Runtime Identity 검증 | 완료 | Gate 6.5 승인 |
| Task 7 — Panel/Domain Engine 준비 | 완료 | Gate 7 승인 |
| Task 8 — PSD Tree/Source Refresh 준비 | 완료 | Gate 8 승인 |
| Task 9A — Layer Document owner/History | 완료 | Gate 9A 승인 |
| Task 9B — 소비자 wiring 조립 | 완료 | Gate 9B 승인 |
| Task 9C — Composition Root 원자적 전환 | 완료 | Gate 9C 승인 |
| Task 9D — Legacy 제거 | 완료 | Gate 9D 승인 |
| Task 10 — 문서/최종 정적 검증 | 완료 | Gate 10 승인 |

현재 Task 1~10의 구현, 문서화와 정적 검증을 완료했다.

---

## 10. Post-Sprint Browser QA

> 진행 상태: 완료 / Microsoft Edge 새 창에서 실제 조작 QA 통과

### Fixture

- `drag_test.psd`
- `layer_test.psd`

### 검증 결과

- 두 PSD를 같은 Project에 순차 Import하고 기존 Source와 편집 상태가
  유지되는 것을 확인했다.
- PSD Tree, Canvas, Timeline, Properties가 같은 Layer Document 선택을
  표시하는 것을 확인했다.
- Group Canvas 더블클릭 진입과 Timeline breadcrumb 이동을 확인했다.
- Properties 위치 입력이 Canvas에 반영되고 Undo/Redo가 같은
  Layer Document 값을 복원하는 것을 확인했다.
- Canvas Anchor 조작 중 Properties 기준 X/Y가 동기화되고 Undo가
  복원되는 것을 확인했다.
- `fast-render`(작업용)와 `full-render`(완성본) 전환 및 재생을 확인했다.
- Duplicate가 같은 Source를 공유하면서 독립 Layer Document를 생성하고,
  원본과 복제본의 Transform이 서로 독립적인 것을 확인했다.
- 첫 QA에서 Duplicate 표시 이름이 원본과 같게 남는 결함을 발견했다.
  sibling 이름 충돌을 건너뛰는 `_2`, `_3` 명명 규칙으로 수정한 뒤
  같은 Edge 절차에서 재검증했다.
- `layer_test.psd` 대용량 Group에서 실제 Layer 선택, Properties 위치
  변경, Undo/Redo와 두 Renderer Mode 재생을 확인했다.

### QA 결론

확인한 범위에서 추가 회귀를 발견하지 않았다. Duplicate 명명 결함은
수정 후 재검증을 통과했다. Sprint는 구현, 정적 검증과 실제 Browser QA를
모두 완료한 상태다.

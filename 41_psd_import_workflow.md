# PSD Tree Import Workflow 개선 설계

> 문서 번호: 41
> 범위: Import Preview, Refresh 계층 유지, Stable Source Identity와 Import Settings의 실제 구현 상태 및 후속 설계를 기록한다.
>
> **현재 상태:** 이 문서는 cutover 전 구현 역사와 제품 의도를 보존한다. 현재 저장/command authority는 Composition/Timeline/Render records가 아니라 `LayerDocumentProject`, `Source Registry`, LayerDocument transaction이며, 현재 구조는 `56_layer_document_architecture.md`를 따른다.

## 현재 Addendum

이 문서의 1절 이후 “실제 구현 상태”, Engine 책임표, Composition/Timeline/Render record 흐름과 당시 검증 결과는 모두 **LayerDocument cutover 전 시점의 설명**이다. PSD import의 prepare/confirm/cancel, stable source identity, editor hierarchy 보존과 refresh summary라는 제품 의도는 유지되지만 현재 구현을 찾을 때는 다음 대응을 사용한다.

| 당시 표현 | 현재 authority |
|---|---|
| Composition/Layer/Timeline/Render records 일괄 변경 | `LayerDocumentProject` transaction |
| Composition/Layer source identity | Source Registry record + LayerDocument Source reference |
| Timeline/Render 순서 | `LayerDocument.common.placement.order`와 renderer projection |
| Composition History 초기화/복원 | LayerDocument Project owner History 정책 |
| runtime canvas/render binding | Source runtime resource cache |

따라서 아래 과거 섹션의 파일명·record명·검증 개수는 현재 소스 지도가 아니다. 현재 파일 책임은 `20_src_map.md`, 현재 데이터/command/cache 계약은 `56_layer_document_architecture.md`가 우선한다.

## 1. 결론

새 Engine을 추가하지 않고 현재 두 Engine의 경계를 유지한다.

이 설계의 제품 철학은 다음 한 문장으로 정리한다.

> PSD는 그림 내용의 원본이고, 편집기의 PSD Tree는 애니메이션 작업 구조의 원본이다.

따라서 최초 Import 전에는 PSD 전체 구조를 Preview에서 검토하고 정리할 수 있어야 한다. Import가 확정된 뒤에는 이미지와 PSD 속성은 원본을 따라가되, 사용자가 편집기에서 정리한 계층과 순서는 Refresh가 임의로 되돌리지 않는다.

- Project Engine은 PSD 해석, Import Plan 생성, 확정 Import, Source Identity, 저장된 Import Settings와 Refresh 정책을 담당한다.
- PSD Tree Engine은 파일 선택, 분석 중 상태, 설정 Dialog의 draft, Confirm/Cancel 사용자 의도를 담당한다.
- View는 Dialog를 렌더하고 DOM 이벤트를 PSD Tree command로 전달한다.
- Composition Root는 두 Engine의 공개 port만 연결하며 Import 판단 로직을 갖지 않는다.

추천 흐름은 다음과 같다.

```text
PSD 선택
  → Project Engine: 파일 parse + 사전 분석
  → Plain Data PsdImportPlan 반환
  → PSD Tree Engine: Import 설정 Dialog 표시
  → Confirm
  → Project Engine: Plan 재검증 + Project records 일괄 변경
  → Import Settings와 Source Identity 저장
  → 이후 Refresh에서 같은 설정과 identity 재사용

Cancel
  → 준비한 runtime resource 폐기
  → Project records 변경 없음
```

### 1.1 1단계 실제 구현 상태

2026-07-17 기준으로 다음 범위가 제품 코드에 적용됐다.

- 파일 선택은 Project records를 바로 바꾸지 않고 Project Engine의 `preparePsdImport`를 호출한다.
- Prepare는 PSD를 한 번 parse하고 `token → PreparedPsdImport` runtime store에 parsed PSD와 source-node map을 보관한다.
- PSD Tree Engine은 Plain Data Plan과 `analyzing/review/importing` Dialog session만 보관한다.
- Dialog는 파일 이름, 크기, 그룹 수, 일반 레이어 수와 전체 Tree를 표시한다.
- 같은 부모의 그룹/레이어 중복 이름은 종류와 관계없이 첫 항목부터 `_1`, `_2`를 붙이고 빨간색으로 표시한다.
- Preview drag/drop은 Plan을 불변 갱신하며 같은 부모 reorder, 다른 그룹/root 이동과 그룹 이동을 지원한다. 자기 자신 또는 자기 자손으로의 이동은 거부한다.
- Confirm은 보관된 parsed PSD와 현재 Plan만 사용해 Composition/Timeline/Render records를 만들며 PSD를 다시 parse하지 않는다.
- Cancel, Confirm 완료, Engine unmount와 분석 중 Cancel의 늦은 완료 시 runtime token을 폐기한다.
- 기존 PSD Tree 최상위 Composition reorder는 Preview Tree와 drop 의미가 달라 공통화하지 않았다. Preview 이동은 별도 순수 helper가 담당한다.

Import Settings 추가 UI는 현재 Sprint 범위 밖으로 남겼다. Sprint 통합 QA 결과는 1.7에 기록한다.

### 1.2 Refresh 계층 유지 실제 구현 상태

2026-07-17 기준으로 다음 Refresh 구조 보존 범위가 제품 코드에 적용됐다.

- Refresh merge는 기존 Composition children, Layer 배열과 Timeline/Render item 순서를 기준으로 결과를 만든다.
- PSD 안에서 기존 그룹/레이어 순서가 바뀌어도 편집기 순서는 바뀌지 않는다.
- Preview에서 다른 그룹으로 옮긴 기존 그룹/레이어는 Refresh 중 전역 best-effort match가 유일하게 성립하면 현재 편집기 부모에 남는다.
- 기존 Layer/Composition과 Timeline/Render 표시 이름은 편집기 값을 유지하고 visibility, source fingerprint와 drawable 같은 PSD source 내용만 갱신한다.
- 매칭 우선순위는 현재 Refresh 실행 안에서만 `유일한 sourcePath → 유일한 fingerprint → 유일한 legacy 이름`을 사용한다.
- 모호한 중복 후보는 임의로 연결하지 않는다. 저장 가능한 stable identity는 다음 Sprint Task의 범위다.
- 새 source의 맨 위 삽입과 NEW 승인 정책은 이번 Task에서 변경하지 않았다.

### 1.3 Stable Source Identity 실제 구현 상태

2026-07-17 기준으로 저장 가능한 Stable Source Identity가 제품 코드에 적용됐다.

- Layer와 Composition은 optional Plain Data `sourceIdentity: { sourceFileName, sourceKey }`를 저장한다.
- ag-psd가 읽은 Photoshop `Layer.id`가 문서 안에서 유일하면 `sourceKey = layer-id:<id>`를 사용한다.
- ID가 없거나 중복이면 충돌하지 않는 `legacy-tree:<원본 traversal key>`를 명시적으로 사용한다.
- Preview Plan의 `sourceKey`와 Confirm 결과의 `sourceIdentity.sourceKey`가 같으므로 Preview 이름·부모·순서 변경이 identity를 바꾸지 않는다.
- Refresh는 identity가 있는 기존 노드를 `sourceKey`로만 찾고 표시 이름, 현재 부모 path, fingerprint fallback을 사용하지 않는다.
- identity가 없는 과거 프로젝트 노드는 기존 유일 legacy matching을 사용하며 성공한 경우 refreshed identity를 채워 이후 Refresh부터 stable matching으로 승격한다.
- Main Composition은 `document` key를 사용한다. matching은 이미 선택된 Main source 범위 안에서 수행하므로 파일명이 바뀌어도 layer key를 우선한다.
- NEW 처리와 Refresh 결과 UI는 이번 Task에서 변경하지 않았다.

### 1.4 Import Settings 실제 구현 상태

2026-07-17 기준으로 저장 및 Refresh 재사용이 가능한 Import Settings가 제품 코드에 적용됐다.

- Main Composition은 optional Plain Data `importSettings: { compositionName, hiddenLayerMode }`를 저장한다.
- Prepare Plan은 기본 설정을 `settings`에 담고 Confirm은 해당 설정을 normalize한 뒤 builder에 적용한다.
- `compositionName`은 최초 Import 결과의 Main Composition 표시 이름에 적용한다.
- `hiddenLayerMode`는 `preserve | omit`이며, `omit`이면 숨김 Layer와 숨김 Group 전체를 Import/Refresh build 대상에서 제외한다.
- Refresh Controller는 기존 Main Composition의 저장 설정을 읽어 같은 설정으로 PSD를 build한 뒤 identity merge를 수행한다.
- 설정이 없는 과거 프로젝트는 현재 Composition 이름과 `preserve`를 기본값으로 사용한다. Refresh 성공 결과에는 정규화된 설정이 저장되어 이후부터 같은 값을 재사용한다.
- 설정 객체는 문자열 union과 문자열만 가진 Plain Data이며 History/JSON 직렬화에 runtime resource를 포함하지 않는다.
- 이번 Task는 설정 입력 UI를 추가하지 않았다. 현재 Preview는 기본값을 사용하며 추가 UI는 별도 범위다.
- NEW 처리와 Refresh 결과 UI는 변경하지 않았다.

### 1.5 NEW Layer/Group 실제 구현 상태

2026-07-17 기준으로 Refresh 신규 source 처리와 사용자 승인이 제품 코드에 적용됐다.

- Stable Source Identity가 기존 Project data에 없는 직접 Layer/Group을 신규 source로 감지한다.
- 새 Group과 Layer는 대응하는 현재 편집기 부모의 `children`/`layers` 맨 위에 추가한다.
- 같은 부모에 새 Group과 Layer가 함께 들어오면 PSD의 새 source 상대 순서를 유지한 채 기존 Timeline/Render item보다 앞에 배치한다.
- 새 Group 내부 전체 Composition/Layer subtree는 `sourceSyncStatus = "new"`로 저장한다.
- 기존 Group에 새 Layer가 생기면 해당 편집기 Group의 Layer, Timeline과 Render 맨 위에 함께 추가한다.
- PSD Tree의 새 Group과 Timeline의 새 Layer/Group에는 `NEW` 배지를 표시한다.
- PSD Tree에서 Group을 실제 선택하거나 Timeline에서 새 Layer/Group을 활성화하면 해당 source만 `new → normal`로 승인한다.
- 승인은 Project Composition Plain Data만 갱신하며 History snapshot을 만들지 않는다.
- 승인하지 않은 `new` 상태는 다음 Refresh에서도 유지되고 JSON 저장/복원 가능한 Plain Data에 남는다.
- Refresh 결과 요약 UI와 Sprint QA는 이번 Task에서 변경하지 않았다.

### 1.6 Refresh 결과 요약 실제 구현 상태

2026-07-17 기준으로 Refresh delta 집계와 비차단 결과 카드가 제품 코드에 적용됐다.

- Project Engine은 `newGroups`, `newLayers`, `updated`, `missing`, `deletePending`을 Refresh merge 과정에서 Plain Data 숫자로 집계한다.
- `problematic`은 현재 Refresh의 `missing + deletePending`으로 계산해 별도 source 상태를 중복 저장하지 않는다.
- 새 Group subtree는 Group과 Layer 개수를 분리하고, 기존 NEW/updated 상태가 남아 있다는 이유만으로 다음 Refresh에 중복 집계하지 않는다.
- 성공한 Refresh command는 Composition ID/이름과 집계를 포함한 `PsdRefreshSummary`를 반환한다.
- PSD Tree Engine은 가장 최근 성공 결과 한 건만 UI session state에 보관한다.
- PSD Tree의 비모달 결과 카드는 여섯 개 수치와 문제 개수를 표시하고, 모든 수치가 0이면 `변경 사항 없음`을 표시한다.
- 카드는 수동으로 닫을 수 있고 8초 뒤 자동으로 사라져 Tree 작업과 입력을 막지 않는다.
- 새 Refresh 시작, Main 삭제 또는 카드 닫기 시 이전 결과를 폐기하므로 결과는 완료 뒤 한 번만 표시된다.
- Refresh 실패나 source 재선택 대기에는 성공 요약을 표시하지 않는다.
- Import Settings 추가 UI는 현재 Sprint 범위 밖으로 남겼다. Sprint 통합 QA 결과는 1.7에 기록한다.

### 1.7 Sprint 통합 QA 결과

2026-07-17 기준 PSD Tree Completion Sprint의 통합 QA를 완료했다.

- Preview Prepare는 Project records와 History를 바꾸지 않고, Confirm만 Composition/Timeline/Render를 일괄 교체한다. Cancel은 token과 parsed runtime을 폐기한다.
- Preview Plan은 JSON 직렬화 가능한 Plain Data이며 `File`, parsed PSD, ag-psd node map은 token 기반 runtime store에만 존재한다. Prepare와 Confirm 사이 parse는 한 번만 실행된다.
- Duplicate Rename, reparent/reorder, 순환 방지와 원본 parsed PSD 불변을 확인했다.
- Photoshop layer ID identity로 표시 이름, PSD 부모와 PSD 순서가 바뀌어도 기존 편집기 계층·이름·순서가 유지된다. identity 없는 legacy data는 유일한 fallback match 성공 시 identity와 기본 Import Settings를 채운다.
- 저장 Import Settings를 Refresh builder가 재사용하며 숨김 처리 정책과 Composition 표시 이름을 유지한다.
- 새 Group/Layer는 편집기 부모의 맨 위에 추가되고 Timeline/Render가 같은 순서와 source ID를 사용한다.
- NEW 승인은 History snapshot을 만들지 않고 해당 Composition Plain Data만 바꾼다. 승인 전 NEW는 반복 Refresh에도 유지되고, 승인 후에는 다시 NEW가 되지 않는다.
- Refresh summary는 이번 merge delta에서만 계산한 transient Plain Data 한 건이며, 기존 source status를 복제해 저장하지 않는다. 반복 Refresh의 무변경 결과는 모두 0이다.
- Confirm과 Refresh는 구조 전체가 바뀐 뒤 stale undo snapshot이 적용되지 않도록 현재 정책대로 Composition History를 초기화한다. Prepare, Cancel과 NEW 승인은 History를 증가시키지 않는다.
- 14개 검증 스크립트, lint, production build, 전체 QA와 diff whitespace 검사를 통과했다.

통합 QA에서 Sprint 기능의 release-blocking 결함은 발견되지 않았다. 다만 다음 한계는 남아 있다.

- Photoshop layer ID가 없거나 중복인 PSD는 `legacy-tree` key를 사용하므로 원본 PSD의 계층 자체가 크게 바뀌면 stable identity 보장이 약해진다.
- Import Settings 입력 UI는 이번 Sprint 범위가 아니어서 현재 Preview는 기본값을 사용한다.
- 실제 PSD picker, Preview pointer drag/drop과 결과 카드의 브라우저 smoke test는 인앱 브라우저가 연결되지 않아 자동 실행하지 못했다.
- 프로젝트 persistence가 아직 없어 Plain Data 저장 계약은 준비됐지만 reload 저장/복원 제품 흐름은 제공하지 않는다.
- 기존 History snapshot은 runtime RenderItem의 canvas 참조를 보유한다. Refresh가 History를 초기화해 이번 Sprint와 충돌하지는 않지만 Plain Data/Runtime 경계를 더 엄격히 하려면 Render runtime을 snapshot에서 분리하는 후속 리팩토링이 필요하다.

## 2. 구현 전 구조와 변경 기준

### 2.1 현재 Import 흐름

```text
PsdTree Import 버튼
  → usePsdPickerController
  → File System Access picker 또는 hidden file input
  → File/FileHandle을 PsdImportSource로 변환
  → Project Engine handleImportPsdFiles
  → usePsdImportController
  → importPsdSourcesIntoProject
  → loadPsd(parse + composition build)
  → 기존 record 교체 및 source runtime binding 등록
```

이 흐름은 1단계 구현 전 상태다. 현재는 picker 뒤에 Prepare와 Preview가 추가됐으며, 같은 파일명 교체 판단과 기존 Import 후처리는 Confirm commit 시점에 그대로 수행한다.

### 2.2 PSD Tree Controller / Engine / View 책임

| 구분 | 현재 책임 |
|---|---|
| `PsdTree.tsx` | Import 버튼, hidden file input, Tree 렌더와 DOM event 전달 |
| `PsdTreeNode.tsx` | 노드 표시, 선택, Main Composition refresh/delete/reorder UI |
| `usePsdTreeEngine.ts` | PSD Tree state와 picker/source action/selection/reorder Controller 조립, ViewProps 생성 |
| `usePsdPickerController.ts` | picker 선택, browser fallback, Import와 Refresh picker mode 구분, 선택 직후 Project command 호출 |
| `useSourceActionController.ts` | Refresh/Delete 의도를 Project command로 전달 |
| `useTreeSelectionController.ts` | Composition 선택 의도 전달 |
| `useTreeReorderController.ts` | drag/drop session과 reorder command 연결 |
| `usePsdTreeState.ts` | file input ref, picker mode, drag/drop UI session 보관 |
| PSD Tree helper/adapter | 파일을 `PsdImportSource`로 변환하고 Tree ViewModel/drop 위치를 순수 계산 |

PSD Tree는 프로젝트 records를 직접 수정하지 않는다. 다만 picker Controller가 `선택`과 `Import 확정 요청`을 한 단계로 처리하고 있다.

### 2.3 Project Engine과의 연결

`useEditorCompositionRoot.ts`가 두 Engine을 다음 port로 연결한다.

```text
Project Selection ReadModel.rootComps
  → PSD Tree read port

Project Engine
  ├─ handleImportPsdFiles
  ├─ handleRefreshMainComp
  ├─ handleDeleteMainComp
  └─ handleReorderMainComps
       → PSD Tree command port
```

`useProjectPsdEngine.ts`는 Source, Import, Refresh, Library, Navigation Controller를 조립한다. Import Controller는 parsing 결과를 프로젝트 records로 확정하고 History/source binding/selection/notice까지 함께 처리한다.

### 2.4 현재 Refresh 구조

```text
Tree의 Refresh 클릭
  → Project Engine refreshMainComp(mainCompId)
  → 저장된 FileHandle에서 최신 File 확인
  ├─ 성공: loadPsd → 기존 Main Composition에 merge
  └─ 실패: needsSource 반환
       → PSD Tree가 단일 파일 picker 표시
       → 선택한 source로 Refresh 재요청
```

Refresh merge는 기존 Layer/Composition 편집값을 가능한 한 유지하면서 PSD 원본에서 바뀐 항목을 갱신한다. matching은 현재 이름 기반 `sourcePath` map을 중심으로 한다.

Source binding의 `File`과 `FileHandle`은 직렬화 대상이 아닌 session runtime resource이며 Main Composition ID를 key로 보관된다.

## 3. 현재 문제점

### 3.1 Import 설정을 끼울 중간 상태가 없다

`usePsdPickerController.ts`는 파일 선택 직후 `importPsdSources()`를 호출한다. PSD Tree command port에도 Prepare/Confirm/Cancel이 없고, PSD Tree state에도 분석 결과·설정 draft·진행 상태가 없다.

### 3.2 parse와 build가 결합돼 있다

`loadPsd()`는 File parse와 Composition/Timeline/Render record 생성을 한 번에 수행한다. 현재 함수로 Dialog용 분석을 먼저 실행하면 Confirm 때 같은 PSD를 다시 parse하거나, 비직렬화 객체를 UI state에 넘겨야 한다.

### 3.3 Import Settings 경계가 필요했다

1단계 당시에는 파일명을 Composition 이름으로 쓰고 숨김 레이어를 항상 유지하는 정책이 builder에 고정돼 있었다. 현재는 Confirm/Refresh가 동일한 normalize와 builder 설정 경계를 사용한다.

### 3.4 충돌 판단이 표시 이름에 의존한다

현재 같은 `comp.name === file.name`이면 교체 대상으로 본다. 사용자가 Composition 이름을 바꾸거나 서로 다른 경로에 같은 이름의 PSD가 있으면 Source Identity와 충돌 판단이 어긋날 수 있다.

### 3.5 Refresh identity가 중복 이름에 약하다

현재 `sourcePath`는 정리된 레이어 이름의 계층 경로다. 같은 부모 아래 같은 이름의 형제 레이어가 있으면 같은 path가 생겨 map matching이 충돌할 수 있다.

### 3.6 설정 저장 위치가 필요했다

Dialog에서 정한 정책을 UI state에만 두면 Refresh가 최초 Import와 다른 결과를 만들 수 있다. 현재는 Main Composition의 Plain Data에 저장하고 Refresh 소비 시 normalize한다.

### 3.7 여러 파일의 Confirm 의미가 정의돼 있지 않다

현재 여러 PSD Import는 성공 파일을 반영하고 실패 파일을 notice/error로 보고하는 부분 성공 방식이다. Dialog에서도 파일별 분석·충돌·설정과 Confirm 결과를 명시해야 한다.

## 4. 확정된 제품 정책

### 4.1 Import Preview 화면

파일 선택 직후 Project records를 변경하지 않고 `Import Preview`를 연다. Preview는 설정 몇 개만 보여주는 확인창이 아니라, 이번 Import 결과 전체를 미리 구성하는 화면이다.

Preview 상단에는 PSD별로 다음 정보를 표시한다.

- PSD 파일 이름
- PSD width × height
- 전체 그룹 수
- 전체 일반 레이어 수

Preview 본문에는 PSD의 그룹과 레이어를 생략하지 않은 전체 Tree로 표시한다. 여러 PSD를 한 번에 선택한 경우 각 파일의 정보와 Tree를 구분해서 검토할 수 있어야 하며, Confirm은 현재 Plan에 포함된 파일만 대상으로 한다.

```text
캐릭터.psd
2048 × 2048 · 그룹 2 · 레이어 7

얼굴
 ├─ 눈_1
 ├─ 눈_2
 ├─ 코
 └─ 입
몸
 ├─ 팔
 └─ 다리
```

분석 중에는 loading 상태를 표시하고, 분석에 실패한 파일은 다른 파일의 Preview와 구분해 오류를 보여준다. Preview가 열려 있는 동안 Project records와 History는 바뀌지 않는다.

### 4.2 중복 이름 처리

같은 부모 안에서 정규화된 원본 이름이 같은 형제 노드가 둘 이상이면 모든 중복 노드에 `_1`, `_2`, `_3` 순서로 suffix를 붙인다. 첫 번째 노드도 suffix 없는 이름을 유지하지 않고 반드시 `_1`부터 시작한다.

```text
눈
눈
눈

→ 눈_1
  눈_2
  눈_3
```

- 비교 범위는 같은 부모의 직계 자식만이다.
- 그룹과 레이어를 포함한 형제 이름 전체를 대상으로 한다.
- suffix 순서는 현재 Preview Tree의 위에서 아래 순서를 따른다.
- Preview에서 다른 부모로 이동해 중복 관계가 달라지면 이름을 다시 계산한다.
- 자동 변경된 이름은 Preview에서 빨간색으로 표시한다.
- 빨간색은 경고를 위한 View 표현이며 저장 데이터에는 색상 값을 넣지 않는다.
- Confirm 후에는 계산된 표시 이름을 프로젝트 이름으로 저장한다.
- 원본 PSD의 이름과 source identity는 별도로 유지하므로 표시 이름이 바뀌어도 Refresh matching에 사용하지 않는다.

Preview node는 `originalName`, 확정 후보인 `displayName`, `autoRenamed`를 분리해 표현하는 것이 안전하다. 이름 충돌 처리는 UI가 직접 계산하지 않고 Project Engine이 만든 Plan과 순수 helper 결과를 사용한다.

### 4.3 Preview Tree 편집

Import 전 Preview에서는 다음 작업을 허용한다.

- 같은 부모 안에서 레이어 순서 변경
- 같은 부모 안에서 그룹 순서 변경
- 레이어를 다른 그룹 또는 root로 이동
- 그룹을 다른 그룹 또는 root로 이동

그룹을 자기 자신이나 자신의 자손 안으로 이동하는 순환 구조는 금지한다. 이동 결과는 `PsdImportPlan`의 Plain Data Tree draft에만 반영한다.

원본 `File`, parsed PSD와 ag-psd node는 읽기 전용 runtime resource로 유지한다. Preview drag/drop은 이 객체들의 `children`, 이름, 순서를 절대 수정하지 않는다. Plan node가 가진 source identity로 원본 runtime node를 참조하고, Confirm 시 Plan의 계층과 순서를 사용해 Project records를 새로 만든다.

Cancel하면 편집한 Preview Tree와 prepared runtime resource를 모두 폐기하며 원본 PSD와 현재 프로젝트에는 아무 변화도 남기지 않는다.

### 4.4 Import 이후 기준 구조

Confirm 이후에는 Preview에서 확정한 Tree가 편집기의 PSD Tree와 Project records에 반영된다.

- 그룹 계층은 `Composition.children` 관계로 저장한다.
- 같은 Composition 안의 그룹/레이어 혼합 순서는 `TimelineItem`과 대응 Render 순서에 저장한다.
- Preview에서 이동한 노드의 source identity는 유지한다.
- 저장되는 계층, 순서, 이름과 NEW 확인 상태는 모두 Plain Data여야 한다.

즉, Import 이후의 구조적 기준은 더 이상 PSD의 현재 배열 순서가 아니라 편집기의 Project data다. PSD 원본은 이후 Refresh에서 그림 내용과 원본 속성을 공급하는 역할을 한다.

### 4.5 Refresh 순서와 그룹 정책

Refresh는 기존 노드의 편집기 순서와 그룹 배치를 유지한다.

```text
최초 Import 후 편집기: A → B → C
Refresh 시 PSD 순서:    C → A → B
Refresh 후 편집기:      A → B → C
```

- PSD에서 기존 레이어나 그룹의 순서만 바뀐 경우 이를 무시한다.
- Preview 또는 편집기에서 다른 그룹으로 옮긴 기존 노드는 PSD의 원래 부모로 돌아가지 않는다.
- image/canvas, visibility, opacity, source fingerprint 등 PSD에서 공급되는 내용과 속성만 갱신한다.
- 기존 노드를 찾는 기준은 표시 이름이나 현재 부모 path가 아니라 stable source identity를 우선한다.
- 기존 노드의 표시 이름과 작업용 계층은 사용자의 Project data를 우선한다.
- 기존 missing/deletePending 정책은 유지하되, 순서 보존과 별개의 상태 처리로 본다.

Refresh merge는 `refreshed order에 기존 노드를 맞추는 계산`이 아니라 `기존 editor order의 각 노드에 refreshed source 내용을 덮어쓰는 계산`이어야 한다.

### 4.6 새 레이어와 NEW 상태

Refresh에서 source identity가 기존 Project data에 없는 레이어를 발견하면 해당 PSD 부모 그룹에 대응하는 편집기 폴더의 맨 위에 추가한다.

- 대응하는 기존 그룹이 있으면 그 그룹의 첫 번째 Timeline/Render 위치에 넣는다.
- 부모 그룹 자체가 새 그룹이면 새 그룹을 가장 가까운 기존 부모의 맨 위에 추가하고 그 내부 PSD 구조를 유지한다.
- 새 레이어의 원본 이름은 변경하지 않는다. 중복 이름 자동 suffix는 Import Preview 정책이며 Refresh로 들어온 새 레이어에는 적용하지 않는다.
- 새 레이어에는 프로젝트에 저장되는 `new` source 상태를 부여하고 View에서 `NEW` 배지로 표시한다.
- 사용자가 PSD Tree 또는 같은 selection command를 사용하는 화면에서 해당 레이어를 선택하면 `new → normal`로 바꾼다.
- NEW 해제는 단순 hover가 아니라 실제 선택 intent가 성공했을 때만 수행한다.
- NEW 상태와 해제 결과는 Project Plain Data에 남아 저장/복원 후에도 다시 나타나지 않아야 한다.
- 선택만으로 Undo stack을 불필요하게 늘리지 않도록 NEW 확인은 편집 History와 분리된 source 상태 승인으로 처리한다.

새 레이어를 맨 위에 둔다는 의미는 `Composition.layers` 배열 하나만 앞에 넣는 것이 아니다. 해당 owner Composition의 Timeline과 Render order도 같은 source 순서가 되도록 함께 갱신해야 한다.

## 5. 추천 책임 구조

### 5.1 Project Engine

Project Engine이 다음을 소유한다.

- PSD를 한 번 parse하고 분석 결과를 만든다.
- 기존 프로젝트와의 충돌을 판정한다.
- Plain Data `PsdImportPlan`을 만든다.
- Confirm 시 Plan이 아직 유효한지 다시 검사한다.
- 확정된 settings를 builder에 전달하고 Project records를 원자적으로 갱신한다.
- Main Composition에 Import Settings와 Source Identity를 Plain Data로 저장한다.
- Refresh가 저장된 settings와 identity를 사용하도록 한다.
- Preview Tree의 중복 이름과 이동 결과를 검증하고 Confirm build에 적용한다.
- Refresh에서 기존 editor 계층/순서를 보존하고 새 source만 부모의 맨 위에 추가한다.
- NEW 상태를 저장하고 selection 이후 승인하는 command를 제공한다.
- Cancel 또는 완료 시 준비 과정의 runtime resource를 폐기한다.

### 5.2 PSD Tree Engine

PSD Tree Engine은 다음 UI session만 소유한다.

- `idle → picking → analyzing → review → importing` 상태
- Project Engine이 반환한 Plain Data Plan
- Dialog에서 편집 중인 settings draft
- 여러 파일 중 현재 표시 항목과 파일별 validation 상태
- Confirm/Cancel command 전달
- loading/error/Dialog ViewModel
- Preview Tree drag/drop session과 drop intent
- 자동 변경 이름과 NEW badge의 화면용 ViewModel

`File`, `FileHandle`, ag-psd node, canvas 같은 runtime resource는 PSD Tree state에 저장하지 않는다.

### 5.3 View

새 Import Dialog View는 다음만 담당한다.

- 파일 정보와 분석 결과 표시
- PSD 전체 Tree, 자동 변경된 빨간색 이름과 drag/drop 위치 표시
- 설정 input과 충돌 선택지 표시
- Confirm/Cancel 버튼과 비활성 상태 표시
- DOM event를 PSD Tree ViewProps command로 전달

View가 collision을 판단하거나 Project data를 직접 바꾸지 않는다.

### 5.4 Composition Root

Composition Root는 다음 공개 port를 연결한다.

```text
Project.preparePsdImport  → PSD Tree
Project.confirmPsdImport  → PSD Tree
Project.cancelPsdImport   → PSD Tree
```

Plan 생성, 설정 보정, 충돌 판단은 Composition Root에 넣지 않는다.

## 6. 데이터 설계

### 6.1 Project에 저장하는 Plain Data

```ts
type PsdImportSettings = {
  compositionName: string;
  hiddenLayerMode: "preserve" | "omit";
};

type PsdSourceIdentity = {
  sourceFileName: string;
  sourceKey: string;
};
```

첫 버전에서는 실제로 Refresh 결과에 영향을 주는 설정만 저장한다. 충돌 시 `replace` 또는 `import-copy` 같은 선택은 일회성 Confirm 명령이므로 장기 설정에 넣지 않는다.

`compositionName`은 표시 이름이고 `sourceKey`는 source identity다. Refresh와 충돌 판단은 표시 이름이 아니라 source identity를 우선해야 한다.

기존 프로젝트에서 새 필드가 없을 수 있으므로 normalize가 기본 설정과 legacy matching 상태를 채워야 한다. 애매한 중복 identity를 임의로 하나에 연결하지 않고 warning 대상으로 남긴다.

### 6.2 Dialog에 전달하는 Plain Data Plan

```ts
type PsdImportPlanNode = {
  id: string;
  sourceKey: string;
  kind: "group" | "layer";
  originalName: string;
  displayName: string;
  autoRenamed: boolean;
  children: PsdImportPlanNode[];
};

type PsdImportAnalysis = {
  fileName: string;
  width: number;
  height: number;
  layerCount: number;
  groupCount: number;
  hiddenLayerCount: number;
  warnings: PsdImportWarning[];
  conflict: PsdImportConflict | null;
};

type PsdImportPlanEntry = {
  token: string;
  analysis: PsdImportAnalysis;
  settings: PsdImportSettings;
  tree: PsdImportPlanNode[];
};

type PsdImportPlan = {
  entries: PsdImportPlanEntry[];
};
```

Plan은 UI와 Project Engine 경계를 건너므로 Plain Data로 유지한다. `token`은 Project Engine 내부의 준비된 runtime resource를 가리키는 불투명한 session ID다.

Plan의 `tree`가 Preview에서 편집되는 대상이다. node `id`는 drag session 식별자이고 `sourceKey`는 원본 runtime node와 Confirm/Refresh를 연결하는 identity다. 두 값을 화면 이름으로 만들지 않는다.

### 6.3 Project Engine 내부 runtime 준비 데이터

```ts
type PreparedPsdImport = {
  source: PsdImportSource;
  parsedPsd: Psd;
  analysis: PsdImportAnalysis;
  sourceNodeByKey: Map<string, PsdLayer>;
};
```

Project Engine 내부 ref/map이 `token → PreparedPsdImport`를 보관한다. 이렇게 하면 PSD를 한 번만 parse하고 Confirm에서 parsed PSD를 재사용할 수 있다. 이 데이터는 저장하거나 History snapshot에 넣지 않는다.

Cancel, Confirm 완료, Engine unmount 때 반드시 제거한다. 없는 token이나 프로젝트 상태가 바뀐 stale plan은 Confirm에서 typed failure로 반환한다.

### 6.4 NEW 상태 저장

기존 `SourceSyncStatus`의 `new`를 새 레이어 확인 전 상태로 사용한다. 별도의 View 전용 boolean을 중복 저장하지 않는다.

```text
Refresh에서 새 source 발견
  → Layer.sourceSyncStatus = "new"
  → PSD Tree ViewModel에서 NEW badge 표시
  → Layer 선택 command
  → acknowledge source status
  → Layer.sourceSyncStatus = "normal"
```

과거 프로젝트에서 status가 없으면 normalize 결과는 `normal`이다.

## 7. Source Identity와 Refresh 설계

### 7.1 identity 원칙

- 화면 이름과 matching identity를 분리한다.
- `sourcePath`는 표시·debug용 legacy 정보로 유지할 수 있다.
- 새 `sourceIdentity`는 layer kind, 계층, 같은 이름의 occurrence를 포함해 형제 중복을 구분한다.
- PSD 포맷에서 안정적으로 재사용 가능한 layer ID가 확인되면 그 값을 우선하고, 없을 때 계층 identity를 사용한다.
- Preview에서 이름, 순서, 부모가 바뀌어도 source identity는 바뀌지 않는다.
- Refresh matching은 identity가 불확실할 때 조용히 잘못 합치지 않는다.

MVP matching 우선순위는 다음과 같다.

1. 저장된 stable source identity 정확히 일치
2. 중복이 없는 legacy sourcePath 일치
3. kind/name/계층 fingerprint와 가까운 원본 순서가 유일하게 일치
4. 불확실하면 새 source 또는 warning으로 처리

### 7.2 Refresh에서 settings와 editor structure 재사용

```text
Refresh 요청
  → source binding으로 최신 File 확보
  → Main Composition의 저장된 Import Settings 읽기
  → 같은 settings로 parse/build
  → 프로젝트 전체에서 source identity 우선 matching
  → 기존 editor parent/order 위치에서 source 내용 갱신
  → 신규 identity만 대응 폴더 맨 위에 추가
```

Refresh는 일반적으로 Import Dialog를 다시 열지 않는다. source를 다시 선택해야 할 때는 선택 파일이 기존 identity와 맞는지 검증하고, 다르면 `source 재연결` 확인을 별도로 보여주는 것이 안전하다.

Import Settings를 나중에 바꾸는 기능은 Refresh에 암묵적으로 섞지 않고 `설정을 바꿔 다시 Import`하는 별도 명령으로 추가한다.

## 8. Confirm / Cancel 정책

### Confirm

- Project Engine이 token 존재 여부와 현재 충돌 상태를 다시 검사한다.
- entry별 settings를 normalize/validate한다.
- Preview Tree의 순환 구조, 빠진 source key, 중복 node와 유효하지 않은 이동을 검증한다.
- 확정된 Tree의 계층, 혼합 순서와 display name으로 records를 build한다.
- 현재 방식과 맞춰 성공 entry는 반영하고 실패 entry는 구체적인 결과로 반환한다.
- 성공한 entry만 source binding을 등록하고 준비 데이터를 제거한다.
- Project records, selection, history reset, notice 갱신은 기존 Import Controller가 한 commit 경계에서 처리한다.
- PSD Tree는 성공 결과를 받은 뒤 Dialog를 닫는다. 일부 실패면 실패 entry를 Dialog에 남긴다.

### Cancel

- Project records와 History를 변경하지 않는다.
- Project Engine의 준비 token을 모두 폐기한다.
- PSD Tree의 Plan과 draft를 초기화하고 `idle`로 돌아간다.

## 9. 변경해야 하는 파일별 책임

아래 표는 1단계에서 실제 반영된 파일과 후속 단계에 남은 책임을 함께 표시한다.

### 공유 Domain

| 파일 | 추천 책임 |
|---|---|
| `src/models/psdSourceIdentityModel.ts` 신규·구현 | 저장 가능한 source file name과 stable source key Plain Data 타입 |
| `src/models/psdImportSettingsModel.ts` 신규·구현 | Composition 표시 이름과 숨김 source 처리 정책 Plain Data 타입 |
| `src/models/compositionModel.ts` 구현 | Layer/Composition source identity와 Main Composition optional Import Settings 연결 |
| Project normalize 경로 구현 | identity 없는 데이터는 legacy match 후 승격하고 settings 없는 데이터는 현재 이름 + `preserve`로 Refresh 시 승격 |

### Project Engine

| 파일 | 추천 책임 |
|---|---|
| `src/engines/project/import/psdImportAnalyzer.ts` 신규 | parsed PSD에서 크기/count/warning, 전체 Tree와 중복 이름 후보를 만드는 순수 분석 |
| `src/engines/project/import/psdImportSettingsHelpers.ts` 신규·구현 | 기본 Import Settings 생성과 unknown/legacy 설정 normalize |
| `src/engines/project/models/psdImportPlanModel.ts` 신규 | Plan, conflict, typed prepare/confirm 결과와 내부 prepared entry 계약 |
| `src/engines/project/state/preparedPsdImportStore.ts` 신규·구현 | token별 runtime prepared resource의 등록/조회/폐기 순수 store |
| `usePsdImportController.ts` 구현 | prepare/cancel orchestration과 Confirm된 Plan의 기존 Project records commit |
| `useProjectPsdEngine.ts` | Preparation과 Import Controller를 port로 조립하고 prepare/confirm/cancel façade 공개 |
| `psdLoader.ts` | 기존 즉시 Import 호환 경로 유지. Prepare는 parser를 직접 호출 |
| `psdCompositionBuilder.ts` 구현 | parsed PSD 또는 Preview Plan과 정규화된 settings로 동일한 records 생성, 이름/숨김 정책 적용 |
| `psdLayerConverter.ts` 구현 | Preview display name과 확정 source identity를 Layer에 적용 |
| `psdImportProjectHelpers.ts` | Confirm된 entry를 records로 만드는 순수 계산 유지, UI 판단 제거 |
| `usePsdRefreshController.ts` | 저장 settings를 builder에 전달하고 identity 기반 merge 호출 |
| `psdRefreshResultModel.ts` 구현 | 신규 종류/updated/missing/deletePending과 성공 command summary Plain Data 계약 |
| `psdSourceMatchingHelpers.ts` 구현 | source key identity-only matching, identity 없는 legacy fallback과 ambiguous 결과 구분 |
| `psdCompositionMergeHelpers.ts` 구현 | 기존 editor 구조 보존, 신규 Layer/Group과 Timeline/Render 맨 위 추가 |
| `psdSourceCleanupHelpers.ts` 구현 | Timeline source와 Composition 선택의 NEW 상태를 Plain Data에서 승인 |
| `useProjectNavigationController.ts` 구현 | Group 진입 성공 시 History 없이 NEW 승인 command 실행 |
| `usePsdSourceSyncController.ts` 구현 | Timeline Layer/Group 선택 뒤 NEW 상태 승인 command 연결 |
| `psdSourceRuntimeModel.ts` | File/FileHandle session binding만 유지. 저장 설정을 넣지 않음 |

### PSD Tree Engine

| 파일 | 추천 책임 |
|---|---|
| `psdTreeModel.ts` 구현 | Plan/Dialog/전체 Tree/NEW badge ViewModel과 Project prepare/confirm/cancel port |
| `usePsdTreeState.ts` 구현 | Plan/Dialog와 가장 최근 Refresh summary 한 건의 UI session state |
| `usePsdPickerController.ts` | 선택 후 즉시 Import 대신 `preparePsdImport` 호출. picker 책임 유지 |
| `useSourceActionController.ts` 구현 | Refresh 결과를 한 번만 summary session에 반영하고 새 요청/삭제 시 폐기 |
| `usePsdImportDialogController.ts` 신규 | draft 변경, Tree 이동, Confirm, Cancel, entry 전환과 validation intent 처리 |
| 별도 Dialog ViewModel helper | 1단계에서는 Plan이 이미 표시 계약이라 만들지 않음 |
| `psdImportPlanTreeHelpers.ts` 신규·구현 | node 이동, 순환 방지, 같은 부모 중복 이름 재계산 순수 helper |
| `usePsdTreeEngine.ts` | Picker/Dialog Controller 조립과 Dialog ViewProps 공개 |

### View와 연결부

| 파일 | 추천 책임 |
|---|---|
| `src/features/psdtree/components/PsdImportPreviewDialog.tsx` 신규·구현 | PSD 정보, 전체 Tree, 빨간 자동 이름, drag/drop, Confirm/Cancel 렌더 |
| `src/features/psdtree/components/PsdImportPreviewNode.tsx` 신규·구현 | Preview node와 drop 위치 렌더. Project mutation 없음 |
| `PsdTree.tsx` | Tree 위에 Dialog를 mount하고 ViewProps 전달 |
| `PsdTreeNode.tsx` 구현 | Group source status에 따른 `NEW` 배지 렌더와 실제 선택 intent 전달 |
| `PsdRefreshSummaryCard.tsx` 신규·구현 | 여섯 개 결과 수치/무변경 상태, 수동 닫기와 8초 자동 닫기 비모달 UI |
| `useEditorCompositionRoot.ts` | Project prepare/confirm/cancel façade를 PSD Tree port에 연결만 함 |
| `20_src_map.md` | 실제 파일 추가 및 책임 변경 후 지도 갱신 |

## 10. 추천 구현 순서

1. 완료: Plain Data `PsdImportPlanNode`, 분석/settings 제안, Plan/result 계약을 추가한다.
2. 완료: parse 1회, prepared runtime store, Plan 기반 builder와 기존 Import 회귀 검증을 추가한다.
3. 완료: Project prepare/confirm/cancel과 PSD Tree Preview session을 공개 port로 연결한다.
4. 완료: 중복 이름 분석, Preview 이동/순환 방지 helper와 Dialog View를 추가한다.
5. 완료: legacy best-effort matching으로 Refresh가 기존 editor 계층/순서와 표시 이름을 보존하도록 한다.
6. 완료: Photoshop layer ID 기반 stable identity를 저장 Domain, Preview/Import builder와 Refresh matching에 연결하고 legacy 프로젝트를 안전하게 승격한다.
7. 완료: Import Settings Plain Data 저장, Import 적용, Refresh 재사용과 legacy normalize를 연결한다.
8. 완료: 신규 source를 대응 폴더 Timeline/Render 맨 위에 추가하고 NEW badge/선택 승인을 연결한다.
9. 완료: Refresh delta를 Plain Data로 집계하고 비차단 결과 요약 카드로 한 번 표시한다.
10. 완료: Sprint 통합 QA로 Preview부터 반복 Refresh, History, legacy 호환과 Plain Data/runtime 경계를 검증한다.

각 단계는 별도 검증이 가능한 작은 변경으로 나눈다. Dialog UI보다 parse/build 분리와 Plain Data 계약을 먼저 끝내야 UI가 임시 runtime data에 의존하지 않는다.

## 11. 구현 시 필수 검증 항목

- Prepare만으로 Project records와 History가 변하지 않는다.
- Confirm 한 번에만 Project records가 변경된다.
- Cancel은 project 변경 없이 prepared runtime resource를 제거한다.
- Prepare와 Confirm 사이에 PSD parse가 중복 실행되지 않는다.
- 같은 부모의 같은 이름 세 개가 Preview에서 `_1`, `_2`, `_3`으로 표시되고 모두 빨간 상태다.
- 중복 노드를 다른 부모로 옮기면 양쪽 부모의 자동 이름이 다시 계산된다.
- Preview에서 레이어/그룹 이동 후에도 parsed PSD node와 원본 PSD 순서는 변하지 않는다.
- 그룹을 자기 자손으로 옮기는 drop은 거부된다.
- Confirm 결과의 Composition 계층과 Timeline/Render 혼합 순서가 Preview와 같다.
- 같은 부모의 같은 이름 레이어가 Refresh에서 서로 바뀌지 않는다.
- PSD 순서를 `A,B,C → C,A,B`로 바꿔 Refresh해도 editor 순서는 `A,B,C`다.
- Preview에서 다른 그룹으로 옮긴 기존 레이어가 Refresh 후에도 editor 그룹에 남는다.
- 신규 레이어가 대응 폴더의 첫 Timeline/Render 위치에 추가된다.
- 신규 레이어 이름은 바꾸지 않고 NEW badge가 표시된다.
- 신규 레이어 선택 후 NEW 상태가 Plain Data에서 `normal`로 바뀌고 다시 나타나지 않는다.
- 저장된 Import Settings가 Refresh에도 동일하게 적용된다.
- Composition 표시 이름 변경 후에도 원본 source를 찾는다.
- stale token과 Confirm 직전 충돌 변경이 typed failure로 처리된다.
- 여러 파일 중 일부 실패 시 성공/실패 entry와 source binding이 일치한다.
- 과거 프로젝트가 normalize를 거쳐 기존 모습으로 열린다.
- File/FileHandle/parsed PSD/canvas가 Plain Data나 History에 들어가지 않는다.

관련 검증 위치는 `verifyPsdPipeline.ts`, `verifyPsdTreeHelpers.ts`, Engine import boundary 검증을 확장하는 방식이 적합하다.

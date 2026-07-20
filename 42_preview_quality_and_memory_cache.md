# Preview Quality & Memory Cache 설계

> 문서 번호: 42
> 상태: Sprint 완료 및 Canvas Drag 안정화 완료
> 범위: Canvas Preview 전용 bitmap 품질, 메모리 추정, runtime cache와 원본 Render 경계

## 1. 결론

새 Engine을 만들지 않는다.

- Project Engine은 Import/Refresh로 만든 원본 `RenderDrawable.canvas`와 source identity/fingerprint를 계속 소유한다.
- Canvas Engine은 Preview 전용 bitmap cache, 선택 품질과 cache lifecycle을 소유한다.
- Playback & Render Engine은 원본 drawable을 기본값으로 사용하고, Canvas가 명시적으로 전달한 preview source resolver가 있을 때만 Preview bitmap을 command에 넣는다.
- Properties 또는 Preview View는 품질 선택 의도만 Canvas Engine command로 전달한다.
- Composition Root는 기존 공개 port를 연결하며 bitmap 생성이나 품질 판단을 하지 않는다.

핵심 경계는 다음과 같다.

```text
원본 PSD parse
  → Project runtime RenderDrawable.canvas
     ├─ Export/원본 Render: 원본 canvas 사용
     └─ Canvas Engine Preview Cache
          → 품질별 ImageBitmap 생성
          → Canvas Preview만 bitmap 사용
```

원본 PSD, parsed PSD node와 원본 canvas의 픽셀·크기·이름·구조는 절대 수정하지 않는다.

### 1.1 Task 1 실제 구현 상태

2026-07-17 기준 Preview Quality Contract & Source Boundary가 제품 코드에 적용됐다.

- Canvas Engine에 Plain Data `PreviewQualityPreference`, `ResolvedPreviewQuality`와 단일 quality scale table을 추가했다.
- Canvas Engine 내부에 `PreviewBitmapRuntime`, `PreviewRuntimeResource` runtime-only 계약을 추가했다. bitmap image, logical/pixel size와 dispose port를 포함하지만 아직 생성하거나 cache하지 않는다.
- Playback & Render Engine에 `RenderDrawableSource`, `RenderDrawableSourceResolver`, `RenderSize` 계약을 추가했다.
- Render drawable command는 `logicalSize`와 `source.pixelSize`를 분리하고 source를 `original | preview`로 구분한다.
- `buildRenderFrame`과 `useRenderEngine`은 optional resolver를 받을 수 있다. resolver가 없거나 `null`을 반환하면 원본 `RenderDrawable.canvas`를 `original` source로 사용한다.
- Canvas 2D adapter는 source bitmap의 pixel 크기와 관계없이 logical destination 크기로 그린다.
- 현재 Canvas Composition은 resolver를 전달하지 않으므로 기존 Preview는 원본 source를 사용하는 이전 동작과 같다.
- Project Engine의 `RenderDrawable`, Project records, 공유 Domain, History와 Composition Root는 변경하지 않았다.
- Bitmap 생성, 메모리 계산, cache, 자동 품질, Canvas resolver 연결, UI와 Refresh 연동은 구현하지 않았다.

### 1.2 Task 2 실제 구현 상태

2026-07-17 기준 Memory Estimator가 Canvas Engine의 순수 helper로 구현됐다.

- `PreviewMemorySource`는 runtime `sourceId`, optional stable source identity와 원본 source pixel size만 받는다.
- stable source identity가 있으면 `[sourceFileName, sourceKey]` 조합을 dedupe key로 사용한다. identity가 없는 legacy source만 `sourceId`를 fallback key로 사용한다.
- source 하나, 프로젝트 전체, 네 resolved quality 전체의 pixel size와 RGBA 예상 bytes를 같은 scale table로 계산한다.
- 결과는 품질, scale, 고유 source 수, 합계 bytes와 source별 세부 결과를 포함하는 Plain Data read model이다.
- formatter는 1024 기준 `B / KB / MB / GB`를 반환하며 GB보다 큰 값도 GB 단위로 표시한다.
- `PreviewGeneration` runtime number 계약과 `PreviewRuntimeResource.generation` 필드를 추가했지만 generation 증가, bitmap 생성, cache commit/dispose 동작은 아직 구현하지 않았다.
- Project, Playback & Render, History, 공유 Domain, Canvas UI와 Composition Root는 변경하지 않았다.

### 1.3 Task 3 실제 구현 상태

2026-07-17 기준 Preview Bitmap Factory가 Canvas Engine에 구현됐다.

- factory는 원본 `HTMLCanvasElement`, quality, logical size와 resource metadata를 받아 `PreviewRuntimeResource` 성공/실패 결과를 반환한다.
- source canvas의 width/height에서 Task 2 estimator로 target pixel size와 예상 RGBA bytes를 계산한다.
- `createImageBitmap`이 지원되면 resize option으로 별도 `ImageBitmap`을 생성한다.
- 지원되지 않으면 새 `OffscreenCanvas`를 우선 만들고, 불가능한 환경에서는 새 HTML canvas에 source를 `drawImage`하는 fallback copy를 사용한다.
- `original` quality도 원본 canvas를 직접 반환하지 않는다. adapter가 원본과 같은 객체를 반환하면 `source-resource-reused` 실패로 거부한다.
- bitmap runtime은 source pixel size와 logical size를 분리하고, idempotent `dispose()`로 `ImageBitmap.close()` 또는 fallback canvas 해제를 한 번만 수행한다.
- primary 생성 오류, fallback 오류와 0 size는 resource를 만들지 않고 오류 결과를 반환한다. factory는 cache/state를 받지 않아 기존 Preview를 변경할 수 없다.
- Generation은 호출자가 전달한 number를 resource에 기록만 한다. 증가, 현재 generation 비교, commit과 stale dispose는 구현하지 않았다.
- Project, Playback & Render, History, 공유 Domain, Composition Root, Cache와 제품 UI는 변경하지 않았다.

### 1.4 Task 4 실제 구현 상태

2026-07-17 기준 Canvas-owned Preview Cache Runtime Store가 구현됐다.

- cache key는 stable source identity 또는 legacy source ID, source fingerprint, resolved quality와 logical width/height를 모두 포함한다.
- store는 bitmap을 생성하지 않고 Factory가 완성한 `PreviewRuntimeResource`만 commit한다. Factory는 Cache 타입이나 store를 import하지 않는다.
- `beginBuild()`가 Canvas runtime generation을 증가시키며, resource generation이 현재 값과 다르면 commit하지 않고 즉시 dispose한다.
- 같은 key가 있으면 기존 resource를 재사용하고 새로 도착한 중복 resource만 dispose한다.
- tracked memory는 Task 2의 생성 전 예상 합계가 아니라 실제 생성·commit된 resource의 `allocatedBytes` 합계다.
- budget 초과 시 단조 증가 access counter가 가장 작은 비활성 entry부터 LRU 제거한다. 현재 Render Frame용 active key는 cache에 아직 없어도 미리 보호할 수 있다.
- active resource 때문에 제거할 후보가 없으면 일시적인 over-budget 상태를 허용하고, active 보호가 풀리거나 budget이 바뀔 때 즉시 다시 eviction한다.
- remove, clear, eviction, stale/duplicate commit과 store `dispose()`에서 resource dispose와 tracked bytes 감소를 정확히 한 번 수행한다.
- store `dispose()`는 unmount cleanup port이며 모든 entry를 해제하고 이후 늦게 도착한 commit도 즉시 dispose한다.
- Cache Runtime만 구현했으며 bitmap build orchestration, Automatic Quality, Canvas resolver, UI, Refresh와 Composition Root 연결은 하지 않았다.
- Project, Playback & Render, History와 공유 Domain은 변경하지 않았다.

### 1.5 Task 5 실제 구현 상태

2026-07-17 기준 Automatic Quality Policy가 Canvas Engine의 순수 helper로 구현됐다.

- policy 입력은 quality preference, Task 2의 네 품질별 예상 memory, optional device memory와 명시 budget뿐이다.
- Task 4 Cache의 tracked/allocated bytes, runtime resource, browser API와 React lifecycle은 입력과 구현에서 제외했다.
- 유효한 명시 budget이 있으면 최우선으로 사용하고, 없으면 device memory tier로 budget을 결정한다.
- device memory가 없거나 0/음수/NaN/Infinity이면 128 MiB의 보수적인 fallback budget을 사용한다.
- `auto`는 `original → high → medium → low` 순서에서 예상 bytes가 budget 이하인 첫 품질을 선택한다. low도 초과하면 low를 유지하고 `fitsBudget: false`로 설명한다.
- 명시 품질은 자동으로 낮추지 않으며 `explicit-preference` 이유와 해당 품질의 budget 적합 여부를 반환한다.
- 결과는 preference, resolved quality, budget/estimated bytes, 적합 여부, fallback, budget 출처, device tier와 선택 이유를 담은 JSON 직렬화 가능한 Plain Data다.
- 같은 입력은 항상 같은 결과를 반환하며 Cache의 일시적 memory 변화로 재평가되지 않는다.
- Bitmap, Cache build, Canvas resolver, UI, Refresh, Project, Playback & Render와 Composition Root는 변경하지 않았다.

### 1.6 Task 6 실제 구현 상태

2026-07-17 기준 Canvas Preview Integration이 제품 Canvas 경로에 연결됐다.

- `useCanvasComposition`이 Project runtime drawable을 읽기 전용으로 Canvas Preview source 목록에 전달한다.
- source 목록은 layer stable identity 기준으로 dedupe하고 flatten/sub composition에서 같은 sourceId alias를 한 bitmap key에 연결한다.
- source-set key는 identity, fingerprint, canvas/logical size와 alias만 포함한다. Transform/selection/playhead 변경으로 Project Layer Map 참조가 바뀌어도 같은 source generation을 다시 시작하지 않는다.
- Canvas Preview runtime은 Task 2 예상치와 Task 5 policy로 quality/budget을 정하고 Task 4 Cache build generation을 시작한다.
- build controller는 최대 4개 Factory 요청만 동시에 실행하고 cache hit는 Factory를 호출하지 않는다.
- 새 build key와 이전 active key를 함께 보호해 build 중 LRU가 현재 Preview를 제거하지 못하게 한다.
- 각 Factory 결과는 Cache가 generation을 확인해 commit하거나 stale dispose한다.
- build source 전체가 성공한 경우에만 sourceId→cache key map과 resolver generation을 한 번에 교체한다. 실패 또는 stale build는 이전 map을 유지한다.
- resolver identity는 active generation이 바뀔 때만 갱신돼 Render Frame이 완성된 새 cache를 사용해 다시 계산된다.
- resolver hit는 Preview bitmap/pixel size를 반환하고 key miss, logical size 불일치와 준비 전 상태는 `null`을 반환해 원본 source를 유지한다.
- 현재 Render Frame source만 active key로 다시 표시해 LRU 보호 범위를 실제 화면에 한정한다.
- build read model은 idle/building/ready/error, generation, quality와 completed/total/failed count를 Plain Data로 제공한다.
- Cache store는 Strict Mode 재설정과 unmount에서 dispose되며 늦게 끝난 generation은 현재 화면을 덮지 못한다.
- resolver는 Canvas용 `useRenderEngine` 호출에만 전달한다. resolver 없는 Render/향후 Export 경로는 계속 원본 `RenderDrawable.canvas`를 사용한다.
- UI, quality control, 명시적인 Import/Refresh/Delete lifecycle은 구현하지 않았다. Project Engine, Playback & Render 구현과 Composition Root는 변경하지 않았다.

### 1.7 Task 7 실제 구현 상태

2026-07-17 기준 Preview Quality Control UI가 기존 Preview control 영역에 연결됐다.

- `PreviewQualityControlViewModel`은 선택 preference, 실제 active cache 품질, 다섯 옵션의 label/예상 memory와 build 상태를 Plain Data로 제공한다.
- 자동 옵션은 Task 5가 결정한 품질의 예상 memory를 사용하고 실제 resolver가 활성화한 품질을 `자동 (현재: 상)` 형식으로 표시한다.
- 원본/상/중/하 옵션은 Task 2의 품질별 예상 bytes를 기존 formatter로 표시한다.
- build read model에 목표 `quality`와 구분되는 `activeQuality`를 추가했다. 새 build 중이나 실패 시 UI와 resolver는 이전 active 품질을 유지한다.
- 기존 Preview 좌측 toolbar에 native select를 추가해 다섯 품질의 keyboard 탐색과 focus 접근성을 제공한다.
- build 중에는 `생성 중... completed / total`, 실패 시 `일부 Preview 생성 실패`를 polite live status로 표시한다. ready 상태에서는 상태 문구를 제거한다.
- 선택 이벤트는 Canvas Preview runtime의 `setPreference` command만 호출한다. View는 bitmap, Cache, Project records와 Render를 알거나 수정하지 않는다.
- Import/Refresh/Delete lifecycle은 이번 Task에서 연결하지 않았다.

### 1.8 Task 8 실제 구현 상태

2026-07-17 기준 Import / Refresh / Delete가 하나의 SourceSet 기반 Preview Cache lifecycle로 연결됐다.

- `useCanvasComposition`이 Project의 Composition과 runtime drawable에서 SourceSet을 다시 만들기 때문에 Confirm Import, Refresh와 실제 Delete가 모두 같은 Canvas runtime 입력 변경으로 수렴한다.
- SourceSet key는 stable identity, fingerprint, source/logical size와 runtime alias를 포함한다. 변경될 때마다 하나의 새 generation build를 시작한다.
- Import에서 기존 source는 동일 cache key로 hit하고 새 source만 Factory를 호출한다.
- Refresh에서 stable identity가 같고 fingerprint가 바뀐 source만 새 key로 생성한다. 동일 fingerprint/quality/logical size는 기존 bitmap을 재사용한다.
- Delete도 남은 SourceSet으로 generation을 시작한다. 새 generation 전체 성공 전에는 이전 active map과 삭제 예정 source bitmap을 보호해 기존 Resolver를 유지한다.
- 성공적인 atomic map 전환 뒤 현재 SourceSet의 네 품질에서 유효한 key만 Cache에 유지한다. 삭제 source, 이전 fingerprint와 이전 logical size entry는 `dispose()`하고 tracked bytes를 감소시킨다.
- 같은 source의 다른 품질 cache는 source identity/fingerprint/logical size가 유효한 동안 유지해 품질 재선택 시 재사용할 수 있고, budget 초과 시 기존 LRU 정책을 따른다.
- build 실패 또는 stale generation에는 active map을 바꾸거나 lifecycle cleanup을 실행하지 않는다. 다음 성공 build 또는 unmount cleanup이 runtime resource를 정리한다.
- Project Engine, 저장 Domain, History, Playback & Render와 Preview UI는 변경하지 않았다.

### 1.9 Task 9 Sprint QA 결과

2026-07-17 기준 Preview Quality & Memory Cache Sprint 통합 QA를 완료했다.

- 자동/원본/상/중/하 계약, 품질별 scale과 예상 memory 표시를 검증했다.
- device memory tier, fallback budget, override와 deterministic Automatic Quality를 검증했다.
- original 별도 bitmap, resize, browser fallback, 실패와 idempotent dispose를 검증했다.
- Cache hit/miss, LRU, budget, tracked bytes, active 보호, retain/delete와 unmount cleanup을 검증했다.
- resolver와 원본 fallback, logical/pixel size 분리, position/anchor/scale/rotation/opacity와 motion path 회귀를 검증했다.
- Selector options, active quality, progress/error 상태, native keyboard 접근성과 Canvas command-only 경계를 검증했다.
- Import/Refresh/Delete, fingerprint 부분 재생성, cache reuse, atomic resolver와 generation 경합을 검증했다.
- 1,000개 8192×8192 source 예상 memory, 전 품질 왕복 12회, Import/Delete 20회, fingerprint Refresh 20회, 동일 Refresh 20회와 동시 generation 24개의 stress QA를 추가했다.
- 모든 반복 뒤 Cache size/tracked bytes가 기대값을 유지하고 stale resource와 unmount resource의 dispose가 정확히 한 번 실행되는지 확인했다.
- Project, Playback, Render, History, Timeline, Properties, PSD Tree와 Engine Import Boundary 기존 검증이 모두 통과했다.
- 제품 코드에서 수정할 회귀는 발견되지 않았다. Sprint QA는 테스트와 문서만 변경했다.

## 2. 현재 구조

현재 PSD pixel layer는 Import 과정에서 `RenderDrawable.canvas`가 되고 `renderItemsByCompId` runtime record에 들어간다. `useRenderEngine`은 선택 Composition의 Render Frame을 만들고, `useCanvasRenderController`가 `canvas2dRenderAdapter`로 이를 Preview canvas에 그린다.

현재 command는 원본 canvas의 width/height를 logical layer 크기로도 사용하고 `drawImage(canvas, 0, 0)`을 호출한다. Preview bitmap을 축소하면 bitmap pixel 크기와 편집 좌표계의 logical 크기가 달라진다. 따라서 Canvas 연결 전에 다음 두 개념을 분리해야 한다.

- source pixel size: 실제 Preview bitmap의 width/height
- logical draw size: 원본 PSD layer의 width/height와 transform/anchor 계산 기준

Preview bitmap을 그릴 때는 logical 크기로 destination draw를 해야 기존 위치, anchor, scale, gizmo와 motion path가 바뀌지 않는다.

## 3. 품질 계약

사용자 선택값은 직렬화 가능한 문자열 union으로 정의한다.

```ts
type PreviewQualityPreference = "auto" | "original" | "high" | "medium" | "low";
type ResolvedPreviewQuality = Exclude<PreviewQualityPreference, "auto">;
```

초기 scale 정책은 다음과 같이 단순하게 시작한다.

| 표시 | 내부 값 | pixel scale | 의미 |
|---|---|---:|---|
| 자동 | `auto` | 계산 결과 | budget 안에서 가능한 가장 높은 품질 |
| 원본 | `original` | 1.0 | 원본과 같은 pixel 크기의 Preview bitmap |
| 상 | `high` | 0.75 | 고해상도 편집 Preview |
| 중 | `medium` | 0.5 | 메모리와 선명도의 균형 |
| 하 | `low` | 0.25 | 대용량 PSD용 저메모리 Preview |

scale 값은 한 helper/table에서만 관리한다. View, cache와 메모리 계산이 각자 숫자를 중복 정의하지 않는다.

품질 preference는 Plain Data session setting으로 유지한다. bitmap, canvas, ImageBitmap, cache entry와 실제 메모리 수치는 저장 Domain이나 History에 넣지 않는다. 프로젝트 영속 저장이 생기기 전에는 reload 간 preference 저장을 이번 Sprint 범위로 확장하지 않는다.

## 4. 메모리 계산

각 source의 예상 RGBA bitmap 메모리는 다음 순수 계산을 사용한다.

```text
scaledWidth  = ceil(originalWidth  × scale)
scaledHeight = ceil(originalHeight × scale)
estimatedBytes = scaledWidth × scaledHeight × 4
```

프로젝트 예상 cache 메모리는 source별 `estimatedBytes`의 합이다.

- stable source identity의 `sourceFileName + sourceKey`를 기준으로 같은 원본 pixel source를 한 번만 센다.
- stable source identity가 없는 legacy source는 runtime `sourceId`를 fallback key로 사용한다.
- sub composition의 flatten drawable과 원본 child record에 같은 source가 반복돼도 중복 계산하지 않는다.
- width 또는 height가 0이면 해당 축은 0이고 예상 bytes도 0이다. 양수인 작은 이미지는 `ceil` 때문에 각 축이 최소 1 pixel이 된다.
- 표시 단위는 B/KB/MB/GB formatter 한 곳에서 만든다.
- UI의 옵션 옆 메모리는 원본 PSD 메모리가 아니라 해당 품질의 **예상 Preview Cache 추가 사용량**이다.
- 실제 cache entry가 만들어진 뒤에는 entry가 기록한 allocated bytes 합도 별도로 제공해 예상값과 실제 관리값을 구분한다.

## 5. Preview Bitmap 생성

bitmap factory는 원본 canvas를 입력으로 받고 새 Preview resource를 반환한다.

```text
원본 HTMLCanvasElement
  → createImageBitmap(source, resizeWidth, resizeHeight, resizeQuality)
  → PreviewBitmapResource
```

규칙:

- 원본 canvas에 draw, resize, clear 또는 pixel write를 하지 않는다.
- `original`도 원본 canvas를 직접 Preview에 넘기지 않고 같은 크기의 Preview bitmap을 만든다.
- bitmap resource는 `CanvasImageSource`, pixel size, logical size, estimated bytes와 dispose 함수를 가진 runtime-only 값이다.
- `createImageBitmap`을 사용할 수 없는 환경은 별도 offscreen canvas copy fallback을 사용할 수 있지만 원본을 수정하지 않는다.
- `createImageBitmap` 호출 자체가 실패하면 해당 요청은 실패 결과가 된다. 이미 만들어진 Preview를 암묵적으로 fallback 결과로 교체하지 않는다.
- 생성 실패 항목은 원본을 영구 대체하지 않는다. 기존 정상 cache entry를 유지하거나 준비 전 원본 Preview fallback을 사용하고 오류 상태를 보고한다.
- 비동기 완료 순서가 뒤바뀌어도 이전 generation의 결과가 현재 cache를 덮지 못하게 한다.

## 6. Cache 소유권과 lifecycle

Preview Cache는 Canvas Engine 내부 runtime store다. React state에는 serializable한 preference, resolved quality, memory read model과 generation 상태만 노출하고 resource map 자체는 ref/store로 유지한다.

cache key는 최소한 다음 정보를 포함한다.

```text
source identity 또는 sourceLayerId
+ source fingerprint
+ resolved quality
+ 원본 logical width/height
```

관리 정책:

- 같은 key 요청은 기존 resource를 재사용한다.
- 품질이 바뀌면 새 generation을 준비하고 완료된 뒤 Canvas가 새 cache로 전환한다.
- 교체, eviction, Refresh invalidation과 Engine unmount에서 소유한 `ImageBitmap.close()`를 정확히 한 번 호출한다.
- 동시에 만드는 bitmap 수를 제한해 Import 직후 main thread와 memory spike를 줄인다.
- cache는 tracked bytes와 last-used 정보를 보유하고 budget 초과 시 현재 화면에 필요하지 않은 entry부터 LRU로 제거한다.
- 현재 Render Frame에 필요한 source는 생성/그리기 동안 eviction하지 않는다.
- 생성 중 취소는 generation token으로 stale commit을 막고, 늦게 완료된 bitmap은 즉시 dispose한다.
- cache hit/miss와 snapshot은 resource map을 노출하지 않고 generation, budget, tracked bytes, entry 수와 active/over-budget 상태만 Plain Data로 제공한다.

### 6.1 Generation 계약

`PreviewGeneration`은 Canvas Engine runtime 안에서만 증가하는 number다. 저장 Domain, Project records와 History에는 포함하지 않는다.

1. Preview Cache 전체를 새로 준비할 때 현재 generation을 1 증가시킨다.
2. 각 비동기 bitmap 생성 요청은 시작 시점의 generation을 캡처한다.
3. 완료 결과의 generation이 현재 generation과 같을 때만 cache에 commit한다.
4. 다른 generation의 stale 결과는 현재 cache를 절대 덮어쓰지 않고 즉시 `dispose()`한다.
5. 품질 변경, 프로젝트 source 집합 교체처럼 전체 build를 무효화하는 사건이 새 generation의 경계가 된다.

Task 4에서 `beginBuild()` 증가, resource generation 비교와 stale dispose까지 구현했다. Bitmap 생성 요청이 generation을 캡처하는 orchestration은 Canvas 연결 시 이 runtime port를 사용한다.

## 7. 자동 품질

자동 품질은 deterministic한 순수 policy로 구현한다.

입력:

- 네 품질별 예상 cache bytes
- 사용 가능한 경우 `navigator.deviceMemory`
- 선택적으로 사용자가 정한 명시 memory budget
- 지원하지 않는 환경을 위한 보수적 기본 memory budget

정책:

1. 환경에서 preview budget을 계산한다.
2. `original → high → medium → low` 순서로 예상량이 budget 안에 드는 가장 높은 품질을 선택한다.
3. 어떤 품질도 budget 안에 들지 않으면 `low`를 선택한다.
4. 같은 입력은 항상 같은 결과를 반환한다.
5. cache build 중 일시적 tracked bytes 변화만으로 품질이 계속 오르내리지 않도록 preference/source 집합/budget이 바뀔 때만 다시 평가한다.

초기 구현은 브라우저의 비표준 `performance.memory`에 의존하지 않는다. `navigator.deviceMemory`도 helper 내부에서 직접 읽지 않고 외부 환경값으로 받는다.

| device memory | tier | Preview budget |
|---:|---|---:|
| 1 GB 이하 | `constrained` | 64 MiB |
| 2 GB 이하 | `low` | 128 MiB |
| 4 GB 이하 | `standard` | 256 MiB |
| 8 GB 이하 | `high` | 512 MiB |
| 8 GB 초과 | `extended` | 1 GiB |
| 미지원/비정상 | 없음 | fallback 128 MiB |

재평가 key는 preference, 고유 source 집합에서 계산된 품질별 예상값과 device memory 또는 명시 budget으로 구성한다. Cache `trackedBytes`는 포함하지 않는다.

UI에는 다음처럼 preference와 resolved quality를 함께 표시한다.

```text
자동 (현재: 상) · 예상 186 MB
원본 · 예상 412 MB
상 · 예상 232 MB
중 · 예상 103 MB
하 · 예상 26 MB
```

## 8. Canvas와 원본 Render 경계

원본 `renderItemsByCompId`를 Preview bitmap으로 교체하거나 복제 저장하지 않는다.

현재 연결:

```text
Project original RenderItem
  → Playback & Render buildRenderFrame
      + optional drawable source resolver
        ├─ resolver 없음: original canvas command
        └─ Canvas resolver: Preview bitmap command
  → Canvas 2D Adapter
```

Render command는 `CanvasImageSource`와 logical width/height를 분리한다. Canvas adapter는 source bitmap을 logical destination 크기로 그린다. 이 계약으로 Preview 품질을 바꿔도 다음 값은 동일해야 한다.

- Layer/Composition position
- anchor와 transform offset
- scale/rotation/opacity
- gizmo bounds와 motion path
- Timeline/Playback frame 결과

향후 Export는 resolver 없이 원본 render source를 사용한다. 현재 제품에는 Export 기능이 없으므로 이번 Sprint는 원본 경계와 회귀 테스트까지만 보장하고 Export UI/encoder를 만들지 않는다.

Build 전환 규칙:

1. 새 source/quality 입력이 생기면 Cache generation을 증가시킨다.
2. 이전 active cache map과 새 build key를 동시에 보호한다.
3. 최대 4개 요청씩 Factory → Cache commit을 진행하며 progress를 갱신한다.
4. 모든 source가 성공하고 generation이 현재 값일 때만 active source map을 원자적으로 교체한다.
5. build 중, 실패 또는 stale인 경우 resolver는 이전 active map을 계속 사용한다.
6. 교체 후 현재 Render Frame source만 active로 남기고 나머지는 budget/LRU 관리 대상으로 돌린다.

## 9. Import와 Refresh 연동

- Confirm Import 뒤 고유 source 집합과 예상 메모리를 다시 계산하고 현재 preference로 cache generation을 시작한다.
- Refresh는 stable source identity와 fingerprint를 사용해 변경되지 않은 entry를 재사용한다.
- fingerprint가 바뀐 source만 invalidation 후 다시 생성한다.
- 새 Layer/Group source는 현재 resolved quality로 추가 생성한다.
- Missing/Delete Pending source는 편집기에 남아 있는 동안 기존 cache를 유지한다.
- 실제 delete, Main Composition 제거와 Project 교체 시 더 이상 참조되지 않는 entry를 dispose한다.
- 연속 Refresh 중 이전 generation 결과가 새 fingerprint cache를 덮지 못하게 한다.

실제 구현은 Import/Refresh/Delete 명령을 Canvas에 직접 전달하지 않는다. Project 결과에서 계산되는 SourceSet key 하나를 lifecycle event로 사용한다.

```text
Project Import / Refresh / Delete
  → Composition + RenderDrawable SourceSet 재계산
  → source-set key 변경
  → Canvas generation build
  → 기존 active resolver 유지
  → 전체 성공
  → active map atomic 교체
  → 현재 SourceSet 밖 cache dispose / tracked memory 감소
```

## 10. 품질 UI

기존 Preview control 영역 안에 품질 선택 control을 추가한다. 별도 modal이나 새로운 작업 흐름은 만들지 않는다.

- 자동/원본/상/중/하를 모두 표시한다.
- 각 옵션에 예상 cache 메모리를 표시한다.
- 자동 선택 시 현재 resolved quality를 `자동 (현재: 상)`처럼 표시한다.
- build 중에는 현재 사용 중 품질과 준비 중 품질을 구분하되 Canvas 작업을 막지 않는다.
- 생성 오류가 있어도 기존 Preview를 유지하고 짧은 상태만 표시한다.
- 선택은 Cache/Canvas Engine command를 호출하고 View가 bitmap이나 Project records를 직접 수정하지 않는다.

## 11. Sprint Task와 독립 완료 조건

### Task 1. Preview Quality Contract & Source Boundary

- 완료: quality preference/resolved quality, scale table과 runtime source resolver 계약을 정의했다.
- 완료: 원본 RenderDrawable이 변경되지 않고 resolver가 없는 Render Frame이 기존 결과와 같은지 검증했다.
- 완료: 저장 Plain Data와 bitmap runtime type의 import 경계를 검증했다.

### Task 2. Memory Estimator

- 완료: quality별 dimension/bytes, 고유 source dedupe와 memory formatter를 Canvas 순수 helper로 구현했다.
- 완료: stable/legacy 중복, 서로 다른 PSD의 같은 layer key, 0/tiny/large/very large size와 각 scale의 예상값을 테스트했다.

### Task 3. Preview Bitmap Factory

- 완료: 원본 무변경 resize bitmap 생성, logical/pixel size 분리와 fallback adapter를 구현했다.
- 완료: 원본 pixel/dimension 불변, original 별도 resource, 생성 크기, fallback, idempotent dispose와 실패 결과를 테스트했다.
- Generation 증가, cache commit과 stale completion dispose는 Task 4로 유지했다.

### Task 4. Cache Lifecycle & Budget

- 완료: Canvas-owned runtime cache, cache key, generation, commit, tracked allocated bytes, active 보호 LRU, budget과 dispose를 구현했다.
- 완료: hit/miss, generation 증가, stale/duplicate commit, budget eviction, protected over-budget, remove와 unmount cleanup을 테스트했다.
- Bitmap 동시 생성 orchestration은 Cache에 생성 책임을 넣지 않기 위해 Canvas build 연결 시 다룬다.

### Task 5. Automatic Quality Policy

- 완료: device tier/fallback/override budget과 가장 높은 허용 품질 선택 helper를 구현했다.
- 완료: original/high/medium/low/low 초과, exact boundary, tiny/huge project, device memory 부재·비정상과 결정성을 테스트했다.
- 완료: Automatic Quality 계약과 helper에 Cache tracked/allocated memory가 포함되지 않는지 검증했다.

### Task 6. Canvas Preview Integration

- 완료: Canvas-only build orchestration, Cache commit과 atomic source resolver 전환을 실제 Preview Render에 연결했다.
- 완료: build 중 이전 Preview 유지, generation stale dispose, cache hit와 완료 후 새 quality bitmap 사용을 테스트했다.
- 완료: Preview pixel size가 달라도 logical size, position/anchor/scale/rotation과 motion path가 같고 resolver 없는 원본 Render가 유지되는지 테스트했다.

### Task 7. Preview Quality Control UI

- 완료: 기존 Preview controls에 다섯 옵션, 예상 메모리와 자동의 실제 active 품질을 표시했다.
- 완료: Canvas command 연결, build 진행/완료/오류 read model과 native select keyboard 접근성을 검증했다.

### Task 8. Import / Refresh / Delete Lifecycle

- 완료: Import/Refresh/Delete를 SourceSet 변경 하나로 연결하고 identity/fingerprint 기반 부분 생성과 cache reuse를 구현했다.
- 완료: generation 중 기존 Resolver 유지, 성공 후 atomic 교체, 삭제/이전 fingerprint dispose와 tracked memory 감소를 검증했다.
- 완료: 같은 source의 품질 cache 유지, Cache LRU와 unmount cleanup 계약을 유지했다.

### Task 9. Sprint QA

- 완료: 대용량 source fixture와 반복 품질 전환/Import/Refresh/Delete를 포함한 통합 QA를 수행했다.
- 완료: Canvas cache resolver와 resolver 없는 원본 Render path, logical geometry 불변을 확인했다.
- 완료: generation 경합, LRU/delete/unmount에서 tracked bytes가 누적되지 않고 resource가 해제되는지 확인했다.
- 완료: Project/Playback/Render/History/Timeline/Properties/PSD Tree 회귀와 필수 명령을 통과했다.

## 12. 이번 Sprint에서 하지 않는 것

- 원본 PSD 또는 parsed PSD node 수정
- Export UI, encoder 또는 영상 Export 구현
- 원본 bitmap 영구 리사이즈
- 디스크 cache, IndexedDB cache 또는 Service Worker cache
- 새로운 Engine 추가
- 프로젝트 persistence 전체 구현
- color management, mipmap, WebGL renderer와 worker rendering

## 13. Sprint 완료 기준

- 완료: 다섯 품질과 자동 resolved quality가 동작한다.
- 완료: 모든 옵션에 중복 없는 예상 Preview Cache 메모리가 표시된다.
- 완료: Canvas Preview는 준비된 cache bitmap을 사용한다.
- 완료: resolver 없는 원본 Render 결과와 원본 canvas는 변하지 않는다.
- 완료: 품질 전환과 반복 Refresh에서 geometry, 상태와 memory가 누적되거나 꼬이지 않는다.
- 완료: cache eviction/delete/unmount에서 runtime bitmap이 해제된다.
- 완료: legacy 프로젝트와 현재 PSD Import/Refresh 결과가 회귀하지 않는다.
- 완료: 필수 lint/test/build/qa/diff 검사를 통과한다.

## 14. 완료 시점 Known Issue

- 현재 제품에는 Export 기능이 없어 실제 encoder Export를 실행할 수 없다. resolver 없는 원본 Render 계약과 결과 불변으로 경계를 검증했다.
- 자동 QA의 대용량 PSD는 1,000개 8192×8192 source의 Plain Data/Runtime 모의 resource다. 실제 수백 MB PSD parse와 브라우저 memory pressure 수동 검증은 별도 실물 fixture가 필요하다.
- in-app browser 인스턴스가 제공되지 않아 제품 화면에서 Selector click/keyboard를 수동 검증하지 못했다. native select, focus/ARIA와 command 연결 자동 검증은 통과했다.
- production bundle은 656.36 kB로 Vite의 500 kB chunk 경고가 남는다. Preview Cache 기능 회귀는 아니며 후속 bundle 분리 대상으로 남긴다.

## 15. Canvas Drag Performance 안정화

2026-07-17 연속 핸들 드래그의 FPS 저하와 정지 Layer 일시 소실을 코드 흐름과 구조 지표로 조사했다.

확정된 병목은 source bitmap cache가 아니라 최종 합성 대상이었다.

- Preview source는 저품질 bitmap을 정상 반환했지만 root Canvas backing buffer는 항상 Composition의 전체 logical resolution이었다.
- `renderFrameToCanvas`가 매 render마다 같은 width/height를 다시 대입해 backing store와 context state를 재생성했다.
- 중첩 Composition command는 매 frame마다 전체 logical resolution의 새 offscreen canvas를 생성하고 전체 child command를 다시 합성했다.
- 따라서 source memory가 저품질로 줄어도 destination clear/draw와 offscreen allocation 비용은 줄지 않았다. surface/context 확보가 실패하면 해당 Composition command가 그 frame에서 빠질 수 있어 정지 Layer의 일시 소실 증상과도 일치했다.

수정된 Canvas Preview 흐름은 다음과 같다.

```text
active Preview quality scale
  → root Canvas backing pixel size 계산
  → 크기가 바뀔 때만 backing store resize
  → logical coordinate transform 적용
  → 전체 Render Frame draw
  → 중첩 Composition surface는 frame traversal 순서로 재사용
  → 현재 frame에서 쓰지 않은 surface와 unmount surface 해제
```

`original`은 scale 1을 사용하며 source resolver가 없는 Render/Export 경로의 command 계약은 바꾸지 않았다. Preview source의 logical size, transform, anchor와 motion path 역시 그대로다.

Pointer Controller는 같은 animation frame 안의 move sample을 최신 값 하나로 병합한다. pointerup은 예약 frame을 취소한 뒤 남은 마지막 sample을 동기적으로 적용하고 drag transaction을 한 번 commit한다. 따라서 처리량을 제한하면서도 마지막 위치와 Undo 1회를 보존한다.

`verifyCanvasDragPerformance.ts`는 다음 구조 지표를 고정 검증한다.

- 102 pointer sample → transform 반영 2회, drag commit 1회
- Transform-only 변경 → SourceSet key 동일, Preview generation/build/factory 호출 증가 없음
- 두 drawable 모두 low Preview hit, hit 상태의 original fallback/dispose 0회
- Render command 수와 정지 Layer source 유지
- 1920×1080 logical frame의 low backing buffer가 480×270이며 같은 품질 반복 frame에서 resize 없음
- resolver 없음 또는 실제 mapping miss에서만 original source 사용

실제 브라우저의 10초 드래그 수동 QA는 in-app browser 인스턴스와 실물 PSD fixture가 없어 실행하지 못했다. 절대 FPS 개선치는 아직 계측하지 않았으며, 자동 검증은 재현 가능한 구조 지표를 기준으로 한다.

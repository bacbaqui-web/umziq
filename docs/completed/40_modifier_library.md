# 수식 라이브러리 구현 설명

> 문서 번호: 40

## 1. 전체 구조

수식 라이브러리는 UI에 수식을 직접 하드코딩하지 않는다. Animation Engine의 Modifier 등록부를 기준으로 Properties Engine이 화면용 ViewModel을 만들고, Feature View가 이를 렌더한다.

```text
modifierRegistry.ts
  → Properties Modifier ViewModel
  → 수식 라이브러리 태그 렌더
  → 태그 클릭
  → Animation Modifier Controller
  → Project의 Layer/Composition modifiers 변경
  → Properties와 Render가 변경 결과를 다시 읽음
```

현재 등록된 Modifier는 Position에 적용되는 `부들부들(wiggle)` 하나다.

## 2. 파일별 책임

### `src/models/modifierModel.ts`

프로젝트에 저장되는 Modifier Plain Data 타입을 정의한다.

- `ModifierType`: 현재는 `wiggle`만 허용한다.
- `WiggleModifierInstance`: `id`, `type`, `frequency`, `amount`를 저장한다.
- `frequency`: UI의 `초당 얼마나` 값이다.
- `amount`: UI의 `흔들림 정도` 값이다.

### `src/models/compositionModel.ts`

Layer와 Composition 양쪽에 `modifiers: ModifierInstance[]`를 둔다. 따라서 Modifier는 선택 객체 자체에 저장되며 다른 객체와 공유되지 않는다.

### `src/engines/animation/modifiers/modifierRegistry.ts`

수식 라이브러리의 단일 등록부다.

- `MODIFIER_DEFINITIONS`에 표시 이름, 적용 대상, 설정 필드를 등록한다.
- 현재 `부들부들`, `초당 얼마나`, `흔들림 정도` 문구가 이 파일에 정의돼 있다.
- `createDefaultModifier()`가 `frequency: 0`, `amount: 0`인 기본 데이터를 만든다.
- `normalizeModifierInstances()`가 과거 데이터, 잘못된 값, 같은 타입의 중복 항목을 정리한다.
- `findModifier()`가 선택 객체에 특정 Modifier가 활성화되어 있는지 확인한다.

새 Modifier를 추가할 때는 모델 타입과 함께 이 등록부에 정의를 추가하는 방식이 기본 확장 지점이다.

### `src/engines/properties/helpers/propertiesModifierHelpers.ts`

등록부와 선택 객체의 저장 데이터를 Properties 화면용 데이터로 변환한다.

- 선택 객체에 실제로 적용된 Modifier만 설정 카드 ViewModel로 만든다.
- 모든 `MODIFIER_DEFINITIONS`를 수식 라이브러리 태그 ViewModel로 만든다.
- 선택 객체에 이미 존재하는 항목은 `active: true`로 표시한다.
- 입력 ID를 `modifier.wiggle.frequency` 같은 형태로 만들고 다시 type/field로 해석한다.
- 선택 대상이 없거나 가상 Master Composition이면 라이브러리를 숨긴다.

### `src/engines/properties/usePropertiesEngine.ts`

Properties 내부 조립 지점이다.

- `buildPropertiesModifierViewModel()`로 설정 카드와 라이브러리 데이터를 만든다.
- Modifier 숫자 입력 Controller를 연결한다.
- Animation Engine의 `toggleModifier` command를 View에 전달한다.

### `src/features/properties/sections/PropertiesModifierLibrarySection.tsx`

`수식 라이브러리` 제목과 Modifier 태그를 렌더하는 View다.

- `viewModel.items`를 순회해 태그 버튼을 만든다.
- 활성 상태는 `aria-pressed`, border, background, 글자색으로 구분한다.
- 태그 클릭 시 `commands.toggleModifier(item.type)`만 호출한다.
- 프로젝트 데이터를 직접 수정하지 않는다.

### `src/engines/animation/controllers/useModifierController.ts`

라이브러리 태그 클릭 이후의 정책을 담당한다.

- 선택 대상이 Layer 또는 편집 가능한 Composition인지 확인한다.
- 같은 Modifier가 없으면 추가하고, 이미 있으면 제거한다.
- 추가와 제거 전에 History snapshot을 남겨 Undo/Redo를 지원한다.
- 실제 데이터 변경은 순수 mutation helper에 위임한다.

### `src/engines/animation/actions/animationProjectMutations.ts`

Composition tree 안의 대상 객체를 불변 방식으로 변경한다.

- `addModifierToCompositions()`: 기본 Modifier를 추가하고 중복을 막는다.
- `removeModifierFromCompositions()`: 같은 type의 Modifier를 제거한다.
- `updateModifierNumberInCompositions()`: 숫자 필드 하나만 교체한다.

### `src/features/properties/sections/PropertiesModifierSection.tsx`

현재 적용된 Modifier의 설정 UI를 렌더한다.

- 활성 Modifier가 없으면 아무것도 표시하지 않는다.
- 현재는 `부들부들 - 입력창 입력창` 한 줄 형태다.
- 각 입력창 내부에 필드 설명을 표시한다.
- DOM 이벤트를 Properties command로 전달할 뿐 데이터를 직접 수정하지 않는다.

### `src/engines/properties/controllers/usePropertiesModifierInputController.ts`

Modifier 숫자 입력의 편집 lifecycle을 담당한다.

- Focus: draft와 History transaction을 시작한다.
- Change: 숫자로 해석 가능한 문자열만 draft에 저장한다.
- Enter/Blur: 숫자를 정규화한 뒤 Animation command로 저장한다.
- Escape: draft와 History transaction을 취소한다.
- 실제 값이 바뀌지 않았거나 입력이 잘못되면 History를 남기지 않는다.

### `src/engines/animation/helpers/modifierEvaluationHelpers.ts`

저장된 `부들부들` 값을 실제 Position offset으로 계산한다.

- `Math.random()`을 사용하지 않는다.
- 객체 ID, Modifier ID, 축, 시간 구간을 seed로 결정적인 값을 만든다.
- 같은 객체의 같은 프레임은 항상 같은 X/Y offset을 반환한다.
- frequency 또는 amount가 0이면 `{ x: 0, y: 0 }`을 반환한다.

### `src/engines/animation/helpers/animationEvaluationHelpers.ts`

Position의 최종 계산 순서를 결정한다.

```text
기본 Position
  → Position Keyframe 평가
  → applyPositionModifiers
  → 최종 Position
```

Layer와 Composition 모두 같은 순서를 사용한다. 편집용 base Position 함수와 출력용 최종 Position 함수를 분리해 Modifier 결과가 원본 Transform에 중복 저장되지 않게 한다.

### `src/engines/playback-render/controllers/buildRenderFrame.ts`

Canvas와 Playback이 소비하는 Render Frame을 만든다. Layer와 Sub Composition의 Position을 Animation 평가 함수로 구하므로 Modifier 결과가 동일한 Render 경로로 전달된다. 향후 Export도 이 Render Frame 경로를 사용하면 같은 결과를 얻는다.

## 3. 태그 클릭 흐름

```text
PropertiesModifierLibrarySection
  → toggleModifier("wiggle")
  → useModifierController
  → 현재 선택 객체에서 wiggle 존재 여부 확인
  → 없으면 addModifierToCompositions
  → 있으면 removeModifierFromCompositions
  → Project state 갱신
  → Properties ViewModel 재생성
  → 태그 active 상태와 설정 카드 갱신
```

## 4. 숫자 입력 흐름

```text
PropertiesModifierSection input
  → Focus: draft/history 시작
  → Change: 문자열 draft 저장
  → Enter 또는 Blur
  → updateModifierNumber
  → Layer/Composition modifiers 갱신
  → History commit

Escape
  → draft 폐기
  → History cancel
```

## 5. 새 Modifier를 추가할 때 필요한 범위

현재 구조에서 새 Modifier를 추가하려면 다음을 함께 확장해야 한다.

1. `modifierModel.ts`에 저장 타입과 필드를 추가한다.
2. `modifierRegistry.ts`에 라이브러리 이름, 적용 대상, 설정 필드를 등록한다.
3. normalize와 기본값 생성을 추가한다.
4. 해당 속성의 evaluation helper에 계산식을 추가한다.
5. 입력 ID/ViewModel 타입이 새 필드를 표현하도록 확장한다.
6. Modifier 검증 스크립트에 기본값, 중복, 결정성, Render 결과 테스트를 추가한다.

UI 태그 목록과 활성 표시 자체는 등록부를 순회하므로 별도의 태그 컴포넌트를 새로 만들 필요가 없다.

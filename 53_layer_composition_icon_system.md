# Layer & Composition Icon System

## 목적

Layer와 Composition을 같은 도형 언어로 구분한다. Composition은 여러 시각 요소를 포함하는 대상임을 겹친 plane으로 표현하고, Layer는 그 plane 한 장만 사용한다.

## 디자인 계약

- Layer: 기울어진 사각형 outline 1장
- Composition: Layer와 동일한 사각형 outline 3장
- 두 종류는 같은 viewBox, path, stroke와 round cap/join을 공유한다.
- 색상은 `currentColor`로 상위 UI의 selected, hover와 disabled 상태를 따른다.
- decorative SVG이므로 접근성 tree와 focus 대상에서 제외한다.

## 구현 경계

`src/shared/components/LayerCompositionIcon.tsx`가 공용 SVG를 소유한다. API는 `kind: "layer" | "composition"`과 선택적인 `size`뿐이다.

Engine은 React icon을 import하지 않는다. Timeline과 Properties Engine은 plain entity kind를 ViewModel에 보존하고, Feature component가 공용 아이콘을 렌더링한다.

## 적용 위치

- Timeline item row, Master를 포함한 Composition breadcrumb, selection context와 switcher
- Properties 선택 대상 header
- PSD Tree의 Sub Composition
- PSD Import Preview의 Layer

PSD source/file와 folder/group처럼 다른 의미를 가진 기존 표시는 대체하지 않는다. Master는 공용 Composition 아이콘을 사용하되 화면 명칭은 `프로젝트`로 표시한다.

사용자 화면에서는 Master를 `프로젝트`, Composition을 `그룹`으로 표시한다. 내부 entity kind와 `Composition` 코드 명칭은 유지한다.

## 검증 결과

- 공용 plane geometry와 Layer 1장/Composition 3장 계약을 focused verifier로 확인했다.
- Timeline, Properties와 PSD kind mapping 및 Engine import boundary를 확인했다.
- 전체 46개 verification script, ESLint, production build와 `git diff --check`가 통과했다.
- Browser QA는 수행하지 않았다.

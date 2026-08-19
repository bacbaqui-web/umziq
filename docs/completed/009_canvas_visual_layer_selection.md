# Canvas Visual Layer Selection

> 문서 번호: 48
> 상태: Alpha 직접 선택과 실루엣 스크린톤 구현
> 최종 갱신: 2026-07-26

## 1. 현재 계약

Canvas 직접 선택은 Source Alpha Mask를 사용한다. 선택 강조는 같은 Alpha
Mask의 바깥쪽에 실제 레이어 실루엣을 따라가는 점 스크린톤 Glow를
표시한다. 경계에서 멀어질수록 점 밀도가 낮아진다.

- 투명 pixel은 선택되지 않고 아래 Layer로 fallthrough
- 스크린톤은 Bounds 사각형이 아니라 실제 불투명 pixel 바깥에만 표시
- Blur Glow는 사용하지 않음
- Alpha Mask와 tone mask/tile은 선택 중 재사용
- Draft Transform은 Projection만 갱신
- Preview/Export, Project, History와 Render cache에는 영향 없음

## 2. Candidate와 Hit

Candidate는 현재 composition의 `EvaluatedScene.nodes` top-level 항목이다.
drawable/placeholder는 Layer, composition은 Group으로 취급한다.

Hit 순서:

```text
viewport point
  → composition bounds
  → candidate AABB
  → transformed quad
  → Source Alpha Mask
  → viewportToSource
  → alpha sample
```

Painter order상 위에 있는 candidate부터 검사한다. Alpha가 투명하면 아래
candidate로 계속 진행한다. Runtime target이나 Source asset이 없으면 현재
선택을 보존하는 blocked 결과를 반환한다.

## 3. Alpha와 Projection 분리

Alpha Mask는 source-local pixel 좌표에 존재한다. Position, Scale, Rotation,
Anchor, Transform Offset, zoom과 pan은 Mask를 다시 만들지 않고
Projection만 변경한다.

Group Alpha identity는 재귀 child descriptor와 child Transform으로 결정한다.
Group 외부 Transform과 frame/result identity 변화는 Alpha Mask를
무효화하지 않는다. child Source visual이나 내부 Transform이 바뀌면
무효화한다.

## 4. 실루엣 스크린톤

선택 표시는 Alpha Mask 바로 바깥 2 source pixel을 불투명한 외곽선으로
채운다. 그다음부터 14 source pixel 범위까지 세 개의 띠로 나누고 고정
Bayer 디더 패턴으로 가까운 띠 50%, 중간 25%, 바깥 12.5% 밀도의 점만
남긴다. 원래 불투명 영역 내부에는 표시하지 않는다.

- 색상: 밝은 파란색 반투명 점
- 외곽선: 실루엣 바로 바깥 2 source px
- 범위: source 기준 바깥 14px
- 밀도: 50% → 25% → 12.5%
- Blur/filter 없음
- 동일 fingerprint에서는 scratch 재사용
- overlay canvas는 `pointer-events: none`
- Motion Path와 Gizmo보다 아래에 표시

따라서 Blur 없이도 경계에서 멀어질수록 자연스럽게 사라지는 Glow처럼
보인다. tone 결과는 Alpha fingerprint별로 한 번 계산하고 이후 Draft에서는
한 장을 투영한다.

## 5. Pointer 우선순위

1. Pan
2. Transform Handle
3. Anchor
4. Motion Path
5. Preview toolbar/form
6. Canvas body Alpha 직접 선택

Transform Drag 중 direct-selection hover는 중지한다. 현재 선택 대상을 다시
누르면 Position drag를 시작하고, 다른 대상을 누르면 selection만 변경한다.

## 6. 표시 설정

Preview toolbar의 `선택 강조` 버튼으로 스크린톤을 켜고 끈다. 내부의 기존
`showSelectionGlow`/`CanvasSelectionGlow*` 이름은 호환을 위해 유지하지만,
실제 renderer는 Blur Glow가 아니라 silhouette screen tone을 그린다.

## 7. 구현 위치

- `src/engines/canvas/helpers/layerDocumentCanvasSelectionHelpers.ts`
- `src/engines/canvas/helpers/layerDocumentCanvasDirectSelectionHelpers.ts`
- `src/engines/canvas/helpers/canvasSelectionAlphaFingerprintHelpers.ts`
- `src/engines/canvas/helpers/selectionSourceAlphaProvider.ts`
- `src/engines/canvas/helpers/canvasSelectionGlowHelpers.ts`
- `src/engines/canvas/adapters/canvasSelectionAlphaBrowserAdapter.ts`
- `src/engines/canvas/adapters/canvasSelectionGlowBrowserAdapter.ts`
- `src/engines/canvas/controllers/useLayerDocumentCanvasDirectSelectionController.ts`
- `src/features/preview/components/PreviewOverlay.tsx`

## 8. 검증

- `scripts/verifyLayerDocumentCanvasMode.ts`
- `scripts/verifyCanvasSelectionScreenTone.ts`

정적 검증은 Alpha hit, painter 우선순위, Draft Projection, 2px 외곽선,
세 단계 밀도, 내부 제외, scratch reuse와 DPR backing을 확인한다. Browser 시각 QA는 별도 요청 시
수행한다.

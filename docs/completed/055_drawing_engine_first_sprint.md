# Drawing Engine 1차 Sprint 완료 기록

## 결과

독립 Drawing Engine에서 드로잉 레이어 생성과 PSD visual 변환, 브러시·지우개·연결
영역 페인트통, Drawing 전용 Pointer Draft와 공용 렌더 경로를 구현했다. Drawing Layer는
타임라인과 Library에서 공용 펜촉 아이콘으로 구분한다.

## 저장과 Runtime 경계

- 확정 Drawing element는 Project의 `DrawingLayerData.documentVersion = 3` Plain Data다.
- Brush와 Eraser의 연속 입력은 Drawing Engine Draft이며 PointerUp에서 transaction 한 건을 만든다.
- Drawing 투명 픽셀은 독립 surface에 그린 뒤 합성해 아래 Layer를 지우지 않는다.
- 외부 `image/drawing-layer/` revision 자산화는 후속 Persistence Sprint로 남겼다.

## 검증

- `scripts/verifyDrawingEngine.ts` 포함 verification suite 통과
- ESLint와 `git diff --check` 통과
- 실제 Browser Pointer·Space-pan·파일 저장 수동 QA는 미실행

## 후속

- Drawing Mode와 일반 Canvas interaction 분리
- Project 추가 메뉴와 Library Layer context menu 통합
- Pointer coalescing과 Draft Canvas 기반 입력 최적화

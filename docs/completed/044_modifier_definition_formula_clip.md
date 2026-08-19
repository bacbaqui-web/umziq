# Modifier Definition & Formula Clip Foundation 완료 기록

## 완료 범위

- `LayerDocument.common.modifiers`의 `LayerModifier`를 저장과 실행의 canonical
  authority로 고정했다.
- typed `ModifierDefinition` registry에 type별 default, normalize/validate,
  Properties/Timeline descriptor와 evaluation kind를 모았다.
- Properties의 Modifier library, field projection과 toggle default가 같은
  Definition을 읽게 했다.
- Project structure validation과 Timeline clip commit이 같은 normalize/validate
  정책을 사용하게 했다.
- Render의 motion/mouth/acceleration 평가는 저장된 `LayerModifier`를 직접 읽고
  Preview/Accurate 공통 `EvaluatedScene` 경로를 유지했다.
- 입뻥긋 Audio 분석과 frame projection을 pure Animation helper로, 연결 action과
  Owner command 조합을 Modifier Properties Controller로 옮겼다.
- Composition Root에서는 decoded-audio read port 조립만 남겼다.
- 입뻥긋과 가속·감속 Timeline row가 공통 `TimelineFormulaClip` shell과 Sprint B
  Pointer Drag Session Runtime을 사용하게 했다.

## 보존한 계약

- `.ziq` schema와 `LayerModifier` plain-data shape는 바꾸지 않았다.
- `modifierId`, `enabled`, unknown Modifier 보존과 save/open round-trip을 유지했다.
- 사용자 action 한 번은 Owner transaction/History 한 건이다.
- Formula clip move 중 History 0, 변경된 pointer-up 1, no-op/cancel 0이다.
- 재생과 출력은 같은 `EvaluatedScene`과 Modifier 평가 결과를 사용한다.
- legacy `ModifierInstance`는 이전 source migration 및 호환 검증 경계에만 남겼다.

## 주요 파일

- `src/models/layerModifierDefinition.ts`
- `src/models/layerDocumentStructureValidation.ts`
- `src/engines/properties/controllers/modifierPropertiesController.ts`
- `src/engines/properties/useLayerDocumentPropertiesEngine.ts`
- `src/animation/modifiers/mouthBasicAnalysis.ts`
- `src/render/helpers/layerDocumentRuntimeEvaluationHelpers.ts`
- `src/features/timeline/components/TimelineFormulaClip.tsx`
- `src/features/timeline/components/TimelineFormulaTrackRow.tsx`
- `src/features/timeline/components/TimelineAccelerationTrackRow.tsx`
- `scripts/verifyModifierDefinitionFoundation.ts`
- `scripts/verifyTimelinePointerDragIntegration.ts`

## 자동 검증

- Modifier Definition order/default/normalize/validation
- unknown Modifier 저장 보존과 Project save/open
- 입뻥긋 Audio 분석, source-local clip 계산과 Controller transaction
- Properties toggle/field/curve/property/audio 연결
- 입뻥긋·가속감속 move/trim/transition/no-op/cancel Pointer 계약
- motion/mouth/acceleration frame 평가와 Preview/Accurate parity
- Composition Root에 PCM 분석, absolute frame 계산과 `set-modifiers` 준비가
  남지 않았는지 정적 검증
- 전체 `npm run qa`
- `git diff --check`

## 수동 QA 잔여

- 실제 Audio를 연결한 입뻥긋 분석 결과와 Undo/Redo 체감 확인
- 입뻥긋 전환선 및 가속·감속 clip의 move/trim을 브라우저에서 직접 조작 확인
- Preview와 실제 출력에서 동일 frame의 opacity/transform 결과 비교


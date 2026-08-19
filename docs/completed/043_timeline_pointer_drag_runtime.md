# Timeline Pointer Drag Runtime 완료

## 완료 범위

- Playhead, Playback Range, Layer move/trim, Keyframe, 입뻥긋 clip과 가속·감속
  clip의 DOM drag 수명을 공통 Pointer Drag Session Controller로 통일했다.
- pointer capture와 global pointer listener를 session 하나가 소유하고 terminal
  event가 겹쳐도 commit/cancel이 정확히 한 번만 실행되게 했다.
- Timeline 밖 pointer-up, buttons-zero, blur, document leave, hidden visibility,
  lost capture와 pointercancel fallback을 같은 계약으로 처리했다.
- Layer/Keyframe/Modifier의 frame, clamp와 Draft 계산 및 Owner mutation은 기존
  Timeline/Feature 책임에 유지했다.
- Playhead/Range는 계속 Timeline Runtime만 갱신하며 Project History를 만들지 않는다.

## 주요 파일

- `src/engines/timeline/controllers/timelinePointerDragSessionController.ts`
- `src/engines/timeline/state/useTimelinePointerDragSessionRuntime.ts`
- `src/engines/timeline/models/timelinePointerDragSessionModel.ts`
- `src/engines/timeline/useLayerDocumentTimelineEngine.ts`
- `src/engines/timeline/controllers/useTimelinePlaybackUIController.ts`
- `src/features/timeline/components/TimelineFormulaTrackRow.tsx`
- `src/features/timeline/components/TimelineAccelerationTrackRow.tsx`

## 검증

- `scripts/verifyTimelinePointerDragSession.ts`
  - fake DOM event target으로 capture/listener/terminal 수명과 모든 fallback 검증
  - Timeline 밖에서 pointer-up 후 추가 move가 적용되지 않는지 검증
  - replace/explicit cancel/dispose의 Draft 취소와 listener 정리 검증
- `scripts/verifyTimelinePointerDragIntegration.ts`
  - 다섯 적용 경로가 공통 Runtime을 사용하고 개별 global listener를 다시 만들지
    않는지 검증
- 기존 Timeline controller/UI, 입뻥긋과 가속·감속 verification 통과
- TypeScript build, 전체 `npm run test`, `npm run qa`, `git diff --check` 통과

현재 subagent 환경에는 Browser skill이 요구하는 in-app JavaScript 실행 도구가 없어
실제 브라우저 수동 drag 확인은 실행하지 못했다. DOM event 수명은 결정론적 fake DOM
회귀 검증으로 고정했으며, 최종 제품 확인에서는 실제 포인터로 Timeline 밖 release와
각 clip drag를 한 번 확인한다.

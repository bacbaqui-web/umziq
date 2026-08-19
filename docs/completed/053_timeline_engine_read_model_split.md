# Timeline Engine·ReadModel 책임 분리 완료 기록

## 결과

Timeline Engine facade를 699줄에서 455줄로, Timeline ReadModel helper를 726줄에서
468줄로 줄이고 실제 변경 이유를 공유하는 책임 단위로 분리했다. 공개 ViewModel과 command
계약은 유지했다.

## 구조

- `useLayerDocumentTimelineUiState`: Timeline 전용 UI session state
- `useLayerDocumentTimelinePointerRuntime`: move·trim·keyframe Pointer Draft와 확정
- `timelineHeaderViewModelHelpers`: breadcrumb, 선택 label, switcher와 header 계산
- `timelineKeyframeRowViewModelHelpers`: keyframe 위치, 선택, drag readout 계산
- `useLayerDocumentTimelineEngine`: Runtime·Controller·ViewProps 조립

전체 길이를 고정해서 보여주는 정책과 충돌하던 Pointer/Playback range 가로 auto-scroll,
scroll 좌표 보정과 Panel의 `scrollLeft` 강제 복구를 제거했다.

## 검증

- Pointer static fixture를 새 Runtime 책임까지 확장했다.
- `npm run qa` 통과: Verification 64/64, ESLint, TypeScript/Vite build
- `git diff --check` 통과
- 기존 Vite 500 kB chunk 경고만 있으며 오류는 아니다.

## 미실행 수동 QA

실제 Browser에서 move·trim·keyframe drag, playback range resize와 전체 길이 고정 표시는
수동으로 확인하지 않았다.

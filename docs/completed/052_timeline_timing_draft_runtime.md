# Timeline Timing Draft 단일 Runtime 경계 완료 기록

## 결과

Timeline Engine의 React state와 Composition Root ref에 중복 보관하던 move·trim timing
Draft를 하나의 외부 Runtime으로 통합했다. Timeline과 Canvas가 같은 Draft를 읽고,
Project와 History는 PointerUp 전까지 변경하지 않는 기존 계약을 유지한다.

## 구조

- `layerDocumentTimelineTimingDraftRuntime`: read, subscribe, publish, clear 단일 소유
- `projectLayerDocumentTimelineTimingDraft`: Canvas read용 순수 Project projection
- `useEditorCompositionRoot`: Runtime 생성과 Timeline·Canvas port 조립만 담당
- `useLayerDocumentTimelineEngine`: Runtime 구독과 Pointer 수명에 따른 publish·clear

cancel, reset과 Project 교체는 Runtime을 clear하며 PointerUp의 `set-timing` transaction은
기존처럼 한 번만 확정된다.

## 검증

- publish·projection·원본 불변·clear·구독 fixture 추가
- 기존 move·trim·cancel과 PointerUp History fixture 유지
- `npm run qa` 통과: Verification 64/64, ESLint, TypeScript/Vite build
- `git diff --check` 통과
- 기존 Vite 500 kB chunk 경고만 있으며 오류는 아니다.

## 미실행 수동 QA

실제 Browser에서 Group Layer move·trim 중 Canvas 실시간 렌더는 수동으로 확인하지 않았다.

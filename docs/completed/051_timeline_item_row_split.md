# Timeline Item Row UI 책임 분리 완료 기록

## 결과

559줄이던 `TimelineItemTrackRow`를 82줄의 조립 Component로 축소하고 이름, Source 상태,
track clip과 context menu를 각각의 UI 책임으로 분리했다.

## 구조

- `TimelineItemTrackRow`: context menu 수명과 하위 조립
- `TimelineItemNameCell`: 이름 편집, 핀, 아이콘, badge와 hover
- `TimelineItemSourceStatus`: deletePending 결정 UI
- `TimelineItemTrackClip`: waveform, visible 영역, move·trim Pointer
- `TimelineItemContextMenu`: 복제·삭제 메뉴 presentation

## 검증

- 기존 UI boundary, Pointer integration, entity icon과 render observation fixture를 새 파일
  책임까지 확장했다.
- `npm run qa` 통과: Verification 64/64, ESLint, TypeScript/Vite build
- `git diff --check` 통과
- 기존 Vite 500 kB chunk 경고만 있으며 오류는 아니다.

## 미실행 수동 QA

실제 Browser에서 이름 편집, 핀, 우클릭, move·trim, waveform과 deletePending UI는
수동으로 확인하지 않았다.

# Drawing Mode·Library 통합 Sprint 완료 기록

## 결과

- Canvas 하단 `+ 드로잉`을 선택된 Drawing Layer에서만 켤 수 있는 `드로잉 모드`로 교체했다.
- Mode OFF에서는 Drawing Layer가 일반 visual Layer처럼 Canvas Transform 입력을 사용하고,
  Mode ON에서만 Brush/Eraser/Fill overlay가 pointer를 받는다.
- Project Header의 PSD·Audio 버튼을 단일 `+` 메뉴로 합쳐 PSD, Drawing, Audio와 Recording
  진입점을 제공한다.
- Library Layer 우클릭 메뉴에 이름 바꾸기, 복제, 삭제와 PSD visual의 Drawing 변환을
  연결했다.
- Library와 Timeline의 Duplicate는 같은 canonical transaction을 사용한다.

## Runtime과 History

- Drawing Mode와 메뉴 open state는 Project/History에 저장하지 않는다.
- selection/Project scope 변경은 Drawing Mode와 active pointer를 폐기한다.
- 비동기 Fill은 selection scope와 operation revision이 달라지면 결과를 commit하지 않는다.
- Create, Duplicate, Rename, Delete와 Convert는 Owner transaction을 사용한다.
- Drawing 변환은 기존 Layer identity를 유지하고 revision을 증가시킨다.

## 검증

- 서브에이전트 독립 검토 2회와 루트 코드 재검증
- ESLint 통과
- verification suite 65개 통과
- `git diff --check` 통과
- TypeScript/Vite build는 이번 변경과 무관한 기존 `src/engines/psd-tree` export/type 오류로
  완료하지 못했다.
- 실제 Browser의 pointer, picker, microphone와 context-menu 위치 수동 QA는 실행하지 않았다.

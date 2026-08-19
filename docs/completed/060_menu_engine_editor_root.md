# Menu Engine과 Editor Root 전환 Sprint 완료 기록

## 결과

- 상단 Project Lifecycle UI를 `src/engines/menu`의 Engine/Composer/Controller/Component
  경계로 이동하고 공개 이름을 `MenuBar`로 전환했다.
- `useEditorCompositionRoot`를 `useEditorRoot`로 바꿨다.
- Menu Controller의 구체 Web Adapter import와 기본 구현 선택을 제거했다.
- Web directory/recent-project 구현은 opaque identity Port로 감싸 Editor Root가 한 번
  주입한다.
- New/Open/Save/Save As/Close와 Export callback의 기존 의미를 유지했다.

## 검증

- ESLint 통과
- Menu lifecycle focused verification 통과
- Engine import boundary 통과
- Build는 기존 PSD Tree 오류 7건만 남았다.
- 같은 Light 서브에이전트가 이동 경계와 Web default 제거를 순차 감사했다.

## 후속

Sprint 5에서 Project asset과 Source 선택/읽기를 Gateway capability로 전환한다.

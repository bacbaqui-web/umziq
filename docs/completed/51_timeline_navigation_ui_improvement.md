# Timeline Navigation UI Improvement

## 목적

Timeline에서 현재 위치를 바로 이해하고 기존 Composition으로 빠르게 이동할 수 있도록 Navigation 표시와 클릭 흐름을 개선했다.

새 Composition 기능이나 Project Navigation을 추가한 작업이 아니다. 기존 `useProjectNavigationController().enterComposition()`으로 이어지는 Timeline `commands.selectComposition()`을 그대로 사용한다.

## 이전 구조의 문제

- Breadcrumb가 Composition 경로와 선택 Layer/Sub Composition 이름을 하나의 문자열로 합쳤다.
- 전체 문자열이 하나의 버튼이라 상위 Composition을 직접 클릭할 수 없었다.
- Timeline selection이 없으면 현재 Composition이 있어도 `No selection`으로 표시됐다.
- Switcher는 현재 parent의 direct children 중심이라 같은 level 이동 외에는 여러 단계를 거쳐야 했다.
- Switcher의 parent/current box가 이동 버튼이 아니었고 현재 위치 표현도 상황마다 달랐다.
- outside click은 있었지만 Escape와 focus return 계약은 없었다.

## 변경 구조

### Composition Breadcrumb

Breadcrumb를 문자열에서 typed segment 배열로 변경했다.

```text
Composition Ancestor
  → Composition Ancestor
    → Current Composition

선택 Item
  → 별도 muted context label
```

- 실제 Composition ancestor와 current만 location segment로 표시한다.
- Main PSD가 Master의 `parentId`를 저장하지 않는 실제 구조에서도 가상 Master 루트를 찾아 화면에는 `프로젝트`로 표시한다. 현재 그룹 경로의 맨 왼쪽에 항상 두며 상위 그룹처럼 클릭해 즉시 이동할 수 있다.
- 내부 `Composition` 모델과 command 명칭은 유지하고 사용자 화면에서만 Composition을 `그룹`으로 표현한다.
- 현재 그룹을 눌러 여는 이동 popover는 별도 제목 없이 그 그룹의 직계 하위 그룹만 바로 표시한다.
- ancestor는 subtle pill button이며 한 번 클릭하면 기존 Composition command로 이동한다.
- current는 강조된 popover trigger이고 `aria-current="page"`를 사용한다.
- 선택 Item 이름은 위치 경로와 섞지 않고 별도 context label로 표시한다.
- Timeline selection이 없어도 현재 Composition location을 표시한다.

### Composition Switcher

Switcher는 현재 그룹의 `Composition.children`에 들어 있는 직계 하위 그룹만 표시한다.

- `프로젝트`에서 열면 Main PSD 그룹만 표시하고 그 내부의 하위 그룹은 펼치지 않는다.
- 일반 그룹에서 열면 해당 그룹의 바로 아래 자식만 표시한다.
- 더 깊은 그룹은 자식으로 이동한 뒤 그 그룹의 switcher를 다시 열어 탐색한다.
- 기존 `Composition.children` 순서를 그대로 사용한다.
- 전체 hierarchy flatten, 검색, 생성, 삭제, 재배치와 새 Navigation history는 추가하지 않았다.

### Popover Interaction

- outside pointer로 닫는다.
- Escape로 닫고 trigger focus를 복원한다.
- Composition 선택 뒤 popover를 닫고 새 current trigger로 focus를 복원한다.
- trigger는 `aria-haspopup="dialog"`와 `aria-expanded`를 제공한다.
- Switcher current item은 `aria-current="page"`를 제공한다.

### Timeline Mini Flowchart

- Timeline의 비입력 영역이 활성화된 상태에서 Tab을 누르면 현재 그룹 중심의 이동 지도를 연다.
- 현재 그룹, 직계 상위 그룹 또는 프로젝트, 직계 하위 그룹만 표시한다.
- `상위/프로젝트 → 현재 그룹 → 직계 하위 그룹` 순서로 왼쪽에서 오른쪽으로 흐르며, 하위 그룹이 여러 개면 오른쪽 열에 세로로 정렬한다.
- 노드를 선택하면 기존 `commands.selectComposition()`으로 즉시 이동하고 지도를 닫는다.
- Tab 재입력, Esc와 배경 클릭으로 닫는다.
- Tab으로 닫을 때 Timeline Panel에 포커스를 복원하여, 다른 패널을 클릭하기 전까지 다음 Tab도 Timeline 지도에 계속 귀속된다.
- input, textarea, select, button과 contenteditable에서는 웹의 기본 Tab 포커스 이동을 보존한다.
- 지도 open state는 Timeline Panel의 일시적인 UI state이며 Project, Store, Runtime과 History에 저장하지 않는다.

## 이동 경계

```text
Breadcrumb / Switcher
  → Timeline commands.selectComposition(compId)
  → useTimelineNavigationController
  → projectEngine.enterComposition(compId)
```

기존 Project Navigation이 다음 의미를 계속 담당한다.

- Composition별 기억된 selection 복원
- 유효하지 않은 selection의 topmost item fallback
- selected Composition과 Timeline/Layer selection 갱신
- keyframe과 Transform Draft clear
- 기존 source-status acknowledge 의미

Timeline UI는 Project state를 직접 수정하지 않고 History를 추가하지 않는다.

## 주요 변경 파일

- `src/engines/timeline/helpers/timelineBreadcrumbHelpers.ts`
- `src/engines/timeline/models/timelineViewModel.ts`
- `src/engines/timeline/controllers/useTimelineNavigationController.ts`
- `src/engines/timeline/controllers/useTimelineViewController.ts`
- `src/engines/timeline/useTimelineEngine.ts`
- `src/features/timeline/components/TimelineSelectionBreadcrumb.tsx`
- `src/features/timeline/components/TimelineCompositionSwitcher.tsx`
- `src/features/timeline/components/TimelineMiniFlowchart.tsx`
- `src/features/timeline/components/TimelineHeader.tsx`
- `src/features/timeline/components/TimelinePanel.tsx`
- `scripts/verifyTimelineHelpers.ts`
- `scripts/verifyTimelineNavigationUi.ts`

## 보존한 계약

- Project schema와 Composition hierarchy 변경 없음
- Navigation command와 selection 복원 의미 변경 없음
- History 추가 없음
- Renderer, Animation, Playback와 Draft Runtime 변경 없음
- 새 Engine, Store와 Runtime 없음
- Timeline item/keyframe 편집 의미 변경 없음

## 검증

- Timeline helper verification: 통과
- Timeline Navigation UI verification: 통과
- Engine import boundary: 통과
- Project selection identity: 통과
- 전체 verification: 46개 script 통과
- ESLint: 통과
- Production build: 통과
- `git diff --check`: 통과

실제 Browser QA는 사용자 요청이 없어 수행하지 않았다. 정적·자동 검증 통과를 실제 시각 QA 통과로 기록하지 않는다.

## 알려진 한계

- Popover 검색은 제공하지 않는다. 현재 프로젝트 규모에서는 전체 hierarchy 목록을 우선 사용한다.
- 키보드 방향키 기반 menu navigation과 focus trap은 제공하지 않는다. Tab, Escape와 기본 button focus를 사용한다.
- Breadcrumb 폭이 매우 좁으면 CSS ellipsis로 segment와 selection context가 축약될 수 있다.
- 다음 Timeline Layer Stack & Time Viewport Foundation 계획은 별도 `docs/97_next_sprint.md`에 있으며 이번 작업에는 포함하지 않았다.

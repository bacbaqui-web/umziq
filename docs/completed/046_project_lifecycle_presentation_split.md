# Project Lifecycle Presentation Split 완료

## 결과

큰 `ProjectLifecycleBar.tsx`에 함께 있던 Browser 폴더 접근, Create/Open/Close UI
workflow, ViewProps 조립과 표시 책임을 분리했다. 기존 Bar 공개 props와 Project
Lifecycle Core Controller, UI Command Port, Project Owner 계약은 유지했다.

```text
ProjectLifecycleBar facade
├─ useProjectLifecycleUiController
│  └─ ProjectLifecycleUiController
│     └─ Browser Directory Adapter
├─ Project Lifecycle UI Composer
└─ ProjectLifecycleView
   ├─ Toolbar
   ├─ Start Screen
   ├─ New Project Dialog
   ├─ Missing Source Banner
   └─ ProjectExportDialog
```

## 책임 분리

- Browser Directory Adapter가 `showDirectoryPicker`, `.ziq` 0/1/복수 탐색,
  Project/`psd/`/`audio/` 폴더 준비와 native write target 변환을 담당한다.
- UI Controller가 pending directory, creating, Export open과 Create/Open/Close
  intent의 성공·실패·취소·stale cleanup을 담당한다.
- Open 전에 임시로 연결한 asset directory는 실패나 dirty 취소에서 이전 값으로
  복구하고 queued open selection은 성공과 실패 모두 정확히 한 번 해제한다.
- Composer는 Core ViewModel과 Controller 결과를 공개 ViewProps로 조립하며
  workflow 실행 순서, 조건, picker와 Project mutation을 소유하지 않는다.
- Toolbar, Start Screen, New Project Dialog와 Missing Source Banner는 받은
  ViewProps 표시와 intent 전달만 담당한다.
- `ProjectExportDialog`의 자체 portal을 유일 owner로 남기고 Bar의 중복 portal을
  제거했다.

## 보존한 계약

- `.ziq` container와 Project schema를 변경하지 않았다.
- `LayerDocumentProjectLifecycleController`, Save/Open/Reconnect Controller와
  `ProjectLifecycleUiCommandPort`의 공개 의미를 변경하지 않았다.
- Project 변경은 기존 Project Owner와 Core Controller 경로만 사용한다.
- 새 Project의 폴더, `.ziq`, `psd/`, `audio/` 구조와 Project Open의 `.ziq`
  단일 파일 조건을 유지했다.
- dirty 확인, notice, Missing/Reconnect, Save As 활성 조건과 기존 class/문구를
  유지했다.
- Export format, renderer, destination, codec와 cancel Runtime은 변경하지 않았다.

## Lifecycle 결과 표

| Intent | 결과 | Project/asset directory |
| --- | --- | --- |
| New 위치 picker 취소 | Dialog 유지 | 기존 상태 유지 |
| New 폴더에 `.ziq` 존재 | 안내 후 Dialog 유지 | 기존 상태 유지 |
| New command 실패 | `creating` 해제, Dialog 유지 | 이전 asset directory 복구 |
| Open picker 취소·권한 실패 | Open 중단 | 현재 Project와 asset directory 유지 |
| Open 폴더 `.ziq` 0개·복수 | 구조화 안내 후 중단 | 현재 상태 유지 |
| Open Core 실패·dirty 취소 | queued selection 해제 | 이전 asset directory 복구 |
| Open 성공 | 새 Project 원자 교체 | 선택한 Project directory 유지 |
| Close dirty 취소 | Close 중단 | 현재 상태 유지 |
| Close 성공 | blank untitled Project | asset directory 해제 |

## 자동 검증

- 구조 이동 전 `npm run qa`: 기존 verification 60개, lint와 build 통과
- `verifyLayerDocumentProjectLifecycleUi.ts`: 기존 Core command fixture와 새
  Adapter/Controller/Composer/Component import·owner 경계 확인
- `verifyProjectLifecyclePresentationSplit.ts`: fake DirectoryHandle로 picker
  미지원·취소·실패, `.ziq` 0/1/복수, `psd/`·`audio/` 생성, connection restore,
  queued selection cleanup 1회, create 실패 복구, 중복 intent와 Export prepare
  1회 확인
- 전체 `npm run qa`: verification 61개, ESLint, TypeScript와 Vite build 통과
- `git diff --check`: 통과

Vite의 기존 500kB 초과 chunk 경고는 남아 있으며 이번 Sprint의 변경 실패가
아니다.

## 남은 실제 Browser 수동 QA

자동 검증과 fake handle은 실제 Browser File System Access 권한과 overlay 화면을
대신하지 않는다. 다음 항목은 실제 Browser에서 아직 확인하지 않았다.

1. Start Screen과 Toolbar가 기존 위치와 디자인으로 표시되는지
2. 실제 폴더 picker에서 새 Project, `psd/`, `audio/`와 `.ziq`가 생성되는지
3. 실제 `.ziq` 0/1/복수 폴더 안내와 Open 결과
4. dirty New/Open/Close 취소 뒤 현재 Project와 asset directory 유지
5. Save, Save As, Missing Source Reconnect와 project location 표시
6. Export Dialog가 한 번만 올바른 z-index로 표시되고 출력/취소가 유지되는지

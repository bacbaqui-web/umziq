# 현재 Source Map

## 최상위 조립

- `src/editor/useEditorRoot.ts`: Nexus, Web Gateway capability, Editor Runtime과 모든 Engine을 한 번 조립한다.
- `src/editor/EditorShellLayout.tsx`: Menu/Library/Canvas/Timeline/Visual/Audio/Drawing Panel을 배치한다.
- `src/editor/nexus/`: canonical Project, transaction, replace, History와 Selection authority다.

## Gateway

- `src/gateway/contracts/`: Project Storage, Source Access, Microphone Capture, Export Destination의 플랫폼 중립 Port다.
- `src/gateway/platforms/web/`: Browser picker, File System Access, download, microphone와 destination 구현이다.
- `src/gateway/testing/`: capability별 deterministic Fake 구현이다.
- Gateway는 Engine을 import하지 않으며 native File/Handle/Blob/MediaStream을 contract로 노출하지 않는다.

## Engine

- `src/engines/menu/`: 상단 Menu Bar, New/Open/Save/Save As/Close와 Export workflow다. Export Controller는 Menu Composer 수명으로 조립되어 destination, progress, error와 abort를 소유한다.
- `src/engines/library/`: Source/Layer Tree, PSD·Audio import, Reconnect와 Recording workflow다. 공개 계약은 neutral Source reference와 Recording preview를 사용하며 Browser `File` 선택은 UI/Web Gateway 경계에서 등록한다.
- `src/engines/visual/`: visual Layer의 Transform, Opacity, Animation과 Modifier Inspector다.
- `src/engines/audio/`: Audio Composer가 Basic/Effects Controller를 조립하고, 각 Controller가 Draft와 transaction을 담당하며 Helper가 순수 ViewModel 계산을 수행한다.
- `src/engines/canvas/`, `timeline/`, `drawing/`: 각 독립 Panel과 projection/interaction이다.
- `src/engines/project/`: Nexus reducer, Project file workflow, codec와 Source preparation이 남아
  있는 내부 core 위치다. 폴더 이름과 달리 독립 Panel Engine으로 분류하지 않는다.
- `src/engines/psd-tree/`: 현재 Editor Root에서 조립되지 않는 과거 PSD Tree public boundary다.
  현재 Library Panel의 Tree와 import workflow 기준은 `src/engines/library/`이며, 이 경로의
  제거 또는 흡수는 별도 코드 정리에서 결정한다.

각 Engine의 기본 구조는 `Engine facade → Composer → Controller → Helper`다. Port는 Controller가 Nexus, Gateway 또는 Runtime과 통신하는 계약이다.

## Runtime·순수 모듈·UI

- `src/editor/audio-runtime/`: decoded audio, audition과 waveform Runtime이다.
- `src/editor/projectExport*.ts`: render/audio/encoder Export Runtime이다. destination I/O는 Gateway를 사용한다.
- `src/shared/models/projectExportContract.ts`: Menu와 Editor Export Runtime이 함께 사용하는 format/progress 중립 계약이다.
- `src/render/`, `src/animation/`, `src/layer-types/`, `src/models/`: render, 순수 계산, Layer 지원과 저장 schema다.
- `src/features/library/`, `visual/`, `audio/`: 담당 Engine의 ViewProps와 command만 소비하는 Panel UI다.

## 검증

- `scripts/runVerificationSuite.mjs`: alias-aware 전체 verification suite다.
- `scripts/verifyEngineImportBoundaries.ts`: Engine 의존 경계를 검증한다.
- `scripts/verifyPlatformBoundaryBaseline.ts`: Platform API 누수 baseline을 검증한다.
- 완료 검사는 `npm run lint`, `npm test`, `npm run build`, `git diff --check`다.

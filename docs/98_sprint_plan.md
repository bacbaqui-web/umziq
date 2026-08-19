# 최종 Architecture 안정화 Sprint 계획

> 상태: 완료 — `docs/completed/067_final_architecture_stabilization.md`

## 1. 목표

Nexus·Gateway·Engine 대규모 리팩터링 뒤 남은 경계와 Runtime 수명 문제를 정리하고,
Architecture 리팩터링을 종료한다.

이번 Sprint는 새 기능을 추가하는 작업이 아니다. 현재 사용자 동작, UI, `.ziq` schema와
Project transaction 결과를 유지하면서 다음 세 가지를 완성한다.

1. Menu Export Controller의 수명을 React 재렌더링과 분리한다.
2. Audio Engine을 `Engine → Composer → Controller → Helper` 구조로 정리한다.
3. Engine 공개 계약에서 Editor 구현 의존성과 Browser 파일 타입을 제거한다.

## 2. 기준 Architecture

- Project와 Nexus: `docs/architecture/10_project_architecture.md`
- Export Runtime: `docs/architecture/11_render_architecture.md`
- Draft와 History: `docs/architecture/13_history_draft_architecture.md`
- Source와 Recording: `docs/architecture/15_source_architecture.md`
- Menu와 Project Lifecycle: `docs/architecture/17_persistence_lifecycle_architecture.md`
- Gateway와 Platform Adapter: `docs/architecture/18_platform_gateway_architecture.md`

목표 구조는 다음과 같다.

```text
Editor Root
├─ Nexus
├─ Gateway capability ports
├─ Editor Runtime
└─ Engines
   ├─ Menu Engine
   │  └─ Composer
   │     └─ Export Controller
   │        ├─ Export Runtime Port
   │        └─ Export Destination Port
   └─ Audio Engine
      └─ Composer
         ├─ Audio Basic Controller
         │  └─ Pure Helper
         └─ Audio Effects Controller
            └─ Pure Helper
```

## 3. 범위

### Task 1. 현재 동작 Characterization

- Export 실행, 진행률, 완료, 실패와 취소 동작을 변경 전에 테스트로 고정한다.
- 출력 도중 상위 React 재렌더링이 발생하는 경우를 재현한다.
- Audio 기본 속성 Draft와 Effect 명령의 현재 결과를 행동 테스트로 고정한다.
- Library 파일 입력과 Recording 결과가 현재 어디에서 Browser 타입으로 변환되는지
  실제 호출 경로를 기록한다.

완료 조건:

- Export 재렌더링·취소 회귀를 실패로 감지하는 테스트가 있다.
- Audio의 focus/change/commit/cancel, mute, Effect 추가·삭제·이동·parameter commit 결과가
  테스트로 보호된다.

### Task 2. Menu Export Controller 수명 안정화

- `ProjectExportDialog`에서 Controller를 생성하지 않는다.
- Menu Composer가 Export Controller를 조립하고 Dialog에는 ViewProps와 command만 전달한다.
- Controller가 destination, progress, error, busy, abort와 실행 수명을 소유한다.
- React callback identity가 바뀌어도 진행 중 Controller가 교체되지 않게 한다.
- Dialog close와 Controller dispose/cancel 규칙을 명시한다.

완료 조건:

- 출력 중 재렌더링 뒤에도 진행률과 destination이 유지된다.
- 재렌더링 뒤 cancel이 현재 실행 중인 작업을 정확히 중단한다.
- 완료·실패·재시도·닫기 상태가 하나의 Controller snapshot과 일치한다.
- Dialog는 제품 workflow와 AbortController를 소유하지 않는다.

### Task 3. Audio Engine 구조 정리

- 현재 `useAudioEngine`의 Audio Basic과 Audio Effects 책임을 별도 Controller로 분리한다.
- Composer가 두 Controller를 조립해 기존 공개 ViewProps를 구성한다.
- clamp, parameter projection과 순수 ViewModel 계산은 Helper로 이동한다.
- Nexus commit과 History 의미를 변경하지 않는다.
- `useAudioEngine`은 공개 경계 또는 얇은 Composer facade로 유지한다.

완료 조건:

- Audio Basic과 Audio Effects가 독립 Controller 수명을 가진다.
- Composer에 제품 계산이나 transaction 정책이 없다.
- 한 번의 사용자 확정이 기존과 같은 Project transaction과 History 한 건만 만든다.
- 기존 Audio UI 공개 계약과 사용자 결과가 유지된다.

### Task 4. Menu Export 계약의 의존 방향 수정

- Menu Engine의 `@/editor/projectExport` 타입 import를 제거한다.
- format, destination, progress와 실행 Port를 Menu 소유 모델 또는 중립 Runtime 계약으로
  이동한다.
- Editor Export Runtime이 Menu가 요구하는 최소 Port를 구현하게 한다.
- Encoder Runtime과 Export Destination Gateway를 합치지 않는다.

완료 조건:

- Menu Engine 공개 model/controller/component가 Editor 구현을 import하지 않는다.
- Menu Controller는 구체 encoder나 Web Adapter를 알지 않는다.
- Editor Root는 Runtime Port와 Gateway Destination Port를 한 번 조립해 주입한다.

### Task 5. Library 공개 계약의 Platform 중립화

- `FileList` 변환을 Browser UI 또는 Web Source Access Adapter 경계로 이동한다.
- Library Engine은 neutral Source reference 또는 현재 Source Access 계약만 받는다.
- Recording review에 노출된 `File`은 실제 소비 경로를 확인한 뒤 neutral preview/source
  계약으로 교체한다.
- Browser object URL과 input element 수명은 UI/Platform 경계에 유지한다.
- 대용량 Source bytes를 Core에 무조건 복사하는 방식은 도입하지 않는다.

완료 조건:

- Library Engine 공개 model에 `FileList`가 없다.
- Engine에 남는 `File`이 없다. 불가피한 UI 전용 타입은 Engine 밖으로 이동한다.
- Browser 파일 선택과 Recording confirm 결과는 기존과 같다.

### Task 6. Boundary 검증과 문서 동기화

- 다음 회귀를 자동 검증한다.
  - Nexus가 Gateway/Platform Adapter를 import하지 않는다.
  - Gateway가 Engine/Nexus 구현을 import하지 않는다.
  - Engine 공개 계약이 `@/editor`를 import하지 않는다.
  - Engine 공개 계약에 `File`, `FileList`, `Blob`, native handle과 Media API 타입이 없다.
  - Engine Controller가 구체 Web Adapter를 import하지 않는다.
- 기존 allowlist는 새 위반을 추가하지 않고 실제로 제거된 항목만 줄인다.
- `docs/20_src_map.md`와 관련 Architecture의 현재 구현 설명을 갱신한다.
- 완료 후 이 Sprint를 `docs/completed/`의 다음 번호로 보존하고 최근 Task를 갱신한다.

완료 조건:

- Architecture 문서, Source Map과 실제 import 방향이 일치한다.
- 정적 문자열 검사만으로 행동 테스트를 대체하지 않는다.

### Task 7. 최종 검증

자동 검증:

- `npm run lint`
- `npm test` 또는 alias-aware 전체 verification suite
- `npm run build`
- `git diff --check`
- 변경 파일과 boundary allowlist diff 검토

사용자가 Sprint 전체 실행을 승인하면 실제 Browser QA도 수행한다.

- New / Open / Save / Save As / Close와 dirty confirm
- `.ziq` 저장 후 재열기와 Project replace
- PSD·Audio import와 missing Source reconnect
- microphone permission, device 변경, 녹음, cancel, retry와 confirm
- MP4 / WebM / GIF / WebP 출력
- destination 선택, download fallback, 출력 취소와 실패
- 주요 Project 변경 뒤 Undo / Redo

정적 검증 통과를 실제 Browser picker, microphone와 media 출력 통과로 보고하지 않는다.

## 4. 금지 사항

- 새 사용자 기능, Panel과 설정을 추가하지 않는다.
- UI 디자인과 `.ziq` 저장 schema를 변경하지 않는다.
- Nexus와 Gateway의 최상위 구조를 다시 설계하지 않는다.
- Recording과 Export를 별도 Engine으로 승격하지 않는다.
- 미래 Electron/macOS/Windows/iOS/Android Adapter를 미리 만들지 않는다.
- Lifecycle 내부 용어를 이유 없이 일괄 rename하지 않는다.
- Browser Runtime API를 이름만 중립적인 `unknown` wrapper로 감추지 않는다.
- 테스트와 allowlist를 현재 구현에 맞춰 약화하지 않는다.
- 관련 없는 기존 작업과 dirty worktree를 정리하거나 되돌리지 않는다.

## 5. Sprint 종료 판정

다음을 모두 만족할 때만 Architecture 리팩터링 완료로 판정한다.

- Export Controller가 React 재렌더링과 무관한 안정된 실행 수명을 가진다.
- Audio Engine이 Composer와 Basic/Effects Controller 경계를 갖는다.
- Menu Engine이 Editor Export 구현을 역방향 import하지 않는다.
- Library Engine 공개 계약이 Browser 파일 타입을 노출하지 않는다.
- Nexus, Gateway, Engine과 Editor Root 의존 방향 검증이 통과한다.
- 기존 Project transaction, History, UI와 저장 결과가 유지된다.
- 전체 lint/test/build/diff 검증이 통과한다.
- 실제 Browser QA 결과와 수행하지 못한 항목이 문서에 사실대로 기록된다.

이 Sprint 이후에는 새로운 Architecture 문제나 실제 기능 요구가 발견되지 않는 한 구조
공사를 종료하고 제품 기능 개발로 전환한다.

## 6. 완료 결과

- Task 1~6 구현과 독립 감사를 완료했다.
- Export Controller 재렌더링·cancel·error·dispose 행동 검증을 추가했다.
- Audio Basic/Effects Controller와 Helper 분리를 완료했다.
- Menu/Audio/Library의 Editor 역방향 import 금지와 Library 공개 model 플랫폼 중립화를
  검증한다.
- `npm run lint`, 69개 verification, `npm run build`, `git diff --check`를 통과했다.
- 실제 Browser에서 앱 로드, Start Screen과 New Project Dialog open/cancel을 확인했고
  console error/warning은 없었다.
- 실제 picker, `.ziq` 파일 round trip, microphone와 MP4/WebM/GIF/WebP 결과 확인은 외부
  파일·장치가 필요한 수동 QA로 남았다.

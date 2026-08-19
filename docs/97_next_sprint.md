# Nexus·Gateway·Editor Root·Engine 재구성 Roadmap

> 상태: Sprint 1~11 완료
> 현재 Sprint: 없음 — Architecture 리팩터링 종료
> 상세 계획: `docs/98_sprint_plan.md`

## 1. 최종 목표

움직의 Project 내부 세계, 외부 플랫폼 세계와 사용자 기능의 경계를 다음 구조로
재정의한다.

```text
Editor Root
├─ Nexus
│  ├─ canonical Project
│  ├─ validated transaction / replace
│  ├─ Project-only History
│  └─ Selection / internal session
├─ Gateway
│  ├─ Project Storage Capability
│  ├─ Source Access Capability
│  ├─ Microphone Capability
│  ├─ Export Destination Capability
│  └─ 실제 제품에 필요한 외부 Capability
├─ Editor Runtime
└─ Engines
   ├─ Menu Engine ↔ Menu Bar
   │  ├─ New / Open / Save / Save As / Close
   │  ├─ Project Session
   │  └─ Export Controller
   ├─ Library Engine ↔ Library Panel
   │  ├─ Source Import
   │  ├─ Reconnect Controller
   │  └─ Recording Controller
   ├─ Visual Engine ↔ Visual Panel
   ├─ Audio Engine ↔ Audio Panel
   ├─ Canvas Engine
   ├─ Timeline Engine
   ├─ Drawing Engine
   └─ 실제 독립 Panel이 있는 기존 Engine
```

용어의 의미는 다음과 같이 고정한다.

- **Nexus**: 움직 내부 Project 세계의 본진이자 유일한 canonical authority
- **Gateway**: 움직 밖의 저장소, 파일, 장치, 권한과 OS capability로 나가는 공식 관문
- **Editor Root**: Nexus, 현재 플랫폼 Gateway, Runtime과 Engine을 각각 한 번 조립하는
  최상위 경계
- **Engine**: 독립 Panel과 사용자 기능의 public boundary
- **Port**: Controller가 Nexus, Gateway 또는 Runtime과 통신하는 interface이며 별도
  실행 계층이 아님
- **Adapter**: Gateway/Runtime Port의 플랫폼별 구현

## 2. 공통 불변 계약

- Nexus는 Project 원본, transaction, replace, History, Selection과 내부 session만
  소유한다.
- Nexus와 Gateway는 서로 import하거나 호출하지 않는다.
- Gateway는 Architecture상 하나의 공식 개념이지만 코드에서는 작은 capability Port와
  Platform Adapter의 집합이다.
- Gateway 전체를 Engine이나 Controller에 Service Locator로 주입하지 않는다.
- Controller는 필요한 최소 Nexus Port, Gateway Port와 Runtime Port만 사용한다.
- Platform Adapter는 Project mutation, 제품 workflow, History와 UI state를 소유하지
  않는다.
- 모든 Engine은 `Engine → Composer → Controller → Helper` 기본 구조를 유지한다.
- Composer는 Controller 결과와 공개 ViewProps/API를 조립할 뿐 workflow 순서와 제품
  정책을 소유하지 않는다.
- Controller는 다른 Controller나 Composer를 직접 참조하거나 생성하지 않는다.
- Engine은 다른 Engine 내부 구현과 상태를 직접 참조하지 않는다.
- 저장 schema, `.ziq` container, 사용자 결과와 History 의미는 명시된 기능 Sprint가
  아니면 변경하지 않는다.
- 실제 Browser/device QA를 실행하지 않았으면 자동 검증으로 대체됐다고 보고하지 않는다.

## 3. 실행 순서

1. **Sprint 1 — Architecture 계약과 회귀 Baseline 고정**
2. **Sprint 2 — Project Owner를 Nexus로 전환**
3. **Sprint 3 — Gateway Foundation과 Project Storage Capability**
4. **Sprint 4 — Menu Engine과 Editor Root 전환**
5. **Sprint 5 — Project Asset·Source Access Gateway 전환**
6. **Sprint 6 — Library Reconnect와 Source Runtime 중립화**
7. **Sprint 7 — Properties/Audio Effects를 Visual/Audio Engine으로 재편**
8. **Sprint 8 — Library Recording과 Microphone Gateway 전환**
9. **Sprint 9 — Menu Export Controller와 Export Destination Gateway 전환**
10. **Sprint 10 — 최종 Platform Boundary 정리와 Architecture 확정**
11. **Sprint 11 — 최종 Architecture 안정화**

각 Sprint는 focused verification, 전체 `npm run qa`, `git diff --check`와 문서 동기화를
완료한 뒤 다음 Sprint를 `docs/98_sprint_plan.md`로 승격한다. 여러 Sprint의 대규모
이동을 한 번에 구현하지 않는다.

## 4. Sprint 1 — Architecture 계약과 회귀 Baseline 고정

> 상태: 완료 — `docs/completed/057_architecture_contract_regression_baseline.md`

### 목적

파일과 책임을 이동하기 전에 최종 용어, 의존 방향, 현재 동작과 Platform API 누수
baseline을 고정한다.

### 핵심 범위

- Nexus/Gateway/Editor Root/Menu/Visual/Audio 최종 계약을 Constitution과 Architecture에
  반영
- 현재 Owner, Lifecycle, Persistence, Source, Recording, Export 의존성 inventory
- Save/Open/History/Source/Recording/Export characterization 검증 위치 확인
- 향후 위반이 증가하지 않게 현재 예외를 명시한 boundary baseline 작성
- 단계별 문서와 검증 갱신 규칙 확정

### 금지

- 제품 코드 rename과 파일 이동
- Gateway/Nexus/Engine 구현 시작
- 사용자 동작과 UI 변경

## 5. Sprint 2 — Project Owner를 Nexus로 전환

> 상태: 완료 — `docs/completed/058_nexus_transition.md`

### 목적

현재 Project Owner의 책임과 동작을 그대로 유지하면서 이름, public entry와 최소 Port를
Nexus 경계로 전환한다.

### 핵심 범위

- `Project Owner` 관련 타입, hook, reducer, helper와 문서를 `Nexus` 용어로 mechanical
  rename
- `NexusProjectReadPort`, `NexusTransactionPort`, `NexusReplacePort`,
  `NexusHistoryPort`, `NexusSelectionPort` 최소 계약 구성
- 기존 Engine과 Editor Runtime이 Nexus 전체가 아니라 필요한 Port만 소비하도록 단계적
  연결
- Nexus 내부에 Lifecycle, Browser, File/Handle과 제품 workflow가 없는지 정적 검증

### 완료 조건

- transaction, replace, Undo/Redo, Selection과 Runtime effect 결과가 변경 전과 같다.
- 두 번째 Project 원본이나 Nexus 인스턴스가 생기지 않는다.
- Nexus는 Gateway, Platform Adapter와 Engine UI를 import하지 않는다.

## 6. Sprint 3 — Gateway Foundation과 Project Storage Capability

> 상태: 완료 — `docs/completed/059_project_storage_gateway.md`

### 목적

외부 capability의 공식 코드 경계를 만들고 `.ziq` Project read/write부터 Gateway로
전환한다.

### 목표 구조

```text
gateway/
├─ contracts/
│  └─ projectStorageGateway
├─ platforms/
│  ├─ web/
│  │  ├─ createWebGateway
│  │  └─ adapters/
│  │     ├─ file-system-access
│  │     ├─ file-input
│  │     └─ browser-download
│  └─ test/
│     └─ createFakeGateway
└─ index
```

### 핵심 범위

- 플랫폼 중립 `ProjectReadPort`와 `ProjectWritePort`
- Web File System Access와 input/download fallback Adapter
- Test Fake Adapter와 공통 contract test
- native handle을 Gateway session 내부에 보관하고 Core에는 neutral target identity만 제공
- Persistence를 순수 Helper + Storage Port + Platform Adapter 책임군으로 유지

### 완료 조건

- `.ziq` Save/Open 공개 계약에 Browser `File`, `Blob`과 `FileSystem*` 타입이 없다.
- Web/Fake 구현을 바꿔도 Controller 계약은 변하지 않는다.
- canonical `Save → Load → Save` bytes가 동일하다.

## 7. Sprint 4 — Menu Engine과 Editor Root 전환

> 상태: 완료 — `docs/completed/060_menu_engine_editor_root.md`

### 목적

상단 Menu Bar의 Project workflow를 Menu Engine으로 모으고 기존 Composition Root를
Editor Root로 전환한다.

### 목표 구조

```text
Menu Engine
└─ Menu Composer
   ├─ New/Close Controller
   ├─ Open Controller
   ├─ Save Controller
   └─ Project Session Controller

Editor Root
├─ Nexus
├─ Gateway
├─ Editor Runtime
└─ Engines
```

### 핵심 범위

- `ProjectLifecycleBar`를 Menu Engine의 공개 ViewProps/command에 연결
- New/Open/Save/Save As/Close와 Start Screen 흐름 이동
- dirty/savepoint/current target/operation token을 Project Session Controller가 소유
- Open Controller의 Save Controller 직접 참조를 공통 Session Port로 교체
- Editor Root는 인스턴스 생성과 최소 Port 주입만 담당
- Export는 기존 동작을 유지하고 Sprint 9에서 Menu Export Controller로 최종 이동

### 완료 조건

- Menu Engine과 Controller가 구체 Web Adapter를 import하지 않는다.
- Editor Root에는 workflow, dirty 계산과 파일 I/O가 없다.
- New/Open/Close 뒤 모든 Engine이 같은 Nexus Project를 관찰한다.

## 8. Sprint 5 — Project Asset·Source Access Gateway 전환

> 상태: 완료 — `docs/completed/061_source_access_gateway.md`

### 목적

Project asset directory, PSD/Audio import와 Source picker를 `SourceAccessPort`와 Gateway
Adapter로 이동한다.

### 핵심 범위

- Project directory와 asset read/write Capability 계약
- Source picker와 neutral Source input 계약
- native File/Directory handle의 Gateway session registry
- `projectAssetDirectoryRuntime`의 Browser API와 제품 policy 분리
- Library PSD/Audio import Controller의 Browser `File`/`FileList` 직접 의존 축소

### 완료 조건

- Library Controller가 `window`, `document`, `navigator`와 File System Access API를 직접
  사용하지 않는다.
- import cancel/failure와 asset-copy prompt 결과가 유지된다.
- 대용량 Source를 무조건 bytes로 복사하는 범용화를 만들지 않는다.

## 9. Sprint 6 — Library Reconnect와 Source Runtime 중립화

> 상태: 완료 — `docs/completed/062_library_reconnect_source_runtime.md`

### 목적

명시적 Missing Source 재연결을 Library Engine으로 이동하고 Source Runtime 공개 계약에서
Browser File/Handle 타입을 제거한다.

### 핵심 범위

- `Library Reconnect Controller`
- Gateway `SourceAccessPort`를 통한 파일 재선택
- fingerprint 확인, Runtime preparation과 resolution 복구
- 같은 파일 재연결은 History 0, mismatch 확인 뒤 Refresh/Replace만 Nexus transaction
- Open 중 자동 Source 준비는 Menu Open Controller에 유지
- Source Runtime에는 neutral resource access identity와 상태만 공개

### 완료 조건

- Menu Engine과 Library Engine이 서로 직접 참조하지 않는다.
- Project Open 뒤 Missing Source가 Library에 표시되고 명시적 Reconnect가 Library command로
  실행된다.
- 실패/취소/stale Reconnect가 기존 Project와 재생 가능한 Runtime을 보존한다.

## 10. Sprint 7 — Visual/Audio Engine 재편

> 상태: 완료 — `docs/completed/063_visual_audio_engine_split.md`

### 목적

Properties Engine을 Visual Engine으로, Audio Effects Engine을 Audio Engine으로 바꾸고
선택 Layer 종류에 따라 같은 Inspector 위치에 해당 Panel을 표시한다.

### 책임

```text
Visual Engine
├─ Transform
├─ Opacity
├─ Visual Animation
├─ Visual Modifier
└─ Visual Source 정보

Audio Engine
├─ Gain / Mute / Fade
├─ Audio Source 정보
├─ Ordered Audio Effects
└─ Effect parameter Draft
```

### 핵심 범위

- Properties의 Audio Controller와 Audio Section을 Audio Engine으로 이동
- Visual Engine에는 visual Layer 관련 책임만 유지
- Audio Effects Engine의 public boundary와 Panel을 Audio로 확장·rename
- Visual/Audio 선택에 따른 Inspector Panel projection
- 기존 Project transaction, Draft와 History 의미 유지

### 완료 조건

- Visual Layer 선택은 Visual Panel, Audio Layer 선택은 Audio Panel을 표시한다.
- Visual Engine에 Audio property/effect 책임이 남지 않는다.
- Audio Engine이 Audio 기본 속성과 ordered effect chain을 함께 제공한다.

## 11. Sprint 8 — Library Recording과 Microphone Gateway 전환

> 상태: 완료 — `docs/completed/064_microphone_capture_gateway.md`

### 목적

Recording을 독립 Engine으로 만들지 않고 Library Engine의 Recording Controller로 유지하며
Browser microphone 구현을 Gateway로 분리한다.

### 핵심 범위

- `MicrophoneCapturePort`
- Web MediaDevices/MediaRecorder Adapter
- Test Fake microphone Adapter
- Library Recording Controller는 Port와 Audio preparation Runtime만 사용
- device enumeration, permission, capture session과 dispose 계약 정리
- 녹음 검토·편집·확인 workflow와 History 의미 유지

### 완료 조건

- Library Engine과 Controller가 `navigator.mediaDevices`, `MediaRecorder`와 native stream을
  직접 사용하지 않는다.
- 다시 녹음, 취소, Project 교체와 unmount의 resource dispose 결과가 유지된다.
- 실제 Browser microphone QA 미실행 여부를 명시한다.

## 12. Sprint 9 — Menu Export Controller와 Export Destination Gateway 전환

> 상태: 완료 — `docs/completed/065_menu_export_destination_gateway.md`

### 목적

독립 Export Engine을 만들지 않고 출력 workflow를 Menu Engine의 Export Controller로
배치하며 destination I/O만 Gateway로 분리한다.

### 핵심 범위

- Menu `Export Controller`
- Gateway `ExportDestinationPort`
- Browser directory/download Adapter와 Test Fake Adapter
- Render/Audio/Encoder는 Export Runtime Port로 유지
- Export destination, encoder와 제품 workflow 책임 분리
- 기존 Export Dialog와 상단 출력 버튼 연결

### 완료 조건

- Export Controller는 DOM download, directory handle과 MediaRecorder를 직접 사용하지
  않는다.
- encoder Runtime은 Gateway에 흡수되지 않는다.
- 기존 format, 진행률, 취소와 결과 파일이 유지된다.

## 13. Sprint 10 — 최종 Platform Boundary 정리와 Architecture 확정

> 상태: 완료 — `docs/completed/066_final_platform_boundary_architecture.md`

### 목적

남은 직접 Platform API와 이전 public entry를 정리하고 최종 구조를 검증·문서화한다.

### 핵심 범위

- Engine/Controller의 직접 Browser/OS capability 접근 최종 inventory
- Nexus↔Gateway, Engine↔Engine과 Controller↔Controller 금지 검증
- Platform-neutral Port의 DOM/File/Handle 타입 금지 검증
- Web Gateway factory와 Editor Root 단일 조립 경로 확인
- Architecture 10~18, source map과 completed 기록 동기화
- 실제 Browser file picker, Source, microphone와 export 수동 QA

### 완료 조건

- 플랫폼 변경은 새 Gateway platform factory와 UI/Runtime shell 구현으로 제한된다.
- 공통 Nexus, Engine Controller, Project model과 Helper는 플랫폼과 무관하다.
- 현재 Web 동작과 저장 결과가 리팩터링 전과 같다.

## 14. Sprint 11 — 최종 Architecture 안정화

> 상태: 완료 — `docs/completed/067_final_architecture_stabilization.md`

- Export Controller를 Dialog 렌더 수명에서 Menu Composer 수명으로 이동했다.
- Audio Engine을 Composer, Basic/Effects Controller와 순수 Helper로 분리했다.
- Export 공용 contract와 Library Source/Recording 공개 계약을 플랫폼 중립화했다.
- lint, 69개 verification, build와 제한된 실제 Browser UI smoke를 통과했다.
- 실제 picker, microphone와 media 결과 파일 검증은 장치·파일을 사용하는 별도 수동 QA로
  남겼다.

## 15. 이번 Roadmap에서 하지 않는 것

- Auto Save, Cloud Sync, Recent Project와 Clipboard 기능 추가
- Safari/Electron/macOS/Windows/iOS/Android Adapter 선행 구현
- 플랫폼별로 복제된 Gateway contract
- 거대한 Gateway Service Locator와 문자열 capability registry
- `unknown nativeHandle`을 Core에 노출하는 이름뿐인 중립화
- 사용하지 않는 streaming/repository abstraction
- `.ziq` container나 Project schema 변경
- UI 디자인 전면 변경과 신규 제품 기능 추가

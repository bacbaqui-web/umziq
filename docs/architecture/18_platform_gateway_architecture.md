# Gateway Architecture

## 한 문장 정의

Gateway는 움직 밖의 저장소, 파일, 장치, 권한과 OS capability를 Core에서 분리하는 공식
관문이며, 코드에서는 작은 capability Port와 Platform Adapter의 집합으로 구현한다.

## 최상위 구조

```text
Editor Root
├─ Nexus
├─ Gateway Capability Bundle
├─ Editor Runtime
└─ Engines
```

Nexus와 Gateway는 대칭적인 두 Service 객체가 아니다. Nexus는 Project 내부 canonical
authority이고 Gateway는 외부 capability 경계다. 둘을 함께 사용하는 제품 workflow는
Engine Controller가 각각의 최소 Port를 주입받아 소유한다.

```text
Nexus -X→ Gateway
Gateway -X→ Nexus

Save Controller
├─ Nexus Project Read Port
├─ serialization/digest Helper
└─ Gateway Project Write Port

Open Controller
├─ Gateway Project Read Port
├─ parse/migrate/normalize/validate Helper
└─ Nexus Replace Port
```

## Gateway는 Service Locator가 아니다

Architecture에서는 Gateway라는 하나의 공식 경계를 사용하지만 다음과 같은 거대한
런타임 API를 만들지 않는다.

```text
gateway.getCapability(name)       # 금지
controller.gateway.platform.*     # 금지
EngineOptions { gateway }         # 금지
```

Gateway public 영역은 capability별 계약과 플랫폼별 구현을 찾는 위치다.

```text
gateway/
├─ contracts/
│  ├─ project-storage
│  ├─ source-access
│  ├─ microphone
│  └─ export-destination
├─ platforms/
│  ├─ web/
│  └─ test/
└─ index
```

Editor Root만 현재 플랫폼 capability bundle 전체를 만들 수 있다. 각 Engine과
Controller에는 실제로 필요한 Port만 명시적으로 주입한다.

## Capability Port

Port는 별도 실행 계층이 아니라 Controller와 외부 구현 사이의 interface다. 계약은
Browser/OS 객체가 아니라 제품 흐름에 필요한 플랫폼 중립 결과를 표현한다.

### Project Storage

- `.ziq` 선택과 bytes 읽기
- 저장 target 선택과 bytes 쓰기
- cancel, permission과 I/O 실패의 구조화 결과
- session-local target identity

### Source Access

- Project asset directory 접근
- PSD/Audio/Video Source 선택과 읽기
- linked Source 탐색과 명시적 Reconnect 선택
- session-local native resource identity와 permission

### Microphone

- permission과 capture session 요청
- device capability와 선택
- capture start/stop/cancel
- native stream/recorder의 exactly-once dispose

### Export Destination

- destination 선택
- 결과 이름과 bytes/blob-like output 쓰기
- cancel, permission과 write 실패 변환

Project Storage와 Export Destination은 둘 다 write를 제공하더라도 합치지 않는다.
Project Storage는 `.ziq`, save target identity와 savepoint workflow를 위한 capability이고
Export Destination은 렌더된 media output의 이름/format과 destination을 위한
capability다.

Clipboard, Cloud와 다른 capability는 실제 제품 기능이 생길 때만 추가한다.

## Platform Adapter

Platform Adapter는 외부 API를 Port 결과로 변환한다. Project mutation, History, 제품
workflow와 UI state를 소유하지 않는다.

현재 Web 구현은 브라우저 이름이 아니라 실제 capability 방식으로 나눈다.

```text
web/adapters/
├─ file-system-access
├─ file-input
├─ browser-download
└─ media-devices
```

Chromium에서도 File System Access API가 없으면 input/download fallback을 사용할 수 있다.
Safari/Electron/macOS/Windows/iOS/Android 구현은 실제 플랫폼 작업이 시작될 때 추가하고
빈 Adapter와 optional method를 미리 만들지 않는다.

플랫폼별 factory는 같은 capability 계약을 구현한다.

```text
createWebGateway
createTestGateway

미래:
createElectronGateway
createMacOSGateway
createWindowsGateway
createIOSGateway
createAndroidGateway
```

플랫폼 변경은 Editor Root에서 factory를 교체하며, 계약이 유지되는 한 Nexus와 Engine
Controller를 변경하지 않는다.

## Platform-neutral 계약

Core/Gateway contract에는 다음 타입을 노출하지 않는다.

- Browser `File`, `FileList`, `Blob`
- `FileSystemFileHandle`, `FileSystemDirectoryHandle`
- DOM element
- `MediaStream`, `MediaRecorder`
- Electron/Node `fs` 객체
- iOS native document handle
- Android Storage Access Framework 객체

Project `.ziq`는 `Uint8Array`와 session-local neutral target identity로 표현할 수 있다.
대용량 PSD/Audio/Video Source는 모든 입력을 무조건 bytes로 복사하지 않는다. native
resource는 Gateway session registry에 보관하고 Engine에는 neutral resource access
identity, metadata와 필요한 read capability만 제공한다. `unknown nativeHandle` 같은
이름뿐인 중립 타입을 만들지 않는다.

## UI와 Runtime API의 구분

모든 Browser API가 Gateway 대상은 아니다.

Gateway 대상:

- file/source picker와 storage
- permission과 native handle
- microphone capture
- clipboard
- export destination

UI presentation에 남을 수 있음:

- pointer/keyboard/focus/portal
- DOM layout과 ResizeObserver
- UI Canvas와 preview object URL
- React lifecycle

Runtime Adapter에 남을 수 있음:

- AudioContext playback/audition backend
- Canvas2D/WebGL renderer
- Export MediaRecorder/encoder
- decoder와 waveform 계산 Runtime

Recording의 MediaRecorder/MediaStream은 Gateway Microphone Adapter 내부에만 두고
Export의 MediaRecorder는 Export Encoder Runtime Adapter에 둔다. AudioContext는 Audio
audition/playback와 Export Audio Runtime Adapter에서만 사용한다. preview object URL은
UI/Source presentation 수명, export download URL은 Gateway Export Destination Adapter
수명으로 구분한다.

외부 destination과 encoder를 같은 Gateway 책임으로 합치지 않는다.

## 현재 구현 상태와 Baseline

Project Storage, Source Access, Microphone Capture와 Export Destination Gateway가 구현되어
Editor Root에서 현재 Web Adapter를 한 번 조립한다. Menu, Audio와 Library Engine은 Editor
구현을 역방향 import하지 않으며 Library 공개 계약은 `File`/`FileList` 대신 neutral Source
reference와 Recording preview를 사용한다.

Export format/progress는 shared neutral contract이고 Menu Export Controller가 workflow
수명을 소유한다. Encoder, AudioContext, MediaRecorder와 Canvas는 외부 destination이 아니라
Editor Export/Audio Runtime 경계에 유지한다.

`scripts/verifyPlatformBoundaryBaseline.ts`는 아직 다른 기존 Engine model과 Controller에
남아 있는 UI/Runtime Platform 타입을 파일별 baseline으로 고정한다. baseline은 새 위반을
허용하는 목록이 아니며 실제 경계가 제거된 Sprint에서만 감소시킨다. 현재 구현 위치는
`docs/20_src_map.md`를 따른다.

## Boundary 규칙

- Nexus는 Gateway와 Platform Adapter를 import하지 않는다.
- Gateway Adapter는 Nexus reducer/action과 Project transaction 생성 코드를 import하지
  않는다.
- Engine Controller는 구체 Platform Adapter를 import하지 않는다.
- Controller는 다른 Controller나 Composer를 직접 참조하지 않는다.
- Engine은 다른 Engine 내부 경로를 import하지 않는다.
- Gateway Port는 Platform-neutral 타입만 공개한다.
- Gateway platform factory는 Editor Root에서 한 번 생성한다.
- Adapter allowlist는 현재 위반을 고정하기 위한 임시 baseline이며 후속 Sprint에서만
  감소시킨다.

## 관련 Architecture

- Project/Nexus/Editor Root: `docs/architecture/10_project_architecture.md`
- Render/Export Runtime: `docs/architecture/11_render_architecture.md`
- Source/Recording/Reconnect: `docs/architecture/15_source_architecture.md`
- Persistence/Menu Project Session: `docs/architecture/17_persistence_lifecycle_architecture.md`

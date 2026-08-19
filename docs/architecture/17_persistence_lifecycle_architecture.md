# Persistence & Menu Project Session Architecture

## 한 문장 정의

저장 파일은 Plain Data Project만 보존하고, Open은 완전히 검증된 Project만
Nexus에서 원자적으로 교체한 뒤 Runtime을 다시 만든다. New/Open/Save/Close와 Project
Session은 Menu Engine이 소유한다.

## 책임 구조

```text
Menu Engine
└─ Menu Composer
   ├─ New/Close Controller
   ├─ Open Controller
   ├─ Save Controller
   ├─ Export Controller
   └─ Project Session Controller
      └─ dirty / savepoint / target / operation token

Save/Open Controller
├─ Nexus Port
├─ pure Persistence Helper
├─ Gateway Project Storage Port
└─ Runtime Port
```

Persistence는 별도 실행 계층이나 상태 소유자가 아니다. serialization, parsing,
migration, normalize, validation과 digest를 수행하는 순수 Helper, Gateway Storage Port와
Platform Adapter의 책임군이다. Port는 Controller와 외부 구현 사이의 interface이며
Platform Adapter는 Save/Open workflow나 Nexus mutation을 소유하지 않는다.

## 저장 Envelope

`.ziq`는 UTF-8 JSON이며 container와 Project schema version을 분리한다.

```text
{
  format: "umziq-project",
  containerVersion,
  project: LayerDocumentProject
}
```

- container version: 파일 포장 형식
- Project schema version: LayerDocumentProject 데이터 구조

현재 Project schema version은 3이다. schema 1은 1→2→3, schema 2는 2→3으로
순수 migration하며 Audio Source/Layer의 metadata, provenance, gain/mute/fade와
ordered effect envelope도 Plain Data round trip 대상이다.

## 저장 대상

저장:

- Project metadata
- Layer Documents
- Source Registry descriptor
- Canvas 촬영범위 설정(표시, 안전영역, 선택 강조, 확대 수치, 바깥 어둡기, 배경)

저장하지 않음:

- File, handle와 permission
- decoded Source resource
- decoded AudioBuffer, waveform cache, AudioContext/AudioNode와 audition session
- Canvas, ImageBitmap와 decoder
- Layer Selection과 active Group
- current frame와 playback
- Draft, Cache, Metrics와 Panel state

촬영범위 확대 수치는 Accurate Export의 출력 framing 입력이므로 단순 Panel state가
아니라 Project Plain Data다. 촬영범위 메뉴에서 함께 편집하는 표시, 안전영역,
선택 강조, 바깥 어둡기와 흰 배경 설정도 같은 `canvasSettings` 묶음으로 round trip한다.
미리보기 자체의 zoom과 pan은 출력 framing과 무관하므로 Runtime으로 유지한다.

## Save와 Save As

Save는 시작 시점의 Project를 immutable Plain Data snapshot으로 만든 뒤
normalize, validation과 canonical serialization을 수행한다.

- Save는 기존 writable target을 재사용할 수 있다.
- Save As는 새 target을 선택한다.
- write와 savepoint 갱신이 모두 성공해야 clean 상태가 된다.
- Cancel, permission, write와 stale operation 실패는 기존 target과
  savepoint를 보존한다.

## Load 순서

```text
bytes/UTF-8/JSON 제한
→ envelope와 version 확인
→ schema migration
→ normalize
→ validation
→ Load Candidate
→ Source Runtime 준비
→ Project Replace
→ Runtime 등록과 reconcile
```

Load Candidate가 완성되기 전에는 현재 Project, History, Runtime과 Save
target을 변경하지 않는다.

## Nexus Project Replace

New/Open에서 Project 교체는 하나의 Menu workflow 경계다.

성공 시:

- 새 Project 설치
- Project-only History 초기화
- Selection과 active Group 유효성 보정
- playback 정지와 frame/range clamp
- Draft와 Panel local state reset
- Source resolution 재구축
- Render/Source Cache invalidate
- visual/audio active·suspended Source resource와 waveform dispose-once

실패하거나 stale한 작업은 현재 Project를 그대로 유지한다.
실패, Cancel 또는 stale Project 작업은 현재 active/suspended cache와 재생 가능한
Source resource도 그대로 유지한다.

## Dirty와 Clean

Dirty는 UI flag나 object identity가 아니다. 현재 canonical Project digest와
마지막 savepoint digest를 비교한다.

- Save 중 후속 편집이 생기면 저장 성공 후에도 dirty다.
- Undo로 savepoint와 같은 내용에 돌아오면 clean이다.
- Runtime 변경은 dirty를 만들지 않는다.

## Linked Source

기본 정책은 Linked Source다. Project에는 Source descriptor만 저장하고 실제
PSD/Audio/외부 파일은 Open 뒤 다시 읽는다.

파일을 찾을 수 없으면 Project는 Ready-Degraded 상태로 열리며 Missing Source
UI와 Reconnect command를 제공한다.

Embedded package, Auto Save, Cloud Sync와 협업은 별도 기능이다. Recent Project는
Project나 `.ziq`를 변경하지 않는 Browser 편의 기능이며, 최근에 성공적으로 생성하거나
연 폴더의 `DirectoryHandle`, 표시 이름과 마지막 사용 시각을 IndexedDB에 최대 5개
보관한다. 재열기는 저장된 handle을 기존 Open 검증과 Project Replace 흐름에 다시
입력하며, 권한 거부나 접근 실패는 현재 Project를 변경하지 않는다.

## Reconnect

Reconnect는 선택한 파일을 decode하고 fingerprint를 확인한 뒤 Source Runtime을
교체한다.

- 성공: dependent Layer가 같은 resource를 공유하고 관련 Cache만 무효화
- mismatch: 명시적 Refresh/Replace 확인 요구
- 실패/Cancel/stale: 기존 Project와 Runtime 유지

## Migration과 Round Trip

Migration은 Plain Data의 순수 변환이다. File 접근, Runtime 생성과 UI
mutation을 수행하지 않는다.

유효한 current Project는 `Save → Load → Save`에서 같은 canonical bytes를
만들어야 한다. 알 수 없는 type/version과 제한 초과 입력은 구조화 오류로
거부한다.

## Menu UI와 Gateway Directory Runtime

Menu Engine의 Project Session, Save/Open/New/Close Controller와 UI Command Port가
Project replace, dirty, save/open과 notice의 workflow를 유지한다. 표시 계층은 Menu
public ViewProps/command만 사용하며 Nexus나 Project를 직접 변경하지 않는다. 명시적
Missing Source Reconnect는 Library Reconnect Controller가 담당한다.

- Gateway Directory/Storage Adapter는 `showDirectoryPicker`, `.ziq` 단일 파일 탐색,
  새 Project 폴더와 `psd/`·`audio/` 준비를 플랫폼 중립 결과로 변환한다.
- 선택한 `File`, queued open selection과 현재 asset directory는 저장되지 않는 Browser
  session Runtime이다. 최근 작업용 `DirectoryHandle`은 Project 저장과 분리된 IndexedDB
  browser cache에만 보관하며 브라우저 데이터 삭제 시 함께 사라진다.
- 각 Menu Controller가 자신의 Create/Open/Close 흐름의 시작부터 성공, 실패, 취소와
  cleanup까지 소유한다. 실패하거나 dirty 확인이 취소된 Open은 이전 asset
  directory를 복구하고 queued selection은 정확히 한 번 해제한다.
- Composer는 Core ViewModel과 UI Controller 결과를 공개 ViewProps로 조립할 뿐
  Controller 실행 순서, picker와 Project mutation을 소유하지 않는다.
- Start Screen, New Project Dialog와 Export Dialog는 각 overlay가 자기 portal을 한 번만
  소유한다. Export workflow는 Menu Composer가 한 번 조립한 Menu Export Controller가
  destination, progress, error와 abort 수명을 소유한다. Dialog는 Controller를 생성하지
  않고 ViewProps와 command만 사용한다. encoding은 Export Runtime, destination I/O는
  Gateway Export Destination Port가 담당한다.
- 직접 녹음의 정지·검토·다시 녹음은 Project directory를 쓰지 않는 session Runtime
  흐름이다. 사용자가 `확인`한 뒤에만 Editor Recording Asset Store Adapter가 현재
  directory의 `audio/`에 충돌 없는 이름으로 한 번 저장하고 Recording Controller가
  그 결과를 기존 Audio prepared confirm과 Nexus transaction 한 건으로 연결한다.
  Project 교체와 unmount는 확인 전 recorder/prepared Runtime을 폐기한다.

이 Runtime 경계는 `.ziq` envelope나 Project schema를 확장하지 않는다. 실제
Browser 권한은 저장할 수 없으므로 새 session에서 descriptor를 기준으로 Source를
다시 준비하고 필요하면 Missing/Reconnect 흐름으로 들어간다.

## 불변 조건

- Runtime을 저장하거나 History에 넣지 않는다.
- 검증 실패 시 현재 Project를 변경하지 않는다.
- Project Replace는 원자적이다.
- Load 뒤 Runtime은 descriptor로 다시 만든다.
- Missing Source가 Project Plain Data를 훼손하지 않는다.
- 새 Layer Type도 같은 envelope와 lifecycle을 재사용한다.
- Menu Controller는 구체 Platform Adapter를 import하지 않는다.
- Gateway Storage Adapter는 Nexus를 호출하지 않는다.

## 관련 Architecture

- Project: `docs/architecture/10_project_architecture.md`
- History/Dirty: `docs/architecture/13_history_draft_architecture.md`
- Source/Reconnect: `docs/architecture/15_source_architecture.md`
- Gateway: `docs/architecture/18_platform_gateway_architecture.md`

현재 실제 Controller/Adapter 이름과 위치는 `docs/20_src_map.md`를 따른다. 이 문서는
Roadmap 완료 뒤의 canonical 책임을 정의하며 현재 코드와의 차이는 Gateway 전환
baseline에 기록한다.

## Drawing persistence

Drawing version 3의 stroke command와 압축 PNG data URL은 Layer Document Plain Data로
저장되어 기존 Save/Open/History lifecycle을 그대로 사용한다. version 1·2 Drawing은
범용 element 호환 경계로 유지하고 version 3부터 알려진 element 구조를 검증한다.
외부 `image/drawing-layer/`를 canonical 원본으로 전환하려면 locator, 원자 파일 저장,
Undo revision 보존과 Missing 복구 계약을 먼저 추가해야 하며 현재 구현의 이중 원본으로
만들지 않는다.

# Source Architecture

## 한 문장 정의

Source는 원본의 identity와 재연결 정보를 제공하고, Layer Document는 그
Source를 참조하는 독립적인 작업 객체다.

## Source와 Layer Document

Layer Document는 PSD Layer 자체가 아니다.

```text
Source Registry
└─ PSD/Audio/외부 파일 descriptor
       ↑
Layer Document A
Layer Document B
```

여러 Layer Document가 같은 Source resource를 공유할 수 있지만 Transform,
Placement, Animation, Effect, Modifier와 Type별 데이터는 각각 독립적이다.

Drawing, Text와 Shape처럼 외부 원본이 없는 Layer는 Source 참조가 없을 수
있다.

## 저장되는 Source Descriptor

Source Registry에는 Plain Data만 저장한다.

- `sourceId`
- Source type
- stable locator identity
- 추천 파일명과 optional path hint
- content fingerprint와 byte length
- PSD node key/path와 visual fingerprint
- Audio provenance(imported/recorded), duration, channel count와 sample rate
- reconciliation 상태

Transform이나 Layer별 편집 데이터는 Source에 저장하지 않는다.

## Source Runtime

다음 값은 Editor session Runtime이다. 목표 구조에서 native File/Handle은 Gateway
session 내부에 보관하고 Engine과 Source Runtime 공개 계약에는 neutral resource access
identity와 상태만 제공한다.

- File과 FileSystemFileHandle
- permission 상태
- resolving/available/missing/error
- decoded PSD visual
- Canvas/ImageBitmap
- decoder와 prepared resource
- decoded AudioBuffer와 waveform peak cache
- AudioContext, AudioNode와 audition/playback handle
- Source visual Cache

Source Runtime은 `(projectId, source identity)`로 Project 간 resource를
격리하고 dispose-once를 보장한다.

## Library

Library Panel과 Engine은 현재 Project의 PSD와 Audio Source/Layer 구조,
import/record/refresh/delete/reconnect와 selection Intent를 표시한다. 향후
Image/Video asset도 같은 책임으로 확장한다. Project와 decoded resource를 직접
소유하지 않는다.

Library, Timeline과 Visual/Audio Engine이 공유하는 배치 선택 identity는
`layerDocumentId`다. Source 파일 전체 작업은 `sourceId`를 사용하므로 같은 Audio
Source를 여러 Cut에 배치해도 Source 삭제/reconnect와 개별 Layer 삭제를 혼동하지
않는다.

준비된 Source는 확인 전까지 Project 밖에 있으며 confirm transaction이
성공한 뒤 Source Registry와 Layer Document에 반영한다.

Library의 Source 작업 Runtime nexus는 다음과 같다.

| 흐름 | nexus | Project 교체·unmount cleanup |
|---|---|---|
| PSD import/refresh | PSD Import Controller | active prepared session cancel, external import `false` 완료 |
| Audio multi-import | Audio Import Controller | request token 폐기, 남은 prepared resource cancel |
| 직접 녹음 | Recording Controller | MediaStream/Recorder cancel, review prepared resource cancel |
| asset copy 확인 | Asset Copy Controller | pending Promise를 lifecycle cancel로 완료하고 prompt 제거 |
| Library drag | Drag Controller | candidate/drop target 폐기 |
| hover preview | Hover Preview Controller | delay timer, pending/stale preview 폐기 |

Composer는 이 흐름들의 실행 순서나 실패 정책을 정하지 않는다. PSD, Audio와
Recording의 다단계 prepare→confirm/cancel 규칙은 각각 해당 Controller 하나가
소유하며 실제 Project 변경은 계속 Nexus command/transaction을 통한다.

Library 계층과 표시 순서는 Source Tree가 아니라 LayerDocument의
`parentLayerDocumentId/order`를 유일한 원본으로 사용한다. Project root에는
Cut과 project-wide Audio가 함께 놓일 수 있고, Cut/Group 아래에는 visual과
Audio Layer가 같은 규칙으로 섞여 배치된다.

Gateway가 Project directory 권한을 가진 경우 import 전에 사용자가 선택하면
PSD는 `psd/`, Audio는 `audio/`에 복사하고 locator의 `relativePathHint`를
기록한다. 기존 Project 파일의 부모 directory는 브라우저가 자동으로 공개하지
않으므로 권한이 없을 때는 사용자가 Project 폴더를 한 번 지정한다. Library Controller는
Browser `File`, `FileList`, DirectoryHandle과 picker API를 직접 사용하지 않고 Gateway의
Source Access Port를 사용한다.

## Import

```text
File 선택
→ parse/decode와 fingerprint
→ prepared Source Runtime
→ Nexus transaction으로 descriptor/Layer 생성
→ Runtime register
```

실패 또는 Cancel은 Project를 부분 변경하지 않고 prepared resource를
dispose한다.

Audio 파일 import와 직접 녹음도 같은 prepared lifecycle을 사용한다. 직접 녹음은
정지할 때 Blob을 session 임시 File과 decoded Audio Runtime으로만 준비하며 이 시점에는
Project `audio/` 폴더를 쓰지 않는다. `확인` intent 뒤 Recording Controller가 충돌 없는
이름으로 최종 파일을 저장하고 실제 `audio/<파일명>` locator를 만든 다음에만 Audio
Source와 Audio Layer를 Nexus transaction 한 번으로 생성한다. 같은 PCM fingerprint의
다른 직접 녹음도 각 확정 원본 locator를 유지하도록 별도 recorded Source를 만든다.
Cancel, 다시 녹음, 권한 거부, decode 실패와 stale 결과는 Project/History 0건이며
stream/track/object URL/prepared resource를 exactly-once 정리한다. 파일 저장 실패는
새로 만든 불완전 entry를 best-effort 제거하고 prepared 검토 상태를 유지해 다시 확인할
수 있다. Nexus commit 뒤 Runtime registration 재시도가 남은 상태에서 Project가
교체되거나 Library가 unmount되면 session lifecycle은 미등록 resource를 abandon하고
exactly-once dispose한다.

Project asset 폴더에 복사한 PSD/Audio와 직접 녹음 원본은 Library의 Layer/Source
삭제로 물리 삭제하지 않는다. 삭제는 Project의 descriptor와 LayerDocument만
변경한다. 이름 충돌이 있는 asset 복사는 기존 파일을 덮어쓰지 않고 `이름 (2)`
형식의 사용 가능한 파일명을 선택하며 locator에는 실제 저장된 상대경로를 기록한다.
미사용 원본 정리는 사용자 확인을 받는 별도 기능의 책임이다.

## Refresh와 Replace

Refresh는 같은 Source identity의 새 원본 상태를 확인하고 dependent
LayerDocument projection을 갱신한다.

- fingerprint 일치 또는 명시적 사용자 승인
- dependent Source/Layer Cache targeted invalidation
- 새 Runtime 등록 성공 후 이전 Runtime dispose
- 실패 시 기존 Runtime과 Project 유지

다른 파일로 교체하거나 legacy fingerprint를 승인하는 작업은 명시적인
Project transaction이다.

## Missing Source와 Reconnect

파일이 없어도 Project Plain Data는 열린다. Source Runtime은 Missing/Error를
표시하고 dependent Layer는 degraded 상태로 남는다.

Reconnect는 Source 단위로 수행한다. 같은 Source를 참조하는 모든 Layer
Document가 성공한 reconnect 결과를 자동으로 공유한다. fingerprint mismatch는
자동 승인하지 않는다.

- 동일 descriptor/fingerprint를 다시 찾은 Runtime-only reconnect는 Nexus Project와
  History를 변경하지 않는다.
- locator 또는 fingerprint를 갱신하는 Source descriptor Refresh/Replace는 사용자 확인
  뒤 Nexus Source transaction 한 건과 History 한 건으로 확정한다.
- mismatch는 자동 변경하지 않고 Refresh/Replace/Cancel 선택 전까지 기존 Project와
  Runtime을 유지한다.

Project Open 중 descriptor를 기준으로 Source를 자동 준비하는 흐름은 Menu Open
Controller가 소유한다. 열린 Project에서 사용자가 특정 Missing Source를 다시 선택하는
명시적 Reconnect는 Library Reconnect Controller가 소유한다. 실제 파일 선택과 접근은
Gateway Source Access Port, parse/decode는 Source preparation Runtime, Project 변경이
필요한 Refresh/Replace만 Nexus transaction을 사용한다. 같은 파일의 Runtime 재연결은
History를 만들지 않는다.

## Gateway Source Access

Source Access Port는 file/source picker, Project asset directory와 native 접근 권한을
플랫폼 중립 결과로 제공한다. Gateway Adapter는 session-local native handle을 보관하고
permission, cancel과 I/O 실패를 구조화 결과로 변환한다. Adapter가 import, reconnect,
record-and-add 같은 제품 command를 만들거나 Nexus를 호출하지 않는다.

Recording은 Library Engine의 Recording Controller가 request/start/stop/review/confirm과
cleanup을 소유한다. microphone permission과 capture session 생성은 Gateway
Microphone Port가 담당하며 Browser MediaRecorder/MediaStream은 Engine 계약에 노출하지
않는다. 확인된 녹음의 `audio/` write는 Gateway Project Asset Storage/Source Access
Port가 담당하고 Asset Store Adapter는 그 결과를 prepared Audio source 입력으로
변환한다. Microphone Adapter와 Asset Store Adapter 모두 Nexus mutation을 수행하지
않는다.

현재 실제 구현 위치와 Browser 타입 boundary baseline은 `docs/20_src_map.md`와
`docs/architecture/18_platform_gateway_architecture.md`를 따른다.

## Cache Invalidation

현재 Project session의 Source Runtime은 active와 suspended collection으로
구분한다.

- Layer/Source 삭제와 Redo: audition/Timeline handle은 즉시 정지하고 decoded
  visual/audio resource와 waveform은 suspended 상태로 보존
- Undo: 같은 resource identity를 active 상태로 복원
- Refresh/Reconnect: 교체 대상의 이전 active/suspended resource만 dispose
- Project Close/Open/New/Replace와 Editor dispose: active/suspended 전체를
  dispose-once

같은 Source placement가 남아 있는 Layer 삭제는 Source Runtime 수명을 변경하지
않는다.

Source bitmap 또는 visual fingerprint가 바뀌면 다음 dependent 결과만
무효화한다.

- Source Runtime visual
- Layer visual result
- Composition/Surface dependency
- Alpha mask와 선택 강조 scratch

단순 Transform Draft는 Source Alpha나 decoded resource를 다시 만들지 않는다.

## 불변 조건

- Source descriptor만 Project에 저장한다.
- Runtime resource를 Layer Document나 History에 넣지 않는다.
- Source는 Layer별 편집 데이터를 소유하지 않는다.
- 같은 Source를 참조하는 Layer Document는 독립 편집 객체다.
- 실패한 Source 작업은 현재 Project와 Runtime을 보존한다.

## 관련 Architecture

- Project: `docs/architecture/10_project_architecture.md`
- Canvas/Alpha: `docs/architecture/14_canvas_overlay_architecture.md`
- Project File Workflow/Reconnect: `docs/architecture/17_project_file_workflow_architecture.md`

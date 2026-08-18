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

다음 값은 Editor session Runtime이다.

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

Library, Timeline과 Properties가 공유하는 배치 선택 identity는
`layerDocumentId`다. Source 파일 전체 작업은 `sourceId`를 사용하므로 같은 Audio
Source를 여러 Cut에 배치해도 Source 삭제/reconnect와 개별 Layer 삭제를 혼동하지
않는다.

준비된 Source는 확인 전까지 Project 밖에 있으며 confirm transaction이
성공한 뒤 Source Registry와 Layer Document에 반영한다.

Library 계층과 표시 순서는 Source Tree가 아니라 LayerDocument의
`parentLayerDocumentId/order`를 유일한 원본으로 사용한다. Project root에는
Cut과 project-wide Audio가 함께 놓일 수 있고, Cut/Group 아래에는 visual과
Audio Layer가 같은 규칙으로 섞여 배치된다.

브라우저가 Project directory 권한을 가진 경우 import 전에 사용자가 선택하면
PSD는 `psd/`, Audio는 `audio/`에 복사하고 locator의 `relativePathHint`를
기록한다. 기존 Project 파일의 부모 directory는 브라우저가 자동으로 공개하지
않으므로 권한이 없을 때는 사용자가 Project 폴더를 한 번 지정한다.

## Import

```text
File 선택
→ parse/decode와 fingerprint
→ prepared Source Runtime
→ Project transaction으로 descriptor/Layer 생성
→ Runtime register
```

실패 또는 Cancel은 Project를 부분 변경하지 않고 prepared resource를
dispose한다.

Audio 파일 import와 직접 녹음도 같은 prepared lifecycle을 사용한다. File,
MediaStream/MediaRecorder와 decoded AudioBuffer는 Confirm 전 Runtime에만 있고,
Confirm 성공 시에만 Audio Source와 Audio Layer를 Owner transaction 한 번으로
생성한다. Cancel, 권한 거부, decode 실패와 stale confirm은 Project/History 0건이며
stream/track/object URL/resource를 정리한다.

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

## Cache Invalidation

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
- Persistence/Reconnect: `docs/architecture/17_persistence_lifecycle_architecture.md`

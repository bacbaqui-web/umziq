# Source Architecture

## 한 문장 정의

Source는 원본의 identity와 재연결 정보를 제공하고, Layer Document는 그
Source를 참조하는 독립적인 작업 객체다.

## Source와 Layer Document

Layer Document는 PSD Layer 자체가 아니다.

```text
Source Registry
└─ PSD/외부 파일 descriptor
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
- Source visual Cache

Source Runtime은 `(projectId, source identity)`로 Project 간 resource를
격리하고 dispose-once를 보장한다.

## PSD Tree

PSD Tree Panel과 Engine은 Source 구조, import/refresh/delete와 selection
Intent를 표시한다. Project와 decoded resource를 직접 소유하지 않는다.

준비된 Source는 확인 전까지 Project 밖에 있으며 confirm transaction이
성공한 뒤 Source Registry와 Layer Document에 반영한다.

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

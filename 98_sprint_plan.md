# Layer Document Persistence & Project Lifecycle

## 1. Sprint 상태

- 단계: Sprint 구현 완료 / Headless Browser QA 부분 완료
- 선행 Sprint: `Layer Document Architecture Migration` 완료
- 기준 문서:
  - `00_rule.md`
  - `56_layer_document_architecture.md`

---

## 2. 목표

Project를 종료했다가 다시 열어도 모든 Project Plain Data를 안전하게
복원하는 저장·불러오기 Foundation을 완성한다.

이번 Sprint 이후 Drawing, Text, Audio, Video와 향후 Layer Type은 별도
저장 구조를 만들지 않고 같은 Project Lifecycle을 사용해야 한다.

Linked Source가 없을 때도 Project는 손실 없이 열려야 하며, Source는
Missing 상태로 표시한 뒤 Reconnect로 복구한다.

---

## 3. 현재 구조 판단

### 유지

- `LayerDocumentProject` 단일 편집 원본
- Project owner와 Transaction/History
- Plain Data 모델
- Layer Document/Source Registry validation
- Source Runtime Cache의 invalidate/dispose 계약
- PSD prepare/confirm 및 stale-result 처리
- offline migration 격리 경계
- Composition Root의 Engine port wiring

### 보완

- Source의 영구 Descriptor와 Runtime Resolution 상태 분리
- 실제 재연결에 사용할 locator/fingerprint 계약
- Container Version과 Project Schema Version 분리
- 순수 Persistence Codec과 version migration chain
- Project owner의 검증된 Project 교체 action
- Project Lifecycle과 dirty/savepoint 관리
- Save/Save As/Open/Load/Reconnect Browser adapter

전체 Layer Document 구조를 다시 설계하지 않는다.

---

## 4. 공통 설계

### 저장 경계

Project 파일은 다음 Plain Data envelope를 기준으로 한다.

```text
Project File
├─ format
├─ containerVersion
└─ project: LayerDocumentProject
```

- 확장자: `.sfep`
- 인코딩: UTF-8 JSON
- `format`: `"shortform-editor-project"`
- 최초 `containerVersion`: `1`
- Source Descriptor 변경 후 Project Schema Version: `2`
- canonical JSON은 object key 사전순, array 순서 보존, 2-space indent와
  마지막 LF를 사용한다.
- `containerVersion`: 파일 envelope의 version
- `project.metadata.schemaVersion`: Layer Document schema version
- Project 파일에는 History와 Editor Session을 저장하지 않는다.
- Cache, Bitmap, Canvas, Decoder, Draft, Playback와 Preview Runtime은
  저장하지 않고 Load 후 다시 생성한다.
- Load 후 History는 비우고 Session은 유효한 기본값으로 normalize한다.
- Playback은 정지 상태, Draft와 로컬 입력 상태는 비운다.

### Linked Source

- Project에는 Source Descriptor와 재연결 힌트만 저장한다.
- PSD/Audio/Video bytes는 Project 파일에 포함하지 않는다.
- 실제 `File`, `FileSystemFileHandle`과 권한은 Project/History 밖의
  Browser adapter가 관리한다.
- 같은 환경에서 재접근 가능한 local handle은 `projectId + locatorId`로
  찾으며 Project 파일의 필수 데이터가 아니다.
- 접근 불가, 권한 만료 또는 파일 이동 시 Runtime Resolution은
  Missing이 된다.
- Reconnect는 document Source 단위로 수행하며 공유 Layer 전체를
  복구한다.

### Source 상태

Project Source Descriptor:

- Source identity와 kind
- 표시 이름
- `locatorId`, 추천 파일명과 optional relative path hint
- SHA-256 content fingerprint와 byte length
- version
- import/source metadata

Runtime Source Resolution:

- unresolved / resolving / available / missing / error
- File/Handle/권한
- Bitmap/Canvas/Decoder
- Runtime resource와 cache

Missing 감지만으로 Project나 History를 변경하지 않는다.

### Project Lifecycle

상태 폭증을 피하기 위해 세 축으로 관리한다.

```text
Document: untitled | file-backed
Dirty: clean | dirty
Operation: idle | saving | loading
```

Source Resolution은 Source별 Runtime 상태로 별도 관리한다.

- Save는 시작 시점의 immutable Project snapshot을 기록한다.
- savepoint는 canonical Project digest로 판정한다.
- 저장 중 새 편집이 발생하면 저장 성공 후에도 Dirty를 유지한다.
- Load Candidate 검증 전에는 현재 Project를 변경하지 않는다.
- Load 실패 시 현재 Project, Session, History와 Runtime을 모두 보존한다.
- Load 성공 시 owner 교체와 기존 Runtime 정리를 한 lifecycle 전환으로
  수행한다.
- 오래된 비동기 Save/Load/Reconnect 결과는 sequence/token으로 폐기한다.

### Engine 경계

```text
Project Engine
├─ Project Owner
├─ Project Lifecycle Controller
├─ Pure Persistence Codec
└─ Browser File I/O Adapter

Source Runtime Resource Port
└─ Source Resolution/Runtime Resource
```

- 새 Persistence Engine, Event Bus와 전역 Store를 만들지 않는다.
- Codec은 Plain Data만 처리한다.
- Browser adapter만 File/Handle API를 사용한다.
- Native picker/write capability가 없으면 file input과 Blob download로
  fallback한다.
- Project owner만 canonical Project를 교체한다.

### 복원 보장

- 모든 Project Plain Data의 semantic round trip을 100% 보장한다.
- Linked Source가 없으면 시각 resource는 복원할 수 없지만 Layer
  Document와 편집 데이터는 유지한다.
- Embedded Asset Package는 이번 Sprint 범위가 아니다.

---

## 5. 제외 범위

- Auto Save
- Recent Project
- Cloud Sync
- 협업
- Embedded Asset Package
- History 영구 저장
- Workspace layout/Canvas zoom/pan 영구 저장
- Drawing/Text/Audio/Video 기능 구현

---

## 6. Task

## Task 1 — Persistence 계약과 Fixture 확정

### 목적

구현 전 파일, Source, Session과 lifecycle 계약을 고정한다.

### 작업 내용

- Project file format/extension과 envelope 정의
- Container Version과 Schema Version 책임 정의
- Project/Session/History/Runtime 저장 여부 표 작성
- Linked Source locator/local handle/fingerprint 정책 정의
- Save/Save As/Open/Load/Replace/New 상태 전이 정의
- 정상, 손상, 미래 version, Missing Source Fixture 명세
- Browser File API capability와 fallback 정책 결정

### 정적 검증

- 계약 표의 데이터가 단일 소유자를 가지는지 검토
- 기존 `00_rule.md`, `56_layer_document_architecture.md`와 충돌 검사

### 완료 조건

- 구현자가 추가 구조 결정을 하지 않아도 Task 2를 시작할 수 있다.
- 편집 데이터 복원과 Linked Source 복원의 완료 기준이 구분된다.

### Gate 1

- 결과: PASS
- 발견한 문제: 현재 PSD path가 파일명이고 fingerprint가 약하며,
  availability가 Project와 Runtime 책임을 혼합한다.
- 수정 사항: `.sfep` v1 envelope, schema 2, SHA-256, local handle,
  canonical savepoint와 fallback 계약을 확정했다.
- 다음 Task: Task 2 진행 승인

---

## Task 2 — Source Descriptor / Runtime Resolution 분리

### 목적

저장 Source 정보와 현재 실행 환경의 접근 상태를 분리한다.

### 작업 내용

- Source Descriptor schema 정리
- Runtime Source Resolution model/port 추가
- 기존 `availability`, `refresh.status`, reconnect hint 책임 재배치
- 실제 외부 파일 locator와 PSD 내부 node path 분리
- document Source의 강한 fingerprint 생성
- 기존 schema에서 새 schema로 순수 migration 추가
- Timeline/Properties/PSD Tree/Renderer가 Resolution read model을 사용하도록
  전환

### 정적 검증

- current schema validation/normalize/migration
- Missing 감지가 Project/History를 변경하지 않는 Fixture
- 같은 document Source를 공유하는 Layer read model Fixture

### 완료 조건

- 저장된 `available` 값을 Runtime resource 존재 여부로 오인하지 않는다.
- Source가 Missing이어도 Project가 자동으로 Dirty가 되지 않는다.

### Gate 2

- 결과: PASS
- 발견한 문제: Source 접근 상태가 영구 Descriptor와 섞여 있었고
  PSD parse와 fingerprint가 별도 파일 읽기를 만들 가능성이 있었다.
- 수정 사항: schema 2 migration, Runtime Resolution Store와 단일
  ArrayBuffer parse/hash 경계로 분리했다.
- 다음 Task: Task 3 진행 승인

---

## Task 3 — Persistence Codec과 Version Migration

### 목적

UI와 File API에 의존하지 않는 순수 Save/Load 변환을 만든다.

### 작업 내용

- canonical serializer
- container parser와 version dispatch
- schema migration chain
- current normalize/validation
- 파일 크기, entity 수와 nesting 제한
- 구조화된 load error
- current Project를 직접 mutation하지 않는 Load Candidate

### 정적 검증

- Save → Load semantic equality
- Load → Save canonical equality
- version별 migration
- 손상/빈 파일/미래 version/unknown type/과대 입력 거부
- Runtime 객체 직렬화 차단

### 완료 조건

- 순수 fixture만으로 정상/실패 Round Trip 계약을 검증한다.
- migration은 normalize/validation보다 먼저 실행된다.

### Gate 3

- 결과: PASS
- 발견한 문제: Project schema migration과 container dispatch를 같은
  경계에서 처리하면 순서가 뒤섞일 위험이 있었다.
- 수정 사항: container dispatch → schema migration → normalize/validation
  순서와 canonical codec·입력 제한을 순수 adapter로 고정했다.
- 다음 Task: Task 4 진행 승인

---

## Task 4 — Project Lifecycle Controller와 Replace Project

### 목적

검증된 Project를 안전하게 교체하고 clean/dirty 상태를 관리한다.

### 작업 내용

- Project Lifecycle runtime state/controller
- savepoint와 dirty 판정
- 비동기 operation sequence/token
- owner `replace-project` action
- Load Session 기본값 normalize
- History/Runtime Session/Draft/local UI 초기화 effect
- 기존 Source Runtime invalidate/dispose-once

### 추가 규칙

- Replace는 cache port 자체를 `dispose()`하지 않고
  `invalidate({ kind: "all" })`로 기존 resource만 정리한다.

### 정적 검증

- New/Replace 성공 상태
- invalid candidate 교체 거부
- Load 실패 시 기존 owner state reference와 Runtime 보존
- 성공 시 History 0, Draft clear, Playback 정지
- Undo로 saved state에 돌아왔을 때 dirty 정책 검증

### 완료 조건

- Project 전체 교체는 owner의 단일 공개 경계에서만 발생한다.
- 실패한 교체는 부분 상태를 남기지 않는다.

### Gate 4

- 결과: PASS
- 발견한 문제: owner에 검증된 Project 전체를 교체하고 저장 기준점을
  추적하는 원자적 lifecycle 경계가 없었다.
- 수정 사항: replace-project reducer와 canonical savepoint·operation
  token 기반 lifecycle controller를 추가했다.
- 다음 Task: Task 5 진행 승인

---

## Task 5 — Save / Save As

### 목적

현재 Project snapshot을 안전하게 파일로 기록한다.

### 작업 내용

- Browser write adapter
- Save target handle의 Runtime 보관
- 첫 Save와 Save As target 선택
- immutable snapshot 저장
- 성공 시에만 savepoint 이동
- 취소, 권한 거부, write 실패와 동시 Save 처리
- 저장 중 추가 편집의 Dirty 유지

### 정적 검증

- Save/Save As adapter Fixture
- 실패/취소 시 clean/dirty와 target 불변
- stale Save 완료 결과 폐기
- Runtime/Session/History 미직렬화 검사

### 완료 조건

- Save 실패가 Project와 기존 파일 대상을 손상하지 않는다.
- Save 성공 시 저장한 snapshot만 clean 기준이 된다.

### Gate 5

- 결과: PASS
- 발견한 문제: Save target과 비동기 write 결과를 Project 밖에서
  관리하고 오래된 저장을 폐기하는 경계가 없었다.
- 수정 사항: native handle/Blob fallback adapter와 immutable snapshot,
  token, write queue 기반 Save controller를 추가했다.
- 다음 Task: Task 6 진행 승인

---

## Task 6 — Open / Load와 Runtime 재생성

### 목적

Project 파일을 검증한 뒤 owner를 교체하고 Runtime을 다시 만든다.

### 작업 내용

- Browser open adapter
- parse/migrate/normalize/validate Load Candidate
- candidate 검증 후 Replace Project
- Source local handle/권한 탐색
- 접근 가능한 Source parse/register
- 접근 불가 Source Missing 처리
- 일부 Source 실패를 허용하는 Ready-Degraded 상태
- stale Load/Source preparation 취소와 dispose

### 정적 검증

- 정상 Load와 Project equality
- 손상/미래 version Load 실패 원자성
- Runtime cache 초기화와 resource dispose-once
- 일부 Missing Source를 포함한 Load 성공
- Load 중 새 Open 요청의 stale 결과 폐기

### 완료 조건

- Load 실패 시 기존 Project와 화면이 유지된다.
- Load 성공 시 Runtime은 저장값이 아니라 새 resource로 구성된다.

### Gate 6

- 결과: PASS
- 발견한 문제: 검증된 Load Candidate 교체와 Linked Source Runtime
  재생성을 원자적으로 조정하는 공개 흐름이 없었다.
- 수정 사항: native/file-input Open adapter와 stale-safe 준비,
  Ready-Degraded, Replace 후 Runtime batch 등록 경계를 추가했다.
- 다음 Task: Task 7 진행 승인

---

## Task 7 — Missing Source와 Reconnect

### 목적

이동되거나 접근할 수 없는 Linked Source를 안전하게 복구한다.

### 작업 내용

- Missing/Error Source UI read model
- document Source 단위 파일 재지정
- fingerprint 일치 자동 reconnect
- fingerprint 불일치 시 Refresh/Replace 확인 경계
- local handle 갱신
- 공유 Layer resource 자동 복구
- Source 단위 targeted cache invalidation

### 정적 검증

- 같은 파일 이동 후 reconnect
- 잘못된 동일 이름 파일 거부
- 여러 Layer가 공유하는 Source 일괄 복구
- 취소/권한 거부/parse 실패
- 다른 Source cache 보존

### 완료 조건

- 한 번의 document reconnect로 연결된 모든 Layer가 복구된다.
- 잘못된 Source를 추측으로 연결하지 않는다.

### Gate 7

- 결과: PASS
- 발견한 문제: Missing Source를 안전하게 재지정하고 공유 PSD resource만
  교체하는 사용자 확인 경계가 없었다.
- 수정 사항: fingerprint 검증, confirmation-required 결과, targeted
  cache 교체와 local handle 갱신 Reconnect controller를 추가했다.
- 다음 Task: Task 8 진행 승인

---

## Task 8 — Lifecycle UI와 Dirty 보호

### 목적

New/Open/Save/Save As/Close 흐름과 상태를 사용자에게 제공한다.

### 작업 내용

- Project lifecycle command UI
- clean/dirty/saving/loading 표시
- Dirty 상태의 New/Open/Close 확인
- Save/Load/Source 오류 표시
- Missing Source와 Reconnect 진입점
- 진행 중 Draft/Input/Playback의 lifecycle 전환 정책 연결

### 정적 검증

- UI command가 Project Lifecycle port만 사용하는지 검사
- 취소/확인/실패 상태 ViewModel Fixture
- Engine import boundary

### 완료 조건

- 저장하지 않은 Project를 사용자 확인 없이 교체하거나 닫지 않는다.
- UI가 Project/Runtime을 직접 수정하지 않는다.

### Gate 8

- 결과: PASS
- 발견한 문제: 최초 구현의 New Project가 고정 projectId를 재사용해
  local Source handle key가 충돌할 수 있었다.
- 수정 사항: 공개 lifecycle UI port와 고유 Project ID factory, Dirty
  보호, Missing/Reconnect 표시를 연결했다.
- 다음 Task: Task 9 진행 승인

---

## Task 9 — 통합 검증과 문서 갱신

### 목적

Foundation 완료 조건과 문서·코드 일치를 확인한다.

### 작업 내용

- 전체 Persistence/Lifecycle verification
- 기존 Layer Document regression verification
- `20_src_map.md` 갱신
- 새 영구 Architecture 문서 작성
- `56_layer_document_architecture.md`와의 연결/변경점 기록
- `98_sprint_plan.md` 최종 상태 갱신

### 정적 검증

- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`
- 500줄 이상 변경 파일 확인

### 완료 조건

- Save → Load 후 Project Plain Data가 동일하다.
- Load 실패는 현재 Project를 변경하지 않는다.
- Runtime 객체가 Project 파일에 포함되지 않는다.
- Missing Source와 Reconnect가 공유 Layer에 일관되게 적용된다.
- 새 Layer Type이 같은 Codec/Lifecycle을 재사용할 수 있다.
- 정적 검증 결과를 Browser QA 통과로 기록하지 않는다.

### Gate 9

- 결과: PASS
- 발견한 문제: 실제 Browser picker·permission·download와 Audio/Video
  Runtime preparation은 정적 Foundation 범위 밖이다.
- 수정 사항: Persistence/Lifecycle 38개 verification과 영구 문서 57,
  소스 지도를 완료했다.
- 다음 Task: Sprint 구현 완료

---

## 7. Sprint 완료 조건

- New/Open/Save/Save As/Load/Replace Project 흐름이 완성된다.
- Project Plain Data가 canonical 파일로 Round Trip된다.
- Container Version과 Schema Version migration 경계가 분리된다.
- History, Session, Draft, Playback와 Runtime resource는 저장되지 않는다.
- Load 성공 후 Session/History/Runtime이 안전한 초기 상태로 재생성된다.
- Load 실패 시 기존 Project와 Runtime이 유지된다.
- dirty/savepoint가 비동기 Save와 Undo/Redo에서도 정확하다.
- Linked Source를 찾지 못해도 Project는 Missing 상태로 열린다.
- Reconnect가 document Source와 모든 공유 Layer를 복구한다.
- Source Runtime 상태가 Project의 대체 저장 원본이 되지 않는다.
- 기존 Layer Document/Engine Boundary를 유지한다.

Browser QA는 사용자가 명시적으로 요청할 때만 헤드리스 우선으로
진행한다.

---

## 8. 진행 현황

| Task | 상태 | Gate |
|---|---|---|
| Task 1 — Persistence 계약과 Fixture | 완료 | PASS |
| Task 2 — Source Descriptor/Resolution | 완료 | PASS |
| Task 3 — Codec/Version Migration | 완료 | PASS |
| Task 4 — Lifecycle/Replace Project | 완료 | PASS |
| Task 5 — Save/Save As | 완료 | PASS |
| Task 6 — Open/Load/Runtime | 완료 | PASS |
| Task 7 — Missing/Reconnect | 완료 | PASS |
| Task 8 — Lifecycle UI | 완료 | PASS |
| Task 9 — 통합 검증/문서 | 완료 | PASS |

Task 9 통합 검증과 문서를 승인해 Sprint 구현을 완료했다. Headless
Browser QA에서 lifecycle UI, Dirty 표시와 미저장 변경 확인을 검증했다.
Native Save/Open 시스템 파일창과 실제 파일 round trip은 수동 QA가
남아 있다.

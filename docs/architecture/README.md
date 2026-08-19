# Architecture 읽기 안내

이 폴더는 현재 제품이 반드시 지켜야 하는 **영구 설계 계약**을 책임 영역별로
보관한다. 문서는 Engine 파일 수나 현재 UI 배치가 아니라, 쉽게 바뀌지 않는 데이터
소유권과 Runtime 경계를 기준으로 나뉜다.

## 1. 문서 체계에서의 위치

- `docs/01_rule.md`: 모든 설계보다 먼저 적용하는 제품 원칙
- `docs/architecture/`: 현재와 앞으로 지켜야 할 canonical 설계
- `docs/20_src_map.md`: 설계를 현재 어떤 파일이 구현하는지 보여주는 위치 지도
- [`docs/completed/`](../completed/README.md): 과거 작업의 결정, 구현과 검증 기록

현재 동작을 수정할 때는 Completed 기록만 보고 설계를 판단하지 않는다. Architecture를
먼저 읽고 Source Map으로 현재 구현을 찾은 뒤, 결정 배경이 필요할 때만 관련 Completed
문서를 찾아본다.

## 2. 기본 읽기 순서

```text
AGENTS.md
→ docs/01_rule.md
→ docs/architecture/README.md
→ 아래 표의 주 문서
→ 주 문서의 관련 Architecture
→ docs/20_src_map.md의 현재 구현 위치
→ 필요할 때만 docs/completed/README.md의 과거 기록 색인
```

여러 영역에 걸친 변경은 문서 하나만 읽지 않는다. 저장 데이터, Runtime, History 또는
Panel 간 공유값을 건드리면 표에 연결된 교차 문서를 함께 읽는다.

## 3. 책임 영역별 문서

| 문서 | canonical 책임 | 이럴 때 다시 읽기 |
|---|---|---|
| [`10_project_architecture.md`](10_project_architecture.md) | Project, Layer Document, Nexus, Panel Engine, Editor Root | 새 Layer/Panel/Engine, transaction, selection, 공통 소유권 변경 |
| [`11_render_architecture.md`](11_render_architecture.md) | Frame Evaluation, Preview/Accurate Renderer, Cache, Export frame | Canvas pixel, renderer, scene, dirty region, cache, export 화면 변경 |
| [`12_timeline_playback_architecture.md`](12_timeline_playback_architecture.md) | Placement, Timeline Runtime, playback, Group navigation, Pointer drag | Timeline 행·길이·이동·trim·재생·waveform·Group scope 변경 |
| [`13_history_draft_architecture.md`](13_history_draft_architecture.md) | Transaction, History, Draft, Undo/Redo, commit 경계 | 연속 입력, drag, preview, History 수, 취소·확정·reset 변경 |
| [`14_canvas_overlay_architecture.md`](14_canvas_overlay_architecture.md) | Canvas interaction, Overlay, hit test, alpha, motion path | 선택 외곽선, handle, 직접 선택, 좌표 변환, overlay 변경 |
| [`15_source_architecture.md`](15_source_architecture.md) | Source descriptor/Runtime, Library, import, reconnect, cache lifecycle | PSD·Audio·외부 파일, Library, recording, missing source 변경 |
| [`16_animation_architecture.md`](16_animation_architecture.md) | Animation, keyframe, Modifier, 평가, Motion Path | 수식, 입뻥긋, 가속·감속, keyframe, animation 평가 변경 |
| [`17_persistence_lifecycle_architecture.md`](17_persistence_lifecycle_architecture.md) | `.ziq`, Menu Save/Open, migration, Project Replace, dirty | 저장 schema, 폴더, Save/Open, Menu UI 변경 |
| [`18_platform_gateway_architecture.md`](18_platform_gateway_architecture.md) | Gateway, capability Port, Platform Adapter | 파일/장치/권한, 플랫폼 API, Web/Electron/native 경계 변경 |

## 4. Engine·작업 영역에서 찾아가기

| 수정 영역 | 먼저 읽기 | 함께 확인 |
|---|---|---|
| Editor Root / Nexus | 10 | 13, 15, 17, 18 |
| Menu Engine / Menu Bar | 17 | 10, 15, 18, Export면 11 |
| Canvas Engine / Overlay | 14 | 11, 13, 16 |
| Timeline Engine / Playback | 12 | 13, 16, 10 |
| Visual Engine | 13 | 10, 14, 16 |
| Library Engine | 15 | 10, 13, 17 |
| Audio Engine | 13 | 10, 15, 11의 Export |
| Render / Export | 11 | 14, 15, 16, 17 |
| Gateway / Platform Adapter | 18 | capability에 따라 11, 15, 17 |
| Modifier / Animation | 16 | 12, 13, 11 |

현재 Architecture는 “Engine별 문서 모음”이 아니다. Engine 하나가 여러 영구 책임을
사용할 수 있기 때문에 위 표처럼 Engine에서 책임 문서로 이동한다. 반대로 Project,
History, Source 같은 교차 책임을 특정 Engine 문서 안에 가두지 않는다.

## 5. 변경 종류별 필수 재독

- 저장 필드나 schema 추가: **10 + 17**, 필요하면 15/16
- 사용자 action의 commit 횟수 변경: **13**, 해당 Panel 문서
- Runtime/Store/ref 추가: **10 + 13**, 실제 소비 영역 문서
- Panel 간 값 공유: **10**, 값의 원래 소유자 문서
- Timeline move·trim·keyframe: **12 + 13 + 16**
- Canvas Transform·선택·Overlay: **14 + 13 + 11**
- PSD/Audio import·record·reconnect: **15 + 17 + 13**
- Preview/Accurate/Export 결과 변경: **11**, Source면 15, Animation이면 16
- File/Device/Permission/Platform API 변경: **18**, 소비 workflow 문서

## 6. 문서 갱신 규칙

1. 데이터 소유권과 불변 계약이 바뀌면 해당 Architecture를 먼저 갱신한다.
2. 파일 위치나 구현 책임만 바뀌면 Architecture를 반복하지 않고
   `docs/20_src_map.md`만 갱신한다.
3. 작업 과정, 비교안, 검증 결과는 Architecture가 아니라 `docs/completed/`에 남긴다.
4. 과거 Completed 문서를 현재 설계처럼 고치지 않는다. 현재 결론은 Architecture에
   반영하고 Completed에는 당시 기록을 보존한다.
5. 새 Architecture 파일은 기존 10~18의 책임으로 설명할 수 없을 때만 추가한다.
6. 문서가 겹치면 소유권을 정의하는 문서를 authority로 삼고 다른 문서는 링크만 둔다.

## 7. 빠른 판단 기준

- **무엇이 저장되는가** → 10, 17
- **누가 값을 소유하는가** → 10, 12, 13, 15
- **언제 History가 생기는가** → 13
- **현재 frame이 어떻게 보이는가** → 11, 14, 16
- **외부 파일이 어떻게 살아남는가** → 15, 17
- **외부 플랫폼 capability가 어디에서 구현되는가** → 18
- **현재 구현 파일은 어디인가** → `docs/20_src_map.md`
- **왜 이렇게 결정했는가** → 관련 `docs/completed/` 기록

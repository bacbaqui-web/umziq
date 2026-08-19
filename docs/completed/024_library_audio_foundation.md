# Library + Audio Foundation

## 완료 상태

- Task 0~13 완료
- 자동 Verification 50/50, ESLint, TypeScript와 Production Build 통과
- 실제 브라우저의 마이크·청감·포인터·출력 파일 QA는 별도 확인 항목

## 목적

PSD만 다루던 패널을 Project의 파일과 배치를 함께 관리하는 Library로
확장하고, Cut마다 오디오를 불러오거나 녹음해 편집·재생·출력할 수 있는
기초 구조를 완성했다.

현재 구조의 영구 기준은 다음 canonical 문서를 따른다.

- Project와 Panel 경계: `docs/architecture/10_project_architecture.md`
- Render와 출력 평가: `docs/architecture/11_render_architecture.md`
- Timeline과 단일 재생 시계: `docs/architecture/12_timeline_playback_architecture.md`
- History와 Draft: `docs/architecture/13_history_draft_architecture.md`
- Source와 Runtime resource: `docs/architecture/15_source_architecture.md`
- 저장·열기·Migration: `docs/architecture/17_persistence_lifecycle_architecture.md`

## 주요 결과

### Library

- 기존 PSD Tree Panel/Engine을 Library Panel/Engine으로 전환했다.
- Project의 PSD와 Audio Source/Layer를 Cut 아래에서 함께 관리한다.
- imported Audio는 음표, 움직에서 직접 녹음한 Audio는 마이크 아이콘으로
  구분한다.
- 재생·정지, 음소거, 이름 변경, 개별 Layer 삭제를 지원한다.
- Cut과 Audio 순서를 바꿀 수 있고 Audio를 다른 Cut으로 옮길 수 있다.
- Library, Timeline과 Properties는 같은 `layerDocumentId` 선택 identity를
  사용한다.

### Audio 저장 계약

- Project schema를 version 3으로 올렸다.
- Audio Source에는 provenance, duration, channel count와 sample rate를
  Plain Data로 저장한다.
- Audio Layer에는 gain, mute와 fade를 저장한다.
- Cut 소속·순서·시작·길이·원본 시작점은 `common.placement`를 사용한다.
- ordered effect chain은 `common.effects`에 저장한다.
- decoded AudioBuffer, waveform, AudioContext와 playback handle은 Project에
  저장하지 않고 Editor Runtime에서만 관리한다.
- schema 1→2→3과 2→3 migration 및 `.ziq` round trip을 검증했다.

### 불러오기와 직접 녹음

- Library의 `+ 오디오`에서 파일 불러오기와 직접 녹음을 제공한다.
- 파일 분석과 녹음 결과는 확인 전까지 prepared Runtime 상태로 유지한다.
- 사용자가 확인했을 때만 Audio Source와 Audio Layer를 Owner transaction
  한 번으로 생성한다.
- 취소, 권한 거부, 빈 녹음, decode 실패와 stale confirm은 Project와
  History를 변경하지 않는다.
- Project 교체나 취소 시 MediaStream, track, recorder와 decoded resource를
  정리한다.

### Timeline과 재생

- Audio Layer를 초록색 Timeline row와 waveform으로 표시한다.
- move, trim과 source offset 편집은 Draft 뒤 한 번의 History로 확정한다.
- visual과 Audio는 기존 Timeline playback clock 하나를 공유한다.
- Library의 미리 듣기는 저장되지 않는 single-active audition session이다.
- play, pause, seek, range와 loop 이동에서 Audio handle을 동기화한다.

### Properties와 Audio Effects

- Audio 선택 시 이름, 음량, 음소거, 시작, 길이, 원본 시작점과 fade를
  Audio Properties에 표시한다.
- Audio에는 visual 기준·위치·크기·회전·투명 UI를 표시하지 않는다.
- Properties와 분리된 Audio Effects Panel/Engine을 추가했다.
- 컴프레서, 리버브, 딜레이와 `소음 줄이기`의 추가·삭제·순서·bypass와
  parameter 편집을 지원한다.
- `소음 줄이기`는 Noise Gate로 구현해 말이 없는 저음량 구간을 부드럽게
  감쇠한다. AudioWorklet을 우선 사용하고 지원되지 않으면 fallback한다.
- Preview와 Export가 같은 ordered effect 의미를 사용한다.

### 출력

- MP4와 WebM 영상 출력에 eligible Audio Layer를 함께 mix한다.
- Cut/Project 시간, start, duration, source offset, gain, fade와 effect
  순서를 반영한다.
- 영상 frame과 Audio scheduling은 AudioContext의 단일 시계를 사용한다.
- GIF와 animated WebP는 현재 음원을 포함하지 않는다.
- 출력 취소·실패·완료 시 recorder, stream track, AudioNode와 AudioContext를
  정리하고 불완전한 파일은 저장하지 않는다.

## 회귀 방지

- Project Owner를 유일한 영구 mutation 경계로 유지했다.
- 연속 입력과 drag 중에는 Runtime Draft만 바꾸고 확정 시 History를 한 번만
  만든다.
- Panel Engine끼리 직접 import하지 않고 Composition Root의 public port로
  연결한다.
- Timeline 외의 두 번째 frame clock을 만들지 않는다.
- Source 전체 삭제/reconnect와 개별 Audio Layer 삭제 의미를 분리했다.
- 기존 visual Layer, PSD import/refresh, Canvas, Timeline과 Properties 검증을
  유지한 상태로 전체 Verification 50개를 통과했다.

## 커밋 기록

- `9758bc4` 작업 전 Editor 체크포인트
- `9220114` Library/Audio 구조 감사
- `2f07066` PSD Tree를 Library로 전환
- `4b55ec8` Audio 영구 모델과 migration
- `c5c653f` Cut Audio import
- `71b6cfe` Editor Audio audition Runtime
- `ae0f544` Library Audio 관리
- `e5647d2` Timeline Audio 동기화
- `c4c9c9c` Cut/Audio 순서 변경
- `bc81640` 직접 녹음
- `e7d0ce1` Audio Properties
- `ecdf94a` Audio Effects Panel
- `c94e2b4` Noise Gate 처리
- `ff29124` 영상 출력 Audio mix
- `c2c4bed` canonical 문서 동기화

## 남은 수동 검증

- 실제 브라우저의 마이크 권한 허용·거부와 MediaRecorder codec
- AudioWorklet 로드, CSP fallback과 각 effect의 실제 청감
- Library drag-and-drop, 키보드 이동과 pointer 취소
- Timeline trim/move와 Properties/Effects 숫자 drag
- MP4/WebM 실제 출력 파일의 음원 포함, 장시간 A/V sync와 투명 WebM 재생


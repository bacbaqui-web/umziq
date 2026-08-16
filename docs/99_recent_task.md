# Library + Audio Foundation Sprint 완료 보고

## 최근 Task

PSD 중심 Editor를 PSD와 Audio를 함께 관리하는 Library 기반 Editor로
확장하고, Audio import/녹음/재생/편집/effect/export의 영구 계약과 Runtime
경계를 구현했다.

## 변경

- Library는 PSD와 imported/recorded Audio Source/Layer를 Cut 아래에서 함께
  관리한다. selection identity는 Library/Timeline/Properties 모두
  `layerDocumentId`를 사용한다.
- schema v3에 Audio provenance, metadata, gain/mute/fade와 ordered effects를
  저장하며 decoded resource, waveform, playback handle은 저장하지 않는다.
- Audio import와 직접 녹음은 prepared lifecycle을 거쳐 confirm 때만 Owner
  단일 transaction으로 Source와 Layer를 생성한다.
- Timeline clock 하나가 visual/audio 재생, seek, range를 소유하고 Audio
  move/trim/source offset은 Draft 뒤 한 번의 History로 확정한다.
- Audio 선택 시 Audio Properties를 표시하고, 독립 Audio Effects Panel에서
  compressor/reverb/delay/Noise Gate envelope를 관리한다.
- `소음 줄이기` Noise Gate는 Preview와 Export에 같은 ordered effect 의미로
  적용된다.
- MP4/WebM 출력은 eligible Audio Layer를 영상과 mix한다. GIF와 animated
  WebP는 현재 음원을 포함하지 않는다.

## 검증

- ESLint: PASS
- 전체 Verification: 50/50 PASS
- TypeScript 및 Production Build: PASS
- `git diff --check`: PASS
- Browser Audio/포인터 QA: 미실행

## 남은 위험

- 실제 마이크 권한 허용·거부, MediaRecorder codec과 AudioWorklet/CSP fallback은
  브라우저 수동 확인이 남았다.
- Library drag-and-drop, Timeline/Properties/Effects pointer 조작과 취소는 실제
  마우스·키보드로 확인해야 한다.
- MP4/WebM codec 재생, 투명 WebM, 효과의 청감과 장시간 A/V sync는 실제 출력
  파일로 확인해야 한다.

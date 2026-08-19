# 입뻥긋(기본) 수식 클립 완료

## 목표

일반 visual Layer에 Audio Layer를 연결하고, 음성 구간에 맞춰 opacity를
0/100으로 바꾸되 keyframe을 대량 생성하지 않는다.

## 구현

- decoded Audio PCM을 RMS, smoothing, 시작·종료 hysteresis로 분석한다.
- 분석 결과를 `mouth-basic` Modifier의 시작 frame, 길이, 전환 frame 배열로
  Project에 저장한다.
- Properties에서 연결 Audio를 선택하거나 교체한다.
- Timeline의 초록색 수식 클립을 이동·리사이즈하고 내부 전환선을 직접
  드래그해 미세 조절한다.
- 조작 중에는 React Draft만 바뀌고 pointer up에서 Owner transaction 한 건으로
  저장한다. pointer cancel은 저장하지 않는다.
- Preview와 Accurate renderer가 같은 pure opacity 평가 결과를 사용한다.

## 검증

- synthetic PCM 음성 구간 분석 및 transition 생성
- 클립 바깥 opacity 0, 내부 0/100 전환
- Layer runtime opacity 합성
- 전체 Verification 54/54 PASS
- TypeScript build PASS

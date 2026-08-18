# 가속·감속 수식 클립 완료

## 구현

- 위치·크기·회전·투명도 복수 선택
- 부드러운 감속, 강한 감속, 부드러운 가속, 강한 가속 preset 그래프
- 기존 keyframe 값을 유지하는 범위 내 시간 재배치
- Timeline 수식 박스 이동과 좌우 길이 조절
- Preview와 Accurate renderer의 공통 평가
- Project 저장·재열기 가능한 Modifier 데이터

## 검증

- 네 곡선의 중간 progress 확인
- 선택 속성만 재배치되고 선택하지 않은 속성은 선형 유지
- 수식 클립 양쪽 경계 연속성 확인
- 전체 Verification 55/55 PASS
- TypeScript build PASS

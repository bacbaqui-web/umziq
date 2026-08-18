# Library Hover Preview

## 상태

- 구현 및 자동 검증 완료

## 목적

Library의 visual layer/group은 합성 이미지를, Audio Layer는 파형을 hover card로
확인할 수 있게 한다.

## 규칙

- 카드 위치는 마우스 오른쪽 위 45도 방향이며 viewport 안으로 clamp한다.
- 180ms 머물렀을 때 열고 pointer leave에는 즉시 닫는다.
- Visual은 runtime surface를 사용하고 Group은 자식을 합성한다.
- Audio는 runtime waveform cache를 사용한다.
- 빈 레이어와 missing resource를 구별한다.
- hover 이전에는 surface 합성을 시작하지 않는다.

## 검증

- Library hover preview focused verification PASS
- 전체 Verification 52/52 PASS
- ESLint, TypeScript, Production Build PASS
- `git diff --check` PASS

## 후속 수정: 다중 오디오 불러오기

- 여러 오디오 파일을 먼저 모두 준비한 뒤 각각 확정한다.
- 준비 중인 파일을 배열로 추적해 취소·프로젝트 전환 시 전부 정리한다.
- 두 파일 선택 시 두 Audio Layer가 생성되는 회귀 검증을 추가했다.

## 후속 수정: 미리보기 적층 순서

- Group hover preview도 Canvas renderer처럼 Library 목록을 아래에서 위로 그린다.
- Library에서 위에 있는 레이어가 최종 합성 이미지의 앞쪽에 표시된다.

## 후속 수정: 공통 미리보기 카드

- PSD 미리보기와 Library visual preview를 같은 공통 컴포넌트로 통합했다.
- 두 화면 모두 레이어 비율에 따라 카드 높이가 바뀐다.
- 빈 레이어 문구와 여백, 테두리, 배경, 위치 계산이 동일하다.
- Audio waveform card만 Library 전용으로 유지한다.

## 후속 수정: 프로젝트 직속 오디오 연결선

- 프로젝트 직속 오디오는 내부 자식선을 중복해서 그리지 않는다.
- 프로젝트 아래 세로선에서 오디오 아이콘으로 한 번만 꺾이는 `ㄴ`자 연결을 사용한다.
- 정정: 프로젝트 직속 오디오는 맨 왼쪽 Cut 트렁크와 연결하지 않고, 오디오 바로 위에서 내려오는 독립 `ㄴ`자 선을 사용한다.

## 후속 수정: Audio Canvas 제외 및 삭제

- Audio Layer는 Canvas placeholder를 만들지 않고 Timeline과 Library에서만 시각화한다.
- Audio 휴지통은 정식 Source transaction으로 Layer를 삭제한다.
- 같은 Source의 마지막 Audio Layer라면 Source도 같은 History 작업에서 제거한다.
- 공유 Source가 남아 있으면 선택한 Audio Layer만 삭제한다.

## 후속 수정: 직접 녹음 파일 수명주기

- 직접 녹음을 멈추면 확인 단계 전에 프로젝트의 `audio/` 폴더에 원본을 저장한다.
- Source locator에는 저장된 `audio/<파일명>` 상대 경로를 기록한다.
- recorded Audio의 마지막 Layer를 라이브러리에서 삭제하면 해당 원본 파일도 삭제한다.
- 같은 Source를 공유하는 Layer가 남아 있으면 원본 파일은 유지한다.
- 프로젝트 교체·닫기에는 진행 중 녹음, prepared 녹음, 재생 및 decoded cache를 정리한다.

## 후속 수정: 공통 레이어 삭제와 드롭 위치 피드백

- visual/group/audio 휴지통은 모두 Source-aware Owner transaction 한 경로를 사용한다.
- subtree의 마지막 Audio Source만 함께 제거하고 PSD node registry는 원본 문서 refresh를 위해 유지한다.
- 액션 버튼의 pointer down은 click 기본 동작을 막지 않는다.
- 드래그 대상의 위·아래 위치에는 실제 행 높이의 공간이 애니메이션으로 열려 주변 행이 밀려난다.
- 정정: PSD visual Layer 단독 삭제는 순수 Layer transaction을 사용해 PSD Source와 Runtime cache identity를 보존한다.
- 삭제 subtree에 Audio가 포함될 때만 Source-aware transaction으로 마지막 Audio Source를 정리한다.

## 후속 수정: 중앙 원점 좌표계

- 사용자에게 보이는 위치 좌표는 부모 그룹의 정중앙을 `(0, 0)`으로 사용한다.
- 기존 프로젝트의 렌더 위치는 유지하고 Properties와 위치 키프레임 입출력에서 좌표를 변환한다.
- 기준점은 레이어 내부 피벗이라는 기존 의미를 유지한다.

## 후속 수정: PSD 그룹 콘텐츠 기준점

- 새 PSD의 그룹 기준점을 실제 자식 픽셀 레이어 bounds 중앙으로 초기화한다.
- 중첩 그룹과 최상위 PSD composition에 동일하게 적용하고 빈 그룹만 캔버스 중앙으로 fallback한다.

## 후속 수정: 프로젝트 자산 재연결

- Source locator의 `psd/`·`audio/` 상대경로와 SHA-256 지문을 재열기 복구에 사용한다.
- 상대경로 실패 시 종류별 자산 폴더를 한 번 더 검색하고 지문이 같은 파일을 복구한다.
- 저장 경로와 폴더 검색이 모두 실패한 Source만 `missing`으로 처리한다.

## 후속 수정: Library 드래그 감도

- 새 드롭 후보가 120ms 유지돼야 도착 위치를 갱신한다.
- 위·안쪽·아래 경계에 히스테리시스를 적용하고 동일 상태의 중복 렌더를 막는다.

## 후속 수정: Audio 재열기

- Linked Source load preparation에 Audio decode와 SHA-256 검증을 추가한다.
- 프로젝트 자동 복구와 수동 재연결 모두 디코딩된 resource를 Audio Runtime에 등록한다.

## 후속 기능: 입뻥긋(기본) 수식 클립

- 일반 visual Layer의 수식 라이브러리에 `입뻥긋(기본)`을 추가했다.
- Properties의 오디오 드롭다운에서 프로젝트 Audio Layer를 연결하면 decoded
  PCM을 RMS·smoothing·hysteresis 방식으로 한 번 분석한다.
- 분석 결과는 keyframe 다발이 아니라 시작·길이·전환선을 저장하는 Modifier
  수식 클립 한 개가 된다.
- Timeline에서 클립 전체 이동, 양 끝 길이 조절, 내부 전환선 미세 조절을
  지원하며 pointer up에 History 한 건으로 확정한다.
- Preview와 Accurate 출력은 동일한 pure opacity 평가로 0/100 전환을 적용한다.
- 자동 Verification 54/54와 TypeScript build를 통과했다.

## 후속 기능: 가속·감속 수식 클립

- 일반 visual Layer의 수식 라이브러리에 `가속·감속`을 추가했다.
- 적용할 위치·크기·회전·투명도를 복수 선택할 수 있다.
- 빠르게 시작해 부드럽게/강하게 감속, 천천히 시작해 부드럽게/강하게
  가속하는 네 가지 그래프를 제공한다.
- Timeline의 파란 수식 박스는 이동과 양 끝 길이 조절을 지원하고 선택한
  곡선을 내부에 표시한다.
- 박스 경계와 범위 밖 값은 유지하고 선택 속성의 기존 keyframe 시간만
  재배치한다.
- 자동 Verification 55/55와 TypeScript build를 통과했다.

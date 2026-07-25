# New Project 이후 PSD 표시 결함 조사 보고

## 사용자 재현

1. 새 프로젝트를 만든다.
2. PSD를 불러온다.
3. PSD Tree에는 항목이 나타난다.
4. Canvas에는 아무것도 표시되지 않는다.
5. Timeline에도 항목이 보이지 않는다.
6. PSD Tree 항목을 선택해도 Canvas/Timeline이 바뀌지 않는다.

## 확정된 결함

New/Replace 직후 Layer selection이 비워진다.

`replaceLayerDocumentOwnerProject()`는 새 Session을 만들 때 다음 값을
사용한다.

- active Group: 새 Project root로 normalize
- Layer selection: `null`
- Source selection: `null`

따라서 새 프로젝트 직후:

- Project root와 Master Group은 존재한다.
- active Group도 root로 유지된다.
- 하지만 선택된 Layer Document는 없다.
- Properties에는 `선택된 그룹이 없습니다.`가 표시된다.
- 초기 bootstrap에서 Master root가 선택되는 동작과 일치하지 않는다.

최소 수정 위치:

- `src/engines/project/actions/layerDocumentProjectOwnerReplaceReducer.ts`

Replace Session을 만들 때 normalized root/active Group을 초기
Layer selection으로 지정해야 한다.

## PSD Tree 선택 계약

PSD Tree 클릭은 `PsdTreeSourceSelection`만 변경한다.

PSD Tree Source 하나를 여러 Layer Document가 공유할 수 있으므로 현재
구조에서는 Source 클릭을 임의의 Layer selection으로 변환하지 않는다.

따라서 Layer selection이 `null`인 상태에서 PSD Tree 항목만 클릭하면:

- Source selection은 변경된다.
- Layer selection은 계속 `null`이다.
- Properties의 선택 대상도 생기지 않는다.
- Timeline/Canvas에서 특정 Layer를 선택하는 동작은 발생하지 않는다.

PSD Tree 클릭으로 Timeline Layer를 선택하게 만드는 것은 이번 결함의
최소 수정 범위가 아니다.

## 코드에서 확인한 PSD Import 경로

PSD Import 자체의 저장 계약은 다음과 같이 정상이다.

- PSD composition Layer의 부모는 active root다.
- PSD 자식 Layer는 composition/group을 부모로 가진다.
- Source와 Layer는 하나의 Import transaction으로 추가된다.
- Import 성공 시 Layer selection은 생성된 composition으로 바뀐다.
- Source selection은 생성된 PSD document Source로 바뀐다.
- active Group은 Project root로 유지된다.

동일한 경로를 Node harness로 확인한 결과:

- New Replace 후 Master root와 active Group 존재
- PSD confirm 후 root + composition + PSD leaf 생성
- composition parent가 새 Project root를 참조
- imported composition이 Layer selection으로 설정
- Timeline row 생성
- Canvas runtime에 composition과 drawable input 생성

따라서 다음 항목은 직접 원인이 아니다.

- 새 `projectId`
- 동일한 root Layer ID
- memoized assembly/controller
- Persistence codec
- PSD Import transaction의 parent/order

## 현재 판단

확정된 첫 번째 문제는 New Project가 root Layer selection을 만들지 않는
것이다. 이 문제 때문에 New 직후 Properties와 선택 기반 UI가 빈 상태가
된다.

그러나 사용자가 본 “Import 완료 후에도 Timeline row와 Canvas drawable이
전혀 없음”은 코드 harness에서는 재현되지 않았다. 가능한 구분은 다음과
같다.

1. PSD 분석 Preview까지만 완료되고 최종 Import confirm이 실행되지 않았다.
2. Import는 완료됐지만 현재 UI가 Source selection만 보여 Layer
   selection과 혼동됐다.
3. 실제 Browser UI의 Import confirm 이후 rerender 경로에 별도 결함이
   있다.

사용자 실제 화면을 기준으로는 3번 가능성도 계속 열어 둔다.

## 권장 수정과 회귀 검증

먼저 New/Replace 직후 root Group을 Layer selection으로 지정한다.

그 뒤 실제 Browser에서 다음 순서로 다시 확인해야 한다.

1. New Project
2. Master가 즉시 선택되는지 확인
3. PSD 선택
4. Import Preview에서 최종 불러오기 실행
5. Project root Timeline에 PSD composition row 표시
6. Canvas drawable 표시
7. imported composition이 Layer selection인지 확인

필요한 regression fixture:

- Replace/New 직후 root Layer selection과 Properties descriptor
- 기존 assembly를 유지한 New → PSD prepare/confirm
- Timeline composition row와 Canvas drawable
- PSD Tree Source 클릭은 Source selection만 바꾸고 기존 Layer
  selection은 보존

## 작업 상태

- 조사만 수행
- 제품 코드 수정 없음
- Browser QA 추가 실행 없음
- Build/정적 검증 미실행
- Commit 없음

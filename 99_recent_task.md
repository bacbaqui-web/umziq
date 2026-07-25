# Layer Document Architecture Migration — Post-Sprint QA 보고

## 작업 상태

- Sprint: `Layer Document Architecture Migration`
- 최근 작업: Post-Sprint Browser QA와 QA 결함 수정
- 결과: 완료
- QA: Microsoft Edge 새 창에서 실제 조작 QA 통과
- Commit: QA와 최종 정적 검증을 통과한 본 변경과 함께 생성

이번 문서는 작업을 멈추는 시점 기준 가장 최근 작업 한 건만 기록한다.

---

## 실제 QA 범위

사용 Fixture:

- `drag_test.psd`
- `layer_test.psd`

확인한 항목:

- 두 PSD의 순차 Import와 기존 Source/편집 상태 보존
- PSD Tree, Canvas, Timeline, Properties의 Layer Document 선택 동기화
- Canvas 더블클릭 Group 진입과 Timeline navigation
- Properties Transform 변경과 Canvas 반영
- Canvas Anchor 조작과 Properties 기준 X/Y 동기화
- Undo/Redo 복원
- 작업용(`fast-render`)과 완성본(`full-render`) 전환 및 재생
- Duplicate의 Source 공유, Layer Document 독립성, 표시 이름
- 대용량 `layer_test.psd` Group의 선택·편집·재생

---

## QA에서 발견하고 수정한 문제

첫 QA에서 Duplicate 자체는 독립 Layer Document로 정상 생성됐지만,
Timeline과 Properties의 표시 이름이 원본과 같은 `background`로 남았다.

원인은 Duplicate Transaction이 Layer Document의 `name`과 Placement
`alias`를 그대로 복사하던 것이었다.

다음 규칙으로 수정했다.

- 같은 부모 Group의 Layer Document 이름, alias와 Source 표시 이름을
  예약 이름으로 취급한다.
- `background` 복제는 `background_2`, 다음 복제는 `background_3`으로
  증가한다.
- 중간 이름이 이미 있으면 충돌하지 않는 다음 번호를 사용한다.
- 같은 `sourceId`는 계속 공유한다.
- 새 `layerDocumentId`와 독립 Transform/Animation/Effect/Modifier/
  Type별 데이터 계약은 유지한다.
- Duplicate Transaction과 History 1회 계약은 유지한다.

수정 후 실제 Edge에서 `background_2`, `background_3`이 표시되는 것을
확인했다. `background_3`의 X를 변경해도 원본 `background`의 X가
변하지 않아 독립 편집도 재확인했다.

---

## 최종 QA 결과

- `drag_test.psd`: 통과
- `layer_test.psd`: 통과
- Import/Selection/Navigation: 통과
- Transform/Anchor/Properties 동기화: 통과
- Duplicate 명명과 독립성: 수정 후 통과
- Undo/Redo: 통과
- 작업용/완성본 Renderer 재생: 통과

확인한 범위에서 추가 제품 결함은 발견되지 않았다.

---

## 최종 정적 검증

- `npm test`: 31개 verification 통과
- `npm run lint`: 통과
- `npm run build`: 통과
- `git diff --check`: 통과

Build에는 기존 minified chunk `753.94 kB` 경고만 남아 있다.

---

## 감독관 판단

QA 중 발견한 Duplicate 표시 이름 결함은 최소 범위로 수정하고 동일
절차로 재검증했다. Layer Document 단일 편집 원본, Source 공유와
Layer별 독립 편집, History 및 Renderer 계약은 유지됐다.

최종 정적 검증까지 통과했으므로 Sprint 결과를 커밋한다.

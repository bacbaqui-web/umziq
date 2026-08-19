# Nexus 전환 Sprint 완료 기록

## 결과

- Project Owner 관련 실행 파일, 타입, 변수와 public entry를 Nexus로 전환했다.
- canonical Project, transaction/replace, History, Selection, session과 Runtime effect 의미는
  유지했다.
- `EditorNexusPort`에서 raw reducer transition을 제거했다.
- Read, Transaction, Replace, History와 Selection capability Port를 실제 메서드 계약으로
  분리하고 소비자별 최소 계약을 주입했다.
- Nexus core에는 Browser/OS, Gateway, Feature UI와 제품 workflow가 들어가지 않았다.

## 검증

- 같은 Light 서브에이전트가 inventory, mechanical rename, 최소 Port와 최종 wiring을
  순서대로 독립 감사했다.
- ESLint 통과
- verification suite 66개 통과
- Build는 기존 PSD Tree export/type 오류 7건만 남았다.
- 제품 동작과 저장 schema는 변경하지 않았다.

## 후속

Sprint 3에서 Gateway의 공식 코드 경계와 Project Storage Capability를 구현한다.

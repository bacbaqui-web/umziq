# 문서·Architecture 정리 완료 보고

- Nexus, Gateway, Editor Root, Menu, Visual과 Audio를 현재 공식 명칭으로 통일했다.
- Timeline과 Animation Architecture에 남아 있던 Composition Root, Properties Engine과
  Audio Effects Engine 표현을 제거했다.
- Drawing의 Project, Render, Draft, Overlay와 저장 계약을 각 canonical 본문에 통합했다.
- Persistence/Lifecycle 문서를 Project File Workflow Architecture로 바꿨다.
- Source Map에 `src/engines/project/`와 사용되지 않는 `src/engines/psd-tree/`의 실제 상태를
  명시했다.
- 완료된 Roadmap은 Completed에만 보존하고 `97`은 다음 Sprint 초안, `98`은 현재 Sprint
  상태 문서로 초기화했다.
- 상세 완료 기록은 `docs/completed/068_documentation_architecture_cleanup.md`에 보존했다.
- canonical 옛 명칭 검색, Markdown 85개 링크 검사, Completed 001~068 연속성 확인과
  `git diff --check`를 통과했다.

코드와 제품 동작은 변경하지 않았다. `src/engines/project/` 재배치와
`src/engines/psd-tree/` 제거·흡수 여부는 별도 코드 Sprint에서 결정한다.

# Preview & Accurate Renderer Architecture

## 완료 상태

- Sprint A~C 완료
- 제품 코드와 canonical Architecture 일치
- Browser QA는 별도 요청 전까지 미실행

## 결과

```text
Frame Evaluation → EvaluatedScene
                         ├─ Preview Renderer → Editor Canvas
                         └─ Accurate Renderer → 전체 Frame

Editor Overlay = Render 결과 밖의 별도 Editor projection
```

## 주요 변경

- Editor Canvas를 Preview Renderer 단일 경로로 전환했다.
- 사용자 Renderer 선택 UI와 Root mode Runtime을 제거했다.
- Accurate Renderer는 같은 `EvaluatedScene`에서 전체 Frame을 만드는
  direct callable로 보존했다.
- Frame Evaluation의 공개 결과를 `EvaluatedScene`으로 한정했다.
- Overlay Target은 Frame 평가가 끝난 뒤 Editor read model에서 조합한다.
- Fast/Full 기술 명칭을 Preview/Accurate 역할 명칭으로 교체했다.
- Preview Composition Cache에서 불필요해진 mode key 축을 제거했다.
- Preview Quality는 Canvas backing scale/Preview Cache 책임으로 유지했고,
  Frame evaluation identity에서는 제거했다.
- timed Source sampling key는 기존 Source 계약을 유지했다.

## 회귀 방지

- Preview/Accurate가 같은 Scene 구조를 소비하는 verification을 추가했다.
- 기존 LayerDocument, Draft, Timeline, History와 Source Runtime verification을
  유지했다.
- 기존 observation fixture의 Dirty/Cache/Surface/painter 수치를 유지했다.

## 후속 범위

- Export scheduler, Encoder, Audio mux와 File 생성
- 실제 브라우저 pixel parity QA
- `RenderFrame` 및 오래된 identity 용어의 별도 정리

위 항목은 이번 Sprint에서 구현하지 않았다.

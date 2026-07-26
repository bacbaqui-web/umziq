# Preview Quality & Backing Scale

> 상태: LayerDocument Runtime 기준 확정
> 범위: Canvas Preview 품질과 runtime surface lifecycle

## 결론

Preview 품질은 **backing-scale-only** 정책을 사용한다.

- 원본 Source bitmap은 `LayerDocumentSourceRuntimeResourceCache`가 한 벌만 소유한다.
- 품질 선택은 root Canvas와 Composition/Surface Cache의 pixel backing scale만 변경한다.
- 품질별 Source bitmap, ImageBitmap generation, bitmap memory estimator는 만들지 않는다.
- Preview와 Export는 계속 같은 원본 Source 경계를 사용한다.
- 품질은 Canvas Runtime이며 Project/History에 저장하지 않는다.

과거 source Preview bitmap cache 설계는 LayerDocument 전환 후 제품 경로에서
제거되었다. 이를 복원하면 Source Runtime과 별도로 bitmap 생성, generation,
atomic swap, LRU, Refresh/Reconnect disposal을 다시 소유해야 한다. 측정된 병목은
Source bitmap이 아니라 최종 합성 경로였으므로 해당 복잡도를 되살리지 않는다.

## 품질 계약

| UI | 내부 preference | resolved backing scale |
|---|---|---:|
| 자동 | `auto` | 기기 메모리 tier 결과 |
| 원본 | `original` | 1.0 |
| 상 | `high` | 0.75 |
| 중 | `medium` | 0.5 |
| 하 | `low` | 0.25 |

자동 품질은 Canvas backing 비용을 낮추기 위한 단순한 기기 tier 정책이다.

- 8 GiB 이상: `original`
- 4 GiB 이상: `high`
- 2 GiB 이상: `medium`
- 2 GiB 미만: `low`
- 기기 메모리 정보를 제공하지 않는 환경: `medium`

명시 품질은 자동으로 변경하지 않는다. UI의 `자동 (현재: …)` 값과 실제
`pixelScale`, `previewQuality`, Composition/Surface Cache key는 항상 같은
resolved quality를 사용한다.

## Runtime 수명

- Import/Refresh/Reconnect/Delete의 원본 resource 수명은
  `LayerDocumentSourceRuntimeResourceCache`가 담당한다.
- Refresh/Reconnect는 기존 resource를 suspend한 뒤 새 batch를 등록하며,
  성공 시 이전 resource를 dispose하고 실패 시 복원한다.
- Delete는 해당 Source resource를 invalidate/dispose한다.
- Project replace와 Editor unmount는 Source runtime 전체를 dispose한다.
- Canvas Composition Cache는 현재 frame에서 사용하지 않은 entry를 `endFrame`
  에서 해제한다.
- Surface Cache는 quality/scale/logical/pixel size key로 surface를 재사용하고,
  bounded pool eviction 또는 Canvas Runtime dispose에서 backing을 해제한다.

Source resource와 Preview surface는 Runtime 전용이며 Project, 저장 파일,
History에 들어가지 않는다.

## Render 경계

- `full-render`와 `fast-render`의 의미는 변경하지 않는다.
- Preview 품질은 renderer 선택과 독립적이다.
- 품질은 pixel backing만 바꾸며 logical Transform, Animation, Anchor,
  Selection, Preview/Export의 원본 시각 결과 계약을 바꾸지 않는다.
- 새 Renderer, Engine, Store, Runtime은 추가하지 않는다.

## 검증

- 자동/원본/상/중/하가 단일 resolved quality와 backing scale을 사용한다.
- UI에 존재하지 않는 bitmap cache memory를 표시하지 않는다.
- 같은 quality/size surface는 재사용하고 quality 변경은 다른 backing key를 쓴다.
- Import/Refresh/Delete/Reconnect의 Source resource가 정확히 한 번 dispose된다.
- Preview Runtime dispose가 Composition/Surface Cache를 정리한다.
- Preview/Export 원본 Source 경계와 full/fast renderer 의미를 유지한다.

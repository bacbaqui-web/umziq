# Radial Transform Handle Size Adjustment

## 목적

Canvas 방사형 Transform Handle을 기존보다 1.2배 크게 표시해 조작 대상을 더 쉽게 인식하고 누를 수 있도록 했다.

## 변경

| 요소 | 이전 | 변경 |
|---|---:|---:|
| Anchor point | 10px | 12px |
| Rotation/Opacity endpoint | 10px | 12px |
| Position ring diameter | 40px | 48px |
| Scale arrow head length | 8px | 9.6px |
| Scale arrow head width | 10px | 12px |
| Scale arrow hit area | 18px | 21.6px |

확대된 외곽과 connection line이 겹치지 않도록 다음 geometry도 같은 비율로 맞췄다.

- Position ring radius: `20px → 24px`
- Rotation/Opacity hollow endpoint radius: `5px → 6px`

## 보존한 의미

- Anchor에서 radial handle center까지의 50px 거리
- Opacity handle의 0~100% center 이동 범위
- Scale, Rotation과 Opacity 계산
- 첫 pointer 위치의 100% 기준
- Cursor, hover, drag와 numeric readout
- Connection line, circle border와 arrow stroke 두께
- Draft, Commit, History와 Project 의미

## 변경 파일

- `src/features/preview/components/PreviewAnchorControl.tsx`
- `src/features/preview/components/PreviewGizmoHandles.tsx`
- `src/engines/canvas/helpers/canvasGizmoHelpers.ts`
- `scripts/verifyCanvasDirectSelectionUi.ts`
- `scripts/verifyCanvasInteractionHelpers.ts`

## 검증

- Canvas helper verification: 통과
- Canvas interaction helper verification: 통과
- Canvas direct-selection UI verification: 통과
- 전체 verification: 45개 script 통과
- 변경 파일 ESLint: 통과
- Production build: 통과
- `git diff --check`: 통과

실제 Browser QA는 사용자 요청이 없어 실행하지 않았다.

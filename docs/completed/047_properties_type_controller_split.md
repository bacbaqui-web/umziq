# Properties Type Controller Split 완료

## 상태

- Sprint F 구현 완료
- 자동 검증 완료
- 실제 Browser pointer/keyboard/Audio 수동 QA는 미실행

## 목표

기존 Properties UI, `.ziq`, Project Owner와 공개
`PropertiesEngineViewProps` 계약을 바꾸지 않고 큰 Engine/Controller에 섞여 있던
Numeric Draft, Visual, Audio와 Modifier 책임을
`Engine → Composer → Controller → Helper` 구조로 분리했다.

## 결과 구조

```text
useLayerDocumentPropertiesEngine
└─ useLayerDocumentPropertiesComposer
   ├─ PropertiesNumericDraftController
   ├─ VisualPropertiesController
   ├─ AudioPropertiesController
   └─ ModifierPropertiesController
```

- Engine은 Composer 호출과 공개 반환만 담당한다.
- Composer는 독립 Controller 결과와 순수 projection을 공개 ViewProps로 조립한다.
  실행 순서, 선택 조건과 제품 규칙은 결정하지 않는다.
- 선택 종류와 Draft scope는 순수 Helper가 계산한다.
- 분리 전 Controller import 경로는 작은 호환 re-export/composer로 유지했다.

## 책임 분리

### Numeric Draft

- focused input, 문자열 Draft와 scope identity만 소유한다.
- selection/revision/global frame/local frame/reset revision 변경 시 Draft를 폐기한다.
- Project, Preview, History와 type별 clamp를 참조하지 않는다.

### Visual

- position/scale/rotation/opacity/anchor focus와 Transform Preview 수명을 소유한다.
- blur/Enter commit, Escape/cancel, scale link, Animation track와 keyframe command를
  기존 port로 유지한다.

### Audio

- 이름, gain, start/duration/source offset, fade in/out와 mute를 소유한다.
- 모든 변경은 기존 `set-audio-properties` command로만 보낸다.
- Source/Cut/fade/gain clamp는 기존 command preparation authority에 남겼다.
- Audio Effects Engine과 직접 import하지 않는다.

### Modifier

- toggle, 숫자 Draft, 입뻥긋 Audio 연결과 가속·감속 property/curve를 소유한다.
- canonical `LayerModifierDefinition`의 default/normalize/descriptor authority를
  유지한다.
- 다른 Properties Controller와 Audio Effects Engine을 참조하지 않는다.

## 보존한 계약

| 동작 | 연속 Draft | 정상 확정 | cancel/stale/no-op |
|---|---:|---:|---:|
| Visual Transform | Preview, History 0 | 의미 있는 변경 History 1 | History 0 |
| Audio field | 문자열 Draft, History 0 | `set-audio-properties` 1건 | History 0 |
| Modifier field | 문자열 Draft, History 0 | `set-modifiers` 1건 | History 0 |
| Scale/Animation/Keyframe | 해당 없음 | 기존 command 1건 | History 0 |

- 공개 `PropertiesEngineViewProps`, `PropertiesReadModel`, `PropertiesCommand` 의미를
  유지했다.
- Properties class, 문구, field 순서와 CSS를 변경하지 않았다.
- `.ziq` schema, `LayerDocument`, `LayerModifier` 저장 포맷을 변경하지 않았다.
- Audio 선택의 Visual/Modifier 숨김과 Visual 선택의 Audio 숨김을 유지했다.
- Audio Effects Engine 파일과 public port를 수정하지 않았다.

## 검증

- `verifyPropertiesTypeControllerSplit.ts`
  - Numeric Draft begin/change/cancel/scope reset
  - 순수 선택 종류 판정
  - 얇은 Engine과 Composer/Controller/Helper import 경계
  - Composer의 `canHandle`/registry/제품 command 부재
- `verifyLayerDocumentAudioProperties.ts`
  - Audio 7개 field projection
  - Audio Controller focus/change/commit/Escape/stale 격리
  - 기존 clamp와 History 0/1 preparation 계약
- `verifyLayerDocumentPropertiesController.ts`
  - Visual Transform Preview/commit/cancel, anchor, Animation/keyframe 회귀
- `verifyModifierDefinitionFoundation.ts`
  - canonical Modifier Definition과 입뻥긋 연결 회귀
- 전체 Verification 62개 통과
- `npm run lint` 통과
- `npm run test` 통과
- `npm run build` 통과
- `git diff --check` 통과

## 남은 수동 QA

자동 검증은 다음 실제 Browser 상호작용을 대신하지 않는다.

1. Visual 숫자 input과 위아래 pointer scrub의 focus/blur/Enter/Escape
2. selection/frame 이동 중 열린 Draft와 Transform Preview 정리
3. Audio 이름 IME 입력, 숫자 scrub, mute와 실제 재생 결과
4. Modifier 숫자 scrub, 입뻥긋 Audio 선택과 가속·감속 설정
5. Undo/Redo 후 표시값, focus와 선택 section의 일치
6. Audio Effects Panel이 Properties와 독립적으로 기존 동작을 유지하는지 청감 확인

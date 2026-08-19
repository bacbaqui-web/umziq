# Completed 기록 안내

이 폴더는 완료된 기능, 조사, 설계 전환과 검증 결과를 **당시 상태 그대로** 보존하는 역사 기록이다. 현재 제품 계약은 [`docs/architecture/`](../architecture/README.md), 현재 구현 위치는 [`docs/20_src_map.md`](../20_src_map.md)를 먼저 확인한다.

## 1. 읽는 방법

```text
AGENTS.md → docs/01_rule.md → docs/architecture/README.md
→ docs/20_src_map.md → 필요할 때 이 README와 관련 Completed 원문
```

- Completed 문서가 현재 Architecture와 다르면 Architecture가 우선한다.
- `대체됨`은 현재 판단에 후속 기록과 Architecture를 함께 읽어야 한다는 뜻이다.
- 과거 문서의 `.sfep`, Fast/Full Renderer, 파일 경로와 타입 이름은 현재와 다를 수 있다.

## 2. 상태 표시

| 상태 | 의미 |
|---|---|
| 기초 | 이후 기능과 리팩토링의 출발점 |
| 완료 | 당시 목표와 검증을 마친 기록 |
| 조사 | 문제, 대안과 후속 방향을 정리한 기록 |
| 최적화 | 측정 또는 Runtime 개선 기록 |
| 대체됨 | 현재 판단에는 후속 기록이나 Architecture를 우선해야 하는 기록 |

## 3. 주제별 빠른 경로

| 작업 주제 | 권장 읽기 순서 | 현재 기준 |
|---|---|---|
| Project·Owner 구조 전환 | 015 → 016 → 017 → 018 → 019 → 057 | Architecture 10, 17, 18 |
| Project 열기·저장·복구 | 027 → 033 → 036 → 037 → 046 | Architecture 15, 17 |
| Render 구조와 최적화 | 004 → 005 → 003 → 020 → 021 → 022 → 023 | Architecture 11 |
| Canvas·Draft·Transform | 006 → 007 → 008 → 009 → 010 → 011 | Architecture 13, 14 |
| Library·Audio | 024 → 025 → 026 → 028 → 029 → 030 → 033 → 035 → 045 → 048 → 063 → 064 → 067 | Architecture 10, 13, 15, 17, 18 |
| Nexus·Gateway·Engine 전환 | 057 → 058 → 059 → 060 → 061 → 062 → 063 → 064 → 065 → 066 → 067 → 068 | Architecture 10~18 |
| Timeline·Modifier | 001 → 040 → 041 → 042 → 043 → 044 → 049 → 050 → 051 → 052 → 053 | Architecture 12, 13, 16 |
| 좌표·Canvas UI | 013 → 031 → 032 → 038 → 039 → 055 | Architecture 14 |
| Drawing | 016 → 055 | Architecture 10, 13, 14 |

## 4. Architecture별 역사적 배경

| Architecture | 관련 Completed 기록 |
|---|---|
| [10 Project](../architecture/10_project_architecture.md) | 015~019, 024, 026, 036~037, 045~046, 057~068 |
| [11 Render](../architecture/11_render_architecture.md) | 003~005, 008, 010~011, 020~023, 038~039, 068 |
| [12 Timeline·Playback](../architecture/12_timeline_playback_architecture.md) | 012, 024, 040~044, 049, 051~053, 068 |
| [13 History·Draft](../architecture/13_history_draft_architecture.md) | 006, 010, 015, 024, 040~044, 047, 049~053, 068 |
| [14 Canvas·Overlay](../architecture/14_canvas_overlay_architecture.md) | 005~014, 023, 031~032, 038~039, 068 |
| [15 Source](../architecture/15_source_architecture.md) | 002~003, 017, 024~026, 028~030, 033~035, 042, 045, 048, 061~064, 067~068 |
| [16 Animation](../architecture/16_animation_architecture.md) | 001, 004, 031~032, 040~044, 047, 050, 052~053, 068 |
| [17 Project File Workflow](../architecture/17_project_file_workflow_architecture.md) | 002, 018, 024, 027, 029, 033, 035~037, 042, 046, 048, 059~060, 065, 067~068 |
| [18 Platform Gateway](../architecture/18_platform_gateway_architecture.md) | 057~068 |

## 5. 전체 기록

아래 표는 001~068의 원문 68개를 번호순으로 모두 포함한다. Architecture 번호는 현재 책임을 찾아가기 위한 색인이다.

| 번호 | 기록 | 주제 | 상태 | Architecture | 후속·참고 |
|---:|---|---|---|---|---|
| 001 | [수식 라이브러리 구현 설명](001_modifier_library.md) | Modifier | 기초·대체됨 | 13, 16 | 040~044, 050 |
| 002 | [PSD Tree Import Workflow 개선 설계](002_psd_import_workflow.md) | PSD Import | 완료·대체됨 | 10, 15, 17 | 016~019, 024, 033 |
| 003 | [Preview Quality & Backing Scale](003_preview_quality_and_memory_cache.md) | Render 품질 | 완료 | 11, 15 | 020~023 |
| 004 | [Dual Renderer Architecture](004_dual_renderer_architecture.md) | Renderer | 완료·대체됨 | 11, 16 | 020~023 |
| 005 | [Preview Runtime Optimization](005_preview_runtime_optimization.md) | Preview Runtime | 최적화 | 11, 13, 14 | 010~011, 020~023 |
| 006 | [Editor Draft Runtime Integration](006_editor_draft_runtime_integration.md) | Draft | 완료 | 13, 14 | 010~011, 052 |
| 007 | [Transform Origin Editing](007_transform_origin_editing.md) | Transform | 완료 | 14 | 031~032 |
| 008 | [Canvas Engine Responsibility Refactoring](008_canvas_engine_responsibility_refactoring.md) | Canvas 책임 | 완료 | 11, 14 | 020~023 |
| 009 | [Canvas Visual Layer Selection](009_canvas_visual_layer_selection.md) | Canvas 선택 | 완료 | 14 | 049 |
| 010 | [Transform Drag Runtime Continuity Optimization](010_transform_drag_runtime_continuity_optimization.md) | Drag Runtime | 최적화 | 11, 13, 14 | 011, 052 |
| 011 | [Preview Interaction Runtime 최적화 측정 기록](011_measured_preview_interaction_runtime_optimization.md) | 성능 측정 | 최적화 | 11, 13, 14 | 020~023 |
| 012 | [Timeline Navigation UI Improvement](012_timeline_navigation_ui_improvement.md) | Timeline UI | 완료 | 12 | 049~053 |
| 013 | [Radial Transform Handle Size Adjustment](013_radial_transform_handle_size_adjustment.md) | Canvas UI | 완료 | 14 | — |
| 014 | [Layer & Composition Icon System](014_layer_composition_icon_system.md) | 공통 아이콘 | 기초·완료 | 10, 14 | 024, 026 |
| 015 | [Editor Shared State & Cross-Engine Synchronization Investigation](015_editor_shared_state_cross_engine_synchronization_investigation.md) | 공유 상태 | 조사·대체됨 | 10, 12, 13 | 017, 019, 049~053 |
| 016 | [Layer Type Foundation + Future Engine Foundation](016_layer_type_future_engine_foundation.md) | Layer Type | 기초·대체됨 | 10 | 017~019 |
| 017 | [LayerDocument Architecture](017_layer_document_architecture.md) | LayerDocument | 완료·대체됨 | 10, 13, 15 | 현재 Architecture 10 |
| 018 | [LayerDocument Persistence와 Project Lifecycle](018_layer_document_persistence_project_lifecycle.md) | Persistence | 완료·대체됨 | 17 | 현재 Architecture 17 |
| 019 | [Editor Project Owner와 Panel Engine Architecture](019_editor_project_owner_panel_engine_architecture.md) | Owner·Engine | 완료·대체됨 | 10 | 현재 Architecture 10 |
| 020 | [Render Runtime Optimization Architecture Audit](020_render_runtime_optimization_architecture_audit.md) | Render 진단 | 조사 | 11 | 021~023 |
| 021 | [Render Runtime Architecture Inventory](021_render_runtime_architecture_inventory.md) | Render Inventory | 조사 | 11 | 022~023 |
| 022 | [Render Runtime Bible](022_render_runtime_bible.md) | Render 기준안 | 조사·대체됨 | 11 | 023, 현재 Architecture 11 |
| 023 | [Preview & Accurate Renderer Architecture](023_preview_accurate_renderer_architecture.md) | Renderer | 완료 | 11, 14 | 현재 Architecture 11 |
| 024 | [Library + Audio Foundation](024_library_audio_foundation.md) | Library·Audio | 기초·완료 | 10~13, 15, 17 | 025~026, 028~030, 035, 042, 045, 048 |
| 025 | [Audio QA Follow-up 완료 보고](025_audio_qa_followup.md) | Audio QA | 완료 | 11, 12, 15 | 029, 035, 048 |
| 026 | [Library Unified Hierarchy Sprint 완료 보고](026_library_unified_hierarchy.md) | Library 계층 | 완료 | 10, 15 | 028, 030, 034, 045 |
| 027 | [Untitled Project Save Controls 완료 보고](027_untitled_project_save_controls.md) | Project Save UI | 완료 | 17 | 036~037, 046 |
| 028 | [Library Hover Preview](028_library_hover_preview.md) | Library Preview | 완료 | 15 | 034, 045 |
| 029 | [Recorded Audio Asset Lifecycle 완료 보고](029_recorded_audio_asset_lifecycle.md) | 녹음 Asset | 완료 | 15, 17 | 035, 048 |
| 030 | [Library Delete and Drop Feedback 완료 보고](030_library_delete_and_drop_feedback.md) | Library 편집 | 완료 | 13, 15 | 034, 045 |
| 031 | [중앙 원점 좌표계](031_center_origin_coordinates.md) | 좌표 | 완료 | 14, 16 | 032 |
| 032 | [PSD 그룹 콘텐츠 중앙 기준점](032_psd_group_content_anchor.md) | PSD Anchor | 완료 | 14, 16 | — |
| 033 | [프로젝트 원본 자동 복구](033_project_asset_recovery.md) | Asset 복구 | 완료 | 15, 17 | 035~036 |
| 034 | [Library 드래그 안정화](034_library_drag_stability.md) | Library Drag | 완료 | 13, 15 | 045 |
| 035 | [Audio 프로젝트 재열기 및 재연결](035_audio_project_reload.md) | Audio Reconnect | 완료 | 15, 17 | 042, 048 |
| 036 | [프로젝트 폴더 한 번으로 열기](036_project_folder_open.md) | Project Open | 완료 | 10, 15, 17 | 037, 046 |
| 037 | [프로젝트 시작 화면과 강제 폴더 구조](037_project_start_screen.md) | Project Lifecycle UI | 완료 | 10, 17 | 046 |
| 038 | [촬영범위 바깥 전체 어둡게 표시](038_camera_outside_dim.md) | Camera Overlay | 완료 | 11, 14 | 039 |
| 039 | [촬영범위 메뉴에 세이프존과 바깥 어둡기 통합](039_camera_menu_safezone_dim.md) | Camera UI | 완료 | 11, 14 | — |
| 040 | [입뻥긋(기본) 수식 클립 완료](040_mouth_basic_formula_clip.md) | Mouth Modifier | 완료 | 12, 13, 16 | 044, 050 |
| 041 | [가속·감속 수식 클립 완료](041_acceleration_formula_clip.md) | Easing Modifier | 완료 | 12, 13, 16 | 044 |
| 042 | [Undo-safe Source Runtime과 원본 보존](042_undo_safe_source_runtime.md) | Source Runtime | 완료 | 13, 15, 17 | 045, 048 |
| 043 | [Timeline Pointer Drag Runtime 완료](043_timeline_pointer_drag_runtime.md) | Pointer Runtime | 완료 | 12, 13 | 049, 052~053 |
| 044 | [Modifier Definition & Formula Clip Foundation 완료 기록](044_modifier_definition_formula_clip.md) | Modifier 구조 | 기초·완료 | 12, 13, 16 | 050, 052~053 |
| 045 | [Library Engine Responsibility Split 완료 기록](045_library_engine_responsibility_split.md) | Library 책임 | 완료 | 10, 13, 15 | — |
| 046 | [Project Lifecycle Presentation Split 완료](046_project_lifecycle_presentation_split.md) | Lifecycle UI 책임 | 완료 | 10, 17 | — |
| 047 | [Properties Type Controller Split 완료](047_properties_type_controller_split.md) | Properties 책임 | 완료 | 10, 13, 16 | 050 |
| 048 | [확인형 녹음창과 최종 파일 저장 완료 기록](048_confirmed_recording_dialog.md) | Recording | 완료 | 15, 17 | — |
| 049 | [Timeline Layer 선택 Intent와 Pointer 상호작용 정리 완료 기록](049_timeline_selection_intent.md) | Selection Intent | 완료 | 12, 13, 14 | 051~053 |
| 050 | [입뻥긋 반복수 Numeric Draft 완료 기록](050_mouth_repetition_numeric_draft.md) | Numeric Draft | 완료 | 13, 16 | — |
| 051 | [Timeline Item Row UI 책임 분리 완료 기록](051_timeline_item_row_split.md) | Timeline UI 책임 | 완료 | 12, 14 | 053 |
| 052 | [Timeline Timing Draft 단일 Runtime 경계 완료 기록](052_timeline_timing_draft_runtime.md) | Timing Draft | 완료 | 12, 13, 16 | 053 |
| 053 | [Timeline Engine·ReadModel 책임 분리 완료 기록](053_timeline_engine_read_model_split.md) | Timeline Engine | 완료 | 10, 12, 13, 16 | 현재 Architecture 12 |
| 054 | [Completed 기록 색인·보존 체계 정리 완료 기록](054_completed_archive_index.md) | 문서 Archive | 완료 | 전체 | — |
| 055 | [Drawing Engine 1차 Sprint 완료 기록](055_drawing_engine_first_sprint.md) | Drawing | 완료 | 10, 13, 14 | Drawing Mode·Library 통합 Sprint |
| 056 | [Drawing Mode·Library 통합 Sprint 완료 기록](056_drawing_mode_library_integration.md) | Drawing·Library | 완료 | 10, 13, 14, 15 | Pointer 입력 최적화 |
| 057 | [Architecture 계약과 회귀 Baseline 완료 기록](057_architecture_contract_regression_baseline.md) | Nexus·Gateway 경계 | 완료 | 10, 11, 15, 17, 18 | Sprint 2 Nexus 전환 |
| 058 | [Nexus 전환 Sprint 완료 기록](058_nexus_transition.md) | Nexus | 완료 | 10, 13, 18 | Sprint 3 Gateway Storage |
| 059 | [Project Storage Gateway Sprint 완료 기록](059_project_storage_gateway.md) | Gateway Storage | 완료 | 10, 17, 18 | 060 |
| 060 | [Menu Engine·Editor Root Sprint 완료 기록](060_menu_engine_editor_root.md) | Menu·Root | 완료 | 10, 17, 18 | 061 |
| 061 | [Source Access Gateway Sprint 완료 기록](061_source_access_gateway.md) | Source Gateway | 완료 | 15, 18 | 062 |
| 062 | [Library Reconnect·Source Runtime Sprint 완료 기록](062_library_reconnect_source_runtime.md) | Reconnect | 완료 | 10, 15, 18 | 063 |
| 063 | [Visual·Audio Engine 재편 Sprint 완료 기록](063_visual_audio_engine_split.md) | Inspector Engine | 완료 | 10, 13, 16 | 064 |
| 064 | [Microphone Capture Gateway Sprint 완료 기록](064_microphone_capture_gateway.md) | Recording Gateway | 완료 | 15, 18 | 065 |
| 065 | [Menu Export·Destination Gateway Sprint 완료 기록](065_menu_export_destination_gateway.md) | Export Gateway | 완료 | 10, 18 | 066 |
| 066 | [최종 Platform Boundary·Architecture Sprint 완료 기록](066_final_platform_boundary_architecture.md) | Architecture | 완료 | 전체 | — |
| 067 | [최종 Architecture 안정화 Sprint 완료 기록](067_final_architecture_stabilization.md) | Architecture 안정화 | 완료 | 10, 11, 13, 15, 17, 18 | 제품 기능 개발 |
| 068 | [문서·Architecture 정리 완료 기록](068_documentation_architecture_cleanup.md) | 문서 정리 | 완료 | 전체 | 제품 기능 개발 |

## 6. 중요한 대체 관계

- 001은 040~044와 050의 typed Modifier·Formula Clip·Draft 구조로 확장됐다.
- 002와 016의 초기 구조는 017~019를 거쳐 현재 Architecture 10, 15, 17로 정리됐다.
- 015의 진단은 017, 019와 049~053의 Owner·Runtime·Intent 분리로 후속 반영됐다.
- 004~005는 020~023에서 다시 조사됐으며 현재 기준은 Architecture 11이다.
- 020~022는 조사와 기준안 기록이다. 완료 결과는 023, 현재 계약은 Architecture 11을 본다.
- 024~030는 035, 042, 045, 048에서 reconnect, Source Runtime, Engine 책임과 recording lifecycle 관점으로 확장됐다.
- 043은 049, 052, 053에서 선택 Intent, Timing Draft와 Timeline Engine 책임으로 후속 정리됐다.

## 7. Archive 유지 규칙

1. 파일명은 `001_이름.md` 형식의 세 자리 연속 번호를 사용한다.
2. 다음 완료 기록은 `069_이름.md`로 추가하고 이후 번호를 하나씩 올린다.
3. 기존 원문의 표현, 번호와 파일명은 소급해 고치지 않는다.
4. 현재 설계가 바뀌면 Architecture를 수정하고 이 색인에는 후속·대체 관계만 추가한다.
5. 새 기록을 추가할 때 전체 기록 표와 관련 주제별 경로를 함께 갱신한다.
6. 파일 이동이나 이름 변경이 필요하면 저장소 전체의 Markdown 링크를 검증한다.

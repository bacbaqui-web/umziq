import { useRef } from "react";
import type { AnimatableProperty, Position } from "@/editor/types/types";
import { getPropertyVisualTokens } from "@/features/propertyVisualTokens";
import type { PropertiesPanelProps } from "@/features/properties/types/propertiesPanelTypes";

type PropertiesPropertyRowProps = Pick<
  PropertiesPanelProps,
  | "selectedPropertyState"
  | "selectedLayer"
  | "selectedTimelineComp"
  | "selectedScaleTarget"
  | "selectedScaleLinked"
  | "propertyLabels"
  | "propertyValueDrafts"
  | "evaluatedSelectedLayerPosition"
  | "evaluatedSelectedScale"
  | "evaluatedSelectedRotation"
  | "positionDraft"
  | "scaleDraft"
  | "rotationDraft"
  | "onTogglePropertyTrack"
  | "onSetPositionDraft"
  | "onApplyPositionValue"
  | "onSetScaleDraft"
  | "onApplyScaleValue"
  | "onSetRotationDraft"
  | "onApplyRotationValue"
  | "onSetOpacityDraft"
  | "onApplyOpacityValue"
  | "onBeginTransformHistoryCapture"
  | "onMarkTransformHistoryCaptureDirty"
  | "onCommitTransformHistoryCapture"
  | "onSetScaleLinkState"
> & {
  property: AnimatableProperty;
};

function getPropertyInputStyle(property: AnimatableProperty, isEnabled: boolean) {
  const colors = getPropertyVisualTokens(property);
  return {
    width: property === "rotation" ? 48 : 42,
    padding: "3px 5px",
    borderRadius: 4,
    border: `1px solid ${isEnabled ? colors.accentBorder : "#34383c"}`,
    background: isEnabled ? "rgba(19, 24, 30, 0.92)" : "#1d1d1d",
    color: isEnabled ? "#fff" : "#7f8790",
    colorScheme: "dark" as const,
    fontSize: 11,
  };
}

export default function PropertiesPropertyRow({
  property,
  selectedPropertyState,
  selectedLayer,
  selectedTimelineComp,
  selectedScaleTarget,
  selectedScaleLinked,
  propertyLabels,
  propertyValueDrafts,
  evaluatedSelectedLayerPosition,
  evaluatedSelectedScale,
  evaluatedSelectedRotation,
  positionDraft,
  scaleDraft,
  rotationDraft,
  onTogglePropertyTrack,
  onSetPositionDraft,
  onApplyPositionValue,
  onSetScaleDraft,
  onApplyScaleValue,
  onSetRotationDraft,
  onApplyRotationValue,
  onSetOpacityDraft,
  onApplyOpacityValue,
  onBeginTransformHistoryCapture,
  onMarkTransformHistoryCaptureDirty,
  onCommitTransformHistoryCapture,
  onSetScaleLinkState,
}: PropertiesPropertyRowProps) {
  const isCapturingHistoryRef = useRef(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const isEnabled = selectedPropertyState[property];
  const isPositionRow = property === "position";
  const isScaleRow = property === "scale";
  const isRotationRow = property === "rotation";
  const isOpacityRow = property === "opacity";
  const hasTransformTarget = !!selectedScaleTarget;
  const isImplementedProperty =
    (isPositionRow && (!!selectedLayer || !!selectedTimelineComp)) ||
    (isOpacityRow && (!!selectedLayer || !!selectedTimelineComp)) ||
    ((isScaleRow || isRotationRow) && hasTransformTarget);
  const values = propertyValueDrafts[property];
  const colors = getPropertyVisualTokens(property);
  const rowTextColor = isEnabled ? colors.label : "#73808d";
  const rowBackground = isEnabled ? "rgba(255,255,255,0.018)" : "transparent";
  const rowBorder = isEnabled ? colors.accentBorder : "rgba(255,255,255,0.06)";
  const inputStyle = getPropertyInputStyle(property, isEnabled);
  const beginHistoryCapture = () => {
    if (!isImplementedProperty || isCapturingHistoryRef.current) {
      return;
    }

    isCapturingHistoryRef.current = true;
    onBeginTransformHistoryCapture();
  };

  const commitHistoryCapture = () => {
    if (!isCapturingHistoryRef.current) {
      return;
    }

    isCapturingHistoryRef.current = false;
    onCommitTransformHistoryCapture();
  };

  return (
    <div
      ref={rowRef}
      style={{
        display: "grid",
        gridTemplateColumns: "18px minmax(40px, auto) 1fr",
        alignItems: "center",
        gap: 6,
        padding: "4px 7px",
        borderRadius: 5,
        borderBottom: `1px solid ${rowBorder}`,
        background: rowBackground,
        color: rowTextColor,
        opacity: isEnabled ? 1 : 0.72,
        boxShadow: isEnabled ? `inset 2px 0 0 ${colors.accentMuted}` : "none",
        transition: "background 120ms ease, border-color 120ms ease, opacity 120ms ease",
      }}
    >
      <input
        type="checkbox"
        checked={isEnabled}
        onChange={(event) => onTogglePropertyTrack(property, event.target.checked)}
        style={{ margin: 0, accentColor: colors.accent }}
      />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{propertyLabels[property]}</span>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 4,
          minWidth: 0,
        }}
      >
        {isScaleRow ? (
          <>
            {(["x", "y"] as const).map((axis, index) => (
              <label
                key={`${property}-${axis}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  color: rowTextColor,
                  fontSize: 11,
                }}
              >
                <span style={{ minWidth: 12, textAlign: "right" }}>
                  {axis.toUpperCase()}
                </span>
                <input
                  type="number"
                  value={values[index]}
                  readOnly={!isImplementedProperty}
                  onFocus={() => {
                    beginHistoryCapture();
                  }}
                  onBlur={(event) => {
                    if (rowRef.current?.contains(event.relatedTarget as Node | null)) {
                      return;
                    }

                    commitHistoryCapture();
                  }}
                  onChange={(event) => {
                    if (!isImplementedProperty) {
                      return;
                    }

                    const numericValue = Math.max(1, Number(event.target.value));
                    const baseScale = scaleDraft ?? evaluatedSelectedScale;
                    const nextScale = {
                      ...baseScale,
                      [axis]: numericValue,
                    };

                    if (selectedScaleLinked) {
                      const currentAxisValue = Math.max(1, baseScale[axis]);
                      const factor = numericValue / currentAxisValue;
                      nextScale.x = Math.max(1, baseScale.x * factor);
                      nextScale.y = Math.max(1, baseScale.y * factor);
                    }

                    onSetScaleDraft(nextScale);
                    onMarkTransformHistoryCaptureDirty();
                    onApplyScaleValue(nextScale, isEnabled);
                  }}
                  style={inputStyle}
                  title={
                    !isImplementedProperty
                      ? "이 프로퍼티 값 편집은 아직 준비 중입니다."
                      : undefined
                  }
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => onSetScaleLinkState(!selectedScaleLinked)}
              disabled={!isImplementedProperty}
              title={selectedScaleLinked ? "X/Y 연동 해제" : "X/Y 연동"}
              style={{
                width: 24,
                height: 24,
                padding: 0,
                borderRadius: 6,
                border: `1px solid ${selectedScaleLinked ? "#5d7fa1" : "#3a4047"}`,
                background: selectedScaleLinked ? colors.accentSoft : "#1c1f22",
                color: selectedScaleLinked ? colors.label : "#8c96a1",
                fontSize: 12,
                cursor: isImplementedProperty ? "pointer" : "default",
                opacity: isImplementedProperty ? 1 : 0.55,
              }}
            >
              {selectedScaleLinked ? "⛓" : "⛓︎"}
            </button>
          </>
        ) : (
          values.map((value, index) => {
            const axisLabel =
              property === "position"
                ? index === 0
                  ? "X"
                  : "Y"
                : property === "rotation"
                  ? "deg"
                  : "%";

            return (
              <label
                key={`${property}-${axisLabel}-${index}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  color: rowTextColor,
                  fontSize: 11,
                }}
              >
                <span style={{ minWidth: 12, textAlign: "right" }}>{axisLabel}</span>
                <input
                  type="number"
                  value={value}
                  readOnly={!isImplementedProperty}
                  onFocus={() => {
                    beginHistoryCapture();
                  }}
                  onBlur={(event) => {
                    if (rowRef.current?.contains(event.relatedTarget as Node | null)) {
                      return;
                    }

                    commitHistoryCapture();
                  }}
                  onChange={(event) => {
                    if (!isImplementedProperty) {
                      return;
                    }

                    const numericValue = Number(event.target.value);

                    if (property === "position") {
                      const nextPosition: Position = {
                        ...(positionDraft ?? evaluatedSelectedLayerPosition),
                        [index === 0 ? "x" : "y"]: numericValue,
                      };
                      onSetPositionDraft(nextPosition);
                      onMarkTransformHistoryCaptureDirty();
                      onApplyPositionValue(nextPosition, isEnabled);
                      return;
                    }

                    if (property === "opacity") {
                      const nextOpacity = Math.min(100, Math.max(0, numericValue));
                      onSetOpacityDraft(nextOpacity);
                      onMarkTransformHistoryCaptureDirty();
                      onApplyOpacityValue(nextOpacity, isEnabled);
                      return;
                    }

                    if (property === "rotation") {
                      const nextRotation = Number(
                        Number.isFinite(numericValue)
                          ? numericValue
                          : rotationDraft ?? evaluatedSelectedRotation
                      );
                      onSetRotationDraft(nextRotation);
                      onMarkTransformHistoryCaptureDirty();
                      onApplyRotationValue(nextRotation);
                    }
                  }}
                  style={inputStyle}
                  title={
                    !isImplementedProperty
                      ? "이 프로퍼티 값 편집은 아직 준비 중입니다."
                      : undefined
                  }
                />
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

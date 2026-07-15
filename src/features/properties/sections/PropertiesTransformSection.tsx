import PropertiesPropertyRow from "@/features/properties/components/PropertiesPropertyRow";
import type { PropertiesPanelProps } from "@/features/properties/types/propertiesPanelTypes";

type PropertiesTransformSectionProps = Pick<
  PropertiesPanelProps,
  | "selectedPropertyState"
  | "selectedLayer"
  | "selectedTimelineComp"
  | "selectedScaleTarget"
  | "selectedScaleLinked"
  | "propertyLabels"
  | "animatableProperties"
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
>;

export default function PropertiesTransformSection({
  animatableProperties,
  ...props
}: PropertiesTransformSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {animatableProperties.map((property) => (
        <PropertiesPropertyRow key={property} property={property} {...props} />
      ))}
    </div>
  );
}

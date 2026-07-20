import PropertiesPropertyRow from "@/features/properties/components/PropertiesPropertyRow";
import PropertiesTransformOriginRow from "@/features/properties/components/PropertiesTransformOriginRow";
import type {
  PropertiesCommand,
  PropertiesPropertyRowViewModel,
  PropertiesTransformOriginViewModel,
} from "@/engines/properties";

type PropertiesTransformSectionProps = {
  rows: PropertiesPropertyRowViewModel[];
  transformOrigin: PropertiesTransformOriginViewModel;
  commands: PropertiesCommand;
};

export default function PropertiesTransformSection({
  rows,
  transformOrigin,
  commands,
}: PropertiesTransformSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <PropertiesTransformOriginRow viewModel={transformOrigin} commands={commands} />
      {rows.filter((row) => row.visible).map((row) => (
        <PropertiesPropertyRow key={row.property} viewModel={row} commands={commands} />
      ))}
    </div>
  );
}

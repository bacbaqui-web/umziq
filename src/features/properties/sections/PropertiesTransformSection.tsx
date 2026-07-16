import PropertiesPropertyRow from "@/features/properties/components/PropertiesPropertyRow";
import type {
  PropertiesCommand,
  PropertiesPropertyRowViewModel,
} from "@/engines/properties";

type PropertiesTransformSectionProps = {
  rows: PropertiesPropertyRowViewModel[];
  commands: PropertiesCommand;
};

export default function PropertiesTransformSection({
  rows,
  commands,
}: PropertiesTransformSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.filter((row) => row.visible).map((row) => (
        <PropertiesPropertyRow key={row.property} viewModel={row} commands={commands} />
      ))}
    </div>
  );
}

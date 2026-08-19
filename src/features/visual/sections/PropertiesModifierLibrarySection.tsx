import type {
  PropertiesCommand,
  PropertiesModifierLibraryViewModel,
} from "@/engines/visual";

type PropertiesModifierLibrarySectionProps = {
  viewModel: PropertiesModifierLibraryViewModel;
  commands: PropertiesCommand;
};

export default function PropertiesModifierLibrarySection({
  viewModel,
  commands,
}: PropertiesModifierLibrarySectionProps) {
  if (!viewModel.visible) return null;

  return (
    <section style={{ marginTop: 14 }}>
      <div className="ui-section-title">
        수식 라이브러리
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {viewModel.items.map((item) => (
          <button
            className="ui-button"
            key={item.type}
            type="button"
            aria-pressed={item.active}
            onClick={() => commands.toggleModifier(item.type)}
            style={{
              minHeight: 28,
              padding: "0 10px",
              borderRadius: 999,
              border: `1px solid ${item.active ? "#6392ad" : "#3c474f"}`,
              background: item.active ? "#284354" : "#20262b",
              color: item.active ? "#edf8ff" : "#aeb9c2",
              fontWeight: item.active ? 700 : 500,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

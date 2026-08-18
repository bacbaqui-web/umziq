import type {
  MissingSourceBannerViewProps,
} from "@/editor/project-lifecycle/models/projectLifecyclePresentationModel";

export function MissingSourceBanner({
  busy,
  items,
  onReconnect,
}: MissingSourceBannerViewProps) {
  if (items.length === 0) return null;
  return (
    <details className="project-missing-sources">
      <summary>연결 필요 {items.length}</summary>
      <div className="project-missing-sources__menu">
        {items.map((source) => (
          <div
            className="project-missing-sources__item"
            key={source.sourceId}
          >
            <span title={source.sourceId}>
              {source.displayName}
              {source.fingerprintPolicy ===
              "legacy-unverified"
                ? " · 지문 확인 필요"
                : ""}
            </span>
            <button
              className="ui-button"
              disabled={busy}
              onClick={() =>
                onReconnect(source.sourceId)
              }
            >
              재연결
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}

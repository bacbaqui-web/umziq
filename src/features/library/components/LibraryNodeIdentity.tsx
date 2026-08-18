import type { Dispatch, SetStateAction } from "react";
import type { LibraryNodeViewModel } from "@/engines/library";
import LibraryNodeNameEditor from "@/features/library/components/LibraryNodeNameEditor";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

function PsdFileIcon() {
  return (
    <span aria-hidden="true" style={{ width: 16, height: 19, position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", flex: "0 0 auto", marginLeft: 2, color: "#82a7c9" }}>
      <svg width="16" height="19" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M4.5 1.8h9.8l5.2 5.3v18a1.4 1.4 0 0 1-1.4 1.4H4.5A1.5 1.5 0 0 1 3 25V3.3a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path d="M14 2v5.5h5.3" />
      </svg>
      <span style={{ position: "absolute", bottom: 2.5, fontSize: 5, lineHeight: 1, fontWeight: 800, letterSpacing: 0.25 }}>PSD</span>
    </span>
  );
}

function AudioIcon({ provenance }: { readonly provenance: "imported" | "recorded" | null }) {
  return (
    <span aria-label={provenance === "recorded" ? "움직에서 녹음" : "불러온 오디오"} style={{ width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", color: "#65c98a" }}>
      {provenance === "recorded" ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
          <rect x="5" y="1.5" width="6" height="9" rx="3" />
          <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5M5.5 14.5h5" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.5 11V2.2c2.9.35 4.2 1.65 4.2 3.55-1.05-.85-2.3-1.25-4.2-1.25" />
          <ellipse cx="7" cy="11.5" rx="2.6" ry="2" transform="rotate(-18 7 11.5)" />
        </svg>
      )}
    </span>
  );
}

function VisualIcon({ node, hasChildren, expanded }: { readonly node: LibraryNodeViewModel; readonly hasChildren: boolean; readonly expanded: boolean }) {
  return (
    <span style={{ color: "#8eb6d8", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", position: "relative", transform: node.entityKind === "layer" ? "translateY(3px)" : "translateY(1px)" }}>
      <LayerCompositionIcon kind={node.entityKind ?? "layer"} size={14} />
      {hasChildren && expanded && (
        <span aria-hidden="true" style={{ position: "absolute", left: "50%", top: "calc(100% + 2px)", height: 2, borderLeft: "1px solid rgba(142, 182, 216, 0.82)", transform: "translateX(-0.5px)", pointerEvents: "none" }} />
      )}
    </span>
  );
}

function NodeName({ node, editing, draft, setDraft, onRename, onFinish }: IdentityProps) {
  if (editing && node.type !== "main" && node.type !== "project") {
    return <LibraryNodeNameEditor name={node.name} draft={draft} setDraft={setDraft} onRename={onRename} onFinish={onFinish} />;
  }
  return (
    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.1 }}>
      {node.type === "main" ? node.name.replace(/\.psd$/i, "") : node.name}
    </span>
  );
}

type IdentityProps = {
  readonly node: LibraryNodeViewModel;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  readonly editing: boolean;
  readonly draft: string;
  readonly setDraft: Dispatch<SetStateAction<string>>;
  readonly onRename: (name: string) => void;
  readonly onFinish: () => void;
};

export function LibraryPsdCutNode(props: IdentityProps) {
  return <><PsdFileIcon /><NodeName {...props} /></>;
}

export function LibraryGroupNode(props: IdentityProps) {
  return <><VisualIcon node={props.node} hasChildren={props.hasChildren} expanded={props.expanded} /><NodeName {...props} /></>;
}

export function LibraryVisualLayerNode(props: IdentityProps) {
  return <><VisualIcon node={props.node} hasChildren={props.hasChildren} expanded={props.expanded} /><NodeName {...props} /></>;
}

export function LibraryAudioLayerNode(props: IdentityProps) {
  return <><AudioIcon provenance={props.node.audioProvenance} /><NodeName {...props} /></>;
}

export default function LibraryNodeIdentity(props: IdentityProps) {
  if (props.node.type === "main") return <LibraryPsdCutNode {...props} />;
  if (props.node.contentKind === "audio") return <LibraryAudioLayerNode {...props} />;
  if (props.node.entityKind === "composition") return <LibraryGroupNode {...props} />;
  return <LibraryVisualLayerNode {...props} />;
}

import { EditorShellLayout } from "@/editor/EditorShellLayout";
import { useEditorRoot } from "@/editor/useEditorRoot";

export default function EditorShell() {
  const shellLayoutProps = useEditorRoot();

  return <EditorShellLayout {...shellLayoutProps} />;
}

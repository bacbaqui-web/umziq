import { EditorShellLayout } from "@/editor/EditorShellLayout";
import { useEditorCompositionRoot } from "@/editor/useEditorCompositionRoot";

export default function EditorShell() {
  const shellLayoutProps = useEditorCompositionRoot();

  return <EditorShellLayout {...shellLayoutProps} />;
}

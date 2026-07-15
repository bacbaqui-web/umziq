import { EditorShellLayout } from "@/editor/EditorShellLayout";
import { useEditorShellController } from "@/editor/useEditorShellController";

export default function EditorShell() {
  const shellLayoutProps = useEditorShellController();

  return <EditorShellLayout {...shellLayoutProps} />;
}

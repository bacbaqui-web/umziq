import { useEditorShellFeatures } from "@/editor/useEditorShellFeatures";
import { useEditorShellModels } from "@/editor/useEditorShellModels";

export function useEditorShellController() {
  const shellModels = useEditorShellModels();

  return useEditorShellFeatures(shellModels);
}

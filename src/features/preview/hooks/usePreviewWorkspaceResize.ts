import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";

type UsePreviewWorkspaceResizeOptions = {
  previewWorkspaceRef: RefObject<HTMLDivElement | null>;
  setPreviewWorkspaceSize: Dispatch<
    SetStateAction<{
      width: number;
      height: number;
    }>
  >;
};

export function usePreviewWorkspaceResize({
  previewWorkspaceRef,
  setPreviewWorkspaceSize,
}: UsePreviewWorkspaceResizeOptions) {
  useEffect(() => {
    const workspace = previewWorkspaceRef.current;

    if (!workspace) {
      return;
    }

    const updateSize = () => {
      const bounds = workspace.getBoundingClientRect();
      setPreviewWorkspaceSize((current) => {
        const nextWidth = Math.max(0, Math.floor(bounds.width));
        const nextHeight = Math.max(0, Math.floor(bounds.height));

        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(workspace);

    return () => {
      observer.disconnect();
    };
  }, [previewWorkspaceRef, setPreviewWorkspaceSize]);
}

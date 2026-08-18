import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LibraryViewProps } from "@/engines/library/models/libraryModel";

export function useLibraryAssetCopyController(projectIdentity: string) {
  const [prompt, setPrompt] = useState<LibraryViewProps["assetCopyPrompt"]>(
    null
  );
  const resolverRef = useRef<((copy: boolean | null) => void) | null>(null);

  const cancelPending = useCallback(() => {
    resolverRef.current?.(null);
    resolverRef.current = null;
    setPrompt(null);
  }, []);

  useEffect(() => cancelPending, [cancelPending, projectIdentity]);

  const request = useCallback(
    (kind: "psd" | "audio", fileCount: number) =>
      new Promise<boolean | null>((resolve) => {
        resolverRef.current?.(null);
        resolverRef.current = resolve;
        setPrompt({ kind, fileCount });
      }),
    []
  );

  const resolve = useCallback((copy: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setPrompt(null);
    resolver?.(copy);
  }, []);

  const requestPort = useMemo(() => ({ request }), [request]);

  return { prompt, requestPort, resolve };
}

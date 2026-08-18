import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createLayerDocumentPsdPreparedSessionController,
  type LayerDocumentPsdImportPreviewPlan,
  type LayerDocumentPsdPreparedSessionController,
} from "@/engines/project";
import { copyFilesIntoProjectAssets } from "@/editor/projectAssetDirectoryRuntime";
import type {
  LayerDocumentLibraryEngineOptions,
  LibraryAssetCopyRequestPort,
} from "@/engines/library/models/libraryEngineModel";
import type {
  LibraryViewProps,
  PsdRefreshSummaryViewModel,
} from "@/engines/library/models/libraryModel";
import {
  buildLayerDocumentPsdImportViewPlan,
  buildLibraryPsdRefreshSummary,
  libraryPsdImportPreviewToken,
  moveLibraryPsdImportPreviewNode,
} from "@/engines/library/helpers/libraryPsdImportViewHelpers";

type Picker =
  | { kind: "import" }
  | { kind: "refresh"; sourceId: string }
  | null;

export function useLibraryPsdImportController(options: {
  engine: LayerDocumentLibraryEngineOptions;
  assetCopy: LibraryAssetCopyRequestPort;
  projectIdentity: string;
}) {
  const { engine } = options;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [plans, setPlans] = useState<
    readonly LayerDocumentPsdImportPreviewPlan[]
  >([]);
  const [status, setStatus] = useState<
    LibraryViewProps["importPreviewStatus"]
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] =
    useState<PsdRefreshSummaryViewModel | null>(null);
  const pendingExternalImportRef = useRef<
    ((imported: boolean) => void) | null
  >(null);
  const session = useMemo<LayerDocumentPsdPreparedSessionController>(
    () =>
      createLayerDocumentPsdPreparedSessionController({
        cancelImport: engine.controller.cancelImport,
        cancelRefresh: engine.controller.cancelRefresh,
      }),
    [engine.controller]
  );

  useEffect(
    () => () => {
      session.cancelActive();
      pendingExternalImportRef.current?.(false);
      pendingExternalImportRef.current = null;
    },
    [options.projectIdentity, session]
  );
  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setPicker(null);
      setPlans([]);
      setStatus("idle");
      setError(null);
      setSummary(null);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [options.projectIdentity]);

  const prepareImports = useCallback(
    async (
      files: readonly { file: File; relativePathHint: string | null }[]
    ) => {
      const sequence = session.begin();
      setStatus("analyzing");
      setError(null);
      const prepared: LayerDocumentPsdImportPreviewPlan[] = [];
      try {
        for (const [index, entry] of files.entries()) {
          prepared.push(
            await engine.controller.prepareImport({
              file: entry.file,
              token: `ui:${sequence}:${index}:${entry.file.name}`,
              parentLayerDocumentId: engine.parentLayerDocumentId,
              order: engine.nextOrder() + index,
              durationFrames: engine.durationFrames,
              parentWidth: engine.parentWidth,
              parentHeight: engine.parentHeight,
              relativePathHint: entry.relativePathHint,
            })
          );
          if (sequence !== session.readSequence()) {
            prepared.forEach(engine.controller.cancelImport);
            return false;
          }
        }
      } catch {
        prepared.forEach(engine.controller.cancelImport);
        if (sequence === session.readSequence()) {
          setStatus("idle");
          setError("PSD 분석에 실패했습니다.");
        }
        return false;
      }
      const accepted = session.acceptImports(sequence, prepared);
      if (!accepted.accepted) return false;
      setPlans(prepared);
      setStatus(prepared.length ? "review" : "idle");
      return prepared.length > 0;
    },
    [engine, session]
  );

  const prepareRefresh = useCallback(
    async (sourceId: string, file: File) => {
      const source = engine.controller.sourceForRefresh(sourceId);
      if (!source) return;
      const sequence = session.begin();
      setError(null);
      try {
        const plan = await engine.controller.prepareRefresh({
          file,
          documentSource: source,
          existingSources: Object.values(
            engine.controller.readProject().payload.sourceRegistry.sourcesById
          ),
        });
        const accepted = session.acceptRefresh(sequence, plan);
        if (!accepted.accepted) return;
        let result = engine.controller.confirmRefresh(
          plan,
          engine.cacheContext()
        );
        if (
          !result.ok &&
          plan.prepared.runtime.readState() === "runtime-registration-pending"
        ) {
          result = engine.controller.confirmRefresh(
            plan,
            engine.cacheContext()
          );
        }
        if (!result.ok) {
          setError("PSD 새로고침에 실패했습니다.");
          return;
        }
        const active = session.read();
        if (active) session.clearTransferred(active);
        setSummary(
          buildLibraryPsdRefreshSummary(source.displayName, plan.summary)
        );
      } catch {
        if (sequence === session.readSequence()) {
          setError("PSD 새로고침 분석에 실패했습니다.");
        }
      }
    },
    [engine, session]
  );

  const onFileInputChange = useCallback(
    (files: FileList | readonly File[]) => {
      const selected = Array.from(files);
      if (picker?.kind === "refresh") {
        const file = selected[0];
        if (file) void prepareRefresh(picker.sourceId, file);
      } else if (selected.length) {
        void options.assetCopy
          .request("psd", selected.length)
          .then((copy) =>
            copy === null
              ? null
              : copyFilesIntoProjectAssets({
                  files: selected,
                  kind: "psd",
                  copy,
                })
          )
          .then((imports) => imports ? prepareImports(imports) : false)
          .catch((reason: unknown) =>
            setError(
              reason instanceof Error
                ? reason.message
                : "PSD 파일 복사에 실패했습니다."
            )
          );
      }
      setPicker(null);
    },
    [options.assetCopy, picker, prepareImports, prepareRefresh]
  );

  const cancel = useCallback(() => {
    session.cancelActive();
    setPlans([]);
    setStatus("idle");
    setError(null);
    pendingExternalImportRef.current?.(false);
    pendingExternalImportRef.current = null;
  }, [session]);

  const confirm = useCallback(async () => {
    const active = session.read();
    if (active?.kind !== "imports") return;
    setStatus("importing");
    let remaining = [...active.plans];
    while (remaining.length > 0) {
      const plan = remaining[0];
      if (!plan) break;
      let result = engine.controller.confirmImport(plan);
      if (
        !result.ok &&
        plan.prepared.runtime.readState() === "runtime-registration-pending"
      ) {
        result = engine.controller.confirmImport(plan);
      }
      if (!result.ok) {
        setStatus("review");
        setError("PSD 불러오기에 실패했습니다.");
        return;
      }
      remaining = remaining.slice(1);
      session.replaceActiveImports(remaining);
      setPlans(remaining);
    }
    const completed = session.read();
    if (completed) session.clearTransferred(completed);
    setPlans([]);
    setStatus("idle");
    setError(null);
    pendingExternalImportRef.current?.(true);
    pendingExternalImportRef.current = null;
  }, [engine.controller, session]);

  const updatePlans = useCallback(
    (next: readonly LayerDocumentPsdImportPreviewPlan[]) => {
      session.replaceActiveImports(next);
      setPlans(next);
    },
    [session]
  );

  const moveNode = useCallback(
    (
      token: string,
      draggedId: string,
      targetId: string | null,
      position: "before" | "inside" | "after"
    ) => {
      updatePlans(
        plans.map((plan) =>
          libraryPsdImportPreviewToken(plan) === token
            ? moveLibraryPsdImportPreviewNode({
                controller: engine.controller,
                plan,
                draggedId,
                targetId,
                position,
              })
            : plan
        )
      );
    },
    [engine.controller, plans, updatePlans]
  );

  const scale = useCallback(
    (token: string, scalePercent: number) => {
      updatePlans(
        plans.map((plan) =>
          libraryPsdImportPreviewToken(plan) === token
            ? engine.controller.scaleImportPreview(plan, scalePercent)
            : plan
        )
      );
    },
    [engine.controller, plans, updatePlans]
  );

  const rename = useCallback(
    (token: string, layerDocumentId: string, name: string) => {
      updatePlans(
        plans.map((plan) =>
          libraryPsdImportPreviewToken(plan) === token
            ? engine.controller.renameImportPreviewNode(
                plan,
                layerDocumentId,
                name
              )
            : plan
        )
      );
    },
    [engine.controller, plans, updatePlans]
  );

  const remove = useCallback(
    (token: string, layerDocumentId: string) => {
      updatePlans(
        plans.map((plan) =>
          libraryPsdImportPreviewToken(plan) === token
            ? engine.controller.removeImportPreviewNode(plan, layerDocumentId)
            : plan
        )
      );
    },
    [engine.controller, plans, updatePlans]
  );

  const beginImport = useCallback(() => {
    setPicker({ kind: "import" });
    fileInputRef.current?.click();
  }, []);
  const beginRefresh = useCallback((sourceId: string) => {
    setPicker({ kind: "refresh", sourceId });
    fileInputRef.current?.click();
  }, []);
  const dismissSummary = useCallback(() => setSummary(null), []);

  const importFiles = useCallback(
    async (files: readonly File[]) => {
      pendingExternalImportRef.current?.(false);
      pendingExternalImportRef.current = null;
      const prepared = await prepareImports(
        files.map((file) => ({ file, relativePathHint: null }))
      );
      if (!prepared) return false;
      return new Promise<boolean>((resolve) => {
        pendingExternalImportRef.current = resolve;
      });
    },
    [prepareImports]
  );

  return {
    fileInputRef,
    importPlan: plans.length
      ? buildLayerDocumentPsdImportViewPlan(plans)
      : null,
    status,
    error,
    summary,
    beginImport,
    beginRefresh,
    onFileInputChange,
    cancel,
    confirm,
    moveNode,
    scale,
    rename,
    remove,
    dismissSummary,
    importFiles,
  };
}

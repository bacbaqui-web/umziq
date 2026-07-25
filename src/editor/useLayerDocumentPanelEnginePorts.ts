import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  layerDocumentGlobalFrameToLocalFrame,
} from "@/models";
import {
  createLayerDocumentCanvasCutoverCommandPort,
  createLayerDocumentPropertiesCommandPort,
  createLayerDocumentPsdTreeCommandPort,
  type LayerDocumentConsumerCutoverAssembly,
  type LayerDocumentCutoverDraftSessionPort,
} from "@/cutover";
import type {
  LayerDocumentCanvasReadPort,
} from "@/engines/canvas";
import {
  createLayerDocumentPsdTreeController,
} from "@/engines/project";
import {
  createLayerDocumentTimelineSourceStatusAdapter,
  type LayerDocumentTimelinePlaybackPort,
} from "@/engines/timeline";

export function useLayerDocumentPanelEnginePorts(
  options: {
    assembly:
      LayerDocumentConsumerCutoverAssembly;
    draftSession:
      LayerDocumentCutoverDraftSessionPort;
    frameInput:
      LayerDocumentTimelinePlaybackPort;
    quality: string;
  }
) {
  const {
    assembly,
    draftSession,
    frameInput,
    quality,
  } = options;
  const [properties] = useState(() =>
    createLayerDocumentPropertiesCommandPort({
      assembly,
      readDraft: draftSession.read,
      readGlobalFrame: () =>
        frameInput.read().currentFrame,
      quality,
    })
  );
  const [psdTreeController] = useState(() =>
    createLayerDocumentPsdTreeController({
      port:
        createLayerDocumentPsdTreeCommandPort(
          assembly
        ),
    })
  );
  const sourceStatus = useMemo(
    () =>
      createLayerDocumentTimelineSourceStatusAdapter({
        assembly,
      }),
    [assembly]
  );
  const allocatedIds = useRef(new Set<string>());
  const nextId = useRef(0);
  const allocateLayerDocumentId =
    useCallback(() => {
      const project = assembly.project.read();
      while (true) {
        nextId.current += 1;
        const candidate =
          `layer-document:ui:${nextId.current}`;
        if (
          !project.payload.layerDocumentsById[
            candidate
          ] &&
          !allocatedIds.current.has(candidate)
        ) {
          allocatedIds.current.add(candidate);
          return candidate;
        }
      }
    }, [assembly]);
  const nextPsdLayerOrder =
    useCallback(() => {
      const project = assembly.project.read();
      const scope = assembly.scope.read();
      if (!scope.ok) return 0;
      return Object.values(
        project.payload.layerDocumentsById
      ).filter((layer) =>
        layer.common.placement
          .parentLayerDocumentId ===
        scope.model.activeGroupLayerDocumentId
      ).length;
    }, [assembly]);
  const readPsdCacheContext =
    useCallback(() => {
      const project = assembly.project.read();
      const globalFrame =
        frameInput.read().currentFrame;
      return {
        globalFrame,
        localFrameByLayerDocumentId:
          Object.fromEntries(
            Object.values(
              project.payload.layerDocumentsById
            ).map((layer) => [
              layer.layerDocumentId,
              layerDocumentGlobalFrameToLocalFrame(
                globalFrame,
                layer.common.placement
              ),
            ])
          ),
        quality,
      };
    }, [assembly, frameInput, quality]);
  const [canvasCommands] = useState(() =>
    createLayerDocumentCanvasCutoverCommandPort({
      assembly,
      playback: frameInput,
      quality,
    })
  );
  const canvasRead = useMemo<
    LayerDocumentCanvasReadPort
  >(
    () => ({
      read: (readOptions) => {
        const canvas =
          assembly.canvas.readViewProps(
            {
              ...readOptions,
              globalFrame:
                frameInput.read().currentFrame,
            }
          );
        if (!canvas.scope.ok) {
          throw new Error(
            `Canvas scope unavailable: ` +
            canvas.scope.reason
          );
        }
        const group =
          canvas.scope.model.activeGroup;
        return {
          selectedLayerDocumentId:
            canvas.selectedLayerDocumentId,
          runtime: canvas.runtime,
          activeScene: {
            layerDocumentId:
              group.layerDocumentId,
            label: group.name,
            width: group.data.width,
            height: group.data.height,
            frameRate:
              group.data.frameRate,
            durationFrames:
              group.data.durationFrames,
          },
        };
      },
    }),
    [assembly, frameInput]
  );
  return {
    properties,
    psdTreeController,
    sourceStatus,
    allocateLayerDocumentId,
    nextPsdLayerOrder,
    readPsdCacheContext,
    canvasCommands,
    canvasRead,
  };
}

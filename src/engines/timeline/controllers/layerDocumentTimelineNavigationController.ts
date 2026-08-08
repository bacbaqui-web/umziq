import type {
  LayerDocumentTimelineOwnerPort,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";

export function createLayerDocumentTimelineNavigationController(
  options: {
    owner: LayerDocumentTimelineOwnerPort;
    ui: {
      readIsOpen: () => boolean;
      setIsOpen: (isOpen: boolean) => void;
      restoreTriggerFocus: () => void;
    };
  }
) {
  const closeAndRestoreFocus = () => {
    options.ui.setIsOpen(false);
    options.ui.restoreTriggerFocus();
  };
  return {
    toggleCompositionSwitcher: () =>
      options.ui.setIsOpen(
        !options.ui.readIsOpen()
      ),
    selectComposition: (
      layerDocumentId: string
    ) => {
      options.owner.scope.enter(
        layerDocumentId
      );
      closeAndRestoreFocus();
    },
    closeForEscape: closeAndRestoreFocus,
    closeForOutsidePointer:
      closeAndRestoreFocus,
  };
}

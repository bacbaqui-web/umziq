import {
  useAudioBasicController,
} from "@/engines/audio/controllers/useAudioBasicController";
import {
  useAudioEffectsController,
} from "@/engines/audio/controllers/useAudioEffectsController";
import type {
  AudioBasicNexusPort,
  AudioEffectsNexusPort,
  AudioEffectType,
} from "@/engines/audio/models/audioEffectsModel";

export function useAudioComposer(options: {
  readonly port: AudioEffectsNexusPort;
  readonly basicPort: AudioBasicNexusPort;
  readonly allocateEffectId?: (type: AudioEffectType, layerDocumentId: string) => string;
  readonly resetRevision?: number;
}) {
  const viewProps = useAudioEffectsController({
    port: options.port,
    allocateEffectId: options.allocateEffectId,
    resetRevision: options.resetRevision,
  });
  const basic = useAudioBasicController({
    port: options.basicPort,
    resetRevision: options.resetRevision,
  });
  return { viewProps, basic };
}

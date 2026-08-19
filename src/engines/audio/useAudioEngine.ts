import { useAudioComposer } from "@/engines/audio/composers/useAudioComposer";
import type { AudioBasicNexusPort, AudioEffectType, AudioEffectsNexusPort } from "@/engines/audio/models/audioEffectsModel";

export function useAudioEngine(options: {
  port: AudioEffectsNexusPort;
  basicPort: AudioBasicNexusPort;
  allocateEffectId?: (type: AudioEffectType, layerDocumentId: string) => string;
  resetRevision?: number;
}) {
  return useAudioComposer(options);
}

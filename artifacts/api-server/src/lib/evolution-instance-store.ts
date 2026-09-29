export type EvolutionInstanceSelection = {
  instanceName: string | null;
};

export interface EvolutionInstanceSelectionRepository {
  load(): Promise<EvolutionInstanceSelection | null>;
  save(instanceName: string | null): Promise<void>;
}

export const createEvolutionInstanceStore = ({
  repository,
  legacyInstance,
}: {
  repository: EvolutionInstanceSelectionRepository;
  legacyInstance?: string;
}) => ({
  async getSelectedInstance() {
    const savedSelection = await repository.load();
    if (savedSelection) return savedSelection.instanceName?.trim() || null;
    return legacyInstance?.trim() || null;
  },

  async setSelectedInstance(instanceName: string | null) {
    const normalized = instanceName?.trim() || null;
    await repository.save(normalized);
    return normalized;
  },
});
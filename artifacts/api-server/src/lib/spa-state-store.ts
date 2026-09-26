export type SpaOperationalStateRecord = {
  version: number;
  payload: unknown;
};

export interface SpaOperationalStateRepository {
  load(): Promise<SpaOperationalStateRecord | null>;
  insertIfAbsent(version: number, payload: unknown): Promise<boolean>;
  save(version: number, payload: unknown): Promise<void>;
}

type SpaOperationalStateStoreOptions<TSnapshot> = {
  repository: SpaOperationalStateRepository;
  createSnapshot: () => TSnapshot;
  restoreSnapshot: (snapshot: unknown) => void;
  importApproved: boolean;
  version?: number;
};

export function createSpaOperationalStateStore<TSnapshot>({
  repository,
  createSnapshot,
  restoreSnapshot,
  importApproved,
  version = 1,
}: SpaOperationalStateStoreOptions<TSnapshot>) {
  let status: "unloaded" | "ready" | "not_initialized" = "unloaded";
  let initialization: Promise<void> | undefined;
  let importedInitialState = false;

  const restoreRecord = (record: SpaOperationalStateRecord) => {
    if (record.version !== version) {
      throw new Error(
        `Unsupported SPA state version ${record.version}; expected ${version}.`,
      );
    }
    restoreSnapshot(record.payload);
    status = "ready";
  };

  const ensureLoaded = async () => {
    if (!initialization) {
      initialization = (async () => {
        const record = await repository.load();
        if (record) {
          restoreRecord(record);
          return;
        }

        if (!importApproved) {
          status = "not_initialized";
          return;
        }

        const initialSnapshot = createSnapshot();
        if (await repository.insertIfAbsent(version, initialSnapshot)) {
          status = "ready";
          importedInitialState = true;
          return;
        }

        // Another server process may have initialized the singleton row first.
        const racedRecord = await repository.load();
        if (!racedRecord) {
          throw new Error("SPA state initialization conflicted but no row exists.");
        }
        restoreRecord(racedRecord);
      })().catch((error: unknown) => {
        initialization = undefined;
        throw error;
      });
    }

    await initialization;
  };

  const refresh = async () => {
    const record = await repository.load();
    if (!record) {
      status = "not_initialized";
      return;
    }
    restoreRecord(record);
  };

  const markNotInitialized = () => {
    status = "not_initialized";
  };

  const persist = async () => {
    if (status !== "ready") {
      throw new Error("SPA state has not been initialized in PostgreSQL.");
    }
    await repository.save(version, createSnapshot());
  };

  return {
    ensureLoaded,
    refresh,
    persist,
    markNotInitialized,
    get status() {
      return status;
    },
    get importedInitialState() {
      return importedInitialState;
    },
  };
}
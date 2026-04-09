import { APP_STATE_VERSION, createInitialAppState } from "../shared/constants";
import type { AppState } from "../shared/types";
import type { StorageAdapter } from "./storage-adapter";

function normalizeState(state: AppState | null): AppState {
  if (!state || state.version !== APP_STATE_VERSION) {
    return createInitialAppState();
  }
  return state;
}

export class AppStateRepository {
  constructor(private readonly storageAdapter: StorageAdapter) {}

  read(): AppState {
    return normalizeState(this.storageAdapter.getState());
  }

  write(state: AppState): void {
    this.storageAdapter.setState(state);
  }

  update<T>(updater: (state: AppState) => T): T {
    const state = this.read();
    const result = updater(state);
    this.write(state);
    return result;
  }
}

export function initializeAppState(storageAdapter: StorageAdapter): AppState {
  const repository = new AppStateRepository(storageAdapter);
  const state = repository.read();
  repository.write(state);
  return state;
}

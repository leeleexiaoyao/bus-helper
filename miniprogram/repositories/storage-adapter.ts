import { APP_STATE_STORAGE_KEY, createInitialAppState } from "../shared/constants";
import type { AppState } from "../shared/types";

export interface StorageAdapter {
  getState(): AppState | null;
  setState(state: AppState): void;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private state: AppState | null;

  constructor(initialState: AppState | null = createInitialAppState()) {
    this.state = initialState;
  }

  getState(): AppState | null {
    return this.state ? JSON.parse(JSON.stringify(this.state)) : null;
  }

  setState(state: AppState): void {
    this.state = JSON.parse(JSON.stringify(state));
  }
}

export const wxStorageAdapter: StorageAdapter = {
  getState() {
    try {
      return (wx.getStorageSync(APP_STATE_STORAGE_KEY) as AppState | "") || null;
    } catch (error) {
      return null;
    }
  },
  setState(state) {
    wx.setStorageSync(APP_STATE_STORAGE_KEY, state);
  }
};

import { APP_STATE_STORAGE_KEY } from "../shared/constants";
import type { AppState } from "../shared/types";

export interface StorageAdapter {
  getState(): AppState | null;
  setState(state: AppState): void;
}

let memoryState: AppState | null = null;

function cloneState(state: AppState | null): AppState | null {
  return state ? (JSON.parse(JSON.stringify(state)) as AppState) : null;
}

function canUseWxStorage(): boolean {
  return typeof wx !== "undefined" && typeof wx.getStorageSync === "function" && typeof wx.setStorageSync === "function";
}

export const wxStorageAdapter: StorageAdapter = {
  getState() {
    if (canUseWxStorage()) {
      const state = wx.getStorageSync(APP_STATE_STORAGE_KEY) as AppState | "" | undefined;
      if (state) {
        memoryState = cloneState(state);
        return state;
      }
    }
    return cloneState(memoryState);
  },
  setState(state) {
    const snapshot = cloneState(state);
    memoryState = snapshot;
    if (snapshot && canUseWxStorage()) {
      wx.setStorageSync(APP_STATE_STORAGE_KEY, snapshot);
    }
  }
};

export class MemoryStorageAdapter implements StorageAdapter {
  private state: AppState | null;

  constructor(initialState: AppState | null = null) {
    this.state = cloneState(initialState);
  }

  getState(): AppState | null {
    return cloneState(this.state);
  }

  setState(state: AppState): void {
    this.state = cloneState(state);
  }
}

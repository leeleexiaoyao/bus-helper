import type { AppState } from "./shared/types";
import { initializeCloudRuntime } from "./config/cloud";
import { syncCloudUserToLocalState } from "./services/cloud/cloud-user-session";
import { initializeAppState } from "./repositories/app-state-repository";
import { wxStorageAdapter } from "./repositories/storage-adapter";
import { DEMO_SWITCHABLE_USER_IDS, createSeededDemoAppState } from "./shared/constants";

function shouldSeedDemoState(state: AppState | null): boolean {
  if (!state) {
    return true;
  }

  const tripCount = Object.keys(state.trips ?? {}).length;
  const tripMemberCount = Array.isArray(state.tripMembers) ? state.tripMembers.length : 0;
  const userIds = Object.keys(state.users ?? {});
  const onlySwitchableUsers =
    userIds.length > 0 && userIds.every((userId) => DEMO_SWITCHABLE_USER_IDS.includes(userId));

  if (tripCount === 0 && tripMemberCount === 0) {
    return true;
  }

  if (onlySwitchableUsers) {
    return true;
  }

  if (tripCount === 1 && tripMemberCount > 0 && tripMemberCount <= DEMO_SWITCHABLE_USER_IDS.length) {
    return true;
  }

  return false;
}

App<IAppOption>({
  globalData: {
    version: "1.0.0",
    cloud: {
      backendMode: "local",
      enabled: false,
      envId: null,
      reason: "云开发尚未初始化。"
    }
  },
  onLaunch() {
    const cloudState = initializeCloudRuntime();
    this.globalData.cloud = cloudState;

    if (cloudState.enabled) {
      console.info(`[cloud] 已连接云开发环境：${cloudState.envId}`);
    } else {
      console.info(`[cloud] ${cloudState.reason}`);
    }

    const existingState = wxStorageAdapter.getState();
    if (shouldSeedDemoState(existingState)) {
      wxStorageAdapter.setState(createSeededDemoAppState());
    }
    initializeAppState(wxStorageAdapter);

    this.globalData.cloudReadyPromise = cloudState.enabled
      ? syncCloudUserToLocalState()
      : Promise.resolve();
  }
});

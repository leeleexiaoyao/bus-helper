import { initializeCloudRuntime } from "./config/cloud";
import { syncCloudUserToLocalState } from "./services/cloud/cloud-user-session";
import { initializeAppState } from "./repositories/app-state-repository";
import { wxStorageAdapter } from "./repositories/storage-adapter";

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

    initializeAppState(wxStorageAdapter);

    this.globalData.cloudReadyPromise = cloudState.enabled
      ? syncCloudUserToLocalState()
      : Promise.resolve();
  }
});

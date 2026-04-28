import { initializeCloudRuntime } from "./config/cloud";
import { syncCloudRuntimeConfigToLocalState } from "./services/cloud/cloud-runtime-config";
import { callCloudFunction } from "./services/cloud/cloud-service";
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
      ? callCloudFunction("ensureBusBuddyCollections")
          .catch((error) => {
            console.warn("[cloud] 集合初始化函数未就绪，继续使用现有状态", error);
          })
          .then(() => syncCloudUserToLocalState())
          .then(() => syncCloudRuntimeConfigToLocalState())
          .catch((error) => {
            console.warn("[cloud] 启动同步失败，继续使用本地状态", error);
          })
      : Promise.resolve();
  }
});

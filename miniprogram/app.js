"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloud_1 = require("./config/cloud");
const cloud_runtime_config_1 = require("./services/cloud/cloud-runtime-config");
const cloud_service_1 = require("./services/cloud/cloud-service");
const cloud_user_session_1 = require("./services/cloud/cloud-user-session");
const app_state_repository_1 = require("./repositories/app-state-repository");
const storage_adapter_1 = require("./repositories/storage-adapter");
App({
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
        const cloudState = (0, cloud_1.initializeCloudRuntime)();
        this.globalData.cloud = cloudState;
        if (cloudState.enabled) {
            console.info(`[cloud] 已连接云开发环境：${cloudState.envId}`);
        }
        else {
            console.info(`[cloud] ${cloudState.reason}`);
        }
        (0, app_state_repository_1.initializeAppState)(storage_adapter_1.wxStorageAdapter);
        this.globalData.cloudReadyPromise = cloudState.enabled
            ? (0, cloud_service_1.callCloudFunction)("ensureBusBuddyCollections")
                .catch((error) => {
                console.warn("[cloud] 集合初始化函数未就绪，继续使用现有状态", error);
            })
                .then(() => (0, cloud_user_session_1.syncCloudUserToLocalState)())
                .then(() => (0, cloud_runtime_config_1.syncCloudRuntimeConfigToLocalState)())
                .catch((error) => {
                console.warn("[cloud] 启动同步失败，继续使用本地状态", error);
            })
            : Promise.resolve();
    }
});

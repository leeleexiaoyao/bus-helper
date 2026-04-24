"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloud_1 = require("./config/cloud");
const cloud_user_session_1 = require("./services/cloud/cloud-user-session");
const app_state_repository_1 = require("./repositories/app-state-repository");
const storage_adapter_1 = require("./repositories/storage-adapter");
const constants_1 = require("./shared/constants");
function shouldSeedDemoState(state) {
    var _a, _b;
    if (!state) {
        return true;
    }
    const tripCount = Object.keys((_a = state.trips) !== null && _a !== void 0 ? _a : {}).length;
    const tripMemberCount = Array.isArray(state.tripMembers) ? state.tripMembers.length : 0;
    const userIds = Object.keys((_b = state.users) !== null && _b !== void 0 ? _b : {});
    const onlySwitchableUsers = userIds.length > 0 && userIds.every((userId) => constants_1.DEMO_SWITCHABLE_USER_IDS.includes(userId));
    if (tripCount === 0 && tripMemberCount === 0) {
        return true;
    }
    if (onlySwitchableUsers) {
        return true;
    }
    if (tripCount === 1 && tripMemberCount > 0 && tripMemberCount <= constants_1.DEMO_SWITCHABLE_USER_IDS.length) {
        return true;
    }
    return false;
}
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
        const existingState = storage_adapter_1.wxStorageAdapter.getState();
        if (shouldSeedDemoState(existingState)) {
            storage_adapter_1.wxStorageAdapter.setState((0, constants_1.createSeededDemoAppState)());
        }
        (0, app_state_repository_1.initializeAppState)(storage_adapter_1.wxStorageAdapter);
        this.globalData.cloudReadyPromise = cloudState.enabled
            ? (0, cloud_user_session_1.syncCloudUserToLocalState)()
            : Promise.resolve();
    }
});

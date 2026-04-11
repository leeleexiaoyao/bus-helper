"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        version: "1.0.0"
    },
    onLaunch() {
        const existingState = storage_adapter_1.wxStorageAdapter.getState();
        if (shouldSeedDemoState(existingState)) {
            storage_adapter_1.wxStorageAdapter.setState((0, constants_1.createSeededDemoAppState)());
        }
        (0, app_state_repository_1.initializeAppState)(storage_adapter_1.wxStorageAdapter);
    }
});

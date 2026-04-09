"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_state_repository_1 = require("./repositories/app-state-repository");
const storage_adapter_1 = require("./repositories/storage-adapter");
App({
    globalData: {
        version: "1.0.0"
    },
    onLaunch() {
        (0, app_state_repository_1.initializeAppState)(storage_adapter_1.wxStorageAdapter);
    }
});

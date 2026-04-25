"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForCloudReady = waitForCloudReady;
async function waitForCloudReady() {
    var _a, _b;
    const app = getApp();
    const cloudReadyPromise = (_b = (_a = app === null || app === void 0 ? void 0 : app.globalData) === null || _a === void 0 ? void 0 : _a.cloudReadyPromise) !== null && _b !== void 0 ? _b : null;
    if (!cloudReadyPromise) {
        return;
    }
    await cloudReadyPromise;
}

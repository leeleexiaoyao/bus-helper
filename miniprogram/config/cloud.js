"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudRuntimeConfig = exports.CLOUD_ENV_ID_PLACEHOLDER = void 0;
exports.hasConfiguredCloudEnv = hasConfiguredCloudEnv;
exports.initializeCloudRuntime = initializeCloudRuntime;
exports.CLOUD_ENV_ID_PLACEHOLDER = "replace-with-your-cloud-env-id";
exports.cloudRuntimeConfig = {
    backendMode: "cloud",
    envId: "cloud1-3gjxwr4baf653a7d",
    traceUser: true
};
function hasConfiguredCloudEnv(envId = exports.cloudRuntimeConfig.envId) {
    return Boolean(envId && envId !== exports.CLOUD_ENV_ID_PLACEHOLDER);
}
function initializeCloudRuntime() {
    if (!wx.cloud) {
        return {
            backendMode: exports.cloudRuntimeConfig.backendMode,
            enabled: false,
            envId: null,
            reason: "当前基础库未提供云开发能力。请在开发者工具中升级基础库。"
        };
    }
    if (exports.cloudRuntimeConfig.backendMode !== "cloud") {
        return {
            backendMode: exports.cloudRuntimeConfig.backendMode,
            enabled: false,
            envId: null,
            reason: "当前项目仍在本地数据模式运行。"
        };
    }
    if (!hasConfiguredCloudEnv()) {
        return {
            backendMode: exports.cloudRuntimeConfig.backendMode,
            enabled: false,
            envId: null,
            reason: "请先在 miniprogram/config/cloud.ts 中填写真实云环境 ID。"
        };
    }
    wx.cloud.init({
        env: exports.cloudRuntimeConfig.envId,
        traceUser: exports.cloudRuntimeConfig.traceUser
    });
    return {
        backendMode: exports.cloudRuntimeConfig.backendMode,
        enabled: true,
        envId: exports.cloudRuntimeConfig.envId,
        reason: null
    };
}

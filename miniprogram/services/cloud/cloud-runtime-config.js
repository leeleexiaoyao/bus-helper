"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeCloudRuntimeConfig = writeCloudRuntimeConfig;
exports.syncCloudRuntimeConfigToLocalState = syncCloudRuntimeConfigToLocalState;
const constants_1 = require("../../shared/constants");
const app_state_repository_1 = require("../../repositories/app-state-repository");
const storage_adapter_1 = require("../../repositories/storage-adapter");
const cloud_1 = require("../../config/cloud");
const cloud_service_1 = require("./cloud-service");
const CLOUD_RUNTIME_CONFIG_COLLECTION = "bus_buddy_runtime_config";
const CLOUD_RUNTIME_CONFIG_DOC_ID = "singleton";
function canUseCloudRuntime() {
    return typeof wx !== "undefined" && Boolean(wx.cloud) && (0, cloud_1.hasConfiguredCloudEnv)();
}
function isPlainObject(value) {
    return typeof value === "object" && value !== null;
}
function normalizeRuntimeConfig(rawDocument) {
    const fallback = (0, constants_1.createDefaultRuntimeConfig)();
    if (!isPlainObject(rawDocument)) {
        return fallback;
    }
    const rawTripAdminUserIds = isPlainObject(rawDocument.tripAdminUserIds)
        ? rawDocument.tripAdminUserIds
        : {};
    return {
        homeTitle: typeof rawDocument.homeTitle === "string" && rawDocument.homeTitle.trim()
            ? rawDocument.homeTitle.trim()
            : fallback.homeTitle,
        tripAdminUserIds: Object.keys(fallback.tripAdminUserIds).reduce((accumulator, tripId) => {
            const rawUserId = rawTripAdminUserIds[tripId];
            accumulator[tripId] =
                typeof rawUserId === "string" && rawUserId.trim() ? rawUserId.trim() : null;
            return accumulator;
        }, {})
    };
}
function toCloudRuntimeConfigDocument(runtimeConfig) {
    return Object.assign(Object.assign({ _id: CLOUD_RUNTIME_CONFIG_DOC_ID }, runtimeConfig), { updatedAt: Date.now() });
}
async function readCloudRuntimeConfig() {
    const database = (0, cloud_service_1.getCloudDatabase)();
    try {
        const response = await database
            .collection(CLOUD_RUNTIME_CONFIG_COLLECTION)
            .doc(CLOUD_RUNTIME_CONFIG_DOC_ID)
            .get();
        return normalizeRuntimeConfig(response.data);
    }
    catch (_error) {
        return null;
    }
}
async function writeCloudRuntimeConfig(runtimeConfig) {
    if (!canUseCloudRuntime()) {
        return;
    }
    const database = (0, cloud_service_1.getCloudDatabase)();
    const _a = toCloudRuntimeConfigDocument(runtimeConfig), { _id } = _a, payload = __rest(_a, ["_id"]);
    await database.collection(CLOUD_RUNTIME_CONFIG_COLLECTION).doc(_id).set({
        data: payload
    });
}
async function syncCloudRuntimeConfigToLocalState() {
    if (!canUseCloudRuntime()) {
        return;
    }
    const repository = new app_state_repository_1.AppStateRepository(storage_adapter_1.wxStorageAdapter);
    let runtimeConfig = await readCloudRuntimeConfig();
    if (!runtimeConfig) {
        runtimeConfig = (0, constants_1.createDefaultRuntimeConfig)();
        try {
            await writeCloudRuntimeConfig(runtimeConfig);
        }
        catch (error) {
            console.warn("[cloud] 运行配置集合不可用，继续使用本地默认配置", error);
        }
    }
    repository.update((state) => {
        state.runtimeConfig = runtimeConfig;
    });
}

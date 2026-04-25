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
exports.syncCloudUserToLocalState = syncCloudUserToLocalState;
exports.scheduleUserCloudSync = scheduleUserCloudSync;
const constants_1 = require("../../shared/constants");
const app_state_repository_1 = require("../../repositories/app-state-repository");
const storage_adapter_1 = require("../../repositories/storage-adapter");
const cloud_1 = require("../../config/cloud");
const cloud_service_1 = require("./cloud-service");
const CLOUD_USER_COLLECTION = "bus_buddy_users";
let userWriteQueue = Promise.resolve();
function canUseCloudRuntime() {
    return typeof wx !== "undefined" && Boolean(wx.cloud) && (0, cloud_1.hasConfiguredCloudEnv)();
}
function isPlainObject(value) {
    return typeof value === "object" && value !== null;
}
function normalizeString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
}
function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry) => typeof entry === "string");
}
function getLocalSeedUser() {
    var _a;
    const repository = new app_state_repository_1.AppStateRepository(storage_adapter_1.wxStorageAdapter);
    const state = repository.read();
    const currentUser = (_a = state.users[state.activeUserId]) !== null && _a !== void 0 ? _a : null;
    if (!currentUser || constants_1.DEMO_SWITCHABLE_USER_IDS.includes(currentUser.id)) {
        return null;
    }
    return currentUser;
}
function buildDefaultCloudUser(openid, localSeedUser) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const timestamp = Date.now();
    return {
        _id: openid,
        id: openid,
        nickname: (_a = localSeedUser === null || localSeedUser === void 0 ? void 0 : localSeedUser.nickname) !== null && _a !== void 0 ? _a : "",
        avatarUrl: (_b = localSeedUser === null || localSeedUser === void 0 ? void 0 : localSeedUser.avatarUrl) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_AVATAR_URL,
        homePersonaAssetId: (_c = localSeedUser === null || localSeedUser === void 0 ? void 0 : localSeedUser.homePersonaAssetId) !== null && _c !== void 0 ? _c : null,
        bio: (_d = localSeedUser === null || localSeedUser === void 0 ? void 0 : localSeedUser.bio) !== null && _d !== void 0 ? _d : "",
        livingCity: (_e = localSeedUser === null || localSeedUser === void 0 ? void 0 : localSeedUser.livingCity) !== null && _e !== void 0 ? _e : "",
        hometown: (_f = localSeedUser === null || localSeedUser === void 0 ? void 0 : localSeedUser.hometown) !== null && _f !== void 0 ? _f : "",
        age: (_g = localSeedUser === null || localSeedUser === void 0 ? void 0 : localSeedUser.age) !== null && _g !== void 0 ? _g : "",
        tags: (_h = localSeedUser === null || localSeedUser === void 0 ? void 0 : localSeedUser.tags) !== null && _h !== void 0 ? _h : [],
        currentTripId: (localSeedUser === null || localSeedUser === void 0 ? void 0 : localSeedUser.id) === openid ? localSeedUser.currentTripId : null,
        isAuthorized: (_j = localSeedUser === null || localSeedUser === void 0 ? void 0 : localSeedUser.isAuthorized) !== null && _j !== void 0 ? _j : false,
        createdAt: timestamp,
        updatedAt: timestamp
    };
}
function normalizeCloudUserDocument(openid, rawDocument, fallbackUser) {
    const fallbackDocument = buildDefaultCloudUser(openid, fallbackUser);
    if (!isPlainObject(rawDocument)) {
        return fallbackDocument;
    }
    return {
        _id: openid,
        id: openid,
        nickname: normalizeString(rawDocument.nickname, fallbackDocument.nickname),
        avatarUrl: normalizeString(rawDocument.avatarUrl, fallbackDocument.avatarUrl),
        homePersonaAssetId: typeof rawDocument.homePersonaAssetId === "string" && rawDocument.homePersonaAssetId.trim()
            ? rawDocument.homePersonaAssetId
            : null,
        bio: normalizeString(rawDocument.bio, fallbackDocument.bio),
        livingCity: normalizeString(rawDocument.livingCity, fallbackDocument.livingCity),
        hometown: normalizeString(rawDocument.hometown, fallbackDocument.hometown),
        age: normalizeString(rawDocument.age, fallbackDocument.age),
        tags: normalizeStringArray(rawDocument.tags),
        currentTripId: typeof rawDocument.currentTripId === "string" && rawDocument.currentTripId.trim()
            ? rawDocument.currentTripId
            : null,
        isAuthorized: Boolean(rawDocument.isAuthorized),
        createdAt: typeof rawDocument.createdAt === "number" ? rawDocument.createdAt : fallbackDocument.createdAt,
        updatedAt: typeof rawDocument.updatedAt === "number" ? rawDocument.updatedAt : fallbackDocument.updatedAt
    };
}
function toLocalUser(document) {
    return {
        id: document._id,
        nickname: document.nickname,
        avatarUrl: document.avatarUrl,
        homePersonaAssetId: document.homePersonaAssetId,
        bio: document.bio,
        livingCity: document.livingCity,
        hometown: document.hometown,
        age: document.age,
        tags: document.tags,
        currentTripId: document.currentTripId,
        isAuthorized: document.isAuthorized
    };
}
function toCloudUserDocument(user) {
    const timestamp = Date.now();
    return {
        _id: user.id,
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        homePersonaAssetId: user.homePersonaAssetId,
        bio: user.bio,
        livingCity: user.livingCity,
        hometown: user.hometown,
        age: user.age,
        tags: user.tags,
        currentTripId: user.currentTripId,
        isAuthorized: user.isAuthorized,
        createdAt: timestamp,
        updatedAt: timestamp
    };
}
async function readCloudUser(openid) {
    const database = (0, cloud_service_1.getCloudDatabase)();
    try {
        const response = await database.collection(CLOUD_USER_COLLECTION).doc(openid).get();
        return normalizeCloudUserDocument(openid, response.data, getLocalSeedUser());
    }
    catch (_error) {
        return null;
    }
}
async function writeCloudUser(document) {
    const database = (0, cloud_service_1.getCloudDatabase)();
    const { _id } = document, payload = __rest(document, ["_id"]);
    const safePayload = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "_id"));
    console.info("[cloud] 写入用户文档", {
        docId: _id,
        payloadKeys: Object.keys(safePayload)
    });
    await database.collection(CLOUD_USER_COLLECTION).doc(_id).set({
        data: safePayload
    });
}
async function syncCloudUserToLocalState() {
    if (!canUseCloudRuntime()) {
        return;
    }
    const identity = await (0, cloud_service_1.fetchCloudIdentity)();
    const repository = new app_state_repository_1.AppStateRepository(storage_adapter_1.wxStorageAdapter);
    const seedUser = getLocalSeedUser();
    let cloudUser = await readCloudUser(identity.openid);
    if (!cloudUser) {
        cloudUser = buildDefaultCloudUser(identity.openid, seedUser);
        await writeCloudUser(cloudUser);
    }
    repository.update((state) => {
        state.users[identity.openid] = toLocalUser(cloudUser);
        state.activeUserId = identity.openid;
    });
}
function scheduleUserCloudSync(user) {
    if (!canUseCloudRuntime() || !user.id || constants_1.DEMO_SWITCHABLE_USER_IDS.includes(user.id)) {
        return;
    }
    const nextDocument = toCloudUserDocument(user);
    userWriteQueue = userWriteQueue
        .catch(() => undefined)
        .then(async () => {
        await writeCloudUser(nextDocument);
    })
        .catch((error) => {
        console.error("[cloud] 用户资料同步失败", error);
    });
}

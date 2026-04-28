"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLocallyClearedUser = isLocallyClearedUser;
exports.markUserAsLocallyCleared = markUserAsLocallyCleared;
exports.clearLocallyClearedUserMark = clearLocallyClearedUserMark;
exports.buildLocallyClearedUser = buildLocallyClearedUser;
const constants_1 = require("../shared/constants");
const LOCAL_CLEARED_USER_IDS_STORAGE_KEY = "bus-seat-buddy-cleared-user-ids";
let memoryClearedUserIds = [];
function canUseWxStorage() {
    return (typeof wx !== "undefined" &&
        typeof wx.getStorageSync === "function" &&
        typeof wx.setStorageSync === "function");
}
function normalizeUserIds(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return Array.from(new Set(value
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)));
}
function readClearedUserIds() {
    if (canUseWxStorage()) {
        const storedValue = wx.getStorageSync(LOCAL_CLEARED_USER_IDS_STORAGE_KEY);
        memoryClearedUserIds = normalizeUserIds(storedValue);
        return [...memoryClearedUserIds];
    }
    return [...memoryClearedUserIds];
}
function writeClearedUserIds(userIds) {
    const nextUserIds = normalizeUserIds(userIds);
    memoryClearedUserIds = nextUserIds;
    if (canUseWxStorage()) {
        wx.setStorageSync(LOCAL_CLEARED_USER_IDS_STORAGE_KEY, nextUserIds);
    }
}
function isLocallyClearedUser(userId) {
    const normalizedUserId = userId.trim();
    return Boolean(normalizedUserId) && readClearedUserIds().includes(normalizedUserId);
}
function markUserAsLocallyCleared(userId) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
        return;
    }
    writeClearedUserIds([...readClearedUserIds(), normalizedUserId]);
}
function clearLocallyClearedUserMark(userId) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
        return;
    }
    writeClearedUserIds(readClearedUserIds().filter((entry) => entry !== normalizedUserId));
}
function buildLocallyClearedUser(userId) {
    return {
        id: userId,
        nickname: "",
        avatarUrl: constants_1.DEFAULT_AVATAR_URL,
        homePersonaAssetId: null,
        bio: "",
        livingCity: "",
        hometown: "",
        age: "",
        tags: [],
        memberTripId: null,
        currentTripId: null,
        isAuthorized: false,
        boardingRecordsByTripId: {}
    };
}

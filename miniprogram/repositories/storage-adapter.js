"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStorageAdapter = exports.wxStorageAdapter = void 0;
const constants_1 = require("../shared/constants");
let memoryState = null;
function cloneState(state) {
    return state ? JSON.parse(JSON.stringify(state)) : null;
}
function canUseWxStorage() {
    return typeof wx !== "undefined" && typeof wx.getStorageSync === "function" && typeof wx.setStorageSync === "function";
}
exports.wxStorageAdapter = {
    getState() {
        if (canUseWxStorage()) {
            const state = wx.getStorageSync(constants_1.APP_STATE_STORAGE_KEY);
            if (state) {
                memoryState = cloneState(state);
                return state;
            }
        }
        return cloneState(memoryState);
    },
    setState(state) {
        const snapshot = cloneState(state);
        memoryState = snapshot;
        if (snapshot && canUseWxStorage()) {
            wx.setStorageSync(constants_1.APP_STATE_STORAGE_KEY, snapshot);
        }
    }
};
class MemoryStorageAdapter {
    constructor(initialState = null) {
        this.state = cloneState(initialState);
    }
    getState() {
        return cloneState(this.state);
    }
    setState(state) {
        this.state = cloneState(state);
    }
}
exports.MemoryStorageAdapter = MemoryStorageAdapter;

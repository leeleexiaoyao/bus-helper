"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wxStorageAdapter = exports.MemoryStorageAdapter = void 0;
const constants_1 = require("../shared/constants");
class MemoryStorageAdapter {
    constructor(initialState = (0, constants_1.createInitialAppState)()) {
        this.state = initialState;
    }
    getState() {
        return this.state ? JSON.parse(JSON.stringify(this.state)) : null;
    }
    setState(state) {
        this.state = JSON.parse(JSON.stringify(state));
    }
}
exports.MemoryStorageAdapter = MemoryStorageAdapter;
exports.wxStorageAdapter = {
    getState() {
        try {
            return wx.getStorageSync(constants_1.APP_STATE_STORAGE_KEY) || null;
        }
        catch (error) {
            return null;
        }
    },
    setState(state) {
        wx.setStorageSync(constants_1.APP_STATE_STORAGE_KEY, state);
    }
};

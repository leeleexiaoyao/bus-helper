"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCloudDatabase = getCloudDatabase;
exports.callCloudFunction = callCloudFunction;
exports.fetchCloudIdentity = fetchCloudIdentity;
const cloud_1 = require("../../config/cloud");
function assertCloudReady() {
    if (!wx.cloud) {
        throw new Error("当前基础库未提供云开发能力。");
    }
    if (!(0, cloud_1.hasConfiguredCloudEnv)()) {
        throw new Error("请先在 miniprogram/config/cloud.ts 中填写真实云环境 ID。");
    }
}
function getCloudDatabase() {
    assertCloudReady();
    return wx.cloud.database();
}
async function callCloudFunction(name, data = {}) {
    assertCloudReady();
    const response = await wx.cloud.callFunction({
        name,
        data
    });
    return response.result;
}
function fetchCloudIdentity() {
    return callCloudFunction("getOpenid");
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorMessage = getErrorMessage;
exports.showErrorToast = showErrorToast;
exports.showSuccessToast = showSuccessToast;
const errors_1 = require("../shared/errors");
function getErrorMessage(error, fallback = "操作失败，请稍后再试。") {
    if (error instanceof errors_1.BusinessError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message || fallback;
    }
    return fallback;
}
function showErrorToast(error, fallback) {
    wx.showToast({
        title: getErrorMessage(error, fallback),
        icon: "none"
    });
}
function showSuccessToast(title) {
    wx.showToast({
        title,
        icon: "success"
    });
}

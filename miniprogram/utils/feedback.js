"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showErrorToast = showErrorToast;
exports.showSuccessToast = showSuccessToast;
function resolveErrorMessage(error) {
    if (typeof error === "string") {
        return error;
    }
    if (error && typeof error === "object" && "message" in error) {
        const message = error.message;
        if (typeof message === "string" && message.trim()) {
            return message.trim();
        }
    }
    return "操作失败，请稍后重试";
}
function showErrorToast(error) {
    wx.showToast({
        title: resolveErrorMessage(error),
        icon: "none"
    });
}
function showSuccessToast(title) {
    wx.showToast({
        title,
        icon: "success"
    });
}

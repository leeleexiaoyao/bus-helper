"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
const PASSWORD_LENGTH = 6;
function sanitizeDigits(value) {
    return value.replace(/\D/g, "");
}
Page({
    data: {
        passwordDigits: Array.from({ length: PASSWORD_LENGTH }, () => ""),
        focusIndex: 0,
        submitting: false
    },
    async onShow() {
        try {
            await (0, cloud_ready_1.waitForCloudReady)();
            trip_service_1.tripService.ensureAuthorizedAccess();
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
            wx.switchTab({
                url: "/pages/home/index"
            });
        }
    },
    handleDigitFocus(event) {
        this.setData({
            focusIndex: Number(event.currentTarget.dataset.index) || 0
        });
    },
    handleDigitInput(event) {
        const index = Number(event.currentTarget.dataset.index) || 0;
        const inputValue = sanitizeDigits(event.detail.value);
        const passwordDigits = [...this.data.passwordDigits];
        if (!inputValue) {
            passwordDigits[index] = "";
            this.setData({
                passwordDigits,
                focusIndex: index > 0 ? index - 1 : 0
            });
            return;
        }
        inputValue
            .slice(0, PASSWORD_LENGTH - index)
            .split("")
            .forEach((digit, offset) => {
            passwordDigits[index + offset] = digit;
        });
        this.setData({
            passwordDigits,
            focusIndex: Math.min(index + inputValue.length, PASSWORD_LENGTH - 1)
        });
    },
    handleSubmit() {
        if (this.data.submitting) {
            return;
        }
        this.setData({
            submitting: true
        });
        try {
            trip_service_1.tripService.joinTripByPassword(this.data.passwordDigits.join(""));
            (0, feedback_1.showSuccessToast)("加入成功");
            setTimeout(() => {
                wx.reLaunch({
                    url: "/pages/home/index"
                });
            }, 450);
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
        finally {
            this.setData({
                submitting: false
            });
        }
    }
});

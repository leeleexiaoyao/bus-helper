"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
Page({
    data: {
        password: "",
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
    handlePasswordInput(event) {
        this.setData({
            password: event.detail.value
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
            trip_service_1.tripService.joinTripByPassword(this.data.password);
            (0, feedback_1.showSuccessToast)("加入成功");
            wx.switchTab({
                url: "/pages/home/index"
            });
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

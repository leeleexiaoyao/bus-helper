"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
const TEMPLATE_COPY = {
    "template-49": "经典 49座",
    "template-53": "舒适 53座",
    "template-57": "宽敞 57座"
};
Page({
    data: {
        settings: null,
        templateLabel: ""
    },
    async onShow() {
        try {
            await (0, cloud_ready_1.waitForCloudReady)();
            const settings = trip_service_1.tripService.getTripSettings();
            if (settings.role !== "admin") {
                wx.switchTab({
                    url: "/pages/home/index"
                });
                return;
            }
            this.setData({
                settings,
                templateLabel: TEMPLATE_COPY[settings.templateId]
            });
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
            wx.switchTab({
                url: "/pages/home/index"
            });
        }
    },
    handleCopyPassword() {
        if (!this.data.settings) {
            return;
        }
        wx.setClipboardData({
            data: this.data.settings.password,
            success: () => {
                (0, feedback_1.showSuccessToast)("已复制");
            },
            fail: feedback_1.showErrorToast
        });
    },
    handleDissolve() {
        wx.showModal({
            title: "解散车次",
            content: "解散后，所有成员都会退出车次并清空座位绑定。",
            success: ({ confirm }) => {
                if (!confirm) {
                    return;
                }
                try {
                    trip_service_1.tripService.dissolveCurrentTrip();
                    (0, feedback_1.showSuccessToast)("车次已解散");
                    wx.switchTab({
                        url: "/pages/home/index"
                    });
                }
                catch (error) {
                    (0, feedback_1.showErrorToast)(error);
                }
            }
        });
    }
});

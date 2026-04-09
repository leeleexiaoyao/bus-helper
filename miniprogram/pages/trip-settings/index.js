"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const feedback_1 = require("../../utils/feedback");
Page({
    data: {
        settings: null,
        templateLabel: ""
    },
    onShow() {
        try {
            const settings = trip_service_1.tripService.getTripSettings();
            if (settings.role !== "admin") {
                wx.switchTab({
                    url: "/pages/home/index"
                });
                return;
            }
            this.setData({
                settings,
                templateLabel: settings.templateId === "template-49"
                    ? "49 座模板"
                    : settings.templateId === "template-53"
                        ? "53 座模板"
                        : "57 座模板"
            });
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
            wx.switchTab({
                url: "/pages/home/index"
            });
        }
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
Page({
    data: {
        pageData: null,
        showAction: false,
        isDissolveAction: false,
        primaryActionLabel: ""
    },
    async onShow() {
        try {
            await (0, cloud_ready_1.waitForCloudReady)();
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
            return;
        }
        this.refreshPage();
    },
    refreshPage() {
        try {
            const pageData = trip_service_1.tripService.getProfilePageData();
            this.setData({
                pageData,
                showAction: pageData.primaryActionKind !== "none",
                isDissolveAction: pageData.primaryActionKind === "dissolve",
                primaryActionLabel: pageData.primaryActionLabel
            });
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    handlePrimaryAction() {
        const pageData = this.data.pageData;
        if (!pageData || pageData.primaryActionKind === "none") {
            return;
        }
        const title = pageData.primaryActionKind === "dissolve" ? "解散车次" : "退出车次";
        const content = pageData.primaryActionKind === "dissolve"
            ? "解散后，所有成员都会退出车次并清空座位绑定。"
            : "退出后会释放你的座位，并回到未加入车次状态。";
        wx.showModal({
            title,
            content,
            success: ({ confirm }) => {
                if (!confirm) {
                    return;
                }
                try {
                    if (pageData.primaryActionKind === "dissolve") {
                        trip_service_1.tripService.dissolveCurrentTrip();
                        (0, feedback_1.showSuccessToast)("车次已解散");
                    }
                    else {
                        trip_service_1.tripService.leaveCurrentTrip();
                        (0, feedback_1.showSuccessToast)("已退出车次");
                    }
                    this.refreshPage();
                }
                catch (error) {
                    (0, feedback_1.showErrorToast)(error);
                }
            }
        });
    }
});

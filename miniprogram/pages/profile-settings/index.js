"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const constants_1 = require("../../shared/constants");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
Page({
    data: {
        pageData: null,
        draftHomeTitle: "",
        draftHomeSubtitle: "",
        isSavingCopy: false,
        seatUpdatingTripId: "",
        isClearingTripData: false,
        isClearingLocalData: false
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
            const pageData = trip_service_1.tripService.getHomeSettingsPageData();
            this.setData({
                pageData,
                draftHomeTitle: pageData.homeTitle,
                draftHomeSubtitle: pageData.homeSubtitle,
                isSavingCopy: false,
                seatUpdatingTripId: "",
                isClearingTripData: false,
                isClearingLocalData: false
            });
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    handleTitleInput(event) {
        this.setData({
            draftHomeTitle: String(event.detail.value || "")
        });
    },
    handleSubtitleInput(event) {
        this.setData({
            draftHomeSubtitle: String(event.detail.value || "")
        });
    },
    async handleSaveCopy() {
        var _a;
        if (!((_a = this.data.pageData) === null || _a === void 0 ? void 0 : _a.canEditHomeTitle) || this.data.isSavingCopy) {
            return;
        }
        this.setData({
            isSavingCopy: true
        });
        try {
            const pageData = await trip_service_1.tripService.saveHomeSettings(this.data.draftHomeTitle, this.data.draftHomeSubtitle);
            this.setData({
                pageData,
                draftHomeTitle: pageData.homeTitle,
                draftHomeSubtitle: pageData.homeSubtitle,
                isSavingCopy: false
            });
            (0, feedback_1.showSuccessToast)("首页文案已更新");
        }
        catch (error) {
            this.setData({
                isSavingCopy: false
            });
            (0, feedback_1.showErrorToast)(error);
        }
    },
    handleSeatTemplateTap(event) {
        const tripId = String(event.currentTarget.dataset.tripId || "");
        const pageData = this.data.pageData;
        if (!(pageData === null || pageData === void 0 ? void 0 : pageData.canEditHomeTitle) || !tripId || this.data.seatUpdatingTripId || this.data.isClearingTripData) {
            return;
        }
        const currentSetting = pageData.tripSeatSettings.find((setting) => setting.tripId === tripId);
        if (!currentSetting) {
            return;
        }
        wx.showActionSheet({
            itemList: constants_1.TRIP_TEMPLATES.map((template) => `${template.seatCount} 座${template.id === currentSetting.templateId ? "（当前）" : ""}`),
            success: ({ tapIndex }) => {
                const selectedTemplate = constants_1.TRIP_TEMPLATES[tapIndex];
                if (!selectedTemplate || selectedTemplate.id === currentSetting.templateId) {
                    return;
                }
                this.setData({
                    seatUpdatingTripId: tripId
                });
                try {
                    const nextPageData = trip_service_1.tripService.saveTripSeatTemplate(tripId, selectedTemplate.id);
                    this.setData({
                        pageData: nextPageData,
                        draftHomeTitle: nextPageData.homeTitle,
                        draftHomeSubtitle: nextPageData.homeSubtitle,
                        seatUpdatingTripId: ""
                    });
                    (0, feedback_1.showSuccessToast)(`${currentSetting.tripLabel} 已改为 ${selectedTemplate.seatCount} 座`);
                }
                catch (error) {
                    this.setData({
                        seatUpdatingTripId: ""
                    });
                    (0, feedback_1.showErrorToast)(error);
                }
            }
        });
    },
    handleClearTripData() {
        const pageData = this.data.pageData;
        if (!(pageData === null || pageData === void 0 ? void 0 : pageData.canClearTripData) || this.data.isClearingTripData || this.data.seatUpdatingTripId) {
            return;
        }
        wx.showModal({
            title: "清除所有车次信息",
            content: "将清空两辆车的座位、成员归属、标记、工具和上车记录，个人资料与首页设置会保留。",
            confirmColor: "#d64638",
            success: ({ confirm }) => {
                if (!confirm) {
                    return;
                }
                this.setData({
                    isClearingTripData: true
                });
                try {
                    const nextPageData = trip_service_1.tripService.clearAllTripData();
                    this.setData({
                        pageData: nextPageData,
                        draftHomeTitle: nextPageData.homeTitle,
                        draftHomeSubtitle: nextPageData.homeSubtitle,
                        isClearingTripData: false
                    });
                    (0, feedback_1.showSuccessToast)("车次信息已清空");
                }
                catch (error) {
                    this.setData({
                        isClearingTripData: false
                    });
                    (0, feedback_1.showErrorToast)(error);
                }
            }
        });
    },
    handleClearLocalData() {
        const pageData = this.data.pageData;
        if (!pageData || pageData.mode !== "member" || this.data.isClearingLocalData) {
            return;
        }
        wx.showModal({
            title: "确认清除",
            content: "清除后，你将在当前设备上看不到自己的车次、个人信息和缓存数据，但不会影响管理员和后端数据库中的相关数据。",
            confirmColor: "#d64638",
            success: ({ confirm }) => {
                if (!confirm) {
                    return;
                }
                this.setData({
                    isClearingLocalData: true
                });
                try {
                    trip_service_1.tripService.clearCurrentUserLocalData();
                    (0, feedback_1.showSuccessToast)("已清除本地数据");
                    wx.switchTab({
                        url: "/pages/profile/index"
                    });
                }
                catch (error) {
                    this.setData({
                        isClearingLocalData: false
                    });
                    (0, feedback_1.showErrorToast)(error);
                }
            }
        });
    }
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
Page({
    data: {
        pageData: null,
        draftHomeTitle: "",
        isSaving: false
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
                isSaving: false
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
    async handleSaveTitle() {
        var _a;
        if (!((_a = this.data.pageData) === null || _a === void 0 ? void 0 : _a.canEditHomeTitle) || this.data.isSaving) {
            return;
        }
        this.setData({
            isSaving: true
        });
        try {
            const pageData = await trip_service_1.tripService.saveHomeTitle(this.data.draftHomeTitle);
            this.setData({
                pageData,
                draftHomeTitle: pageData.homeTitle,
                isSaving: false
            });
            (0, feedback_1.showSuccessToast)("首页标题已更新");
        }
        catch (error) {
            this.setData({
                isSaving: false
            });
            (0, feedback_1.showErrorToast)(error);
        }
    }
});

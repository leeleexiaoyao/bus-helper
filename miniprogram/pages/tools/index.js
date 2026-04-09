"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const feedback_1 = require("../../utils/feedback");
Page({
    data: {
        pageData: null,
        showAuthGate: true,
        showToolsContent: false,
        showGoHomeAction: false,
        navProgress: 0,
        authPresetNickname: "",
        authPresetAvatarUrl: ""
    },
    onShow() {
        this.refreshPage();
    },
    onPageScroll(event) {
        const navProgress = Math.max(0, Math.min(1, event.scrollTop / 72));
        if (Math.abs(navProgress - this.data.navProgress) < 0.02) {
            return;
        }
        this.setData({
            navProgress
        });
    },
    refreshPage() {
        try {
            const pageData = trip_service_1.tripService.getToolsPageData();
            this.setData({
                pageData,
                showAuthGate: !pageData.isAuthorized,
                showToolsContent: pageData.isAuthorized,
                showGoHomeAction: !pageData.hasCurrentTrip,
                navProgress: 0,
                authPresetNickname: pageData.currentUser.nickname,
                authPresetAvatarUrl: pageData.currentUser.avatarUrl
            });
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    handleAuthorizeProfile(event) {
        try {
            trip_service_1.tripService.authorizeProfile(event.detail);
            this.refreshPage();
            (0, feedback_1.showSuccessToast)("授权成功");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    goHome() {
        wx.switchTab({
            url: "/pages/home/index"
        });
    }
});

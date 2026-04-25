"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
Page({
    data: {
        pageData: null,
        showAuthGate: true,
        showPageContent: false,
        showEmptyState: false,
        navProgress: 0,
        authPresetNickname: "",
        authPresetAvatarUrl: "",
        activeTab: "mine",
        isMineTab: true,
        isRankingTab: false
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
            const pageData = trip_service_1.tripService.getFavoritesPageData();
            const activeTab = this.data.activeTab === "ranking" && !pageData.showRankingTab ? "mine" : this.data.activeTab;
            const showEmptyState = !pageData.hasCurrentTrip ||
                (pageData.favorites.length === 0 && (!pageData.showRankingTab || pageData.ranking.length === 0));
            this.setData({
                pageData,
                showAuthGate: !pageData.isAuthorized,
                showPageContent: pageData.isAuthorized,
                showEmptyState,
                navProgress: 0,
                authPresetNickname: pageData.currentUser.nickname,
                authPresetAvatarUrl: pageData.currentUser.avatarUrl,
                activeTab,
                isMineTab: activeTab === "mine",
                isRankingTab: activeTab === "ranking"
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
    handleTabChange(event) {
        const nextTab = String(event.currentTarget.dataset.tab) === "ranking" ? "ranking" : "mine";
        this.setData({
            activeTab: nextTab,
            isMineTab: nextTab === "mine",
            isRankingTab: nextTab === "ranking"
        });
    }
});

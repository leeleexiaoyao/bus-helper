"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const constants_1 = require("../../shared/constants");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
const tag_style_1 = require("../../utils/tag-style");
const SETTINGS_ITEMS = [
    {
        id: "boarding-records",
        label: "上车记录",
        icon: "/assets/icons/me/icon_me_record.svg",
        action: "boarding-records",
        isShare: false,
        showDivider: true
    },
    {
        id: "favorite",
        label: "标记",
        icon: "/assets/icons/me/icon_me_favorite.svg",
        action: "favorite",
        isShare: false,
        showDivider: true
    },
    {
        id: "share",
        label: "分享",
        icon: "/assets/icons/me/icon_me_share.svg",
        action: "share",
        isShare: true,
        showDivider: true
    },
    {
        id: "feedback",
        label: "意见反馈",
        icon: "/assets/icons/me/icon_me_feedback.svg",
        action: "feedback",
        isShare: false,
        showDivider: true
    },
    {
        id: "settings",
        label: "设置",
        icon: "/assets/icons/me/icon_me_setting.svg",
        action: "settings",
        isShare: false,
        showDivider: false
    }
];
const UNAUTHORIZED_SETTINGS_ITEMS = [
    {
        id: "share",
        label: "分享",
        icon: "/assets/icons/profile-share.svg",
        action: "share",
        isShare: true,
        showDivider: true
    },
    {
        id: "about",
        label: "关于小程序",
        icon: "/assets/icons/profile-about.svg",
        action: "about",
        isShare: false,
        showDivider: false
    }
];
function resolveProfileIllustrationUrl(homePersonaAssetId) {
    var _a, _b;
    if (!homePersonaAssetId) {
        return "";
    }
    return (_b = (_a = constants_1.HOME_PERSONA_OPTIONS.find((option) => option.id === homePersonaAssetId)) === null || _a === void 0 ? void 0 : _a.imageUrl) !== null && _b !== void 0 ? _b : "";
}
Page({
    data: {
        pageData: null,
        showAuthGate: false,
        showProfileContent: false,
        showSeedDemoEntry: false,
        seedDemoToggling: false,
        navProgress: 0,
        authPresetNickname: "",
        authPresetAvatarUrl: "",
        profileIllustrationUrl: "",
        hasProfileIllustration: false,
        flowerIconUrl: "/assets/icons/me/pic_me_flower.svg",
        moreIconUrl: "/assets/icons/me/icon_me_more.svg",
        settingsItems: UNAUTHORIZED_SETTINGS_ITEMS,
        profileTagViews: []
    },
    onLoad() {
        wx.showShareMenu({
            menus: ["shareAppMessage"]
        });
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
            const pageData = trip_service_1.tripService.getProfilePageData();
            const profileIllustrationUrl = resolveProfileIllustrationUrl(pageData.currentUser.homePersonaAssetId);
            this.setData({
                pageData,
                showProfileContent: pageData.isAuthorized,
                showSeedDemoEntry: pageData.isAuthorized,
                navProgress: 0,
                authPresetNickname: pageData.currentUser.nickname,
                authPresetAvatarUrl: pageData.currentUser.avatarUrl,
                profileIllustrationUrl,
                hasProfileIllustration: Boolean(profileIllustrationUrl),
                settingsItems: pageData.isAuthorized ? SETTINGS_ITEMS : UNAUTHORIZED_SETTINGS_ITEMS,
                profileTagViews: (0, tag_style_1.buildTagColorViews)(pageData.tags)
            });
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    handleAuthorizeProfile(event) {
        try {
            trip_service_1.tripService.authorizeProfile(event.detail);
            this.setData({
                showAuthGate: false
            });
            this.refreshPage();
            (0, feedback_1.showSuccessToast)("保存成功");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    openAuthGate() {
        this.setData({
            showAuthGate: true
        });
    },
    handleCloseAuthGate() {
        this.setData({
            showAuthGate: false
        });
    },
    handleSeedDemoToggle(event) {
        const enabled = Boolean(event.detail.value);
        this.setData({
            seedDemoToggling: true
        });
        try {
            if (enabled) {
                trip_service_1.tripService.enableSeedDemoData();
            }
            else {
                trip_service_1.tripService.disableSeedDemoData();
            }
            this.refreshPage();
            (0, feedback_1.showSuccessToast)(enabled ? "已填充假数据" : "已清除假数据");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
        finally {
            this.setData({
                seedDemoToggling: false
            });
        }
    },
    handleSwitchSeedDemoUser(event) {
        const userId = String(event.currentTarget.dataset.userId || "");
        if (!userId) {
            return;
        }
        try {
            trip_service_1.tripService.switchActiveUser(userId);
            this.refreshPage();
            (0, feedback_1.showSuccessToast)("已切换角色");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    goTagEditor() {
        wx.navigateTo({
            url: "/pages/tag-editor/index"
        });
    },
    goFeedback() {
        wx.navigateTo({
            url: "/pages/feedback/index"
        });
    },
    goFavorite() {
        wx.navigateTo({
            url: "/pages/favorites/index"
        });
    },
    goBoardingRecords() {
        wx.navigateTo({
            url: "/pages/boarding-records/index"
        });
    },
    goSettings() {
        wx.navigateTo({
            url: "/pages/profile-settings/index"
        });
    },
    goAbout() {
        wx.navigateTo({
            url: "/pages/about/index"
        });
    },
    handleMenuTap(event) {
        const action = String(event.currentTarget.dataset.action || "");
        if (action === "boarding-records") {
            this.goBoardingRecords();
            return;
        }
        if (action === "favorite") {
            this.goFavorite();
            return;
        }
        if (action === "feedback") {
            this.goFeedback();
            return;
        }
        if (action === "settings") {
            this.goSettings();
            return;
        }
        if (action === "about") {
            this.goAbout();
        }
    },
    onShareAppMessage() {
        return {
            title: "巴士认座助手",
            path: "/pages/home/index"
        };
    }
});

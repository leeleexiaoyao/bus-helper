"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const constants_1 = require("../../shared/constants");
const feedback_1 = require("../../utils/feedback");
const SETTINGS_ITEMS = [
    {
        id: "share",
        label: "分享",
        icon: "/assets/icons/profile-share.svg",
        action: "share",
        isShare: true,
        showDivider: true
    },
    {
        id: "feedback",
        label: "问题反馈",
        icon: "/assets/icons/profile-feedback.svg",
        action: "feedback",
        isShare: false,
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
function buildTextStat(value) {
    const trimmed = value.trim();
    return {
        primary: trimmed || "未填写",
        secondary: "",
        isPlaceholder: !trimmed
    };
}
function resolveProfileIllustrationUrl(homePersonaAssetId) {
    var _a, _b;
    if (!homePersonaAssetId) {
        return constants_1.HOME_PERSONA_IMAGE_URL;
    }
    return (_b = (_a = constants_1.HOME_PERSONA_OPTIONS.find((option) => option.id === homePersonaAssetId)) === null || _a === void 0 ? void 0 : _a.imageUrl) !== null && _b !== void 0 ? _b : constants_1.HOME_PERSONA_IMAGE_URL;
}
Page({
    data: {
        pageData: null,
        showAuthGate: true,
        showProfileContent: false,
        showLeaveAction: false,
        showDissolveAction: false,
        navProgress: 0,
        authPresetNickname: "",
        authPresetAvatarUrl: "",
        profileIllustrationUrl: "/assets/personas/profile-illustration.svg",
        editIconUrl: "/assets/icons/profile-edit.svg",
        settingsItems: SETTINGS_ITEMS,
        profileStats: {
            age: buildTextStat(""),
            living: buildTextStat(""),
            hometown: buildTextStat("")
        }
    },
    onLoad() {
        wx.showShareMenu({
            menus: ["shareAppMessage"]
        });
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
            const pageData = trip_service_1.tripService.getProfilePageData();
            this.setData({
                pageData,
                showAuthGate: !pageData.isAuthorized,
                showProfileContent: pageData.isAuthorized,
                showLeaveAction: pageData.primaryActionKind === "leave",
                showDissolveAction: pageData.primaryActionKind === "dissolve",
                navProgress: 0,
                authPresetNickname: pageData.currentUser.nickname,
                authPresetAvatarUrl: pageData.currentUser.avatarUrl,
                profileIllustrationUrl: resolveProfileIllustrationUrl(pageData.currentUser.homePersonaAssetId),
                profileStats: {
                    age: buildTextStat(pageData.currentUser.age),
                    living: pageData.livingLocationDisplay,
                    hometown: pageData.hometownLocationDisplay
                }
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
    goAbout() {
        wx.navigateTo({
            url: "/pages/about/index"
        });
    },
    handleMenuTap(event) {
        const action = String(event.currentTarget.dataset.action || "");
        if (action === "about") {
            this.goAbout();
            return;
        }
        if (action === "feedback") {
            this.goFeedback();
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
    },
    handleSwitchDemoUser(event) {
        const userId = String(event.currentTarget.dataset.userId);
        try {
            trip_service_1.tripService.switchActiveUser(userId);
            this.refreshPage();
            (0, feedback_1.showSuccessToast)("已切换身份");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    onShareAppMessage() {
        return {
            title: "巴士认座助手",
            path: "/pages/home/index"
        };
    }
});

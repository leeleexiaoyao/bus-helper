import type { ProfilePageViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { HOME_PERSONA_OPTIONS } from "../../shared/constants";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";
import { buildTagColorViews, type TagColorView } from "../../utils/tag-style";

interface ProfileMenuItem {
  id: string;
  label: string;
  icon: string;
  action: "boarding-records" | "favorite" | "share" | "feedback" | "settings" | "about";
  isShare: boolean;
  showDivider: boolean;
}

const SETTINGS_ITEMS: ProfileMenuItem[] = [
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

const UNAUTHORIZED_SETTINGS_ITEMS: ProfileMenuItem[] = [
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

function resolveProfileIllustrationUrl(homePersonaAssetId: string | null): string {
  if (!homePersonaAssetId) {
    return "";
  }

  return HOME_PERSONA_OPTIONS.find((option) => option.id === homePersonaAssetId)?.imageUrl ?? "";
}

Page({
  data: {
    pageData: null as ProfilePageViewModel | null,
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
    profileTagViews: [] as TagColorView[]
  },

  onLoad() {
    wx.showShareMenu({
      menus: ["shareAppMessage"]
    });
  },

  async onShow() {
    try {
      await waitForCloudReady();
    } catch (error) {
      showErrorToast(error);
      return;
    }

    this.refreshPage();
  },

  onPageScroll(event: WechatMiniprogram.Page.IPageScrollOption) {
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
      const pageData = tripService.getProfilePageData();
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
        profileTagViews: buildTagColorViews(pageData.tags)
      });
    } catch (error) {
      showErrorToast(error);
    }
  },

  handleAuthorizeProfile(
    event: WechatMiniprogram.CustomEvent<{ nickname: string; avatarUrl: string }>
  ) {
    try {
      tripService.authorizeProfile(event.detail);
      this.setData({
        showAuthGate: false
      });
      this.refreshPage();
      showSuccessToast("保存成功");
    } catch (error) {
      showErrorToast(error);
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

  handleSeedDemoToggle(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    const enabled = Boolean(event.detail.value);
    this.setData({
      seedDemoToggling: true
    });

    try {
      if (enabled) {
        tripService.enableSeedDemoData();
      } else {
        tripService.disableSeedDemoData();
      }
      this.refreshPage();
      showSuccessToast(enabled ? "已填充假数据" : "已清除假数据");
    } catch (error) {
      showErrorToast(error);
    } finally {
      this.setData({
        seedDemoToggling: false
      });
    }
  },

  handleSwitchSeedDemoUser(event: WechatMiniprogram.CustomEvent) {
    const userId = String(event.currentTarget.dataset.userId || "");
    if (!userId) {
      return;
    }

    try {
      tripService.switchActiveUser(userId);
      this.refreshPage();
      showSuccessToast("已切换角色");
    } catch (error) {
      showErrorToast(error);
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

  handleMenuTap(event: WechatMiniprogram.CustomEvent) {
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

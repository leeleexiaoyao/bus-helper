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
  action: "favorite" | "share" | "feedback" | "settings" | "about";
  isShare: boolean;
  showDivider: boolean;
}

interface ProfileStatDisplay {
  primary: string;
  secondary: string;
  isPlaceholder: boolean;
}

const SETTINGS_ITEMS: ProfileMenuItem[] = [
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

function buildTextStat(value: string): ProfileStatDisplay {
  const trimmed = value.trim();
  return {
    primary: trimmed,
    secondary: "",
    isPlaceholder: false
  };
}

function buildAgeStat(value: string): ProfileStatDisplay {
  const trimmed = value.trim();
  return {
    primary: trimmed ? `${trimmed} 岁` : "",
    secondary: "",
    isPlaceholder: false
  };
}

function trimProfileLocationSuffix(value: string): string {
  const suffixes = ["特别行政区", "自治区", "自治州", "自治县", "地区", "盟", "省", "市", "区", "县"];
  const matchedSuffix = suffixes.find((suffix) => value.endsWith(suffix));
  if (!matchedSuffix) {
    return value;
  }

  return value.slice(0, -matchedSuffix.length);
}

function parseLocationUnits(value: string): Array<{ name: string; suffix: string }> {
  const units: Array<{ name: string; suffix: string }> = [];
  const matcher = /(.+?)(特别行政区|自治区|自治州|自治县|地区|盟|省|市|区|县)/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(value)) !== null) {
    units.push({
      name: match[1],
      suffix: match[2]
    });
  }

  return units;
}

function buildLocationStatFromName(name: string): ProfileStatDisplay {
  return {
    primary: name,
    secondary: "",
    isPlaceholder: !name
  };
}

function buildLivingLocationStat(value: string): ProfileStatDisplay {
  const trimmed = value.trim();
  if (!trimmed) {
    return buildLocationStatFromName("");
  }

  const units = parseLocationUnits(trimmed);
  const districtUnit = units.find((unit) => unit.suffix === "区" || unit.suffix === "县");
  const cityUnit = units.find((unit) => unit.suffix === "市");
  return buildLocationStatFromName(districtUnit?.name ?? cityUnit?.name ?? trimProfileLocationSuffix(trimmed));
}

function buildHometownLocationStat(value: string): ProfileStatDisplay {
  const trimmed = value.trim();
  if (!trimmed) {
    return buildLocationStatFromName("");
  }

  const units = parseLocationUnits(trimmed);
  const cityUnit = units.find((unit) => unit.suffix === "市");
  const districtUnit = units.find((unit) => unit.suffix === "区" || unit.suffix === "县");
  return buildLocationStatFromName(cityUnit?.name ?? districtUnit?.name ?? trimProfileLocationSuffix(trimmed));
}

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
    seedDemoToggling: false,
    navProgress: 0,
    authPresetNickname: "",
    authPresetAvatarUrl: "",
    profileIllustrationUrl: "",
    hasProfileIllustration: false,
    flowerIconUrl: "/assets/icons/me/pic_me_flower.svg",
    moreIconUrl: "/assets/icons/me/icon_me_more.svg",
    settingsItems: UNAUTHORIZED_SETTINGS_ITEMS,
    profileTagViews: [] as TagColorView[],
    hasProfileBio: false,
    hasProfileStats: false,
    profileStats: {
      age: buildAgeStat(""),
      living: buildTextStat(""),
      hometown: buildTextStat("")
    }
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
      const ageStat = buildAgeStat(pageData.currentUser.age);
      const livingStat = buildLivingLocationStat(pageData.currentUser.livingCity);
      const hometownStat = buildHometownLocationStat(pageData.currentUser.hometown);
      this.setData({
        pageData,
        showProfileContent: pageData.isAuthorized,
        navProgress: 0,
        authPresetNickname: pageData.currentUser.nickname,
        authPresetAvatarUrl: pageData.currentUser.avatarUrl,
        profileIllustrationUrl,
        hasProfileIllustration: Boolean(profileIllustrationUrl),
        settingsItems: pageData.isAuthorized ? SETTINGS_ITEMS : UNAUTHORIZED_SETTINGS_ITEMS,
        profileTagViews: buildTagColorViews(pageData.tags),
        hasProfileBio: Boolean(pageData.currentUser.bio.trim()),
        hasProfileStats: Boolean(ageStat.primary || livingStat.primary || hometownStat.primary),
        profileStats: {
          age: ageStat,
          living: livingStat,
          hometown: hometownStat
        }
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

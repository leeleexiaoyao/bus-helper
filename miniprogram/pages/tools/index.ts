import type { ToolsPageViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

Page({
  data: {
    pageData: null as ToolsPageViewModel | null,
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
      const pageData = tripService.getToolsPageData();
      this.setData({
        pageData,
        showAuthGate: !pageData.isAuthorized,
        showToolsContent: pageData.isAuthorized,
        showGoHomeAction: !pageData.hasCurrentTrip,
        navProgress: 0,
        authPresetNickname: pageData.currentUser.nickname,
        authPresetAvatarUrl: pageData.currentUser.avatarUrl
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
      this.refreshPage();
      showSuccessToast("授权成功");
    } catch (error) {
      showErrorToast(error);
    }
  },

  goHome() {
    wx.switchTab({
      url: "/pages/home/index"
    });
  }
});

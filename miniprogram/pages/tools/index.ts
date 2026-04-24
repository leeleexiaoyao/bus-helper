import type { ToolType, ToolsPageViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

Page({
  data: {
    pageData: null as ToolsPageViewModel | null,
    showAuthGate: true,
    showToolsContent: false,
    navProgress: 0,
    authPresetNickname: "",
    authPresetAvatarUrl: ""
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
      const pageData = tripService.getToolsPageData();
      this.setData({
        pageData,
        showAuthGate: !pageData.isAuthorized,
        showToolsContent: pageData.isAuthorized,
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

  handleEnterTool(event: WechatMiniprogram.CustomEvent) {
    const toolType = String(event.currentTarget.dataset.toolType) as ToolType;
    if (!this.data.pageData?.hasCurrentTrip) {
      showErrorToast(new Error("请先创建或加入车次"));
      return;
    }
    this.goToolDetail(toolType);
  },

  goToolDetail(toolType: ToolType) {
    wx.navigateTo({
      url: `/pages/tool-detail/index?type=${toolType}`
    });
  }
});

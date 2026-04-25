import type { ToolType, ToolsPageViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast } from "../../utils/feedback";

Page({
  data: {
    pageData: null as ToolsPageViewModel | null,
    showToolsContent: false,
    navProgress: 0
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
        showToolsContent: pageData.isAuthorized && pageData.hasCurrentTrip,
        navProgress: 0
      });
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

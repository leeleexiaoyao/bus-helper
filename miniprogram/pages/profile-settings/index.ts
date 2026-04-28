import type { HomeSettingsPageViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

Page({
  data: {
    pageData: null as HomeSettingsPageViewModel | null,
    draftHomeTitle: "",
    isSaving: false
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

  refreshPage() {
    try {
      const pageData = tripService.getHomeSettingsPageData();
      this.setData({
        pageData,
        draftHomeTitle: pageData.homeTitle,
        isSaving: false
      });
    } catch (error) {
      showErrorToast(error);
    }
  },

  handleTitleInput(event: WechatMiniprogram.CustomEvent) {
    this.setData({
      draftHomeTitle: String(event.detail.value || "")
    });
  },

  async handleSaveTitle() {
    if (!this.data.pageData?.canEditHomeTitle || this.data.isSaving) {
      return;
    }

    this.setData({
      isSaving: true
    });

    try {
      const pageData = await tripService.saveHomeTitle(this.data.draftHomeTitle);
      this.setData({
        pageData,
        draftHomeTitle: pageData.homeTitle,
        isSaving: false
      });
      showSuccessToast("首页标题已更新");
    } catch (error) {
      this.setData({
        isSaving: false
      });
      showErrorToast(error);
    }
  }
});

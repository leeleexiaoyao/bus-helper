import { tripService } from "../../services/trip-service";
import type { TripSettingsViewModel } from "../../shared/types";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

const TEMPLATE_COPY = {
  "template-49": "经典 49座",
  "template-53": "舒适 53座",
  "template-57": "宽敞 57座"
} as const;

Page({
  data: {
    settings: null as TripSettingsViewModel | null,
    templateLabel: ""
  },

  async onShow() {
    try {
      await waitForCloudReady();
      const settings = tripService.getTripSettings();
      if (settings.role !== "admin") {
        wx.switchTab({
          url: "/pages/home/index"
        });
        return;
      }
      this.setData({
        settings,
        templateLabel: TEMPLATE_COPY[settings.templateId]
      });
    } catch (error) {
      showErrorToast(error);
      wx.switchTab({
        url: "/pages/home/index"
      });
    }
  },

  handleCopyPassword() {
    if (!this.data.settings) {
      return;
    }

    wx.setClipboardData({
      data: this.data.settings.password,
      success: () => {
        showSuccessToast("已复制");
      },
      fail: showErrorToast
    });
  },

  handleDissolve() {
    wx.showModal({
      title: "解散车次",
      content: "解散后，所有成员都会退出车次并清空座位绑定。",
      success: ({ confirm }) => {
        if (!confirm) {
          return;
        }

        try {
          tripService.dissolveCurrentTrip();
          showSuccessToast("车次已解散");
          wx.switchTab({
            url: "/pages/home/index"
          });
        } catch (error) {
          showErrorToast(error);
        }
      }
    });
  }
});

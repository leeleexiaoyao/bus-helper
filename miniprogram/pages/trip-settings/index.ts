import { tripService } from "../../services/trip-service";
import type { TripSettingsViewModel } from "../../shared/types";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

Page({
  data: {
    settings: null as TripSettingsViewModel | null,
    templateLabel: ""
  },

  onShow() {
    try {
      const settings = tripService.getTripSettings();
      if (settings.role !== "admin") {
        wx.switchTab({
          url: "/pages/home/index"
        });
        return;
      }
      this.setData({
        settings,
        templateLabel:
          settings.templateId === "template-49"
            ? "49 座模板"
            : settings.templateId === "template-53"
              ? "53 座模板"
              : "57 座模板"
      });
    } catch (error) {
      showErrorToast(error);
      wx.switchTab({
        url: "/pages/home/index"
      });
    }
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

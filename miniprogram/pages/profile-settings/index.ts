import type { ProfilePageViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

Page({
  data: {
    pageData: null as ProfilePageViewModel | null,
    showAction: false,
    isDissolveAction: false,
    primaryActionLabel: ""
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
      const pageData = tripService.getProfilePageData();
      this.setData({
        pageData,
        showAction: pageData.primaryActionKind !== "none",
        isDissolveAction: pageData.primaryActionKind === "dissolve",
        primaryActionLabel: pageData.primaryActionLabel
      });
    } catch (error) {
      showErrorToast(error);
    }
  },

  handlePrimaryAction() {
    const pageData = this.data.pageData;
    if (!pageData || pageData.primaryActionKind === "none") {
      return;
    }

    const title = pageData.primaryActionKind === "dissolve" ? "解散车次" : "退出车次";
    const content =
      pageData.primaryActionKind === "dissolve"
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
            tripService.dissolveCurrentTrip();
            showSuccessToast("车次已解散");
          } else {
            tripService.leaveCurrentTrip();
            showSuccessToast("已退出车次");
          }
          this.refreshPage();
        } catch (error) {
          showErrorToast(error);
        }
      }
    });
  }
});

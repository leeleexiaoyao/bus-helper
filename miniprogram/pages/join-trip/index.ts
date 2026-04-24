import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

Page({
  data: {
    password: "",
    submitting: false
  },

  async onShow() {
    try {
      await waitForCloudReady();
      tripService.ensureAuthorizedAccess();
    } catch (error) {
      showErrorToast(error);
      wx.switchTab({
        url: "/pages/home/index"
      });
    }
  },

  handlePasswordInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      password: event.detail.value
    });
  },

  handleSubmit() {
    if (this.data.submitting) {
      return;
    }

    this.setData({
      submitting: true
    });

    try {
      tripService.joinTripByPassword(this.data.password);
      showSuccessToast("加入成功");
      wx.switchTab({
        url: "/pages/home/index"
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      this.setData({
        submitting: false
      });
    }
  }
});

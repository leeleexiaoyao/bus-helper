import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

const PASSWORD_LENGTH = 6;

function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

Page({
  data: {
    passwordDigits: Array.from({ length: PASSWORD_LENGTH }, () => ""),
    focusIndex: 0,
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

  handleDigitFocus(event: WechatMiniprogram.CustomEvent) {
    this.setData({
      focusIndex: Number(event.currentTarget.dataset.index) || 0
    });
  },

  handleDigitInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    const inputValue = sanitizeDigits(event.detail.value);
    const passwordDigits = [...this.data.passwordDigits];

    if (!inputValue) {
      passwordDigits[index] = "";
      this.setData({
        passwordDigits,
        focusIndex: index > 0 ? index - 1 : 0
      });
      return;
    }

    inputValue
      .slice(0, PASSWORD_LENGTH - index)
      .split("")
      .forEach((digit, offset) => {
        passwordDigits[index + offset] = digit;
      });

    this.setData({
      passwordDigits,
      focusIndex: Math.min(index + inputValue.length, PASSWORD_LENGTH - 1)
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
      tripService.joinTripByPassword(this.data.passwordDigits.join(""));
      showSuccessToast("加入成功");
      setTimeout(() => {
        wx.reLaunch({
          url: "/pages/home/index"
        });
      }, 450);
    } catch (error) {
      showErrorToast(error);
    } finally {
      this.setData({
        submitting: false
      });
    }
  }
});

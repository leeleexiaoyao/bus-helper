import { TRIP_TEMPLATES } from "../../shared/constants";
import type { TemplateId } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

const DEFAULT_TEMPLATE_ID: TemplateId = "template-49";
const TEMPLATE_COPY: Record<TemplateId, { title: string; layoutText: string }> = {
  "template-49": {
    title: "经典 49座",
    layoutText: "4 × 11 + 5"
  },
  "template-53": {
    title: "舒适 53座",
    layoutText: "4 × 12 + 5"
  },
  "template-57": {
    title: "宽敞 57座",
    layoutText: "4 × 13 + 5"
  }
};

function getDepartureDisplay(departureDate: string, departureClock: string): string {
  if (departureDate && departureClock) {
    return `${departureDate}  ${departureClock}`;
  }
  if (departureDate) {
    return `${departureDate}  选择时间`;
  }
  if (departureClock) {
    return `选择日期  ${departureClock}`;
  }
  return "";
}

function buildTemplates(selectedTemplateId: TemplateId | "") {
  return TRIP_TEMPLATES.map((template) => ({
    ...template,
    displayName: TEMPLATE_COPY[template.id].title,
    layoutText: TEMPLATE_COPY[template.id].layoutText,
    selected: selectedTemplateId === template.id,
    className:
      selectedTemplateId === template.id ? "template-card is-active" : "template-card"
  }));
}

Page({
  data: {
    tripName: "",
    departureTime: "",
    departureDate: "",
    departureClock: "",
    departureDisplay: "",
    password: "",
    templateId: DEFAULT_TEMPLATE_ID as TemplateId,
    templates: buildTemplates(DEFAULT_TEMPLATE_ID),
    submitting: false
  },

  onLoad() {
    try {
      this.setData({
        password: tripService.generateAvailableTripPassword()
      });
    } catch (error) {
      showErrorToast(error);
    }
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

  handleInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const field = String(event.currentTarget.dataset.field);
    this.setData({
      [field]: event.detail.value
    });
  },

  handleTemplateSelect(event: WechatMiniprogram.CustomEvent) {
    const templateId = String(event.currentTarget.dataset.templateId) as TemplateId;
    this.setData({
      templateId,
      templates: buildTemplates(templateId)
    });
  },

  handleDepartureDateChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const departureDate = String(event.detail.value || "");
    const departureDisplay = getDepartureDisplay(departureDate, this.data.departureClock);
    this.setData({
      departureDate,
      departureDisplay,
      departureTime: departureDate && this.data.departureClock ? `${departureDate} ${this.data.departureClock}` : ""
    });
  },

  handleDepartureTimeChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const departureClock = String(event.detail.value || "");
    const departureDisplay = getDepartureDisplay(this.data.departureDate, departureClock);
    this.setData({
      departureClock,
      departureDisplay,
      departureTime: this.data.departureDate && departureClock ? `${this.data.departureDate} ${departureClock}` : ""
    });
  },

  handleCopyPassword() {
    wx.setClipboardData({
      data: this.data.password,
      success: () => {
        showSuccessToast("已复制");
      },
      fail: showErrorToast
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
      tripService.createTrip({
        tripName: this.data.tripName,
        departureTime: this.data.departureTime,
        password: this.data.password,
        templateId: this.data.templateId as TemplateId
      });
      showSuccessToast("创建成功");
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

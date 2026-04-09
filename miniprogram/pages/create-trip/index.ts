import { TRIP_TEMPLATES } from "../../shared/constants";
import type { TemplateId } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

function formatTemplateLayout(rowSeatCounts: number[]): string {
  const groups = rowSeatCounts.reduce<Array<{ rowCount: number; seatCount: number }>>(
    (accumulator, seatCount) => {
      const lastGroup = accumulator[accumulator.length - 1];
      if (lastGroup && lastGroup.seatCount === seatCount) {
        lastGroup.rowCount += 1;
        return accumulator;
      }

      accumulator.push({
        rowCount: 1,
        seatCount
      });
      return accumulator;
    },
    []
  );

  return groups
    .map((group) => `${group.rowCount}排${group.seatCount}座`)
    .join("+");
}

function buildTemplates(selectedTemplateId: TemplateId | "") {
  return TRIP_TEMPLATES.map((template) => ({
    ...template,
    displayName: `${template.seatCount} 座`,
    layoutText: formatTemplateLayout(template.rowSeatCounts),
    selected: selectedTemplateId === template.id,
    className:
      selectedTemplateId === template.id ? "template-card is-active" : "template-card"
  }));
}

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 44,
    navTotalHeight: 64,
    navRightPadding: 112,
    tripName: "",
    departureTime: "",
    password: "",
    templateId: "" as TemplateId | "",
    templates: buildTemplates(""),
    submitting: false
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const capsule = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navHeight = Math.max(44, capsule.bottom - statusBarHeight);
    const navTotalHeight = statusBarHeight + navHeight;
    const navRightPadding = Math.max(systemInfo.windowWidth - capsule.left + 16, 112);

    this.setData({
      statusBarHeight,
      navHeight,
      navTotalHeight,
      navRightPadding
    });
  },

  onShow() {
    try {
      tripService.ensureAuthorizedAccess();
    } catch (error) {
      showErrorToast(error);
      wx.switchTab({
        url: "/pages/home/index"
      });
    }
  },

  handleBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }

    wx.switchTab({
      url: "/pages/home/index"
    });
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

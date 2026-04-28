import type { HomeSettingsPageViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { TRIP_TEMPLATES } from "../../shared/constants";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

Page({
  data: {
    pageData: null as HomeSettingsPageViewModel | null,
    draftHomeTitle: "",
    draftHomeSubtitle: "",
    isSavingCopy: false,
    seatUpdatingTripId: "",
    isClearingTripData: false,
    isClearingLocalData: false
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
        draftHomeSubtitle: pageData.homeSubtitle,
        isSavingCopy: false,
        seatUpdatingTripId: "",
        isClearingTripData: false,
        isClearingLocalData: false
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

  handleSubtitleInput(event: WechatMiniprogram.CustomEvent) {
    this.setData({
      draftHomeSubtitle: String(event.detail.value || "")
    });
  },

  async handleSaveCopy() {
    if (!this.data.pageData?.canEditHomeTitle || this.data.isSavingCopy) {
      return;
    }

    this.setData({
      isSavingCopy: true
    });

    try {
      const pageData = await tripService.saveHomeSettings(
        this.data.draftHomeTitle,
        this.data.draftHomeSubtitle
      );
      this.setData({
        pageData,
        draftHomeTitle: pageData.homeTitle,
        draftHomeSubtitle: pageData.homeSubtitle,
        isSavingCopy: false
      });
      showSuccessToast("首页文案已更新");
    } catch (error) {
      this.setData({
        isSavingCopy: false
      });
      showErrorToast(error);
    }
  },

  handleSeatTemplateTap(event: WechatMiniprogram.CustomEvent) {
    const tripId = String(event.currentTarget.dataset.tripId || "");
    const pageData = this.data.pageData;
    if (!pageData?.canEditHomeTitle || !tripId || this.data.seatUpdatingTripId || this.data.isClearingTripData) {
      return;
    }

    const currentSetting = pageData.tripSeatSettings.find((setting) => setting.tripId === tripId);
    if (!currentSetting) {
      return;
    }

    wx.showActionSheet({
      itemList: TRIP_TEMPLATES.map((template) =>
        `${template.seatCount} 座${template.id === currentSetting.templateId ? "（当前）" : ""}`
      ),
      success: ({ tapIndex }) => {
        const selectedTemplate = TRIP_TEMPLATES[tapIndex];
        if (!selectedTemplate || selectedTemplate.id === currentSetting.templateId) {
          return;
        }

        this.setData({
          seatUpdatingTripId: tripId
        });

        try {
          const nextPageData = tripService.saveTripSeatTemplate(tripId, selectedTemplate.id);
          this.setData({
            pageData: nextPageData,
            draftHomeTitle: nextPageData.homeTitle,
            draftHomeSubtitle: nextPageData.homeSubtitle,
            seatUpdatingTripId: ""
          });
          showSuccessToast(`${currentSetting.tripLabel} 已改为 ${selectedTemplate.seatCount} 座`);
        } catch (error) {
          this.setData({
            seatUpdatingTripId: ""
          });
          showErrorToast(error);
        }
      }
    });
  },

  handleClearTripData() {
    const pageData = this.data.pageData;
    if (!pageData?.canClearTripData || this.data.isClearingTripData || this.data.seatUpdatingTripId) {
      return;
    }

    wx.showModal({
      title: "清除所有车次信息",
      content: "将清空两辆车的座位、成员归属、标记、工具和上车记录，个人资料与首页设置会保留。",
      confirmColor: "#d64638",
      success: ({ confirm }) => {
        if (!confirm) {
          return;
        }

        this.setData({
          isClearingTripData: true
        });

        try {
          const nextPageData = tripService.clearAllTripData();
          this.setData({
            pageData: nextPageData,
            draftHomeTitle: nextPageData.homeTitle,
            draftHomeSubtitle: nextPageData.homeSubtitle,
            isClearingTripData: false
          });
          showSuccessToast("车次信息已清空");
        } catch (error) {
          this.setData({
            isClearingTripData: false
          });
          showErrorToast(error);
        }
      }
    });
  },

  handleClearLocalData() {
    const pageData = this.data.pageData;
    if (!pageData || pageData.mode !== "member" || this.data.isClearingLocalData) {
      return;
    }

    wx.showModal({
      title: "确认清除",
      content:
        "清除后，你将在当前设备上看不到自己的车次、个人信息和缓存数据，但不会影响管理员和后端数据库中的相关数据。",
      confirmColor: "#d64638",
      success: ({ confirm }) => {
        if (!confirm) {
          return;
        }

        this.setData({
          isClearingLocalData: true
        });

        try {
          tripService.clearCurrentUserLocalData();
          showSuccessToast("已清除本地数据");
          wx.switchTab({
            url: "/pages/profile/index"
          });
        } catch (error) {
          this.setData({
            isClearingLocalData: false
          });
          showErrorToast(error);
        }
      }
    });
  }
});

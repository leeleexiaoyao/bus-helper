import type { BoardingRecordPageViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast } from "../../utils/feedback";

Page({
  data: {
    pageData: null as BoardingRecordPageViewModel | null,
    selectedTripFilter: "all" as "all" | "trip1" | "trip2"
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

  refreshPage(this: { data: { selectedTripFilter: "all" | "trip1" | "trip2" } } & WechatMiniprogram.Page.Instance<any, any>, selectedTripFilter = this.data.selectedTripFilter) {
    try {
      const pageData = tripService.getBoardingRecordPageData(selectedTripFilter);
      this.setData({
        pageData
      });
    } catch (error) {
      showErrorToast(error);
    }
  },

  handleTripFilterTap(event: WechatMiniprogram.CustomEvent) {
    const selectedTripFilter = String(event.currentTarget.dataset.filter) as "all" | "trip1" | "trip2";
    if (selectedTripFilter === this.data.selectedTripFilter) {
      return;
    }

    this.setData({
      selectedTripFilter
    });
    this.refreshPage(selectedTripFilter);
  }
});

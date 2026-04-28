"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
Page({
    data: {
        pageData: null,
        selectedTripFilter: "all"
    },
    async onShow() {
        try {
            await (0, cloud_ready_1.waitForCloudReady)();
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
            return;
        }
        this.refreshPage();
    },
    refreshPage(selectedTripFilter = this.data.selectedTripFilter) {
        try {
            const pageData = trip_service_1.tripService.getBoardingRecordPageData(selectedTripFilter);
            this.setData({
                pageData
            });
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    handleTripFilterTap(event) {
        const selectedTripFilter = String(event.currentTarget.dataset.filter);
        if (selectedTripFilter === this.data.selectedTripFilter) {
            return;
        }
        this.setData({
            selectedTripFilter
        });
        this.refreshPage(selectedTripFilter);
    }
});

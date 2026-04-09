"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const feedback_1 = require("../../utils/feedback");
const format_1 = require("../../utils/format");
Page({
    data: {
        viewModel: null,
        tagsInput: "",
        previewTags: [],
        submitting: false
    },
    onShow() {
        this.refreshPage();
    },
    refreshPage() {
        try {
            const viewModel = trip_service_1.tripService.getTagEditorData();
            this.applyViewModel(viewModel);
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
            wx.switchTab({
                url: "/pages/profile/index"
            });
        }
    },
    applyViewModel(viewModel) {
        this.setData({
            viewModel,
            tagsInput: viewModel.tagsInput,
            previewTags: viewModel.previewTags
        });
    },
    handleInput(event) {
        const tagsInput = event.detail.value;
        this.setData({
            tagsInput,
            previewTags: (0, format_1.parseTags)(tagsInput)
        });
    },
    handleSave() {
        if (this.data.submitting) {
            return;
        }
        this.setData({
            submitting: true
        });
        try {
            const viewModel = trip_service_1.tripService.updateTags(this.data.tagsInput);
            this.applyViewModel(viewModel);
            (0, feedback_1.showSuccessToast)("标签已保存");
            wx.navigateBack({
                delta: 1,
                fail: () => {
                    wx.switchTab({
                        url: "/pages/profile/index"
                    });
                }
            });
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
        finally {
            this.setData({
                submitting: false
            });
        }
    }
});

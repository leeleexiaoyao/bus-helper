"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../shared/constants");
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
const format_1 = require("../../utils/format");
Page({
    data: {
        viewModel: null,
        authNickname: "",
        authAvatarUrl: "",
        currentPersonaId: "",
        currentPersonaImageUrl: "",
        personaOptions: constants_1.HOME_PERSONA_OPTIONS.map((option) => (Object.assign({}, option))),
        showPersonaSheet: false,
        personaSheetActive: false,
        personaDraftId: "",
        tagsInput: "",
        previewTags: [],
        submitting: false
    },
    personaSheetCloseTimer: 0,
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
    onUnload() {
        this.clearPersonaSheetCloseTimer();
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
            authNickname: viewModel.authNickname,
            authAvatarUrl: viewModel.authAvatarUrl,
            currentPersonaId: viewModel.currentPersonaId,
            currentPersonaImageUrl: viewModel.currentPersonaImageUrl,
            personaOptions: constants_1.HOME_PERSONA_OPTIONS.map((option) => (Object.assign({}, option))),
            showPersonaSheet: false,
            personaSheetActive: false,
            personaDraftId: viewModel.currentPersonaId,
            tagsInput: viewModel.tagsInput,
            previewTags: viewModel.previewTags
        });
    },
    handlePreviewAvatar() {
        if (!this.data.authAvatarUrl) {
            return;
        }
        wx.previewImage({
            current: this.data.authAvatarUrl,
            urls: [this.data.authAvatarUrl]
        });
    },
    handleOpenPersonaSheet() {
        this.clearPersonaSheetCloseTimer();
        this.setData({
            showPersonaSheet: true,
            personaDraftId: this.data.currentPersonaId
        });
        wx.nextTick(() => {
            this.setData({
                personaSheetActive: true
            });
        });
    },
    handlePersonaSelect(event) {
        this.setData({
            personaDraftId: String(event.detail.personaId || "")
        });
    },
    handlePersonaCancel() {
        this.closePersonaSheet();
    },
    handlePersonaConfirm(event) {
        const personaId = String(event.detail.personaId || this.data.personaDraftId || "");
        try {
            trip_service_1.tripService.updateHomePersona(personaId || null);
            this.closePersonaSheet();
            this.refreshPage();
            (0, feedback_1.showSuccessToast)("我的形象已更新");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    closePersonaSheet() {
        this.clearPersonaSheetCloseTimer();
        this.setData({
            personaSheetActive: false
        });
        this.personaSheetCloseTimer = setTimeout(() => {
            this.setData({
                showPersonaSheet: false,
                personaDraftId: this.data.currentPersonaId
            });
        }, 220);
    },
    clearPersonaSheetCloseTimer() {
        if (!this.personaSheetCloseTimer) {
            return;
        }
        clearTimeout(this.personaSheetCloseTimer);
        this.personaSheetCloseTimer = 0;
    },
    handleTagsInput(event) {
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
            const viewModel = trip_service_1.tripService.updateProfile({
                tagsInput: this.data.tagsInput
            });
            this.applyViewModel(viewModel);
            (0, feedback_1.showSuccessToast)("个人资料已保存");
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

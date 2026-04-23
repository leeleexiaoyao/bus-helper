"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../shared/constants");
const trip_service_1 = require("../../services/trip-service");
const feedback_1 = require("../../utils/feedback");
const format_1 = require("../../utils/format");
const AGE_OPTIONS = Array.from({ length: 75 }, (_, index) => index + 16);
const DEFAULT_AGE = 18;
function resolveAgePickerIndex(age) {
    const numericAge = Number(age);
    const targetAge = Number.isInteger(numericAge) && numericAge >= AGE_OPTIONS[0] && numericAge <= AGE_OPTIONS[AGE_OPTIONS.length - 1]
        ? numericAge
        : DEFAULT_AGE;
    return AGE_OPTIONS.indexOf(targetAge);
}
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
        bio: "",
        livingCity: "",
        livingRegion: [],
        hometown: "",
        hometownRegion: [],
        ageOptions: AGE_OPTIONS,
        agePickerIndex: resolveAgePickerIndex(""),
        age: String(DEFAULT_AGE),
        tagsInput: "",
        previewTags: [],
        submitting: false
    },
    personaSheetCloseTimer: 0,
    onShow() {
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
            bio: viewModel.bio,
            livingCity: viewModel.livingCity,
            livingRegion: viewModel.livingRegion,
            hometown: viewModel.hometown,
            hometownRegion: viewModel.hometownRegion,
            agePickerIndex: resolveAgePickerIndex(viewModel.age),
            age: viewModel.age || String(DEFAULT_AGE),
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
    handleFieldInput(event) {
        const field = String(event.currentTarget.dataset.field || "");
        if (!field) {
            return;
        }
        this.setData({
            [field]: event.detail.value
        });
    },
    handleTagsInput(event) {
        const tagsInput = event.detail.value;
        this.setData({
            tagsInput,
            previewTags: (0, format_1.parseTags)(tagsInput)
        });
    },
    handleLivingRegionChange(event) {
        var _a;
        const nextRegion = (_a = event.detail.value) !== null && _a !== void 0 ? _a : [];
        this.setData({
            livingRegion: nextRegion,
            livingCity: nextRegion.slice(0, 3).join("")
        });
    },
    handleHometownRegionChange(event) {
        var _a;
        const nextRegion = (_a = event.detail.value) !== null && _a !== void 0 ? _a : [];
        this.setData({
            hometownRegion: nextRegion.slice(0, 2),
            hometown: nextRegion.slice(0, 2).join("")
        });
    },
    handleAgeChange(event) {
        var _a, _b;
        const nextIndex = Number((_a = event.detail.value) !== null && _a !== void 0 ? _a : 0);
        const nextAge = (_b = this.data.ageOptions[nextIndex]) !== null && _b !== void 0 ? _b : DEFAULT_AGE;
        this.setData({
            agePickerIndex: nextIndex,
            age: String(nextAge)
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
                bio: this.data.bio,
                livingCity: this.data.livingCity,
                hometown: this.data.hometown,
                age: this.data.age,
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

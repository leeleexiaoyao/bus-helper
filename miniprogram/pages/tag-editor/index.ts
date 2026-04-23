import type { HomePersonaOption, TagEditorViewModel } from "../../shared/types";
import { HOME_PERSONA_OPTIONS } from "../../shared/constants";
import { tripService } from "../../services/trip-service";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";
import { parseTags } from "../../utils/format";

interface TagEditorPageData {
  viewModel: TagEditorViewModel | null;
  authNickname: string;
  authAvatarUrl: string;
  currentPersonaId: string;
  currentPersonaImageUrl: string;
  personaOptions: HomePersonaOption[];
  showPersonaSheet: boolean;
  personaSheetActive: boolean;
  personaDraftId: string;
  bio: string;
  livingCity: string;
  livingRegion: string[];
  hometown: string;
  hometownRegion: string[];
  ageOptions: number[];
  agePickerIndex: number;
  age: string;
  tagsInput: string;
  previewTags: string[];
  submitting: boolean;
}

const AGE_OPTIONS = Array.from({ length: 75 }, (_, index) => index + 16);
const DEFAULT_AGE = 18;

function resolveAgePickerIndex(age: string): number {
  const numericAge = Number(age);
  const targetAge =
    Number.isInteger(numericAge) && numericAge >= AGE_OPTIONS[0] && numericAge <= AGE_OPTIONS[AGE_OPTIONS.length - 1]
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
    personaOptions: HOME_PERSONA_OPTIONS.map((option) => ({ ...option })),
    showPersonaSheet: false,
    personaSheetActive: false,
    personaDraftId: "",
    bio: "",
    livingCity: "",
    livingRegion: [] as string[],
    hometown: "",
    hometownRegion: [] as string[],
    ageOptions: AGE_OPTIONS,
    agePickerIndex: resolveAgePickerIndex(""),
    age: String(DEFAULT_AGE),
    tagsInput: "",
    previewTags: [] as string[],
    submitting: false
  } as TagEditorPageData,
  personaSheetCloseTimer: 0,

  onShow() {
    this.refreshPage();
  },

  onUnload() {
    this.clearPersonaSheetCloseTimer();
  },

  refreshPage() {
    try {
      const viewModel = tripService.getTagEditorData();
      this.applyViewModel(viewModel);
    } catch (error) {
      showErrorToast(error);
      wx.switchTab({
        url: "/pages/profile/index"
      });
    }
  },

  applyViewModel(viewModel: TagEditorViewModel) {
    this.setData({
      viewModel,
      authNickname: viewModel.authNickname,
      authAvatarUrl: viewModel.authAvatarUrl,
      currentPersonaId: viewModel.currentPersonaId,
      currentPersonaImageUrl: viewModel.currentPersonaImageUrl,
      personaOptions: HOME_PERSONA_OPTIONS.map((option) => ({ ...option })),
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

  handlePersonaSelect(event: WechatMiniprogram.CustomEvent<{ personaId: string }>) {
    this.setData({
      personaDraftId: String(event.detail.personaId || "")
    });
  },

  handlePersonaCancel() {
    this.closePersonaSheet();
  },

  handlePersonaConfirm(event: WechatMiniprogram.CustomEvent<{ personaId: string }>) {
    const personaId = String(event.detail.personaId || this.data.personaDraftId || "");

    try {
      tripService.updateHomePersona(personaId || null);
      this.closePersonaSheet();
      this.refreshPage();
      showSuccessToast("我的形象已更新");
    } catch (error) {
      showErrorToast(error);
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
    }, 220) as unknown as number;
  },

  clearPersonaSheetCloseTimer() {
    if (!this.personaSheetCloseTimer) {
      return;
    }
    clearTimeout(this.personaSheetCloseTimer);
    this.personaSheetCloseTimer = 0;
  },

  handleFieldInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const field = String(event.currentTarget.dataset.field || "");
    if (!field) {
      return;
    }

    this.setData({
      [field]: event.detail.value
    });
  },

  handleTagsInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const tagsInput = event.detail.value;
    this.setData({
      tagsInput,
      previewTags: parseTags(tagsInput)
    });
  },

  handleLivingRegionChange(event: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    const nextRegion = event.detail.value ?? [];
    this.setData({
      livingRegion: nextRegion,
      livingCity: nextRegion.slice(0, 3).join("")
    });
  },

  handleHometownRegionChange(event: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    const nextRegion = event.detail.value ?? [];
    this.setData({
      hometownRegion: nextRegion.slice(0, 2),
      hometown: nextRegion.slice(0, 2).join("")
    });
  },

  handleAgeChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const nextIndex = Number(event.detail.value ?? 0);
    const nextAge = this.data.ageOptions[nextIndex] ?? DEFAULT_AGE;
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
      const viewModel = tripService.updateProfile({
        bio: this.data.bio,
        livingCity: this.data.livingCity,
        hometown: this.data.hometown,
        age: this.data.age,
        tagsInput: this.data.tagsInput
      });
      this.applyViewModel(viewModel);
      showSuccessToast("个人资料已保存");
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({
            url: "/pages/profile/index"
          });
        }
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

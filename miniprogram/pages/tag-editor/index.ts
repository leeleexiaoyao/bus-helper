import type { HomePersonaOption, TagEditorViewModel } from "../../shared/types";
import { HOME_PERSONA_OPTIONS } from "../../shared/constants";
import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
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
  tagsInput: string;
  previewTags: string[];
  submitting: boolean;
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
    tagsInput: "",
    previewTags: [] as string[],
    submitting: false
  } as TagEditorPageData,
  personaSheetCloseTimer: 0,

  async onShow() {
    try {
      await waitForCloudReady();
    } catch (error) {
      showErrorToast(error);
      return;
    }

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

  handleTagsInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const tagsInput = event.detail.value;
    this.setData({
      tagsInput,
      previewTags: parseTags(tagsInput)
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

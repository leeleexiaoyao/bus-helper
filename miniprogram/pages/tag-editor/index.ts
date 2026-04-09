import type { TagEditorViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";
import { parseTags } from "../../utils/format";

Page({
  data: {
    viewModel: null as TagEditorViewModel | null,
    tagsInput: "",
    previewTags: [] as string[],
    submitting: false
  },

  onShow() {
    this.refreshPage();
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
      tagsInput: viewModel.tagsInput,
      previewTags: viewModel.previewTags
    });
  },

  handleInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
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
      const viewModel = tripService.updateTags(this.data.tagsInput);
      this.applyViewModel(viewModel);
      showSuccessToast("标签已保存");
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

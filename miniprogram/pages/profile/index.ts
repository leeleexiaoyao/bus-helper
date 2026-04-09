import type { ProfilePageViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

Page({
  data: {
    pageData: null as ProfilePageViewModel | null,
    showAuthGate: true,
    showProfileContent: false,
    showLeaveAction: false,
    showDissolveAction: false,
    navProgress: 0,
    authPresetNickname: "",
    authPresetAvatarUrl: ""
  },

  onShow() {
    this.refreshPage();
  },

  onPageScroll(event: WechatMiniprogram.Page.IPageScrollOption) {
    const navProgress = Math.max(0, Math.min(1, event.scrollTop / 72));
    if (Math.abs(navProgress - this.data.navProgress) < 0.02) {
      return;
    }
    this.setData({
      navProgress
    });
  },

  refreshPage() {
    try {
      const pageData = tripService.getProfilePageData();
      this.setData({
        pageData,
        showAuthGate: !pageData.isAuthorized,
        showProfileContent: pageData.isAuthorized,
        showLeaveAction: pageData.primaryActionKind === "leave",
        showDissolveAction: pageData.primaryActionKind === "dissolve",
        navProgress: 0,
        authPresetNickname: pageData.currentUser.nickname,
        authPresetAvatarUrl: pageData.currentUser.avatarUrl
      });
    } catch (error) {
      showErrorToast(error);
    }
  },

  handleAuthorizeProfile(
    event: WechatMiniprogram.CustomEvent<{ nickname: string; avatarUrl: string }>
  ) {
    try {
      tripService.authorizeProfile(event.detail);
      this.refreshPage();
      showSuccessToast("授权成功");
    } catch (error) {
      showErrorToast(error);
    }
  },

  goTagEditor() {
    wx.navigateTo({
      url: "/pages/tag-editor/index"
    });
  },

  goFeedback() {
    wx.navigateTo({
      url: "/pages/feedback/index"
    });
  },

  goAbout() {
    wx.navigateTo({
      url: "/pages/about/index"
    });
  },

  handlePrimaryAction() {
    const pageData = this.data.pageData;
    if (!pageData || pageData.primaryActionKind === "none") {
      return;
    }

    const title = pageData.primaryActionKind === "dissolve" ? "解散车次" : "退出车次";
    const content =
      pageData.primaryActionKind === "dissolve"
        ? "解散后，所有成员都会退出车次并清空座位绑定。"
        : "退出后会释放你的座位，并回到未加入车次状态。";

    wx.showModal({
      title,
      content,
      success: ({ confirm }) => {
        if (!confirm) {
          return;
        }

        try {
          if (pageData.primaryActionKind === "dissolve") {
            tripService.dissolveCurrentTrip();
            showSuccessToast("车次已解散");
          } else {
            tripService.leaveCurrentTrip();
            showSuccessToast("已退出车次");
          }
          this.refreshPage();
        } catch (error) {
          showErrorToast(error);
        }
      }
    });
  },

  handleSwitchDemoUser(event: WechatMiniprogram.CustomEvent) {
    const userId = String(event.currentTarget.dataset.userId);
    try {
      tripService.switchActiveUser(userId);
      this.refreshPage();
      showSuccessToast("已切换身份");
    } catch (error) {
      showErrorToast(error);
    }
  }
});

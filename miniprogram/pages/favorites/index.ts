import type { FavoritePageViewModel } from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

Page({
  data: {
    pageData: null as FavoritePageViewModel | null,
    showAuthGate: true,
    showPageContent: false,
    showEmptyState: false,
    authPresetNickname: "",
    authPresetAvatarUrl: "",
    activeTab: "mine" as "mine" | "ranking",
    isMineTab: true,
    isRankingTab: false
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
      const pageData = tripService.getFavoritesPageData();
      const activeTab =
        this.data.activeTab === "ranking" && !pageData.showRankingTab ? "mine" : this.data.activeTab;
      const showEmptyState =
        !pageData.hasCurrentTrip ||
        (pageData.favorites.length === 0 && (!pageData.showRankingTab || pageData.ranking.length === 0));
      this.setData({
        pageData,
        showAuthGate: !pageData.isAuthorized,
        showPageContent: pageData.isAuthorized,
        showEmptyState,
        authPresetNickname: pageData.currentUser.nickname,
        authPresetAvatarUrl: pageData.currentUser.avatarUrl,
        activeTab,
        isMineTab: activeTab === "mine",
        isRankingTab: activeTab === "ranking"
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

  handleTabChange(event: WechatMiniprogram.CustomEvent) {
    const nextTab = String(event.currentTarget.dataset.tab) === "ranking" ? "ranking" : "mine";
    this.setData({
      activeTab: nextTab,
      isMineTab: nextTab === "mine",
      isRankingTab: nextTab === "ranking"
    });
  }
});

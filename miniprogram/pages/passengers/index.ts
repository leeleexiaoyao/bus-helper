import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import type {
  MemberDetailMode,
  PassengerFilterOptionView,
  PassengerMemberGroupView,
  PassengerMemberView,
  PassengerPageViewModel
} from "../../shared/types";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

interface PassengerPageData {
  pageData: PassengerPageViewModel | null;
  navProgress: number;
  filterOptions: PassengerFilterOptionView[];
  visibleGroups: PassengerMemberGroupView[];
  activeFilterId: string;
  sheetVisible: boolean;
  sheetMode: MemberDetailMode;
  selectedMember: PassengerMemberView | null;
}

interface ApplyPageOptions {
  preserveSelectedMemberKey?: string | null;
}

const initialData: PassengerPageData = {
  pageData: null,
  navProgress: 0,
  filterOptions: [],
  visibleGroups: [],
  activeFilterId: "all",
  sheetVisible: false,
  sheetMode: "member-detail",
  selectedMember: null
};

Page({
  data: initialData,

  async onShow() {
    try {
      await waitForCloudReady();
    } catch (error) {
      showErrorToast(error);
      return;
    }

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
      this.applyPageData(tripService.getPassengerPageData());
    } catch (error) {
      showErrorToast(error);
    }
  },

  applyPageData(pageData: PassengerPageViewModel, options: ApplyPageOptions = {}) {
    const activeFilterId = pageData.filterOptions.some((option) => option.id === this.data.activeFilterId)
      ? this.data.activeFilterId
      : "all";
    const filterOptions = pageData.filterOptions.map((option) => ({
      ...option,
      isSelected: option.id === activeFilterId
    }));
    const visibleGroups = this.filterGroups(pageData.memberGroups, activeFilterId);
    const preservedMember = options.preserveSelectedMemberKey
      ? this.findMemberByKey(pageData.memberGroups, options.preserveSelectedMemberKey)
      : null;

    this.setData({
      pageData,
      navProgress: 0,
      filterOptions,
      visibleGroups,
      activeFilterId,
      sheetVisible: Boolean(preservedMember),
      sheetMode: preservedMember?.detailMode ?? "member-detail",
      selectedMember: preservedMember
    });
  },

  filterGroups(groups: PassengerMemberGroupView[], activeFilterId: string): PassengerMemberGroupView[] {
    if (activeFilterId === "all") {
      return groups;
    }

    return groups.filter((group) => group.tripId === activeFilterId);
  },

  findMemberByKey(
    groups: PassengerMemberGroupView[],
    memberKey: string
  ): PassengerMemberView | null {
    for (const group of groups) {
      const member = group.members.find((item) => this.getMemberKey(item) === memberKey);
      if (member) {
        return member;
      }
    }

    return null;
  },

  getMemberKey(member: PassengerMemberView): string {
    return `${member.tripId}:${member.userId}`;
  },

  handleFilterChange(event: WechatMiniprogram.CustomEvent) {
    const filterId = String(event.currentTarget.dataset.filterId || "all");
    if (!this.data.pageData || filterId === this.data.activeFilterId) {
      return;
    }

    this.setData({
      activeFilterId: filterId,
      filterOptions: this.data.pageData.filterOptions.map((option) => ({
        ...option,
        isSelected: option.id === filterId
      })),
      visibleGroups: this.filterGroups(this.data.pageData.memberGroups, filterId)
    });
  },

  handleMemberTap(event: WechatMiniprogram.CustomEvent<{ member: PassengerMemberView }>) {
    const member = event.detail.member;
    if (!member) {
      return;
    }

    this.setData({
      sheetVisible: true,
      sheetMode: member.detailMode,
      selectedMember: member
    });
  },

  handleSheetClose() {
    this.setData({
      sheetVisible: false,
      selectedMember: null
    });
  },

  handleReleaseMine() {
    const memberKey = this.data.selectedMember ? this.getMemberKey(this.data.selectedMember) : null;

    try {
      tripService.releaseMySeat();
      this.applyPageData(tripService.getPassengerPageData(), {
        preserveSelectedMemberKey: memberKey
      });
      showSuccessToast("座位已解除");
    } catch (error) {
      showErrorToast(error);
    }
  },

  handleAdminRelease() {
    if (!this.data.selectedMember) {
      return;
    }

    const memberKey = this.getMemberKey(this.data.selectedMember);

    try {
      tripService.adminReleaseSeat(this.data.selectedMember.userId);
      this.applyPageData(tripService.getPassengerPageData(), {
        preserveSelectedMemberKey: memberKey
      });
      showSuccessToast("已解除对方座位");
    } catch (error) {
      showErrorToast(error);
    }
  },

  handleToggleFavorite() {
    if (!this.data.selectedMember) {
      return;
    }

    const memberKey = this.getMemberKey(this.data.selectedMember);
    const wasFavorited = this.data.selectedMember.isFavoritedByViewer;

    try {
      tripService.toggleFavoriteMember(this.data.selectedMember.userId);
      this.applyPageData(tripService.getPassengerPageData(), {
        preserveSelectedMemberKey: memberKey
      });
      showSuccessToast(wasFavorited ? "已取消标记" : "已标记");
    } catch (error) {
      showErrorToast(error);
    }
  }
});

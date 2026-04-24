import { tripService } from "../../services/trip-service";
import { HOME_PERSONA_OPTIONS } from "../../shared/constants";
import { waitForCloudReady } from "../../utils/cloud-ready";
import type {
  BootstrapResult,
  CurrentTripViewModel,
  HomePersonaOption,
  MemberView,
  SeatCellView,
  User
} from "../../shared/types";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

type SheetMode =
  | "empty-confirm"
  | "self-detail"
  | "member-detail"
  | "admin-member-detail";

interface HomePageData {
  showAuthGate: boolean;
  showTripContent: boolean;
  showTripEntry: boolean;
  hasCurrentTrip: boolean;
  navTitle: string;
  navProgress: number;
  isSeatsTab: boolean;
  isMembersTab: boolean;
  seatsTabClassName: string;
  membersTabClassName: string;
  currentUser: User | null;
  currentUserInitial: string;
  authPresetNickname: string;
  authPresetAvatarUrl: string;
  currentTrip: CurrentTripViewModel | null;
  seatedMembers: MemberView[];
  viewerSeatText: string;
  currentPersonaId: string;
  currentPersonaImageUrl: string;
  personaOptions: HomePersonaOption[];
  showPersonaSheet: boolean;
  personaSheetActive: boolean;
  personaDraftId: string;
  activeTab: "seats" | "members";
  sheetVisible: boolean;
  sheetMode: SheetMode;
  selectedSeat: SeatCellView | null;
  selectedMember: MemberView | null;
}

interface ApplyBootstrapOptions {
  preserveSelectedMemberId?: string | null;
}

const initialData: HomePageData = {
  showAuthGate: true,
  showTripContent: false,
  showTripEntry: false,
  hasCurrentTrip: false,
  navTitle: "巴士认座",
  navProgress: 0,
  isSeatsTab: true,
  isMembersTab: false,
  seatsTabClassName: "home-tab is-active",
  membersTabClassName: "home-tab",
  currentUser: null,
  currentUserInitial: "我",
  authPresetNickname: "",
  authPresetAvatarUrl: "",
  currentTrip: null,
  seatedMembers: [],
  viewerSeatText: "未入座",
  currentPersonaId: "",
  currentPersonaImageUrl: "",
  personaOptions: HOME_PERSONA_OPTIONS.map((option) => ({
    ...option
  })),
  showPersonaSheet: false,
  personaSheetActive: false,
  personaDraftId: "",
  activeTab: "seats",
  sheetVisible: false,
  sheetMode: "member-detail",
  selectedSeat: null,
  selectedMember: null
};

function resolveHomePersonaImageUrl(user: User): string {
  if (!user.homePersonaAssetId) {
    return "";
  }
  return HOME_PERSONA_OPTIONS.find((option) => option.id === user.homePersonaAssetId)?.imageUrl ?? "";
}

Page({
  data: initialData,
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
      const result = tripService.bootstrapApp();
      this.applyBootstrapResult(result);
    } catch (error) {
      showErrorToast(error);
    }
  },

  applyBootstrapResult(result: BootstrapResult, options: ApplyBootstrapOptions = {}) {
    const showAuthGate = !result.currentUser.isAuthorized;
    const hasCurrentTrip = result.currentUser.isAuthorized && Boolean(result.currentTrip);
    const showTripEntry = result.currentUser.isAuthorized && !result.currentTrip;
    const activeTab = this.data.activeTab;
    const currentPersonaId = result.currentUser.homePersonaAssetId ?? "";
    const currentPersonaImageUrl = resolveHomePersonaImageUrl(result.currentUser);
    const preservedMember =
      options.preserveSelectedMemberId && result.currentTrip
        ? result.currentTrip.members.find((member) => member.userId === options.preserveSelectedMemberId) ?? null
        : null;

    this.setData({
      showAuthGate,
      showTripContent: hasCurrentTrip,
      showTripEntry,
      hasCurrentTrip,
      navTitle: result.currentTrip?.tripMeta.tripName ?? "巴士认座",
      navProgress: 0,
      isSeatsTab: activeTab === "seats",
      isMembersTab: activeTab === "members",
      seatsTabClassName: activeTab === "seats" ? "home-tab is-active" : "home-tab",
      membersTabClassName: activeTab === "members" ? "home-tab is-active" : "home-tab",
      currentUser: result.currentUser,
      currentUserInitial: result.currentUser.nickname.trim().slice(0, 1) || "我",
      authPresetNickname: result.currentUser.nickname,
      authPresetAvatarUrl: result.currentUser.avatarUrl,
      currentTrip: hasCurrentTrip ? result.currentTrip : null,
      seatedMembers: (result.currentTrip?.members ?? []).filter((member) => Boolean(member.seatCode)),
      viewerSeatText: result.currentTrip?.tripMeta.viewerSeatCode ?? "请选择您的座位",
      currentPersonaId,
      currentPersonaImageUrl,
      personaOptions: HOME_PERSONA_OPTIONS.map((option) => ({ ...option })),
      showPersonaSheet: false,
      personaSheetActive: false,
      personaDraftId: currentPersonaId,
      sheetVisible: Boolean(preservedMember),
      sheetMode: preservedMember
        ? this.resolveMemberSheetMode(preservedMember, result.currentTrip)
        : "member-detail",
      selectedSeat: preservedMember
        ? this.findSeatByCode(preservedMember.seatCode ?? null, result.currentTrip)
        : null,
      selectedMember: preservedMember
    });
  },

  handleAuthorizeProfile(
    event: WechatMiniprogram.CustomEvent<{ nickname: string; avatarUrl: string }>
  ) {
    try {
      const result = tripService.authorizeProfile(event.detail);
      this.applyBootstrapResult(result);
      showSuccessToast("授权成功");
    } catch (error) {
      showErrorToast(error);
    }
  },

  goCreateTrip() {
    wx.navigateTo({
      url: "/pages/create-trip/index"
    });
  },

  goJoinTrip() {
    wx.navigateTo({
      url: "/pages/join-trip/index"
    });
  },

  handleTabChange(event: WechatMiniprogram.CustomEvent) {
    const nextTab = String(event.currentTarget.dataset.tab) as "seats" | "members";
    this.setData({
      activeTab: nextTab,
      isSeatsTab: nextTab === "seats",
      isMembersTab: nextTab === "members",
      seatsTabClassName: nextTab === "seats" ? "home-tab is-active" : "home-tab",
      membersTabClassName: nextTab === "members" ? "home-tab is-active" : "home-tab"
    });
  },

  handleOpenPersonaSheet() {
    const personaDraftId = this.data.currentPersonaId;
    this.clearPersonaSheetCloseTimer();
    this.setData({
      showPersonaSheet: true,
      personaDraftId
    });
    wx.nextTick(() => {
      this.setData({
        personaSheetActive: true
      });
    });
  },

  handlePersonaSelect(event: WechatMiniprogram.CustomEvent) {
    const personaId = String(event.detail.personaId || "");
    this.setData({
      personaDraftId: personaId
    });
  },

  handlePersonaCancel() {
    this.closePersonaSheet();
  },

  handlePersonaConfirm() {
    try {
      const result = tripService.updateHomePersona(this.data.personaDraftId || null);
      this.applyBootstrapResult(result);
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

  noop() {},

  getSelfMember(): MemberView | null {
    return this.data.currentTrip?.members.find((member) => member.isSelf) ?? null;
  },

  findSeatByCode(
    this: { data: HomePageData },
    seatCode: string | null,
    currentTrip?: CurrentTripViewModel | null
  ): SeatCellView | null {
    if (!seatCode) {
      return null;
    }

    const rows = (currentTrip ?? this.data.currentTrip)?.seatRows ?? [];
    for (const row of rows) {
      for (const seat of row.slots) {
        if (seat?.code === seatCode) {
          return seat;
        }
      }
    }
    return null;
  },

  resolveMemberSheetMode(
    this: { data: HomePageData },
    member: MemberView | null,
    currentTrip?: CurrentTripViewModel | null
  ): SheetMode {
    if (!member) {
      return "member-detail";
    }
    if (member.isSelf) {
      return "self-detail";
    }
    return (currentTrip ?? this.data.currentTrip)?.tripMeta.viewerRole === "admin"
      ? "admin-member-detail"
      : "member-detail";
  },

  handleSeatTap(event: WechatMiniprogram.CustomEvent<{ seat: SeatCellView }>) {
    const seat = event.detail.seat;
    if (!seat) {
      return;
    }

    if (seat.isEmpty) {
      this.setData({
        sheetVisible: true,
        sheetMode: "empty-confirm",
        selectedSeat: seat,
        selectedMember: null
      });
      return;
    }

    const targetMember =
      this.data.currentTrip?.members.find((member) => member.userId === seat.occupant?.userId) ?? null;

    if (seat.isMine) {
      this.setData({
        sheetVisible: true,
        sheetMode: "self-detail",
        selectedSeat: seat,
        selectedMember: targetMember ?? this.getSelfMember()
      });
      return;
    }

    this.setData({
      sheetVisible: true,
      sheetMode: this.resolveMemberSheetMode(targetMember),
      selectedSeat: seat,
      selectedMember: targetMember
    });
  },

  handleMemberTap(event: WechatMiniprogram.CustomEvent<{ member: MemberView }>) {
    const member = event.detail.member;
    this.setData({
      sheetVisible: true,
      sheetMode: this.resolveMemberSheetMode(member),
      selectedMember: member,
      selectedSeat: this.findSeatByCode(member?.seatCode ?? null)
    });
  },

  handleSheetClose() {
    this.setData({
      sheetVisible: false,
      selectedSeat: null,
      selectedMember: null
    });
  },

  handleClaimConfirm() {
    if (!this.data.selectedSeat) {
      return;
    }

    try {
      const result = this.data.currentTrip?.tripMeta.viewerSeatCode
        ? tripService.switchSeat(this.data.selectedSeat.code)
        : tripService.claimSeat(this.data.selectedSeat.code);
      this.applyBootstrapResult(result);
      showSuccessToast("入座成功");
    } catch (error) {
      showErrorToast(error);
    }
  },

  handleReleaseMine() {
    try {
      const result = tripService.releaseMySeat();
      this.applyBootstrapResult(result);
      showSuccessToast("座位已解除");
    } catch (error) {
      showErrorToast(error);
    }
  },

  handleAdminRelease() {
    if (!this.data.selectedMember) {
      return;
    }

    try {
      const result = tripService.adminReleaseSeat(this.data.selectedMember.userId);
      this.applyBootstrapResult(result);
      showSuccessToast("已解除对方座位");
    } catch (error) {
      showErrorToast(error);
    }
  },

  handleToggleFavorite() {
    if (!this.data.selectedMember) {
      return;
    }

    const targetUserId = this.data.selectedMember.userId;
    const wasFavorited = this.data.selectedMember.isFavoritedByViewer;
    try {
      const result = tripService.toggleFavoriteMember(targetUserId);
      this.applyBootstrapResult(result, {
        preserveSelectedMemberId: targetUserId
      });
      showSuccessToast(wasFavorited ? "已取消收藏" : "已收藏");
    } catch (error) {
      showErrorToast(error);
    }
  },

  onUnload() {
    this.clearPersonaSheetCloseTimer();
  }
});

import { tripService } from "../../services/trip-service";
import { HOME_PERSONA_OPTIONS } from "../../shared/constants";
import { waitForCloudReady } from "../../utils/cloud-ready";
import type {
  BoardingButtonView,
  BootstrapResult,
  CurrentTripViewModel,
  HomePersonaOption,
  MemberView,
  SeatCellView,
  TripSwitchOption,
  User
} from "../../shared/types";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

type SheetMode =
  | "empty-confirm"
  | "self-detail"
  | "member-detail"
  | "admin-member-detail";

interface HomePageData {
  showTripContent: boolean;
  hasCurrentTrip: boolean;
  navTitle: string;
  currentTripLabel: string;
  navProgress: number;
  currentUser: User | null;
  currentUserInitial: string;
  currentTrip: CurrentTripViewModel | null;
  viewerSeatSummary: string;
  boardingButton: BoardingButtonView;
  tripSwitchOptions: TripSwitchOption[];
  currentPersonaId: string;
  currentPersonaImageUrl: string;
  personaOptions: HomePersonaOption[];
  showPersonaSheet: boolean;
  personaSheetActive: boolean;
  personaDraftId: string;
  sheetVisible: boolean;
  sheetMode: SheetMode;
  seatConfirmTitle: string;
  selectedSeat: SeatCellView | null;
  selectedMember: MemberView | null;
}

interface ApplyBootstrapOptions {
  preserveSelectedMemberId?: string | null;
}

const initialData: HomePageData = {
  showTripContent: false,
  hasCurrentTrip: false,
  navTitle: "麒麟之旅",
  currentTripLabel: "1车",
  navProgress: 0,
  currentUser: null,
  currentUserInitial: "我",
  currentTrip: null,
  viewerSeatSummary: "1车 未入座",
  boardingButton: {
    label: "上车",
    isActive: false,
    isDisabled: true,
    nextRefreshAt: null,
    disabledReason: "unseated"
  },
  tripSwitchOptions: [],
  currentPersonaId: "",
  currentPersonaImageUrl: "",
  personaOptions: HOME_PERSONA_OPTIONS.map((option) => ({
    ...option
  })),
  showPersonaSheet: false,
  personaSheetActive: false,
  personaDraftId: "",
  sheetVisible: false,
  sheetMode: "member-detail",
  seatConfirmTitle: "",
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
  boardingButtonRefreshTimer: 0,

  async onShow() {
    try {
      await waitForCloudReady();
    } catch (error) {
      showErrorToast(error);
      return;
    }

    this.refreshPage();
  },

  onHide() {
    this.clearBoardingButtonRefreshTimer();
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
    const hasCurrentTrip = Boolean(result.currentTrip);
    const currentPersonaId = result.currentUser.homePersonaAssetId ?? "";
    const currentPersonaImageUrl = resolveHomePersonaImageUrl(result.currentUser);
    const preservedMember =
      options.preserveSelectedMemberId
        ? result.currentTrip.members.find((member) => member.userId === options.preserveSelectedMemberId) ?? null
        : null;

    this.setData({
      showTripContent: hasCurrentTrip,
      hasCurrentTrip,
      navTitle: result.homeTitle,
      currentTripLabel: result.currentTripLabel,
      navProgress: 0,
      currentUser: result.currentUser,
      currentUserInitial: result.currentUser.nickname.trim().slice(0, 1) || "我",
      currentTrip: result.currentTrip,
      viewerSeatSummary: result.viewerSeatSummary,
      boardingButton: result.boardingButton,
      tripSwitchOptions: result.tripSwitchOptions,
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
      seatConfirmTitle: "",
      selectedSeat: preservedMember
        ? this.findSeatByCode(preservedMember.seatCode ?? null, result.currentTrip)
        : null,
      selectedMember: preservedMember
    });
    this.syncBoardingButtonRefreshTimer(result.boardingButton);
  },

  handleOpenTripSwitcher() {
    const options = this.data.tripSwitchOptions;
    if (!options.length) {
      return;
    }

    wx.showActionSheet({
      itemList: options.map((option) => option.label),
      success: ({ tapIndex }) => {
        const selectedOption = options[tapIndex];
        if (!selectedOption || selectedOption.tripId === this.data.currentTrip?.tripMeta.tripId) {
          return;
        }

        try {
          const result = tripService.switchCurrentTrip(selectedOption.tripId);
          this.applyBootstrapResult(result);
        } catch (error) {
          showErrorToast(error);
        }
      }
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

  syncBoardingButtonRefreshTimer(boardingButton: BoardingButtonView) {
    this.clearBoardingButtonRefreshTimer();
    if (!boardingButton.nextRefreshAt) {
      return;
    }

    const delay = Math.max(0, boardingButton.nextRefreshAt - Date.now() + 50);
    this.boardingButtonRefreshTimer = setTimeout(() => {
      this.refreshPage();
    }, delay) as unknown as number;
  },

  clearBoardingButtonRefreshTimer() {
    if (!this.boardingButtonRefreshTimer) {
      return;
    }
    clearTimeout(this.boardingButtonRefreshTimer);
    this.boardingButtonRefreshTimer = 0;
  },

  noop() {},

  handleBoardingTap() {
    if (this.data.boardingButton.isDisabled) {
      if (this.data.boardingButton.disabledReason === "seat-in-other-trip") {
        showErrorToast(new Error("请先释放座位"));
        return;
      }
      if (this.data.boardingButton.disabledReason === "unseated") {
        showErrorToast(new Error("请先入座"));
      }
      return;
    }

    try {
      const toggleResult = tripService.toggleBoardingCheckIn();
      this.applyBootstrapResult(toggleResult.result);
      showSuccessToast(toggleResult.action === "checked-in" ? "上车成功" : "已取消上车");
    } catch (error) {
      showErrorToast(error);
    }
  },

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
      if (!this.data.currentUser?.isAuthorized) {
        showErrorToast(new Error("请先完成微信授权。"));
        return;
      }
      const userHasGlobalSeat =
        Boolean(this.data.currentTrip?.tripMeta.viewerSeatCode) ||
        !this.data.viewerSeatSummary.endsWith("未入座");
      this.setData({
        sheetVisible: true,
        sheetMode: "empty-confirm",
        seatConfirmTitle: userHasGlobalSeat
          ? `是否改到${this.data.currentTripLabel}${seat.label}？`
          : `是否入座${this.data.currentTripLabel}${seat.label}？`,
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

  handleSheetClose() {
    this.setData({
      sheetVisible: false,
      seatConfirmTitle: "",
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
      showSuccessToast(wasFavorited ? "已取消标记" : "已标记");
    } catch (error) {
      showErrorToast(error);
    }
  },

  onUnload() {
    this.clearBoardingButtonRefreshTimer();
    this.clearPersonaSheetCloseTimer();
  }
});

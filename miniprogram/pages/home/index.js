"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const constants_1 = require("../../shared/constants");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
const initialData = {
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
    personaOptions: constants_1.HOME_PERSONA_OPTIONS.map((option) => (Object.assign({}, option))),
    showPersonaSheet: false,
    personaSheetActive: false,
    personaDraftId: "",
    sheetVisible: false,
    sheetMode: "member-detail",
    seatConfirmTitle: "",
    selectedSeat: null,
    selectedMember: null
};
function resolveHomePersonaImageUrl(user) {
    var _a, _b;
    if (!user.homePersonaAssetId) {
        return "";
    }
    return (_b = (_a = constants_1.HOME_PERSONA_OPTIONS.find((option) => option.id === user.homePersonaAssetId)) === null || _a === void 0 ? void 0 : _a.imageUrl) !== null && _b !== void 0 ? _b : "";
}
Page({
    data: initialData,
    personaSheetCloseTimer: 0,
    boardingButtonRefreshTimer: 0,
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
    onHide() {
        this.clearBoardingButtonRefreshTimer();
    },
    onPageScroll(event) {
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
            const result = trip_service_1.tripService.bootstrapApp();
            this.applyBootstrapResult(result);
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    applyBootstrapResult(result, options = {}) {
        var _a, _b, _c;
        const hasCurrentTrip = Boolean(result.currentTrip);
        const currentPersonaId = (_a = result.currentUser.homePersonaAssetId) !== null && _a !== void 0 ? _a : "";
        const currentPersonaImageUrl = resolveHomePersonaImageUrl(result.currentUser);
        const preservedMember = options.preserveSelectedMemberId
            ? (_b = result.currentTrip.members.find((member) => member.userId === options.preserveSelectedMemberId)) !== null && _b !== void 0 ? _b : null
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
            personaOptions: constants_1.HOME_PERSONA_OPTIONS.map((option) => (Object.assign({}, option))),
            showPersonaSheet: false,
            personaSheetActive: false,
            personaDraftId: currentPersonaId,
            sheetVisible: Boolean(preservedMember),
            sheetMode: preservedMember
                ? this.resolveMemberSheetMode(preservedMember, result.currentTrip)
                : "member-detail",
            seatConfirmTitle: "",
            selectedSeat: preservedMember
                ? this.findSeatByCode((_c = preservedMember.seatCode) !== null && _c !== void 0 ? _c : null, result.currentTrip)
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
                var _a;
                const selectedOption = options[tapIndex];
                if (!selectedOption || selectedOption.tripId === ((_a = this.data.currentTrip) === null || _a === void 0 ? void 0 : _a.tripMeta.tripId)) {
                    return;
                }
                try {
                    const result = trip_service_1.tripService.switchCurrentTrip(selectedOption.tripId);
                    this.applyBootstrapResult(result);
                }
                catch (error) {
                    (0, feedback_1.showErrorToast)(error);
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
    handlePersonaSelect(event) {
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
            const result = trip_service_1.tripService.updateHomePersona(this.data.personaDraftId || null);
            this.applyBootstrapResult(result);
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
    syncBoardingButtonRefreshTimer(boardingButton) {
        this.clearBoardingButtonRefreshTimer();
        if (!boardingButton.nextRefreshAt) {
            return;
        }
        const delay = Math.max(0, boardingButton.nextRefreshAt - Date.now() + 50);
        this.boardingButtonRefreshTimer = setTimeout(() => {
            this.refreshPage();
        }, delay);
    },
    clearBoardingButtonRefreshTimer() {
        if (!this.boardingButtonRefreshTimer) {
            return;
        }
        clearTimeout(this.boardingButtonRefreshTimer);
        this.boardingButtonRefreshTimer = 0;
    },
    noop() { },
    handleBoardingTap() {
        if (this.data.boardingButton.isDisabled) {
            if (this.data.boardingButton.disabledReason === "seat-in-other-trip") {
                (0, feedback_1.showErrorToast)(new Error("请先释放座位"));
                return;
            }
            if (this.data.boardingButton.disabledReason === "unseated") {
                (0, feedback_1.showErrorToast)(new Error("请先入座"));
            }
            return;
        }
        try {
            const toggleResult = trip_service_1.tripService.toggleBoardingCheckIn();
            this.applyBootstrapResult(toggleResult.result);
            (0, feedback_1.showSuccessToast)(toggleResult.action === "checked-in" ? "上车成功" : "已取消上车");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    getSelfMember() {
        var _a, _b;
        return (_b = (_a = this.data.currentTrip) === null || _a === void 0 ? void 0 : _a.members.find((member) => member.isSelf)) !== null && _b !== void 0 ? _b : null;
    },
    findSeatByCode(seatCode, currentTrip) {
        var _a, _b;
        if (!seatCode) {
            return null;
        }
        const rows = (_b = (_a = (currentTrip !== null && currentTrip !== void 0 ? currentTrip : this.data.currentTrip)) === null || _a === void 0 ? void 0 : _a.seatRows) !== null && _b !== void 0 ? _b : [];
        for (const row of rows) {
            for (const seat of row.slots) {
                if ((seat === null || seat === void 0 ? void 0 : seat.code) === seatCode) {
                    return seat;
                }
            }
        }
        return null;
    },
    resolveMemberSheetMode(member, currentTrip) {
        var _a;
        if (!member) {
            return "member-detail";
        }
        if (member.isSelf) {
            return "self-detail";
        }
        return ((_a = (currentTrip !== null && currentTrip !== void 0 ? currentTrip : this.data.currentTrip)) === null || _a === void 0 ? void 0 : _a.tripMeta.viewerRole) === "admin"
            ? "admin-member-detail"
            : "member-detail";
    },
    handleSeatTap(event) {
        var _a, _b, _c, _d;
        const seat = event.detail.seat;
        if (!seat) {
            return;
        }
        if (seat.isEmpty) {
            if (!((_a = this.data.currentUser) === null || _a === void 0 ? void 0 : _a.isAuthorized)) {
                (0, feedback_1.showErrorToast)(new Error("请先完成微信授权。"));
                return;
            }
            const userHasGlobalSeat = Boolean((_b = this.data.currentTrip) === null || _b === void 0 ? void 0 : _b.tripMeta.viewerSeatCode) ||
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
        const targetMember = (_d = (_c = this.data.currentTrip) === null || _c === void 0 ? void 0 : _c.members.find((member) => { var _a; return member.userId === ((_a = seat.occupant) === null || _a === void 0 ? void 0 : _a.userId); })) !== null && _d !== void 0 ? _d : null;
        if (seat.isMine) {
            this.setData({
                sheetVisible: true,
                sheetMode: "self-detail",
                selectedSeat: seat,
                selectedMember: targetMember !== null && targetMember !== void 0 ? targetMember : this.getSelfMember()
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
        var _a;
        if (!this.data.selectedSeat) {
            return;
        }
        try {
            const result = ((_a = this.data.currentTrip) === null || _a === void 0 ? void 0 : _a.tripMeta.viewerSeatCode)
                ? trip_service_1.tripService.switchSeat(this.data.selectedSeat.code)
                : trip_service_1.tripService.claimSeat(this.data.selectedSeat.code);
            this.applyBootstrapResult(result);
            (0, feedback_1.showSuccessToast)("入座成功");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    handleReleaseMine() {
        try {
            const result = trip_service_1.tripService.releaseMySeat();
            this.applyBootstrapResult(result);
            (0, feedback_1.showSuccessToast)("座位已解除");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    handleAdminRelease() {
        if (!this.data.selectedMember) {
            return;
        }
        try {
            const result = trip_service_1.tripService.adminReleaseSeat(this.data.selectedMember.userId);
            this.applyBootstrapResult(result);
            (0, feedback_1.showSuccessToast)("已解除对方座位");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    handleToggleFavorite() {
        if (!this.data.selectedMember) {
            return;
        }
        const targetUserId = this.data.selectedMember.userId;
        const wasFavorited = this.data.selectedMember.isFavoritedByViewer;
        try {
            const result = trip_service_1.tripService.toggleFavoriteMember(targetUserId);
            this.applyBootstrapResult(result, {
                preserveSelectedMemberId: targetUserId
            });
            (0, feedback_1.showSuccessToast)(wasFavorited ? "已取消标记" : "已标记");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    onUnload() {
        this.clearBoardingButtonRefreshTimer();
        this.clearPersonaSheetCloseTimer();
    }
});

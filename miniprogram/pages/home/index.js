"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const constants_1 = require("../../shared/constants");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
const initialData = {
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
    personaOptions: constants_1.HOME_PERSONA_OPTIONS.map((option) => (Object.assign({}, option))),
    showPersonaSheet: false,
    personaSheetActive: false,
    personaDraftId: "",
    activeTab: "seats",
    sheetVisible: false,
    sheetMode: "member-detail",
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const showAuthGate = !result.currentUser.isAuthorized;
        const hasCurrentTrip = result.currentUser.isAuthorized && Boolean(result.currentTrip);
        const showTripEntry = result.currentUser.isAuthorized && !result.currentTrip;
        const activeTab = this.data.activeTab;
        const currentPersonaId = (_a = result.currentUser.homePersonaAssetId) !== null && _a !== void 0 ? _a : "";
        const currentPersonaImageUrl = resolveHomePersonaImageUrl(result.currentUser);
        const preservedMember = options.preserveSelectedMemberId && result.currentTrip
            ? (_b = result.currentTrip.members.find((member) => member.userId === options.preserveSelectedMemberId)) !== null && _b !== void 0 ? _b : null
            : null;
        this.setData({
            showAuthGate,
            showTripContent: hasCurrentTrip,
            showTripEntry,
            hasCurrentTrip,
            navTitle: (_d = (_c = result.currentTrip) === null || _c === void 0 ? void 0 : _c.tripMeta.tripName) !== null && _d !== void 0 ? _d : "巴士认座",
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
            seatedMembers: ((_f = (_e = result.currentTrip) === null || _e === void 0 ? void 0 : _e.members) !== null && _f !== void 0 ? _f : []).filter((member) => Boolean(member.seatCode)),
            viewerSeatText: (_h = (_g = result.currentTrip) === null || _g === void 0 ? void 0 : _g.tripMeta.viewerSeatCode) !== null && _h !== void 0 ? _h : "请选择您的座位",
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
            selectedSeat: preservedMember
                ? this.findSeatByCode((_j = preservedMember.seatCode) !== null && _j !== void 0 ? _j : null, result.currentTrip)
                : null,
            selectedMember: preservedMember
        });
    },
    handleAuthorizeProfile(event) {
        try {
            const result = trip_service_1.tripService.authorizeProfile(event.detail);
            this.applyBootstrapResult(result);
            (0, feedback_1.showSuccessToast)("授权成功");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
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
    handleTabChange(event) {
        const nextTab = String(event.currentTarget.dataset.tab);
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
    noop() { },
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
        var _a, _b;
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
        const targetMember = (_b = (_a = this.data.currentTrip) === null || _a === void 0 ? void 0 : _a.members.find((member) => { var _a; return member.userId === ((_a = seat.occupant) === null || _a === void 0 ? void 0 : _a.userId); })) !== null && _b !== void 0 ? _b : null;
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
    handleMemberTap(event) {
        var _a;
        const member = event.detail.member;
        this.setData({
            sheetVisible: true,
            sheetMode: this.resolveMemberSheetMode(member),
            selectedMember: member,
            selectedSeat: this.findSeatByCode((_a = member === null || member === void 0 ? void 0 : member.seatCode) !== null && _a !== void 0 ? _a : null)
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
            (0, feedback_1.showSuccessToast)(wasFavorited ? "已取消收藏" : "已收藏");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    onUnload() {
        this.clearPersonaSheetCloseTimer();
    }
});

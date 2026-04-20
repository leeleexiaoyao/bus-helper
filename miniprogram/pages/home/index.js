"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const constants_1 = require("../../shared/constants");
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
    personaOptions: constants_1.HOME_PERSONA_OPTIONS.map((option) => (Object.assign(Object.assign({}, option), { className: "persona-option" }))),
    showPersonaSheet: false,
    personaSheetActive: false,
    personaDraftId: "",
    activeTab: "seats",
    sheetVisible: false,
    sheetMode: "detail",
    selectedSeat: null,
    selectedMember: null,
    claimNickname: "",
    claimAvatarUrl: "",
    sheetCanAdminRelease: false
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
    onShow() {
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
    applyBootstrapResult(result) {
        var _a, _b, _c, _d, _e, _f, _g;
        const showAuthGate = !result.currentUser.isAuthorized;
        const hasCurrentTrip = result.currentUser.isAuthorized && Boolean(result.currentTrip);
        const showTripEntry = result.currentUser.isAuthorized && !result.currentTrip;
        const activeTab = this.data.activeTab;
        const currentPersonaId = (_a = result.currentUser.homePersonaAssetId) !== null && _a !== void 0 ? _a : "";
        const currentPersonaImageUrl = resolveHomePersonaImageUrl(result.currentUser);
        this.setData({
            showAuthGate,
            showTripContent: hasCurrentTrip,
            showTripEntry,
            hasCurrentTrip,
            navTitle: (_c = (_b = result.currentTrip) === null || _b === void 0 ? void 0 : _b.tripMeta.tripName) !== null && _c !== void 0 ? _c : "巴士认座",
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
            seatedMembers: ((_e = (_d = result.currentTrip) === null || _d === void 0 ? void 0 : _d.members) !== null && _e !== void 0 ? _e : []).filter((member) => Boolean(member.seatCode)),
            viewerSeatText: (_g = (_f = result.currentTrip) === null || _f === void 0 ? void 0 : _f.tripMeta.viewerSeatCode) !== null && _g !== void 0 ? _g : "未入座",
            currentPersonaId,
            currentPersonaImageUrl,
            personaOptions: constants_1.HOME_PERSONA_OPTIONS.map((option) => (Object.assign(Object.assign({}, option), { className: option.id === (this.data.showPersonaSheet ? this.data.personaDraftId : currentPersonaId)
                    ? "persona-option is-active"
                    : "persona-option" }))),
            showPersonaSheet: false,
            personaSheetActive: false,
            personaDraftId: currentPersonaId,
            sheetVisible: false,
            selectedSeat: null,
            selectedMember: null,
            claimNickname: result.currentUser.nickname,
            claimAvatarUrl: result.currentUser.avatarUrl,
            sheetCanAdminRelease: false
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
            personaDraftId,
            personaOptions: constants_1.HOME_PERSONA_OPTIONS.map((option) => (Object.assign(Object.assign({}, option), { className: option.id === personaDraftId ? "persona-option is-active" : "persona-option" })))
        });
        wx.nextTick(() => {
            this.setData({
                personaSheetActive: true
            });
        });
    },
    handlePersonaSelect(event) {
        const personaId = String(event.currentTarget.dataset.personaId || "");
        this.setData({
            personaDraftId: personaId,
            personaOptions: constants_1.HOME_PERSONA_OPTIONS.map((option) => (Object.assign(Object.assign({}, option), { className: option.id === personaId ? "persona-option is-active" : "persona-option" })))
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
                personaDraftId: this.data.currentPersonaId,
                personaOptions: constants_1.HOME_PERSONA_OPTIONS.map((option) => (Object.assign(Object.assign({}, option), { className: option.id === this.data.currentPersonaId ? "persona-option is-active" : "persona-option" })))
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
    handleSeatTap(event) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const seat = event.detail.seat;
        if (!seat) {
            return;
        }
        if (seat.isEmpty) {
            this.setData({
                sheetVisible: true,
                sheetMode: ((_a = this.data.currentTrip) === null || _a === void 0 ? void 0 : _a.tripMeta.viewerSeatCode) ? "switch" : "claim",
                selectedSeat: seat,
                selectedMember: null,
                claimNickname: (_c = (_b = this.data.currentUser) === null || _b === void 0 ? void 0 : _b.nickname) !== null && _c !== void 0 ? _c : "",
                claimAvatarUrl: (_e = (_d = this.data.currentUser) === null || _d === void 0 ? void 0 : _d.avatarUrl) !== null && _e !== void 0 ? _e : "",
                sheetCanAdminRelease: false
            });
            return;
        }
        if (seat.isMine) {
            this.setData({
                sheetVisible: true,
                sheetMode: "self",
                selectedSeat: seat,
                selectedMember: null,
                sheetCanAdminRelease: false
            });
            return;
        }
        const targetMember = (_g = (_f = this.data.currentTrip) === null || _f === void 0 ? void 0 : _f.members.find((member) => { var _a; return member.userId === ((_a = seat.occupant) === null || _a === void 0 ? void 0 : _a.userId); })) !== null && _g !== void 0 ? _g : null;
        this.setData({
            sheetVisible: true,
            sheetMode: "detail",
            selectedSeat: seat,
            selectedMember: targetMember,
            sheetCanAdminRelease: Boolean(((_h = this.data.currentTrip) === null || _h === void 0 ? void 0 : _h.tripMeta.viewerRole) === "admin" &&
                (targetMember === null || targetMember === void 0 ? void 0 : targetMember.seatCode) &&
                !(targetMember === null || targetMember === void 0 ? void 0 : targetMember.isSelf))
        });
    },
    handleMemberTap(event) {
        var _a;
        const member = event.detail.member;
        this.setData({
            sheetVisible: true,
            sheetMode: "detail",
            selectedMember: member,
            selectedSeat: null,
            sheetCanAdminRelease: Boolean(((_a = this.data.currentTrip) === null || _a === void 0 ? void 0 : _a.tripMeta.viewerRole) === "admin" &&
                (member === null || member === void 0 ? void 0 : member.seatCode) &&
                !(member === null || member === void 0 ? void 0 : member.isSelf))
        });
    },
    handleSheetClose() {
        this.setData({
            sheetVisible: false,
            selectedSeat: null,
            selectedMember: null,
            sheetCanAdminRelease: false
        });
    },
    handleClaimConfirm() {
        if (!this.data.selectedSeat) {
            return;
        }
        try {
            const result = trip_service_1.tripService.claimSeat(this.data.selectedSeat.code);
            this.applyBootstrapResult(result);
            (0, feedback_1.showSuccessToast)("入座成功");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    handleSwitchConfirm() {
        if (!this.data.selectedSeat) {
            return;
        }
        try {
            const result = trip_service_1.tripService.switchSeat(this.data.selectedSeat.code);
            this.applyBootstrapResult(result);
            (0, feedback_1.showSuccessToast)("换座成功");
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
    onUnload() {
        this.clearPersonaSheetCloseTimer();
    }
});

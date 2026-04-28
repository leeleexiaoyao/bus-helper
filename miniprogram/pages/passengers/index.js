"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
const initialData = {
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
            this.applyPageData(trip_service_1.tripService.getPassengerPageData());
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    applyPageData(pageData, options = {}) {
        var _a;
        const activeFilterId = pageData.filterOptions.some((option) => option.id === this.data.activeFilterId)
            ? this.data.activeFilterId
            : "all";
        const filterOptions = pageData.filterOptions.map((option) => (Object.assign(Object.assign({}, option), { isSelected: option.id === activeFilterId })));
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
            sheetMode: (_a = preservedMember === null || preservedMember === void 0 ? void 0 : preservedMember.detailMode) !== null && _a !== void 0 ? _a : "member-detail",
            selectedMember: preservedMember
        });
    },
    filterGroups(groups, activeFilterId) {
        if (activeFilterId === "all") {
            return groups;
        }
        return groups.filter((group) => group.tripId === activeFilterId);
    },
    findMemberByKey(groups, memberKey) {
        for (const group of groups) {
            const member = group.members.find((item) => this.getMemberKey(item) === memberKey);
            if (member) {
                return member;
            }
        }
        return null;
    },
    getMemberKey(member) {
        return `${member.tripId}:${member.userId}`;
    },
    handleFilterChange(event) {
        const filterId = String(event.currentTarget.dataset.filterId || "all");
        if (!this.data.pageData || filterId === this.data.activeFilterId) {
            return;
        }
        this.setData({
            activeFilterId: filterId,
            filterOptions: this.data.pageData.filterOptions.map((option) => (Object.assign(Object.assign({}, option), { isSelected: option.id === filterId }))),
            visibleGroups: this.filterGroups(this.data.pageData.memberGroups, filterId)
        });
    },
    handleMemberTap(event) {
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
            trip_service_1.tripService.releaseMySeat();
            this.applyPageData(trip_service_1.tripService.getPassengerPageData(), {
                preserveSelectedMemberKey: memberKey
            });
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
        const memberKey = this.getMemberKey(this.data.selectedMember);
        try {
            trip_service_1.tripService.adminReleaseSeat(this.data.selectedMember.userId);
            this.applyPageData(trip_service_1.tripService.getPassengerPageData(), {
                preserveSelectedMemberKey: memberKey
            });
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
        const memberKey = this.getMemberKey(this.data.selectedMember);
        const wasFavorited = this.data.selectedMember.isFavoritedByViewer;
        try {
            trip_service_1.tripService.toggleFavoriteMember(this.data.selectedMember.userId);
            this.applyPageData(trip_service_1.tripService.getPassengerPageData(), {
                preserveSelectedMemberKey: memberKey
            });
            (0, feedback_1.showSuccessToast)(wasFavorited ? "已取消标记" : "已标记");
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    }
});

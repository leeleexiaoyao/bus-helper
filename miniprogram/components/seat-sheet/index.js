"use strict";
Component({
    properties: {
        visible: {
            type: Boolean,
            value: false
        },
        mode: {
            type: String,
            value: "member-detail"
        },
        seat: {
            type: Object
        },
        member: {
            type: Object
        },
        tripLabel: {
            type: String,
            value: ""
        },
        confirmTitle: {
            type: String,
            value: ""
        }
    },
    data: {
        renderVisible: false,
        panelActive: false,
        isEmptyConfirmMode: false,
        isSelfDetailMode: false,
        isMemberDetailMode: false,
        isAdminMemberDetailMode: false,
        showDetailCard: false,
        detailSeatLabel: "未入座",
        detailPersonaImageUrl: "",
        showAdminBadge: false,
        showFavoriteAction: false,
        favoriteButtonText: "标记"
    },
    observers: {
        "visible, mode, member": function (visible, mode, member) {
            var _a, _b, _c;
            if (visible) {
                this.showSheet();
            }
            else {
                this.hideSheet();
            }
            this.setData({
                isEmptyConfirmMode: mode === "empty-confirm",
                isSelfDetailMode: mode === "self-detail",
                isMemberDetailMode: mode === "member-detail",
                isAdminMemberDetailMode: mode === "admin-member-detail",
                showDetailCard: mode === "self-detail" ||
                    mode === "member-detail" ||
                    mode === "admin-member-detail" ||
                    mode === "readonly-member-detail",
                detailSeatLabel: (_b = (_a = member === null || member === void 0 ? void 0 : member.seatDisplayLabel) !== null && _a !== void 0 ? _a : member === null || member === void 0 ? void 0 : member.seatLabel) !== null && _b !== void 0 ? _b : "未入座",
                detailPersonaImageUrl: (_c = member === null || member === void 0 ? void 0 : member.homePersonaImageUrl) !== null && _c !== void 0 ? _c : "",
                showAdminBadge: Boolean(member === null || member === void 0 ? void 0 : member.isAdmin),
                showFavoriteAction: mode === "member-detail" || mode === "admin-member-detail",
                favoriteButtonText: (member === null || member === void 0 ? void 0 : member.isFavoritedByViewer) ? "取消标记" : "标记"
            });
        }
    },
    lifetimes: {
        attached() {
            if (this.properties.visible) {
                this.showSheet();
            }
        },
        detached() {
            this.clearVisibilityTimer();
        }
    },
    methods: {
        getVisibilityTimer() {
            var _a;
            return ((_a = this.visibilityTimer) !== null && _a !== void 0 ? _a : 0);
        },
        setVisibilityTimer(timer) {
            this.visibilityTimer = timer;
        },
        showSheet() {
            this.clearVisibilityTimer();
            if (!this.data.renderVisible) {
                this.setData({
                    renderVisible: true
                });
            }
            wx.nextTick(() => {
                this.setData({
                    panelActive: true
                });
            });
        },
        hideSheet() {
            this.clearVisibilityTimer();
            if (!this.data.renderVisible) {
                return;
            }
            this.setData({
                panelActive: false
            });
            this.setVisibilityTimer(setTimeout(() => {
                this.setData({
                    renderVisible: false
                });
                this.setVisibilityTimer(0);
            }, 220));
        },
        clearVisibilityTimer() {
            const visibilityTimer = this.getVisibilityTimer();
            if (!visibilityTimer) {
                return;
            }
            clearTimeout(visibilityTimer);
            this.setVisibilityTimer(0);
        },
        stopPropagation() { },
        stopTouchMove() { },
        handleMaskTap() {
            this.triggerEvent("close");
        },
        handleConfirmClaim() {
            this.triggerEvent("confirmclaim");
        },
        handleConfirmSwitch() {
            this.triggerEvent("confirmswitch");
        },
        handleReleaseMine() {
            this.triggerEvent("releasemine");
        },
        handleAdminRelease() {
            this.triggerEvent("adminrelease");
        },
        handleToggleFavorite() {
            this.triggerEvent("togglefavorite");
        },
        handleClose() {
            this.triggerEvent("close");
        }
    }
});

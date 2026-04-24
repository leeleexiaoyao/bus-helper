"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        detailBioText: "暂无签名",
        detailLivingLocationDisplay: {
            primary: "未填写",
            secondary: "",
            full: "",
            isPlaceholder: true
        },
        detailHometownLocationDisplay: {
            primary: "未填写",
            secondary: "",
            full: "",
            isPlaceholder: true
        },
        detailAgeText: "未填写",
        detailPersonaImageUrl: "",
        showAdminBadge: false,
        showFavoriteAction: false,
        favoriteButtonText: "收藏"
    },
    observers: {
        "visible, mode, member": function (visible, mode, member) {
            var _a, _b, _c, _d, _e, _f;
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
                showDetailCard: mode === "self-detail" || mode === "member-detail" || mode === "admin-member-detail",
                detailSeatLabel: (_a = member === null || member === void 0 ? void 0 : member.seatLabel) !== null && _a !== void 0 ? _a : "未入座",
                detailBioText: ((_b = member === null || member === void 0 ? void 0 : member.bio) === null || _b === void 0 ? void 0 : _b.trim()) || "暂无签名",
                detailLivingLocationDisplay: (_c = member === null || member === void 0 ? void 0 : member.livingLocationDisplay) !== null && _c !== void 0 ? _c : {
                    primary: "未填写",
                    secondary: "",
                    full: "",
                    isPlaceholder: true
                },
                detailHometownLocationDisplay: (_d = member === null || member === void 0 ? void 0 : member.hometownLocationDisplay) !== null && _d !== void 0 ? _d : {
                    primary: "未填写",
                    secondary: "",
                    full: "",
                    isPlaceholder: true
                },
                detailAgeText: ((_e = member === null || member === void 0 ? void 0 : member.age) === null || _e === void 0 ? void 0 : _e.trim()) || "未填写",
                detailPersonaImageUrl: (_f = member === null || member === void 0 ? void 0 : member.homePersonaImageUrl) !== null && _f !== void 0 ? _f : "",
                showAdminBadge: Boolean(member === null || member === void 0 ? void 0 : member.isAdmin),
                showFavoriteAction: mode === "member-detail",
                favoriteButtonText: (member === null || member === void 0 ? void 0 : member.isFavoritedByViewer) ? "取消收藏" : "收藏"
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

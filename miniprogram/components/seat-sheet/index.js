"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const format_1 = require("../../utils/format");
Component({
    properties: {
        visible: {
            type: Boolean,
            value: false
        },
        mode: {
            type: String,
            value: "detail"
        },
        seat: {
            type: Object
        },
        member: {
            type: Object
        },
        claimNickname: {
            type: String,
            value: ""
        },
        claimAvatarUrl: {
            type: String,
            value: ""
        },
        canAdminRelease: {
            type: Boolean,
            value: false
        }
    },
    data: {
        localInitial: "座",
        isClaimMode: false,
        isSwitchMode: false,
        isSelfMode: false,
        isDetailMode: true,
        detailSeatLabel: "未入座",
        showAdminBadge: false,
        showAdminReleaseButton: false
    },
    observers: {
        "visible, mode, claimNickname, member, canAdminRelease": function (visible, mode, claimNickname, member, canAdminRelease) {
            var _a;
            if (!visible) {
                return;
            }
            this.setData({
                localInitial: (0, format_1.getInitial)(claimNickname || "座"),
                isClaimMode: mode === "claim",
                isSwitchMode: mode === "switch",
                isSelfMode: mode === "self",
                isDetailMode: mode === "detail",
                detailSeatLabel: (_a = member === null || member === void 0 ? void 0 : member.seatLabel) !== null && _a !== void 0 ? _a : "未入座",
                showAdminBadge: Boolean(member === null || member === void 0 ? void 0 : member.isAdmin),
                showAdminReleaseButton: Boolean(canAdminRelease && (member === null || member === void 0 ? void 0 : member.seatCode))
            });
        }
    },
    methods: {
        stopPropagation() { },
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
        handleClose() {
            this.triggerEvent("close");
        }
    }
});

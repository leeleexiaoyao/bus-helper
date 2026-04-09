import { getInitial } from "../../utils/format";

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
    "visible, mode, claimNickname, member, canAdminRelease": function (
      visible: boolean,
      mode: string,
      claimNickname: string,
      member: {
        seatLabel?: string;
        isAdmin?: boolean;
        seatCode?: string | null;
      } | null,
      canAdminRelease: boolean
    ) {
      if (!visible) {
        return;
      }
      this.setData({
        localInitial: getInitial(claimNickname || "座"),
        isClaimMode: mode === "claim",
        isSwitchMode: mode === "switch",
        isSelfMode: mode === "self",
        isDetailMode: mode === "detail",
        detailSeatLabel: member?.seatLabel ?? "未入座",
        showAdminBadge: Boolean(member?.isAdmin),
        showAdminReleaseButton: Boolean(canAdminRelease && member?.seatCode)
      });
    }
  },
  methods: {
    stopPropagation() {},
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

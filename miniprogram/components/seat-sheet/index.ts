import type { LocationDisplay } from "../../shared/types";

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
    } as LocationDisplay,
    detailHometownLocationDisplay: {
      primary: "未填写",
      secondary: "",
      full: "",
      isPlaceholder: true
    } as LocationDisplay,
    detailAgeText: "未填写",
    detailPersonaImageUrl: "",
    showAdminBadge: false
  },
  observers: {
    "visible, mode, member": function (
      visible: boolean,
      mode: string,
      member: {
        seatLabel?: string;
        isAdmin?: boolean;
        bio?: string;
        livingLocationDisplay?: LocationDisplay;
        hometownLocationDisplay?: LocationDisplay;
        age?: string;
        homePersonaImageUrl?: string;
      } | null
    ) {
      if (!visible) {
        return;
      }
      this.setData({
        isEmptyConfirmMode: mode === "empty-confirm",
        isSelfDetailMode: mode === "self-detail",
        isMemberDetailMode: mode === "member-detail",
        isAdminMemberDetailMode: mode === "admin-member-detail",
        showDetailCard:
          mode === "self-detail" || mode === "member-detail" || mode === "admin-member-detail",
        detailSeatLabel: member?.seatLabel ?? "未入座",
        detailBioText: member?.bio?.trim() || "暂无签名",
        detailLivingLocationDisplay: member?.livingLocationDisplay ?? {
          primary: "未填写",
          secondary: "",
          full: "",
          isPlaceholder: true
        },
        detailHometownLocationDisplay: member?.hometownLocationDisplay ?? {
          primary: "未填写",
          secondary: "",
          full: "",
          isPlaceholder: true
        },
        detailAgeText: member?.age?.trim() || "未填写",
        detailPersonaImageUrl: member?.homePersonaImageUrl ?? "",
        showAdminBadge: Boolean(member?.isAdmin)
      });
    }
  },
  methods: {
    stopPropagation() {},
    stopTouchMove() {},
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

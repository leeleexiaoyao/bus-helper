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
    } as LocationDisplay,
    detailHometownLocationDisplay: {
      primary: "未填写",
      secondary: "",
      full: "",
      isPlaceholder: true
    } as LocationDisplay,
    detailAgeText: "未填写",
    detailPersonaImageUrl: "",
    showAdminBadge: false,
    showFavoriteAction: false,
    favoriteButtonText: "收藏"
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
        isFavoritedByViewer?: boolean;
      } | null
    ) {
      if (visible) {
        this.showSheet();
      } else {
        this.hideSheet();
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
        showAdminBadge: Boolean(member?.isAdmin),
        showFavoriteAction: mode === "member-detail",
        favoriteButtonText: member?.isFavoritedByViewer ? "取消收藏" : "收藏"
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
    getVisibilityTimer(): number {
      return ((this as unknown as { visibilityTimer?: number }).visibilityTimer ?? 0) as number;
    },
    setVisibilityTimer(timer: number) {
      (this as unknown as { visibilityTimer?: number }).visibilityTimer = timer;
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
      this.setVisibilityTimer(
        setTimeout(() => {
          this.setData({
            renderVisible: false
          });
          this.setVisibilityTimer(0);
        }, 220) as unknown as number
      );
    },
    clearVisibilityTimer() {
      const visibilityTimer = this.getVisibilityTimer();
      if (!visibilityTimer) {
        return;
      }
      clearTimeout(visibilityTimer);
      this.setVisibilityTimer(0);
    },
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
    handleToggleFavorite() {
      this.triggerEvent("togglefavorite");
    },
    handleClose() {
      this.triggerEvent("close");
    }
  }
});

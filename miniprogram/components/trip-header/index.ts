Component({
  properties: {
    tripMeta: {
      type: Object
    }
  },
  data: {
    roleClassName: "",
    roleLabel: "",
    templateLabel: "",
    showAdminActions: false
  },
  observers: {
    tripMeta(tripMeta: {
      viewerRoleClassName?: string;
      viewerRoleLabel?: string;
      templateLabel?: string;
      isAdmin?: boolean;
    }) {
      this.setData({
        roleClassName: tripMeta?.viewerRoleClassName ?? "",
        roleLabel: tripMeta?.viewerRoleLabel ?? "",
        templateLabel: tripMeta?.templateLabel ?? "",
        showAdminActions: Boolean(tripMeta?.isAdmin)
      });
    }
  },
  methods: {
    handleSettingTap() {
      this.triggerEvent("settingtap");
    },
    handleLeaveTap() {
      this.triggerEvent("leavetap");
    }
  }
});

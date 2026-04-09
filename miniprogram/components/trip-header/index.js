"use strict";
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
        tripMeta(tripMeta) {
            var _a, _b, _c;
            this.setData({
                roleClassName: (_a = tripMeta === null || tripMeta === void 0 ? void 0 : tripMeta.viewerRoleClassName) !== null && _a !== void 0 ? _a : "",
                roleLabel: (_b = tripMeta === null || tripMeta === void 0 ? void 0 : tripMeta.viewerRoleLabel) !== null && _b !== void 0 ? _b : "",
                templateLabel: (_c = tripMeta === null || tripMeta === void 0 ? void 0 : tripMeta.templateLabel) !== null && _c !== void 0 ? _c : "",
                showAdminActions: Boolean(tripMeta === null || tripMeta === void 0 ? void 0 : tripMeta.isAdmin)
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

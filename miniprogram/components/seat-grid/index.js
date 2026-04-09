"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
Component({
    properties: {
        rows: {
            type: Array,
            value: []
        }
    },
    methods: {
        handleSeatTap(event) {
            var _a;
            const rowIndex = Number(event.currentTarget.dataset.row);
            const slotIndex = Number(event.currentTarget.dataset.slot);
            const row = this.properties.rows[rowIndex];
            const seat = (_a = row === null || row === void 0 ? void 0 : row.slots) === null || _a === void 0 ? void 0 : _a[slotIndex];
            if (!seat) {
                return;
            }
            this.triggerEvent("seattap", { seat });
        }
    }
});

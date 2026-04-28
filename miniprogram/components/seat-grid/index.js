"use strict";
Component({
  properties: {
    rows: {
      type: Array,
      value: []
    }
  },
  methods: {
    handleSeatTap(event) {
      const rowIndex = Number(event.currentTarget.dataset.row);
      const slotIndex = Number(event.currentTarget.dataset.slot);
      const rows = this.properties.rows || [];
      const row = rows[rowIndex];
      const slot = row && row.slots ? row.slots[slotIndex] : null;
      if (!slot) {
        return;
      }
      this.triggerEvent("seattap", { seat: slot });
    }
  }
});

import type { SeatCellView, SeatRowView } from "../../shared/types";

Component({
  properties: {
    rows: {
      type: Array,
      value: [] as SeatRowView[]
    }
  },
  methods: {
    handleSeatTap(event: WechatMiniprogram.CustomEvent) {
      const rowIndex = Number(event.currentTarget.dataset.row);
      const slotIndex = Number(event.currentTarget.dataset.slot);
      const row = (this.properties.rows as SeatRowView[])[rowIndex];
      const seat = row?.slots?.[slotIndex] as SeatCellView | null;
      if (!seat) {
        return;
      }
      this.triggerEvent("seattap", { seat });
    }
  }
});

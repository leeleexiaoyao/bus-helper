import type { MemberView, PassengerMemberView } from "../../shared/types";

type MemberListItem = MemberView | PassengerMemberView;

Component({
  properties: {
    members: {
      type: Array,
      value: [] as MemberListItem[]
    }
  },
  methods: {
    handleMemberTap(event: WechatMiniprogram.CustomEvent) {
      const memberIndex = Number(event.currentTarget.dataset.index);
      const member = (this.properties.members as MemberListItem[])[memberIndex];
      if (!member) {
        return;
      }
      this.triggerEvent("membertap", { member });
    }
  }
});

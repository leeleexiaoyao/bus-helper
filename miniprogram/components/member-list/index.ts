import type { MemberView } from "../../shared/types";

Component({
  properties: {
    members: {
      type: Array,
      value: [] as MemberView[]
    }
  },
  methods: {
    handleMemberTap(event: WechatMiniprogram.CustomEvent) {
      const memberIndex = Number(event.currentTarget.dataset.index);
      const member = (this.properties.members as MemberView[])[memberIndex];
      if (!member) {
        return;
      }
      this.triggerEvent("membertap", { member });
    }
  }
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
Component({
    properties: {
        members: {
            type: Array,
            value: []
        }
    },
    methods: {
        handleMemberTap(event) {
            const memberIndex = Number(event.currentTarget.dataset.index);
            const member = this.properties.members[memberIndex];
            if (!member) {
                return;
            }
            this.triggerEvent("membertap", { member });
        }
    }
});

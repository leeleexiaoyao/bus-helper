"use strict";
Component({
    properties: {
        title: {
            type: String,
            value: "历史记录"
        },
        showEmpty: {
            type: Boolean,
            value: false
        },
        emptyText: {
            type: String,
            value: "暂无记录"
        },
        cardClassName: {
            type: String,
            value: ""
        }
    }
});

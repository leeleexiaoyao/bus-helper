"use strict";
Component({
    properties: {
        title: {
            type: String,
            value: ""
        },
        progress: {
            type: Number,
            value: 0
        }
    },
    data: {
        navHeight: 44,
        statusBarHeight: 20,
        navTotalHeight: 64,
        titleLeftPadding: 20,
        titleRightPadding: 104,
        navOpacityStyle: "opacity: 0;"
    },
    lifetimes: {
        attached() {
            const systemInfo = wx.getSystemInfoSync();
            const capsule = wx.getMenuButtonBoundingClientRect();
            const statusBarHeight = systemInfo.statusBarHeight || 20;
            const navHeight = Math.max(44, capsule.bottom - statusBarHeight);
            const navTotalHeight = statusBarHeight + navHeight;
            const titleRightPadding = Math.max(systemInfo.windowWidth - capsule.left + 10, 102);
            const titleLeftPadding = 10;
            this.setData({
                navHeight,
                statusBarHeight,
                navTotalHeight,
                titleLeftPadding,
                titleRightPadding
            });
        }
    },
    observers: {
        progress(progress) {
            const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0));
            this.setData({
                navOpacityStyle: `opacity: ${safeProgress};`
            });
        }
    }
});

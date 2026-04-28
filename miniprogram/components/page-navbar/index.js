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
        },
        theme: {
            type: String,
            value: "dark"
        },
        leftPadding: {
            type: Number,
            value: 20
        },
        titleFontSize: {
            type: Number,
            value: 20
        },
        showBack: {
            type: Boolean,
            value: false
        },
        backDelta: {
            type: Number,
            value: 1
        },
        backFallbackUrl: {
            type: String,
            value: ""
        }
    },
    data: {
        navHeight: 44,
        statusBarHeight: 20,
        navTotalHeight: 64,
        titleLeftPadding: 20,
        titleRightPadding: 104,
        navOpacityStyle: "opacity: 0;",
        titleStyle: "color: var(--text-primary);",
        resolvedTitleFontSize: 20
    },
    lifetimes: {
        attached() {
            const systemInfo = wx.getSystemInfoSync();
            const capsule = wx.getMenuButtonBoundingClientRect();
            const statusBarHeight = systemInfo.statusBarHeight || 20;
            const navHeight = Math.max(44, capsule.bottom - statusBarHeight);
            const navTotalHeight = statusBarHeight + navHeight;
            const titleRightPadding = Math.max(systemInfo.windowWidth - capsule.left + 10, 102);
            const titleLeftPadding = Number(this.properties.leftPadding) || 20;
            const titleFontSize = Number(this.properties.titleFontSize) || 20;
            this.setData({
                navHeight,
                statusBarHeight,
                navTotalHeight,
                titleLeftPadding,
                titleRightPadding,
                resolvedTitleFontSize: titleFontSize
            });
            this.updateVisualState(Number(this.properties.progress) || 0, String(this.properties.theme));
        }
    },
    observers: {
        progress(progress) {
            this.updateVisualState(progress, String(this.properties.theme));
        },
        theme(theme) {
            this.updateVisualState(Number(this.properties.progress) || 0, theme);
        },
        leftPadding(leftPadding) {
            this.setData({
                titleLeftPadding: Number(leftPadding) || 20
            });
        },
        titleFontSize(titleFontSize) {
            this.setData({
                resolvedTitleFontSize: Number(titleFontSize) || 20
            });
        }
    },
    methods: {
        handleBackTap() {
            const delta = Math.max(1, Number(this.properties.backDelta) || 1);
            const fallbackUrl = String(this.properties.backFallbackUrl || "");
            wx.navigateBack({
                delta,
                fail: () => {
                    if (fallbackUrl) {
                        wx.navigateTo({
                            url: fallbackUrl,
                            fail: () => {
                                wx.switchTab({
                                    url: fallbackUrl
                                });
                            }
                        });
                    }
                }
            });
        },
        updateVisualState(progress, theme) {
            const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0));
            const isLightTheme = theme === "light";
            const startColor = isLightTheme ? [255, 255, 255] : [31, 37, 57];
            const endColor = [31, 37, 57];
            const titleColor = startColor.map((channel, index) => Math.round(channel + (endColor[index] - channel) * safeProgress));
            this.setData({
                navOpacityStyle: `opacity: ${safeProgress};`,
                titleStyle: `color: rgb(${titleColor[0]}, ${titleColor[1]}, ${titleColor[2]}); opacity: ${safeProgress};`
            });
        }
    }
});

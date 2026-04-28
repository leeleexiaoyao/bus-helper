"use strict";
Component({
    data: {
        selected: 0,
        list: [
            {
                pagePath: "/pages/home/index",
                text: "首页",
                iconPath: "/assets/icons/tab-home.svg",
                selectedIconPath: "/assets/icons/tab-home-active.svg"
            },
            {
                pagePath: "/pages/passengers/index",
                text: "乘客",
                iconPath: "/assets/icons/tab-passengers.svg",
                selectedIconPath: "/assets/icons/tab-passengers-active.svg"
            },
            {
                pagePath: "/pages/profile/index",
                text: "我的",
                iconPath: "/assets/icons/tab-profile.svg",
                selectedIconPath: "/assets/icons/tab-profile-active.svg"
            }
        ]
    },
    lifetimes: {
        attached() {
            this.syncSelected();
        }
    },
    pageLifetimes: {
        show() {
            this.syncSelected();
        }
    },
    methods: {
        getCurrentRoute() {
            const pages = getCurrentPages();
            const currentPage = pages[pages.length - 1];
            return currentPage ? `/${currentPage.route}` : "";
        },
        setSelected(selected) {
            if (selected >= 0 && selected !== this.data.selected) {
                this.setData({ selected });
            }
        },
        syncSelected() {
            const currentRoute = this.getCurrentRoute();
            const selected = this.data.list.findIndex((item) => item.pagePath === currentRoute);
            this.setSelected(selected);
        },
        handleSwitch(event) {
            const pagePath = String(event.currentTarget.dataset.path || "");
            const index = Number(event.currentTarget.dataset.index);
            const currentRoute = this.getCurrentRoute();
            if (!pagePath || pagePath === currentRoute) {
                return;
            }
            this.setSelected(index);
            wx.switchTab({
                url: pagePath,
                fail: () => {
                    this.syncSelected();
                }
            });
        }
    }
});

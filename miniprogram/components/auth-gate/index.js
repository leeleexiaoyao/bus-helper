"use strict";
Component({
    properties: {
        title: {
            type: String,
            value: "先完成微信授权"
        },
        subtitle: {
            type: String,
            value: "授权头像和昵称后，才能创建车次、加入车次并查看成员信息。"
        },
        buttonText: {
            type: String,
            value: "模拟身份授权"
        },
        presetNickname: {
            type: String,
            value: ""
        },
        presetAvatarUrl: {
            type: String,
            value: ""
        }
    },
    methods: {
        handleAuthorize() {
            const nickname = this.properties.presetNickname.trim() || "演示用户";
            const avatarUrl = this.properties.presetAvatarUrl.trim();
            wx.showModal({
                title: "模拟身份授权",
                content: `将以“${nickname}”身份完成授权。后续可在“我的”页切换演示身份。`,
                confirmText: "确认授权",
                success: ({ confirm }) => {
                    if (!confirm) {
                        return;
                    }
                    this.triggerEvent("authorized", {
                        nickname,
                        avatarUrl
                    });
                }
            });
        }
    }
});

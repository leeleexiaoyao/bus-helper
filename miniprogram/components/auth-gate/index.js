"use strict";
Component({
    data: {
        nickname: "",
        avatarUrl: "",
        submitting: false
    },
    properties: {
        title: {
            type: String,
            value: "获取你的头像、昵称"
        },
        subtitle: {
            type: String,
            value: "用于生成账号信息"
        },
        buttonText: {
            type: String,
            value: "确认授权"
        },
        displayMode: {
            type: String,
            value: "card"
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
    lifetimes: {
        attached() {
            this.setData({
                nickname: this.properties.presetNickname,
                avatarUrl: this.properties.presetAvatarUrl
            });
        }
    },
    observers: {
        presetNickname(value) {
            if (!this.data.nickname) {
                this.setData({
                    nickname: value
                });
            }
        },
        presetAvatarUrl(value) {
            if (!this.data.avatarUrl) {
                this.setData({
                    avatarUrl: value
                });
            }
        }
    },
    methods: {
        handleNicknameInput(event) {
            this.setData({
                nickname: String(event.detail.value || "").trim()
            });
        },
        handleChooseAvatar(event) {
            this.setData({
                avatarUrl: String(event.detail.avatarUrl || "")
            });
        },
        handleAvatarRowTap() {
            if (!this.data.avatarUrl) {
                return;
            }
            wx.previewImage({
                current: this.data.avatarUrl,
                urls: [this.data.avatarUrl]
            });
        },
        async uploadAvatarIfNeeded(avatarUrl) {
            var _a, _b;
            if (!avatarUrl || avatarUrl.startsWith("cloud://") || !wx.cloud) {
                return avatarUrl;
            }
            const extensionMatch = avatarUrl.match(/\.(png|jpg|jpeg|webp|gif)$/i);
            const extension = (_b = (_a = extensionMatch === null || extensionMatch === void 0 ? void 0 : extensionMatch[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "png";
            const cloudPath = `bus-buddy/avatars/${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 10)}.${extension}`;
            const uploadResult = await wx.cloud.uploadFile({
                cloudPath,
                filePath: avatarUrl
            });
            return uploadResult.fileID;
        },
        async handleAuthorize() {
            const nickname = this.data.nickname.trim();
            const avatarUrl = this.data.avatarUrl.trim();
            if (!nickname) {
                wx.showToast({
                    title: "请填写昵称",
                    icon: "none"
                });
                return;
            }
            if (!avatarUrl) {
                wx.showToast({
                    title: "请选择头像",
                    icon: "none"
                });
                return;
            }
            if (this.data.submitting) {
                return;
            }
            this.setData({
                submitting: true
            });
            try {
                const uploadedAvatarUrl = await this.uploadAvatarIfNeeded(avatarUrl);
                this.triggerEvent("authorized", {
                    nickname,
                    avatarUrl: uploadedAvatarUrl
                });
            }
            catch (error) {
                wx.showToast({
                    title: "授权失败，请重试",
                    icon: "none"
                });
                console.error("[auth-gate] 授权上传失败", error);
            }
            finally {
                this.setData({
                    submitting: false
                });
            }
        }
    }
});

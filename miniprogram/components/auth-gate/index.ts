Component({
  data: {
    nickname: "",
    avatarUrl: "",
    submitting: false
  },
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
      value: "确认授权"
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
    presetNickname(value: string) {
      if (!this.data.nickname) {
        this.setData({
          nickname: value
        });
      }
    },
    presetAvatarUrl(value: string) {
      if (!this.data.avatarUrl) {
        this.setData({
          avatarUrl: value
        });
      }
    }
  },
  methods: {
    handleNicknameInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
      this.setData({
        nickname: String(event.detail.value || "").trim()
      });
    },

    handleChooseAvatar(event: WechatMiniprogram.CustomEvent<{ avatarUrl: string }>) {
      this.setData({
        avatarUrl: String(event.detail.avatarUrl || "")
      });
    },

    async uploadAvatarIfNeeded(avatarUrl: string): Promise<string> {
      if (!avatarUrl || avatarUrl.startsWith("cloud://") || !wx.cloud) {
        return avatarUrl;
      }

      const extensionMatch = avatarUrl.match(/\.(png|jpg|jpeg|webp|gif)$/i);
      const extension = extensionMatch?.[1]?.toLowerCase() ?? "png";
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
      } catch (error) {
        wx.showToast({
          title: "授权失败，请重试",
          icon: "none"
        });
        console.error("[auth-gate] 授权上传失败", error);
      } finally {
        this.setData({
          submitting: false
        });
      }
    }
  }
});

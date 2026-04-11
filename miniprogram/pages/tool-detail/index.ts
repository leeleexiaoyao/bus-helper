import { TOOL_META } from "../../shared/constants";
import { BusinessError } from "../../shared/errors";
import type {
  ToolDetailViewModel,
  ToolResultMemberView,
  ToolType,
  VoteChoice,
  VoteSelectionMode
} from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

type WheelSliceView = {
  id: string;
  label: string;
  style: string;
  innerStyle: string;
};

type VoteOptionCardView = {
  id: string;
  label: string;
  supportCount: number;
  isSelected: boolean;
  className: string;
};

let seatDrawRollingSyncTimer: number | null = null;
let lotteryRollingInterval: number | null = null;
let lotteryRollingTimeout: number | null = null;

function isToolType(value: string): value is ToolType {
  return ["seat-draw", "vote", "wheel", "lottery"].includes(value);
}

function parseWheelItems(input: string): string[] {
  return input
    .split(/\n|,|，|;|；/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseVoteOptions(input: string): string[] {
  return input
    .split(/\n|,|，|;|；/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildWheelSlices(items: string[]): WheelSliceView[] {
  const safeItems = items.slice(0, 49);
  const step = safeItems.length ? 360 / safeItems.length : 360;
  const radius = 176;
  return safeItems.map((item, index) => {
    const angle = index * step + step / 2;
    const radians = (angle * Math.PI) / 180;
    const offsetX = (Math.sin(radians) * radius).toFixed(2);
    const offsetY = (-Math.cos(radians) * radius).toFixed(2);
    const labelRotation = (angle + 180).toFixed(2);
    return {
      id: `slice-${index}`,
      label: item,
      style: `transform: translate(-50%, -50%) translate(${offsetX}rpx, ${offsetY}rpx) rotate(${labelRotation}deg);`,
      innerStyle: ""
    };
  });
}

function buildVoteInteractionState(
  pageData: ToolDetailViewModel | null,
  selectedIds: string[]
): {
  approveDisabled: boolean;
  abstainDisabled: boolean;
  viewerResultLabel: string;
} {
  const detail = pageData?.voteDetail;
  if (!detail) {
    return {
      approveDisabled: true,
      abstainDisabled: true,
      viewerResultLabel: ""
    };
  }

  if (!detail.viewerEligible) {
    return {
      approveDisabled: true,
      abstainDisabled: true,
      viewerResultLabel: ""
    };
  }

  const validOptionIds = new Set(detail.options.map((option) => option.id));
  const currentSelectedIds = Array.from(new Set(selectedIds)).filter((optionId) =>
    validOptionIds.has(optionId)
  );
  const persistedOptionIds = new Set(detail.viewerSelectedOptionIds);
  const pendingOptionCount = currentSelectedIds.filter((optionId) => !persistedOptionIds.has(optionId)).length;
  const allOptionsSelected =
    detail.selectionMode === "multiple" &&
    detail.options.length > 0 &&
    detail.viewerSelectedOptionIds.length >= detail.options.length;

  let viewerResultLabel = "";
  if (detail.viewerChoice === "approve") {
    if (
      detail.selectionMode === "multiple" &&
      detail.viewerSelectedOptionIds.length > 0 &&
      detail.viewerSelectedOptionIds.length < detail.options.length
    ) {
      viewerResultLabel = `你已投 ${detail.viewerSelectedOptionIds.length} 项，还可继续投票。`;
    } else {
      viewerResultLabel = "你已完成投票。";
    }
  } else if (detail.viewerChoice === "abstain") {
    viewerResultLabel = "你已完成弃权。";
  } else if (detail.viewerChoice === "reject") {
    viewerResultLabel = "你已完成否决。";
  }

  return {
    approveDisabled:
      detail.selectionMode === "single"
        ? detail.viewerHasSubmitted || currentSelectedIds.length === 0
        : detail.viewerChoice === "abstain" || allOptionsSelected || pendingOptionCount === 0,
    abstainDisabled: detail.viewerHasSubmitted,
    viewerResultLabel
  };
}

function pickRollingLabel(entry: ToolResultMemberView): string {
  return `${entry.nickname} / ${entry.seatLabel}`;
}

function buildVoteOptionCards(pageData: ToolDetailViewModel | null, selectedIds: string[]): VoteOptionCardView[] {
  const selectedIdSet = new Set(selectedIds);
  return (pageData?.voteDetail?.options ?? []).map((option) => ({
    id: option.id,
    label: option.label,
    supportCount: option.supportCount,
    isSelected: option.selectedByViewer || selectedIdSet.has(option.id),
    className: option.selectedByViewer || selectedIdSet.has(option.id) ? "vote-option-card is-selected" : "vote-option-card"
  }));
}

function clearSeatDrawRollingTimer(): void {
  if (seatDrawRollingSyncTimer !== null) {
    clearInterval(seatDrawRollingSyncTimer);
    seatDrawRollingSyncTimer = null;
  }
}

function clearLotteryRollingTimer(): void {
  if (lotteryRollingInterval !== null) {
    clearInterval(lotteryRollingInterval);
    lotteryRollingInterval = null;
  }
  if (lotteryRollingTimeout !== null) {
    clearTimeout(lotteryRollingTimeout);
    lotteryRollingTimeout = null;
  }
}

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 44,
    navTotalHeight: 64,
    navRightPadding: 112,
    navActionRight: 96,
    toolType: "" as ToolType | "",
    toolTitle: "",
    pageData: null as ToolDetailViewModel | null,
    isDraftEditing: false,
    isRecreateMode: false,
    showActionSheet: false,
    seatDrawTopicInput: "",
    drawCountOptions: [1, 2, 3, 4, 5],
    drawCountPickerValue: 0,
    seatDrawCountLabel: "1人",
    seatDrawExcludePreviouslyDrawn: false,
    seatDrawExcludeAdmin: false,
    voteTopicInput: "",
    voteOptionsInput: "",
    voteSelectionMode: "single" as VoteSelectionMode,
    voteExcludeAdmin: false,
    voteSelectedOptionIds: [] as string[],
    voteOptionCards: [] as VoteOptionCardView[],
    votePhaseActive: false,
    voteModeLabel: "单选",
    voteModeSingleClass: "mode-chip is-active",
    voteModeMultipleClass: "mode-chip",
    voteViewerResultLabel: "",
    voteApproveDisabled: true,
    voteAbstainDisabled: true,
    wheelItemsInput: "",
    wheelRotation: 0,
    wheelTransitionMs: 0,
    wheelSlices: [] as WheelSliceView[],
    wheelSpinning: false,
    lotteryWinnerCountInput: "1",
    lotteryExcludeAdmin: false,
    lotteryRolling: false,
    lotteryRollingText: ""
  },

  onLoad(query: Record<string, string | undefined>) {
    const nextToolType = String(query.type || "");
    if (!isToolType(nextToolType)) {
      showErrorToast(new BusinessError("INVALID_TOOL_TYPE", "未识别的玩法类型。"));
      this.handleBack();
      return;
    }

    const systemInfo = wx.getSystemInfoSync();
    const capsule = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navHeight = Math.max(44, capsule.bottom - statusBarHeight);
    const navTotalHeight = statusBarHeight + navHeight;
    const navRightPadding = Math.max(systemInfo.windowWidth - capsule.left + 16, 112);
    const navActionRight = Math.max(systemInfo.windowWidth - capsule.left + 8, 16);

    this.setData({
      statusBarHeight,
      navHeight,
      navTotalHeight,
      navRightPadding,
      navActionRight,
      toolType: nextToolType,
      toolTitle: TOOL_META[nextToolType].title
    });
  },

  onShow() {
    this.refreshPage();
  },

  onHide() {
    clearSeatDrawRollingTimer();
    clearLotteryRollingTimer();
  },

  onUnload() {
    clearSeatDrawRollingTimer();
    clearLotteryRollingTimer();
  },

  refreshPage() {
    if (!this.data.toolType) {
      return;
    }

    try {
      const pageData =
        this.data.toolType === "seat-draw" &&
        this.data.pageData?.isAdmin &&
        this.data.pageData?.seatDrawDetail?.phase === "rolling"
          ? tripService.advanceSeatDrawRollingFrame()
          : tripService.getToolDetailPageData(this.data.toolType);
      this.applyPageData(pageData);
    } catch (error) {
      this.handlePageError(error);
    }
  },

  applyPageData(pageData: ToolDetailViewModel) {
    const voteSelectionMode = pageData.voteDetail?.selectionMode ?? "single";
    const voteSelectedOptionIds = pageData.voteDetail?.viewerSelectedOptionIds ?? [];
    const voteInteraction = buildVoteInteractionState(pageData, voteSelectedOptionIds);
    const seatDrawCount = Math.max(
      1,
      Math.min(5, pageData.seatDrawDetail?.drawCount ?? 1)
    );
    this.setData({
      pageData,
      toolTitle: pageData.toolTitle,
      isDraftEditing: false,
      isRecreateMode: false,
      showActionSheet: false,
      seatDrawTopicInput: pageData.seatDrawDetail?.topic ?? "",
      drawCountPickerValue: seatDrawCount - 1,
      seatDrawCountLabel: `${seatDrawCount}人`,
      seatDrawExcludePreviouslyDrawn: pageData.seatDrawDetail?.excludePreviouslyDrawn ?? false,
      seatDrawExcludeAdmin: pageData.seatDrawDetail?.excludeAdmin ?? false,
      voteTopicInput: pageData.voteDetail?.topic ?? "",
      voteOptionsInput: pageData.voteDetail?.options.map((option) => option.label).join("\n") ?? "",
      voteSelectionMode,
      voteExcludeAdmin: pageData.voteDetail?.excludeAdmin ?? false,
      voteSelectedOptionIds,
      voteOptionCards: buildVoteOptionCards(pageData, voteSelectedOptionIds),
      votePhaseActive: pageData.voteDetail?.phase === "active",
      voteModeLabel: voteSelectionMode === "single" ? "单选" : "多选",
      voteModeSingleClass: voteSelectionMode === "single" ? "mode-chip is-active" : "mode-chip",
      voteModeMultipleClass: voteSelectionMode === "multiple" ? "mode-chip is-active" : "mode-chip",
      voteViewerResultLabel: voteInteraction.viewerResultLabel,
      voteApproveDisabled: voteInteraction.approveDisabled,
      voteAbstainDisabled: voteInteraction.abstainDisabled,
      wheelItemsInput: pageData.wheelDetail?.items.join("\n") ?? "",
      wheelRotation:
        pageData.wheelDetail?.resultIndex != null && pageData.wheelDetail.items.length
          ? 360 - (360 / pageData.wheelDetail.items.length) * pageData.wheelDetail.resultIndex
          : 0,
      wheelTransitionMs: 0,
      wheelSlices: buildWheelSlices(pageData.wheelDetail?.items ?? []),
      wheelSpinning: false,
      lotteryWinnerCountInput: String(pageData.lotteryDetail?.winnerCount ?? 1),
      lotteryExcludeAdmin: pageData.lotteryDetail?.excludeAdmin ?? false,
      lotteryRolling: false,
      lotteryRollingText: ""
    });
    this.syncSeatDrawRollingTimer(pageData);
  },

  syncSeatDrawRollingTimer(pageData: ToolDetailViewModel) {
    const shouldSync =
      pageData.toolType === "seat-draw" && pageData.seatDrawDetail?.phase === "rolling";

    if (!shouldSync) {
      clearSeatDrawRollingTimer();
      return;
    }

    if (seatDrawRollingSyncTimer !== null) {
      return;
    }

    seatDrawRollingSyncTimer = setInterval(() => {
      this.refreshPage();
    }, 120) as unknown as number;
  },

  handlePageError(error: unknown) {
    if (
      error instanceof BusinessError &&
      (error.code === "AUTH_REQUIRED" || error.code === "TRIP_REQUIRED")
    ) {
      showErrorToast(error);
      wx.switchTab({
        url: "/pages/tools/index"
      });
      return;
    }

    showErrorToast(error);
  },

  handleActionError(error: unknown) {
    if (error instanceof BusinessError && error.code === "TOOL_NOT_STARTED") {
      this.refreshPage();
      showErrorToast(new BusinessError("TOOL_NOT_STARTED", "当前玩法已关闭，页面已切回未开启状态"));
      return;
    }

    if (
      error instanceof BusinessError &&
      (error.code === "AUTH_REQUIRED" || error.code === "TRIP_REQUIRED")
    ) {
      this.handlePageError(error);
      return;
    }

    showErrorToast(error);
  },

  handleBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }

    wx.switchTab({
      url: "/pages/tools/index"
    });
  },

  handleCreateDraft() {
    if (this.data.toolType === "seat-draw") {
      this.setData({
        isDraftEditing: true,
        isRecreateMode: false,
        seatDrawTopicInput: "",
        drawCountPickerValue: 0,
        seatDrawCountLabel: "1人",
        seatDrawExcludePreviouslyDrawn: false,
        seatDrawExcludeAdmin: false
      });
      return;
    }

    this.setData({
      isDraftEditing: true,
      isRecreateMode: false
    });
  },

  handleRecreateDraft() {
    if (this.data.toolType === "seat-draw") {
      try {
        const pageData = tripService.closeSeatDraw();
        this.applyPageData(pageData);
        this.setData({
          isDraftEditing: true,
          isRecreateMode: true,
          showActionSheet: false,
          seatDrawTopicInput: "",
          drawCountPickerValue: 0,
          seatDrawCountLabel: "1人",
          seatDrawExcludePreviouslyDrawn: false,
          seatDrawExcludeAdmin: false
        });
        showSuccessToast("已清除原有内容，请重新创建");
      } catch (error) {
        this.handleActionError(error);
      }
      return;
    }

    this.setData({
      isDraftEditing: true,
      isRecreateMode: true,
      showActionSheet: false
    });
  },

  handleOpenActionSheet() {
    this.setData({
      showActionSheet: true
    });
  },

  handleCloseActionSheet() {
    this.setData({
      showActionSheet: false
    });
  },

  handleSheetPanelTap() {},

  handleSeatDrawTopicInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      seatDrawTopicInput: event.detail.value
    });
  },

  handleSeatDrawCountChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const value = Number(event.detail.value ?? 0);
    this.setData({
      drawCountPickerValue: value,
      seatDrawCountLabel: `${(value || 0) + 1}人`
    });
  },

  handleSeatDrawExcludeHistoryChange(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    this.setData({
      seatDrawExcludePreviouslyDrawn: Boolean(event.detail.value)
    });
  },

  handleSeatDrawExcludeAdminChange(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    this.setData({
      seatDrawExcludeAdmin: Boolean(event.detail.value)
    });
  },

  handleSeatDrawPublish() {
    try {
      const input = {
        topic: this.data.seatDrawTopicInput,
        drawCount: this.data.drawCountPickerValue + 1,
        excludePreviouslyDrawn: this.data.seatDrawExcludePreviouslyDrawn,
        excludeAdmin: this.data.seatDrawExcludeAdmin
      };
      const pageData = this.data.pageData?.isStarted
        ? tripService.recreateSeatDrawTool(input)
        : tripService.publishSeatDrawTool(input);
      this.applyPageData(pageData);
      showSuccessToast(this.data.isRecreateMode ? "玩法已重新创建" : "玩法已创建");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleSeatDrawRun() {
    try {
      const nextPageData = tripService.startSeatDrawRound();
      this.applyPageData(nextPageData);
      showSuccessToast("抽号已开始");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleVoteTopicInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      voteTopicInput: event.detail.value
    });
  },

  handleVoteOptionsInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      voteOptionsInput: event.detail.value
    });
  },

  handleVoteModeSelect(event: WechatMiniprogram.CustomEvent) {
    const mode = String(event.currentTarget.dataset.mode) as VoteSelectionMode;
    if (!["single", "multiple"].includes(mode)) {
      return;
    }
    this.setData({
      voteSelectionMode: mode,
      voteModeLabel: mode === "single" ? "单选" : "多选",
      voteModeSingleClass: mode === "single" ? "mode-chip is-active" : "mode-chip",
      voteModeMultipleClass: mode === "multiple" ? "mode-chip is-active" : "mode-chip"
    });
  },

  handleVoteExcludeAdminChange(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    this.setData({
      voteExcludeAdmin: Boolean(event.detail.value)
    });
  },

  handleVotePublish() {
    try {
      const isRecreateMode = this.data.isRecreateMode;
      const pageData = this.data.isRecreateMode
        ? tripService.recreateVoteTool({
            topic: this.data.voteTopicInput,
            options: parseVoteOptions(this.data.voteOptionsInput),
            selectionMode: this.data.voteSelectionMode,
            excludeAdmin: this.data.voteExcludeAdmin
          })
        : tripService.publishVoteTool({
            topic: this.data.voteTopicInput,
            options: parseVoteOptions(this.data.voteOptionsInput),
            selectionMode: this.data.voteSelectionMode,
            excludeAdmin: this.data.voteExcludeAdmin
          });
      this.applyPageData(pageData);
      showSuccessToast(isRecreateMode ? "投票已重新创建" : "投票已发布");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleVoteOptionSelect(event: WechatMiniprogram.CustomEvent) {
    const optionId = String(event.currentTarget.dataset.optionId || "");
    const pageData = this.data.pageData;
    const detail = pageData?.voteDetail;
    if (!optionId || !detail?.viewerEligible) {
      return;
    }
    if (detail.selectionMode === "single" && detail.viewerHasSubmitted) {
      return;
    }
    if (detail.viewerChoice === "abstain") {
      return;
    }

    const persistedOptionIds = new Set(detail.viewerSelectedOptionIds);
    if (detail.selectionMode === "multiple" && persistedOptionIds.has(optionId)) {
      return;
    }

    const currentIds = this.data.voteSelectedOptionIds.slice();
    const exists = currentIds.includes(optionId);
    let nextIds = currentIds;

    if (this.data.voteSelectionMode === "single") {
      nextIds = exists ? [] : [optionId];
    } else if (exists) {
      nextIds = currentIds.filter((id) => id !== optionId);
    } else {
      nextIds = [...currentIds, optionId];
    }

    const voteInteraction = buildVoteInteractionState(pageData, nextIds);
    this.setData({
      voteSelectedOptionIds: nextIds,
      voteOptionCards: buildVoteOptionCards(pageData, nextIds),
      voteApproveDisabled: voteInteraction.approveDisabled,
      voteAbstainDisabled: voteInteraction.abstainDisabled,
      voteViewerResultLabel: voteInteraction.viewerResultLabel
    });
  },

  handleVoteSubmit(event: WechatMiniprogram.CustomEvent) {
    const choice = String(event.currentTarget.dataset.choice) as VoteChoice;
    if (
      (choice === "approve" && this.data.voteApproveDisabled) ||
      (choice === "abstain" && this.data.voteAbstainDisabled)
    ) {
      return;
    }
    try {
      const pageData = tripService.submitVote({
        choice,
        optionIds: choice === "approve" ? this.data.voteSelectedOptionIds : []
      });
      this.applyPageData(pageData);
      showSuccessToast("已完成投票");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleWheelItemsInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      wheelItemsInput: event.detail.value
    });
  },

  handleWheelPublish() {
    try {
      const isRecreateMode = this.data.isRecreateMode;
      const pageData = this.data.isRecreateMode
        ? tripService.recreateWheelTool({
            items: parseWheelItems(this.data.wheelItemsInput)
          })
        : tripService.publishWheelTool({
            items: parseWheelItems(this.data.wheelItemsInput)
          });
      this.applyPageData(pageData);
      showSuccessToast(isRecreateMode ? "转盘已重新创建" : "转盘内容已确定");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleWheelSpin() {
    if (this.data.wheelSpinning) {
      return;
    }

    try {
      const pageData = tripService.spinWheel();
      const items = pageData.wheelDetail?.items ?? [];
      const resultIndex = pageData.wheelDetail?.resultIndex ?? 0;
      const step = items.length ? 360 / items.length : 0;
      const targetRotation = this.data.wheelRotation + 2160 + (360 - resultIndex * step);

      this.setData({
        pageData,
        toolTitle: pageData.toolTitle,
        wheelSlices: buildWheelSlices(items),
        wheelSpinning: true,
        wheelTransitionMs: 3200,
        wheelRotation: targetRotation,
        isDraftEditing: false
      });

      setTimeout(() => {
        this.setData({
          wheelSpinning: false
        });
      }, 3200);
      showSuccessToast("大转盘已启动");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleLotteryWinnerCountInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      lotteryWinnerCountInput: event.detail.value
    });
  },

  handleLotteryExcludeAdminChange(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    this.setData({
      lotteryExcludeAdmin: Boolean(event.detail.value)
    });
  },

  handleLotteryPublish() {
    try {
      const isRecreateMode = this.data.isRecreateMode;
      const pageData = this.data.isRecreateMode
        ? tripService.recreateLotteryTool({
            winnerCount: Number(this.data.lotteryWinnerCountInput),
            excludeAdmin: this.data.lotteryExcludeAdmin
          })
        : tripService.publishLotteryTool({
            winnerCount: Number(this.data.lotteryWinnerCountInput),
            excludeAdmin: this.data.lotteryExcludeAdmin
          });
      this.applyPageData(pageData);
      showSuccessToast(isRecreateMode ? "抓阄已重新创建" : "抓阄已发布");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleLotteryClaim() {
    const pageData = this.data.pageData;
    const participants = pageData?.lotteryDetail?.participants ?? [];
    if (!participants.length || this.data.lotteryRolling) {
      return;
    }

    clearLotteryRollingTimer();
    let index = 0;
    this.setData({
      lotteryRolling: true,
      lotteryRollingText: pickRollingLabel(participants[0])
    });

    lotteryRollingInterval = setInterval(() => {
      index = (index + 1) % participants.length;
      this.setData({
        lotteryRollingText: pickRollingLabel(participants[index])
      });
    }, 90) as unknown as number;

    lotteryRollingTimeout = setTimeout(() => {
      clearLotteryRollingTimer();
      try {
        const nextPageData = tripService.claimLottery();
        this.applyPageData(nextPageData);
        showSuccessToast("结果已揭晓");
      } catch (error) {
        this.setData({
          lotteryRolling: false
        });
        this.handleActionError(error);
      }
    }, 1200) as unknown as number;
  },

  handleReset() {
    if (!this.data.toolType) {
      return;
    }

    try {
      this.setData({
        showActionSheet: false
      });
      let pageData: ToolDetailViewModel;
      if (this.data.toolType === "seat-draw") {
        pageData = tripService.resetSeatDraw();
      } else if (this.data.toolType === "vote") {
        pageData = tripService.resetVote();
      } else if (this.data.toolType === "wheel") {
        pageData = tripService.resetWheel();
      } else {
        pageData = tripService.resetLottery();
      }
      this.applyPageData(pageData);
      showSuccessToast("已重置当前玩法");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleCloseTool() {
    if (!this.data.toolType) {
      return;
    }

    try {
      this.setData({
        showActionSheet: false
      });
      let pageData: ToolDetailViewModel;
      if (this.data.toolType === "seat-draw") {
        pageData = tripService.closeSeatDraw();
      } else if (this.data.toolType === "vote") {
        pageData = tripService.closeVote();
      } else if (this.data.toolType === "wheel") {
        pageData = tripService.closeWheel();
      } else {
        pageData = tripService.closeLottery();
      }
      this.applyPageData(pageData);
      showSuccessToast("玩法已关闭");
    } catch (error) {
      this.handleActionError(error);
    }
  }
});

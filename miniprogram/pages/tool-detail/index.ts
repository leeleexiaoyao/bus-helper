import { TOOL_META } from "../../shared/constants";
import { BusinessError } from "../../shared/errors";
import type {
  SeatDrawDisplaySlotView,
  ToolDetailViewModel,
  ToolType,
  VoteChoice,
  VoteSelectionMode
} from "../../shared/types";
import { tripService } from "../../services/trip-service";
import { waitForCloudReady } from "../../utils/cloud-ready";
import { showErrorToast, showSuccessToast } from "../../utils/feedback";

type WheelSliceView = {
  id: string;
  label: string;
  style: string;
  innerStyle: string;
  sliceClassName: string;
  labelStyle: string;
};

type VoteOptionCardView = {
  id: string;
  title: string;
  label: string;
  supportCount: number;
  supportCountText: string;
  supportRateText: string;
  isSelected: boolean;
  showCheckbox: boolean;
  checkboxClassName: string;
  showResult: boolean;
  className: string;
};

type ToolHeroView = {
  eyebrowText: string;
  titleText: string;
  subtitleText: string;
  illustrationSrc: string;
  illustrationClassName: string;
  resultTitle: string;
};

let seatDrawRollingSyncTimer: number | null = null;
let voteRefreshTimer: number | null = null;

const VOTE_REFRESH_INTERVAL_MS = 10000;
const TOOL_HERO_ILLUSTRATIONS: Record<ToolType, string> = {
  "seat-draw": "/assets/icons/pic_tools_seatdraw_star.png",
  vote: "/assets/icons/icon_tools_投票.png",
  wheel: "/assets/icons/icon_tools_幸运大转盘.png",
  lottery: "/assets/icons/icon_tools_抽签.png"
};
const WHEEL_SLICE_COLORS = [
  "#fff0b7",
  "#ffd4de",
  "#d8c8ff",
  "#c9f2c2",
  "#bfe6ff",
  "#ffe1b2",
  "#ffd7b8",
  "#c8f3ec",
  "#d4e4ff",
  "#f5d7ff"
] as const;

function getHeroTopic(topic: string | null | undefined, fallback: string): string {
  const normalized = typeof topic === "string" ? topic.trim() : "";
  return normalized || fallback;
}

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

function parseLotteryAnswers(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildWheelSlices(items: string[]): WheelSliceView[] {
  const safeItems = items.slice(0, 10);
  const step = safeItems.length ? 360 / safeItems.length : 360;
  const radius = safeItems.length > 8 ? 144 : safeItems.length > 6 ? 154 : 164;
  const densityClassName = safeItems.length > 8 ? "wheel-slice is-tight" : "wheel-slice";
  const labelWidth = safeItems.length > 8 ? 122 : safeItems.length > 6 ? 132 : 142;
  return safeItems.map((item, index) => {
    const angle = Number((index * step).toFixed(2));
    return {
      id: `slice-${index}`,
      label: item,
      style: `transform: translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}rpx);`,
      innerStyle: "transform: translateX(24rpx);",
      sliceClassName: densityClassName,
      labelStyle: `width: ${labelWidth}rpx;`
    };
  });
}

function buildWheelBackgroundStyle(items: string[]): string {
  const safeItems = items.slice(0, 10);
  if (!safeItems.length) {
    return "background: #ffffff;";
  }

  const step = 360 / safeItems.length;
  const startOffset = -step / 2;
  const segments = safeItems
    .map((_, index) => {
      const start = index * step;
      const end = start + step;
      const color = WHEEL_SLICE_COLORS[index % WHEEL_SLICE_COLORS.length];
      return `${color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    })
    .join(", ");

  return `background: conic-gradient(from ${startOffset.toFixed(2)}deg, ${segments});`;
}

function buildWheelLights(count = 14): string[] {
  const radius = 286;
  const step = 360 / count;
  return Array.from({ length: count }, (_, index) => {
    const angle = index * step;
    const radians = (angle * Math.PI) / 180;
    const offsetX = (Math.sin(radians) * radius).toFixed(2);
    const offsetY = (-Math.cos(radians) * radius).toFixed(2);
    return `transform: translate(-50%, -50%) translate(${offsetX}rpx, ${offsetY}rpx); animation-delay: ${index * 120}ms;`;
  });
}

function getWheelTargetRotation(itemCount: number, resultIndex: number): number {
  if (!itemCount) {
    return 0;
  }

  const step = 360 / itemCount;
  const targetAngle = resultIndex * step;
  return 360 - targetAngle;
}

function normalizeRotation(rotation: number): number {
  const normalized = rotation % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

async function pickSecureRandomIndex(itemCount: number): Promise<number> {
  if (itemCount <= 1) {
    return 0;
  }

  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % itemCount);

  while (true) {
    const result = await wx.getRandomValues({
      length: 4
    });
    const value = new DataView(result.randomValues).getUint32(0);
    if (value < limit) {
      return value % itemCount;
    }
  }
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
  if (detail.phase !== "active") {
    return {
      approveDisabled: true,
      abstainDisabled: true,
      viewerResultLabel: detail.phase === "ended" ? "本轮投票已结束。" : ""
    };
  }

  const validOptionIds = new Set(detail.options.map((option) => option.id));
  const currentSelectedIds = Array.from(new Set(selectedIds)).filter((optionId) =>
    validOptionIds.has(optionId)
  );

  let viewerResultLabel = "";
  if (detail.viewerChoice === "approve") {
    viewerResultLabel = "你已完成投票。";
  } else if (detail.viewerChoice === "abstain") {
    viewerResultLabel = "你已完成弃权。";
  } else if (detail.viewerChoice === "reject") {
    viewerResultLabel = "你已完成否决。";
  }

  return {
    approveDisabled: detail.viewerHasSubmitted || currentSelectedIds.length === 0,
    abstainDisabled: detail.viewerHasSubmitted,
    viewerResultLabel
  };
}

function buildVoteOptionCards(pageData: ToolDetailViewModel | null, selectedIds: string[]): VoteOptionCardView[] {
  const detail = pageData?.voteDetail;
  const selectedIdSet = new Set(selectedIds);
  const shouldShowResult = Boolean(
    detail && (detail.phase === "ended" || (detail.phase === "active" && detail.viewerHasSubmitted))
  );
  const shouldShowCheckbox = Boolean(
    detail && detail.phase === "active" && detail.viewerEligible && !detail.viewerHasSubmitted
  );

  return (detail?.options ?? []).map((option, index) => {
    const isSelected = option.selectedByViewer || selectedIdSet.has(option.id);
    const supportRate =
      detail && detail.participantCount > 0
        ? Math.round((option.supportCount / detail.participantCount) * 100)
        : 0;

    return {
      id: option.id,
      title: `选项${index + 1}`,
      label: option.label,
      supportCount: option.supportCount,
      supportCountText: String(option.supportCount),
      supportRateText: `${supportRate}%`,
      isSelected,
      showCheckbox: shouldShowCheckbox,
      checkboxClassName: isSelected ? "vote-option-check is-selected" : "vote-option-check",
      showResult: shouldShowResult,
      className: isSelected ? "vote-option-card is-selected" : "vote-option-card"
    };
  });
}

function clearSeatDrawRollingTimer(): void {
  if (seatDrawRollingSyncTimer !== null) {
    clearInterval(seatDrawRollingSyncTimer);
    seatDrawRollingSyncTimer = null;
  }
}

function clearVoteRefreshTimer(): void {
  if (voteRefreshTimer !== null) {
    clearInterval(voteRefreshTimer);
    voteRefreshTimer = null;
  }
}

function buildToolHeroView(pageData: ToolDetailViewModel): ToolHeroView | null {
  if (!pageData.isStarted) {
    return null;
  }

  if (pageData.toolType === "seat-draw" && pageData.seatDrawDetail) {
    return {
      eyebrowText: "本次主题",
      titleText: getHeroTopic(pageData.seatDrawDetail.topic, "随机抽"),
      subtitleText: `要求:${pageData.seatDrawDetail.drawCount}人`,
      illustrationSrc: TOOL_HERO_ILLUSTRATIONS["seat-draw"],
      illustrationClassName: "tool-hero-illustration tool-hero-illustration--seat-draw",
      resultTitle: "历史记录"
    };
  }

  if (pageData.toolType === "vote" && pageData.voteDetail) {
    const detail = pageData.voteDetail;
    return {
      eyebrowText: "本次主题",
      titleText: getHeroTopic(detail.topic, "做选择"),
      subtitleText: `要求:${detail.maxSelections}项`,
      illustrationSrc: TOOL_HERO_ILLUSTRATIONS.vote,
      illustrationClassName: "tool-hero-illustration tool-hero-illustration--icon",
      resultTitle: "历史记录"
    };
  }

  if (pageData.toolType === "wheel" && pageData.wheelDetail) {
    return {
      eyebrowText: "本次主题",
      titleText: getHeroTopic(pageData.wheelDetail.topic, "大转盘"),
      subtitleText: `奖项:${pageData.wheelDetail.items.length}项`,
      illustrationSrc: TOOL_HERO_ILLUSTRATIONS.wheel,
      illustrationClassName: "tool-hero-illustration tool-hero-illustration--icon",
      resultTitle: "历史记录"
    };
  }

  if (pageData.toolType === "lottery" && pageData.lotteryDetail) {
    return {
      eyebrowText: "本次主题",
      titleText: getHeroTopic(pageData.lotteryDetail.topic, "幸运签"),
      subtitleText: `次数:${pageData.lotteryDetail.drawLimitPerUser}次`,
      illustrationSrc: TOOL_HERO_ILLUSTRATIONS.lottery,
      illustrationClassName: "tool-hero-illustration tool-hero-illustration--icon",
      resultTitle: "历史记录"
    };
  }

  return null;
}

function buildSeatDrawMachineClass(slots: SeatDrawDisplaySlotView[]): string {
  if (slots.length >= 5) {
    return "seat-draw-machine is-compact";
  }

  if (slots.length === 4) {
    return "seat-draw-machine is-medium";
  }

  return "seat-draw-machine is-large";
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
    heroView: null as ToolHeroView | null,
    seatDrawMachineClass: "seat-draw-machine is-large",
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
    voteMaxSelectionsInput: "1",
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
    wheelTopicInput: "",
    wheelItemsInput: "",
    wheelRotation: 0,
    wheelTransitionMs: 0,
    wheelSlices: [] as WheelSliceView[],
    wheelBackgroundStyle: "",
    wheelLights: buildWheelLights(),
    wheelSpinning: false,
    wheelVisibleHistoryLabels: [] as string[],
    wheelAllowAssignedUser: false,
    wheelAssignedUserId: "",
    wheelAssignedUserIndex: 0,
    wheelEligibleUserLabels: [] as string[],
    wheelShowResult: false,
    lotteryTopicInput: "",
    lotteryAnswersInput: "",
    lotteryDrawLimitInput: "1",
    lotteryAllowAssignedUser: false,
    lotteryAssignedUserId: "",
    lotteryAssignedUserIndex: 0,
    lotteryEligibleUserLabels: [] as string[],
    lotteryFlippingCardId: ""
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

  async onShow() {
    try {
      await waitForCloudReady();
    } catch (error) {
      showErrorToast(error);
      return;
    }

    this.refreshPage();
  },

  onHide() {
    clearSeatDrawRollingTimer();
    clearVoteRefreshTimer();
  },

  onUnload() {
    clearSeatDrawRollingTimer();
    clearVoteRefreshTimer();
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
    const voteValidOptionIds = new Set(pageData.voteDetail?.options.map((option) => option.id) ?? []);
    const localVoteSelectedOptionIds = this.data.voteSelectedOptionIds.filter((optionId) =>
      voteValidOptionIds.has(optionId)
    );
    const voteSelectedOptionIds =
      pageData.toolType === "vote" && pageData.voteDetail?.phase === "active"
        ? Array.from(
            new Set([
              ...(pageData.voteDetail?.viewerSelectedOptionIds ?? []),
              ...localVoteSelectedOptionIds
            ])
          )
        : pageData.voteDetail?.viewerSelectedOptionIds ?? [];
    const voteInteraction = buildVoteInteractionState(pageData, voteSelectedOptionIds);
    const seatDrawCount = Math.max(
      1,
      Math.min(5, pageData.seatDrawDetail?.drawCount ?? 1)
    );
    const wheelEligibleUsers = pageData.wheelDetail?.eligibleUsers ?? [];
    const wheelAssignedUserId =
      pageData.wheelDetail?.assignedUserId ??
      wheelEligibleUsers.find((member) => member.isSelf)?.userId ??
      wheelEligibleUsers[0]?.userId ??
      "";
    const wheelAssignedUserIndex = Math.max(
      0,
      wheelEligibleUsers.findIndex((member) => member.userId === wheelAssignedUserId)
    );
    const lotteryEligibleUsers = pageData.lotteryDetail?.eligibleUsers ?? [];
    const lotteryAssignedUserId =
      pageData.lotteryDetail?.assignedUserId ??
      lotteryEligibleUsers.find((member) => member.isSelf)?.userId ??
      lotteryEligibleUsers[0]?.userId ??
      "";
    const lotteryAssignedUserIndex = Math.max(
      0,
      lotteryEligibleUsers.findIndex((member) => member.userId === lotteryAssignedUserId)
    );
    const heroView = buildToolHeroView(pageData);
    this.setData({
      pageData,
      heroView,
      seatDrawMachineClass: buildSeatDrawMachineClass(pageData.seatDrawDetail?.displaySlots ?? []),
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
      voteMaxSelectionsInput: String(
        pageData.voteDetail?.maxSelections ?? (voteSelectionMode === "multiple" ? 2 : 1)
      ),
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
      wheelTopicInput: pageData.wheelDetail?.topic ?? "",
      wheelItemsInput: pageData.wheelDetail?.items.join("\n") ?? "",
      wheelRotation:
        pageData.wheelDetail?.resultIndex != null && pageData.wheelDetail.items.length
          ? getWheelTargetRotation(pageData.wheelDetail.items.length, pageData.wheelDetail.resultIndex)
          : 0,
      wheelTransitionMs: 0,
      wheelSlices: buildWheelSlices(pageData.wheelDetail?.items ?? []),
      wheelBackgroundStyle: buildWheelBackgroundStyle(pageData.wheelDetail?.items ?? []),
      wheelSpinning: false,
      wheelVisibleHistoryLabels: pageData.wheelDetail?.resultHistoryLabels ?? [],
      wheelAllowAssignedUser: pageData.wheelDetail?.allowAssignedUser ?? false,
      wheelAssignedUserId,
      wheelAssignedUserIndex,
      wheelEligibleUserLabels: wheelEligibleUsers.map(
        (member) => `${member.nickname} / ${member.seatLabel}`
      ),
      wheelShowResult: Boolean(
        pageData.wheelDetail?.resultLabel || pageData.wheelDetail?.resultHistoryLabels.length
      ),
      lotteryTopicInput: pageData.lotteryDetail?.topic ?? "",
      lotteryAnswersInput: pageData.lotteryDetail?.answers.join("\n") ?? "",
      lotteryDrawLimitInput: String(pageData.lotteryDetail?.drawLimitPerUser ?? 1),
      lotteryAllowAssignedUser: pageData.lotteryDetail?.allowAssignedUser ?? false,
      lotteryAssignedUserId,
      lotteryAssignedUserIndex,
      lotteryEligibleUserLabels: lotteryEligibleUsers.map(
        (member) => `${member.nickname} / ${member.seatLabel}`
      ),
      lotteryFlippingCardId: ""
    });
    this.syncSeatDrawRollingTimer(pageData);
    this.syncVoteRefreshTimer(pageData);
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

  syncVoteRefreshTimer(pageData: ToolDetailViewModel) {
    const shouldSync =
      pageData.toolType === "vote" &&
      pageData.isStarted &&
      pageData.voteDetail?.phase === "active" &&
      pageData.voteDetail.viewerHasSubmitted &&
      !this.data.isDraftEditing;

    if (!shouldSync) {
      clearVoteRefreshTimer();
      return;
    }

    if (voteRefreshTimer !== null) {
      return;
    }

    voteRefreshTimer = setInterval(() => {
      this.refreshPage();
    }, VOTE_REFRESH_INTERVAL_MS) as unknown as number;
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

    if (this.data.toolType === "wheel") {
      const eligibleUsers = this.data.pageData?.wheelDetail?.eligibleUsers ?? [];
      const defaultAssignedUserId =
        eligibleUsers.find((member) => member.isSelf)?.userId ?? eligibleUsers[0]?.userId ?? "";
      const defaultAssignedUserIndex = Math.max(
        0,
        eligibleUsers.findIndex((member) => member.userId === defaultAssignedUserId)
      );
      this.setData({
        isDraftEditing: true,
        isRecreateMode: false,
        wheelTopicInput: "",
        wheelItemsInput: "",
        wheelAllowAssignedUser: false,
        wheelAssignedUserId: defaultAssignedUserId,
        wheelAssignedUserIndex: defaultAssignedUserIndex
      });
      return;
    }

    if (this.data.toolType === "lottery") {
      const eligibleUsers = this.data.pageData?.lotteryDetail?.eligibleUsers ?? [];
      const defaultAssignedUserId =
        eligibleUsers.find((member) => member.isSelf)?.userId ?? eligibleUsers[0]?.userId ?? "";
      const defaultAssignedUserIndex = Math.max(
        0,
        eligibleUsers.findIndex((member) => member.userId === defaultAssignedUserId)
      );
      this.setData({
        isDraftEditing: true,
        isRecreateMode: false,
        lotteryTopicInput: "",
        lotteryAnswersInput: "",
        lotteryDrawLimitInput: "1",
        lotteryAllowAssignedUser: false,
        lotteryAssignedUserId: defaultAssignedUserId,
        lotteryAssignedUserIndex: defaultAssignedUserIndex
      });
      return;
    }

    if (this.data.toolType === "vote") {
      clearVoteRefreshTimer();
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

    if (this.data.toolType === "lottery") {
      const eligibleUsers = this.data.pageData?.lotteryDetail?.eligibleUsers ?? [];
      const assignedUserId =
        this.data.pageData?.lotteryDetail?.assignedUserId ??
        eligibleUsers.find((member) => member.isSelf)?.userId ??
        eligibleUsers[0]?.userId ??
        "";
      const assignedUserIndex = Math.max(
        0,
        eligibleUsers.findIndex((member) => member.userId === assignedUserId)
      );
      this.setData({
        isDraftEditing: true,
        isRecreateMode: true,
        showActionSheet: false,
        lotteryTopicInput: this.data.pageData?.lotteryDetail?.topic ?? "",
        lotteryAnswersInput: this.data.pageData?.lotteryDetail?.answers.join("\n") ?? "",
        lotteryDrawLimitInput: String(this.data.pageData?.lotteryDetail?.drawLimitPerUser ?? 1),
        lotteryAllowAssignedUser: this.data.pageData?.lotteryDetail?.allowAssignedUser ?? false,
        lotteryAssignedUserId: assignedUserId,
        lotteryAssignedUserIndex: assignedUserIndex
      });
      return;
    }

    if (this.data.toolType === "vote") {
      clearVoteRefreshTimer();
    }

    this.setData({
      isDraftEditing: true,
      isRecreateMode: true,
      showActionSheet: false
    });
  },

  handleOpenActionSheet() {
    if (this.data.toolType === "vote") {
      clearVoteRefreshTimer();
    }
    this.setData({
      showActionSheet: true
    });
  },

  handleCloseActionSheet() {
    this.setData({
      showActionSheet: false
    });
    if (this.data.toolType === "vote" && this.data.pageData) {
      this.syncVoteRefreshTimer(this.data.pageData);
    }
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
      voteMaxSelectionsInput:
        mode === "single"
          ? "1"
          : Number(this.data.voteMaxSelectionsInput) > 1
            ? this.data.voteMaxSelectionsInput
            : "2",
      voteModeLabel: mode === "single" ? "单选" : "多选",
      voteModeSingleClass: mode === "single" ? "mode-chip is-active" : "mode-chip",
      voteModeMultipleClass: mode === "multiple" ? "mode-chip is-active" : "mode-chip"
    });
  },

  handleVoteMaxSelectionsInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      voteMaxSelectionsInput: event.detail.value
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
            maxSelections:
              this.data.voteSelectionMode === "multiple"
                ? Number(this.data.voteMaxSelectionsInput)
                : 1,
            excludeAdmin: this.data.voteExcludeAdmin
          })
        : tripService.publishVoteTool({
            topic: this.data.voteTopicInput,
            options: parseVoteOptions(this.data.voteOptionsInput),
            selectionMode: this.data.voteSelectionMode,
            maxSelections:
              this.data.voteSelectionMode === "multiple"
                ? Number(this.data.voteMaxSelectionsInput)
                : 1,
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
    if (detail.phase !== "active") {
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
      if (currentIds.length >= detail.maxSelections) {
        showErrorToast(
          new BusinessError(
            "VOTE_SELECTION_LIMIT_EXCEEDED",
            `当前投票最多可选择 ${detail.maxSelections} 项。`
          )
        );
        return;
      }
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

  handleVoteEnd() {
    try {
      const pageData = tripService.endVote();
      this.applyPageData(pageData);
      showSuccessToast("投票已结束");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleWheelItemsInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      wheelItemsInput: event.detail.value
    });
  },

  handleWheelTopicInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      wheelTopicInput: event.detail.value
    });
  },

  handleWheelAllowAssignedUserChange(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    this.setData({
      wheelAllowAssignedUser: Boolean(event.detail.value)
    });
  },

  handleWheelAssignedUserChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const index = Number(event.detail.value ?? 0);
    const eligibleUsers = this.data.pageData?.wheelDetail?.eligibleUsers ?? [];
    const targetUser = eligibleUsers[index] ?? eligibleUsers[0] ?? null;
    this.setData({
      wheelAssignedUserIndex: index,
      wheelAssignedUserId: targetUser?.userId ?? ""
    });
  },

  handleWheelPublish() {
    try {
      const isRecreateMode = this.data.isRecreateMode;
      const pageData = this.data.isRecreateMode
        ? tripService.recreateWheelTool({
            topic: this.data.wheelTopicInput,
            items: parseWheelItems(this.data.wheelItemsInput),
            allowAssignedUser: this.data.wheelAllowAssignedUser,
            assignedUserId: this.data.wheelAllowAssignedUser ? this.data.wheelAssignedUserId : null
          })
        : tripService.publishWheelTool({
            topic: this.data.wheelTopicInput,
            items: parseWheelItems(this.data.wheelItemsInput),
            allowAssignedUser: this.data.wheelAllowAssignedUser,
            assignedUserId: this.data.wheelAllowAssignedUser ? this.data.wheelAssignedUserId : null
          });
      this.applyPageData(pageData);
      showSuccessToast(isRecreateMode ? "转盘已重新创建" : "转盘内容已确定");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  async handleWheelSpin() {
    if (this.data.wheelSpinning || !this.data.pageData?.wheelDetail?.viewerCanSpin) {
      return;
    }

    try {
      const currentItems = this.data.pageData?.wheelDetail?.items ?? [];
      const previousHistoryLabels = this.data.wheelVisibleHistoryLabels.slice();
      const selectedIndex = await pickSecureRandomIndex(currentItems.length);
      const pageData = tripService.spinWheel(selectedIndex);
      const nextItems = pageData.wheelDetail?.items ?? [];
      const resultIndex = pageData.wheelDetail?.resultIndex ?? 0;
      const targetRotationBase = getWheelTargetRotation(nextItems.length, resultIndex);
      const currentRotationBase = normalizeRotation(this.data.wheelRotation);
      const rotationDelta = normalizeRotation(targetRotationBase - currentRotationBase);
      const targetRotation = this.data.wheelRotation + 2160 + rotationDelta;

      this.setData({
        pageData,
        toolTitle: pageData.toolTitle,
        wheelSlices: buildWheelSlices(nextItems),
        wheelBackgroundStyle: buildWheelBackgroundStyle(nextItems),
        wheelSpinning: true,
        wheelShowResult: false,
        wheelVisibleHistoryLabels: previousHistoryLabels,
        wheelTransitionMs: 4800,
        wheelRotation: targetRotation,
        isDraftEditing: false
      });

      setTimeout(() => {
        this.setData({
          wheelSpinning: false,
          wheelShowResult: true,
          wheelVisibleHistoryLabels: pageData.wheelDetail?.resultHistoryLabels ?? []
        });
      }, 4800);
      showSuccessToast("大转盘已启动");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleWheelCenterTap() {
    if (!this.data.pageData?.isStarted || this.data.isDraftEditing) {
      return;
    }

    this.handleWheelSpin();
  },

  handleLotteryAnswersInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      lotteryAnswersInput: event.detail.value
    });
  },

  handleLotteryTopicInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      lotteryTopicInput: event.detail.value
    });
  },

  handleLotteryDrawLimitInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      lotteryDrawLimitInput: event.detail.value
    });
  },

  handleLotteryAllowAssignedUserChange(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    this.setData({
      lotteryAllowAssignedUser: Boolean(event.detail.value)
    });
  },

  handleLotteryAssignedUserChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const index = Number(event.detail.value ?? 0);
    const eligibleUsers = this.data.pageData?.lotteryDetail?.eligibleUsers ?? [];
    const targetUser = eligibleUsers[index] ?? eligibleUsers[0] ?? null;
    this.setData({
      lotteryAssignedUserIndex: index,
      lotteryAssignedUserId: targetUser?.userId ?? ""
    });
  },

  handleLotteryPublish() {
    try {
      const isRecreateMode = this.data.isRecreateMode;
      const pageData = this.data.isRecreateMode
        ? tripService.recreateLotteryTool({
            topic: this.data.lotteryTopicInput,
            answers: parseLotteryAnswers(this.data.lotteryAnswersInput),
            drawLimitPerUser: Number(this.data.lotteryDrawLimitInput),
            allowAssignedUser: this.data.lotteryAllowAssignedUser,
            assignedUserId: this.data.lotteryAllowAssignedUser ? this.data.lotteryAssignedUserId : null
          })
        : tripService.publishLotteryTool({
            topic: this.data.lotteryTopicInput,
            answers: parseLotteryAnswers(this.data.lotteryAnswersInput),
            drawLimitPerUser: Number(this.data.lotteryDrawLimitInput),
            allowAssignedUser: this.data.lotteryAllowAssignedUser,
            assignedUserId: this.data.lotteryAllowAssignedUser ? this.data.lotteryAssignedUserId : null
          });
      this.applyPageData(pageData);
      showSuccessToast(isRecreateMode ? "抓阄已重新创建" : "抓阄已发布");
    } catch (error) {
      this.handleActionError(error);
    }
  },

  handleLotteryCardTap(event: WechatMiniprogram.CustomEvent) {
    const cardId = String(event.currentTarget.dataset.cardId || "");
    const cards = this.data.pageData?.lotteryDetail?.cards ?? [];
    const card = cards.find((entry) => entry.id === cardId);
    if (!cardId || !card?.canClaim) {
      return;
    }

    try {
      const nextPageData = tripService.claimLottery(cardId);
      this.applyPageData(nextPageData);
      this.setData({
        lotteryFlippingCardId: cardId
      });
      showSuccessToast("结果已揭晓");
    } catch (error) {
      this.handleActionError(error);
    }
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../shared/constants");
const errors_1 = require("../../shared/errors");
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
let seatDrawRollingSyncTimer = null;
let voteRefreshTimer = null;
const VOTE_REFRESH_INTERVAL_MS = 10000;
const TOOL_HERO_ILLUSTRATIONS = {
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
];
function getHeroTopic(topic, fallback) {
    const normalized = typeof topic === "string" ? topic.trim() : "";
    return normalized || fallback;
}
function isToolType(value) {
    return ["seat-draw", "vote", "wheel", "lottery"].includes(value);
}
function parseWheelItems(input) {
    return input
        .split(/\n|,|，|;|；/)
        .map((item) => item.trim())
        .filter(Boolean);
}
function parseVoteOptions(input) {
    return input
        .split(/\n|,|，|;|；/)
        .map((item) => item.trim())
        .filter(Boolean);
}
function parseLotteryAnswers(input) {
    return input
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
}
function buildWheelSlices(items) {
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
function buildWheelBackgroundStyle(items) {
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
function buildWheelLights(count = 14) {
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
function getWheelTargetRotation(itemCount, resultIndex) {
    if (!itemCount) {
        return 0;
    }
    const step = 360 / itemCount;
    const targetAngle = resultIndex * step;
    return 360 - targetAngle;
}
function normalizeRotation(rotation) {
    const normalized = rotation % 360;
    return normalized < 0 ? normalized + 360 : normalized;
}
async function pickSecureRandomIndex(itemCount) {
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
function buildVoteInteractionState(pageData, selectedIds) {
    const detail = pageData === null || pageData === void 0 ? void 0 : pageData.voteDetail;
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
    const currentSelectedIds = Array.from(new Set(selectedIds)).filter((optionId) => validOptionIds.has(optionId));
    let viewerResultLabel = "";
    if (detail.viewerChoice === "approve") {
        viewerResultLabel = "你已完成投票。";
    }
    else if (detail.viewerChoice === "abstain") {
        viewerResultLabel = "你已完成弃权。";
    }
    else if (detail.viewerChoice === "reject") {
        viewerResultLabel = "你已完成否决。";
    }
    return {
        approveDisabled: detail.viewerHasSubmitted || currentSelectedIds.length === 0,
        abstainDisabled: detail.viewerHasSubmitted,
        viewerResultLabel
    };
}
function buildVoteOptionCards(pageData, selectedIds) {
    var _a;
    const detail = pageData === null || pageData === void 0 ? void 0 : pageData.voteDetail;
    const selectedIdSet = new Set(selectedIds);
    const shouldShowResult = Boolean(detail && (detail.phase === "ended" || (detail.phase === "active" && detail.viewerHasSubmitted)));
    const shouldShowCheckbox = Boolean(detail && detail.phase === "active" && detail.viewerEligible && !detail.viewerHasSubmitted);
    return ((_a = detail === null || detail === void 0 ? void 0 : detail.options) !== null && _a !== void 0 ? _a : []).map((option, index) => {
        const isSelected = option.selectedByViewer || selectedIdSet.has(option.id);
        const supportRate = detail && detail.participantCount > 0
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
function clearSeatDrawRollingTimer() {
    if (seatDrawRollingSyncTimer !== null) {
        clearInterval(seatDrawRollingSyncTimer);
        seatDrawRollingSyncTimer = null;
    }
}
function clearVoteRefreshTimer() {
    if (voteRefreshTimer !== null) {
        clearInterval(voteRefreshTimer);
        voteRefreshTimer = null;
    }
}
function buildToolHeroView(pageData) {
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
function buildSeatDrawMachineClass(slots) {
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
        toolType: "",
        toolTitle: "",
        pageData: null,
        heroView: null,
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
        voteSelectionMode: "single",
        voteMaxSelectionsInput: "1",
        voteExcludeAdmin: false,
        voteSelectedOptionIds: [],
        voteOptionCards: [],
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
        wheelSlices: [],
        wheelBackgroundStyle: "",
        wheelLights: buildWheelLights(),
        wheelSpinning: false,
        wheelVisibleHistoryLabels: [],
        wheelAllowAssignedUser: false,
        wheelAssignedUserId: "",
        wheelAssignedUserIndex: 0,
        wheelEligibleUserLabels: [],
        wheelShowResult: false,
        lotteryTopicInput: "",
        lotteryAnswersInput: "",
        lotteryDrawLimitInput: "1",
        lotteryAllowAssignedUser: false,
        lotteryAssignedUserId: "",
        lotteryAssignedUserIndex: 0,
        lotteryEligibleUserLabels: [],
        lotteryFlippingCardId: ""
    },
    onLoad(query) {
        const nextToolType = String(query.type || "");
        if (!isToolType(nextToolType)) {
            (0, feedback_1.showErrorToast)(new errors_1.BusinessError("INVALID_TOOL_TYPE", "未识别的玩法类型。"));
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
            toolTitle: constants_1.TOOL_META[nextToolType].title
        });
    },
    async onShow() {
        try {
            await (0, cloud_ready_1.waitForCloudReady)();
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
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
        var _a, _b, _c;
        if (!this.data.toolType) {
            return;
        }
        try {
            const pageData = this.data.toolType === "seat-draw" &&
                ((_a = this.data.pageData) === null || _a === void 0 ? void 0 : _a.isAdmin) &&
                ((_c = (_b = this.data.pageData) === null || _b === void 0 ? void 0 : _b.seatDrawDetail) === null || _c === void 0 ? void 0 : _c.phase) === "rolling"
                ? trip_service_1.tripService.advanceSeatDrawRollingFrame()
                : trip_service_1.tripService.getToolDetailPageData(this.data.toolType);
            this.applyPageData(pageData);
        }
        catch (error) {
            this.handlePageError(error);
        }
    },
    applyPageData(pageData) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42;
        const voteSelectionMode = (_b = (_a = pageData.voteDetail) === null || _a === void 0 ? void 0 : _a.selectionMode) !== null && _b !== void 0 ? _b : "single";
        const voteValidOptionIds = new Set((_d = (_c = pageData.voteDetail) === null || _c === void 0 ? void 0 : _c.options.map((option) => option.id)) !== null && _d !== void 0 ? _d : []);
        const localVoteSelectedOptionIds = this.data.voteSelectedOptionIds.filter((optionId) => voteValidOptionIds.has(optionId));
        const voteSelectedOptionIds = pageData.toolType === "vote" && ((_e = pageData.voteDetail) === null || _e === void 0 ? void 0 : _e.phase) === "active"
            ? Array.from(new Set([
                ...((_g = (_f = pageData.voteDetail) === null || _f === void 0 ? void 0 : _f.viewerSelectedOptionIds) !== null && _g !== void 0 ? _g : []),
                ...localVoteSelectedOptionIds
            ]))
            : (_j = (_h = pageData.voteDetail) === null || _h === void 0 ? void 0 : _h.viewerSelectedOptionIds) !== null && _j !== void 0 ? _j : [];
        const voteInteraction = buildVoteInteractionState(pageData, voteSelectedOptionIds);
        const seatDrawCount = Math.max(1, Math.min(5, (_l = (_k = pageData.seatDrawDetail) === null || _k === void 0 ? void 0 : _k.drawCount) !== null && _l !== void 0 ? _l : 1));
        const wheelEligibleUsers = (_o = (_m = pageData.wheelDetail) === null || _m === void 0 ? void 0 : _m.eligibleUsers) !== null && _o !== void 0 ? _o : [];
        const wheelAssignedUserId = (_u = (_s = (_q = (_p = pageData.wheelDetail) === null || _p === void 0 ? void 0 : _p.assignedUserId) !== null && _q !== void 0 ? _q : (_r = wheelEligibleUsers.find((member) => member.isSelf)) === null || _r === void 0 ? void 0 : _r.userId) !== null && _s !== void 0 ? _s : (_t = wheelEligibleUsers[0]) === null || _t === void 0 ? void 0 : _t.userId) !== null && _u !== void 0 ? _u : "";
        const wheelAssignedUserIndex = Math.max(0, wheelEligibleUsers.findIndex((member) => member.userId === wheelAssignedUserId));
        const lotteryEligibleUsers = (_w = (_v = pageData.lotteryDetail) === null || _v === void 0 ? void 0 : _v.eligibleUsers) !== null && _w !== void 0 ? _w : [];
        const lotteryAssignedUserId = (_2 = (_0 = (_y = (_x = pageData.lotteryDetail) === null || _x === void 0 ? void 0 : _x.assignedUserId) !== null && _y !== void 0 ? _y : (_z = lotteryEligibleUsers.find((member) => member.isSelf)) === null || _z === void 0 ? void 0 : _z.userId) !== null && _0 !== void 0 ? _0 : (_1 = lotteryEligibleUsers[0]) === null || _1 === void 0 ? void 0 : _1.userId) !== null && _2 !== void 0 ? _2 : "";
        const lotteryAssignedUserIndex = Math.max(0, lotteryEligibleUsers.findIndex((member) => member.userId === lotteryAssignedUserId));
        const heroView = buildToolHeroView(pageData);
        this.setData({
            pageData,
            heroView,
            seatDrawMachineClass: buildSeatDrawMachineClass((_4 = (_3 = pageData.seatDrawDetail) === null || _3 === void 0 ? void 0 : _3.displaySlots) !== null && _4 !== void 0 ? _4 : []),
            toolTitle: pageData.toolTitle,
            isDraftEditing: false,
            isRecreateMode: false,
            showActionSheet: false,
            seatDrawTopicInput: (_6 = (_5 = pageData.seatDrawDetail) === null || _5 === void 0 ? void 0 : _5.topic) !== null && _6 !== void 0 ? _6 : "",
            drawCountPickerValue: seatDrawCount - 1,
            seatDrawCountLabel: `${seatDrawCount}人`,
            seatDrawExcludePreviouslyDrawn: (_8 = (_7 = pageData.seatDrawDetail) === null || _7 === void 0 ? void 0 : _7.excludePreviouslyDrawn) !== null && _8 !== void 0 ? _8 : false,
            seatDrawExcludeAdmin: (_10 = (_9 = pageData.seatDrawDetail) === null || _9 === void 0 ? void 0 : _9.excludeAdmin) !== null && _10 !== void 0 ? _10 : false,
            voteTopicInput: (_12 = (_11 = pageData.voteDetail) === null || _11 === void 0 ? void 0 : _11.topic) !== null && _12 !== void 0 ? _12 : "",
            voteOptionsInput: (_14 = (_13 = pageData.voteDetail) === null || _13 === void 0 ? void 0 : _13.options.map((option) => option.label).join("\n")) !== null && _14 !== void 0 ? _14 : "",
            voteSelectionMode,
            voteMaxSelectionsInput: String((_16 = (_15 = pageData.voteDetail) === null || _15 === void 0 ? void 0 : _15.maxSelections) !== null && _16 !== void 0 ? _16 : (voteSelectionMode === "multiple" ? 2 : 1)),
            voteExcludeAdmin: (_18 = (_17 = pageData.voteDetail) === null || _17 === void 0 ? void 0 : _17.excludeAdmin) !== null && _18 !== void 0 ? _18 : false,
            voteSelectedOptionIds,
            voteOptionCards: buildVoteOptionCards(pageData, voteSelectedOptionIds),
            votePhaseActive: ((_19 = pageData.voteDetail) === null || _19 === void 0 ? void 0 : _19.phase) === "active",
            voteModeLabel: voteSelectionMode === "single" ? "单选" : "多选",
            voteModeSingleClass: voteSelectionMode === "single" ? "mode-chip is-active" : "mode-chip",
            voteModeMultipleClass: voteSelectionMode === "multiple" ? "mode-chip is-active" : "mode-chip",
            voteViewerResultLabel: voteInteraction.viewerResultLabel,
            voteApproveDisabled: voteInteraction.approveDisabled,
            voteAbstainDisabled: voteInteraction.abstainDisabled,
            wheelTopicInput: (_21 = (_20 = pageData.wheelDetail) === null || _20 === void 0 ? void 0 : _20.topic) !== null && _21 !== void 0 ? _21 : "",
            wheelItemsInput: (_23 = (_22 = pageData.wheelDetail) === null || _22 === void 0 ? void 0 : _22.items.join("\n")) !== null && _23 !== void 0 ? _23 : "",
            wheelRotation: ((_24 = pageData.wheelDetail) === null || _24 === void 0 ? void 0 : _24.resultIndex) != null && pageData.wheelDetail.items.length
                ? getWheelTargetRotation(pageData.wheelDetail.items.length, pageData.wheelDetail.resultIndex)
                : 0,
            wheelTransitionMs: 0,
            wheelSlices: buildWheelSlices((_26 = (_25 = pageData.wheelDetail) === null || _25 === void 0 ? void 0 : _25.items) !== null && _26 !== void 0 ? _26 : []),
            wheelBackgroundStyle: buildWheelBackgroundStyle((_28 = (_27 = pageData.wheelDetail) === null || _27 === void 0 ? void 0 : _27.items) !== null && _28 !== void 0 ? _28 : []),
            wheelSpinning: false,
            wheelVisibleHistoryLabels: (_30 = (_29 = pageData.wheelDetail) === null || _29 === void 0 ? void 0 : _29.resultHistoryLabels) !== null && _30 !== void 0 ? _30 : [],
            wheelAllowAssignedUser: (_32 = (_31 = pageData.wheelDetail) === null || _31 === void 0 ? void 0 : _31.allowAssignedUser) !== null && _32 !== void 0 ? _32 : false,
            wheelAssignedUserId,
            wheelAssignedUserIndex,
            wheelEligibleUserLabels: wheelEligibleUsers.map((member) => `${member.nickname} / ${member.seatLabel}`),
            wheelShowResult: Boolean(((_33 = pageData.wheelDetail) === null || _33 === void 0 ? void 0 : _33.resultLabel) || ((_34 = pageData.wheelDetail) === null || _34 === void 0 ? void 0 : _34.resultHistoryLabels.length)),
            lotteryTopicInput: (_36 = (_35 = pageData.lotteryDetail) === null || _35 === void 0 ? void 0 : _35.topic) !== null && _36 !== void 0 ? _36 : "",
            lotteryAnswersInput: (_38 = (_37 = pageData.lotteryDetail) === null || _37 === void 0 ? void 0 : _37.answers.join("\n")) !== null && _38 !== void 0 ? _38 : "",
            lotteryDrawLimitInput: String((_40 = (_39 = pageData.lotteryDetail) === null || _39 === void 0 ? void 0 : _39.drawLimitPerUser) !== null && _40 !== void 0 ? _40 : 1),
            lotteryAllowAssignedUser: (_42 = (_41 = pageData.lotteryDetail) === null || _41 === void 0 ? void 0 : _41.allowAssignedUser) !== null && _42 !== void 0 ? _42 : false,
            lotteryAssignedUserId,
            lotteryAssignedUserIndex,
            lotteryEligibleUserLabels: lotteryEligibleUsers.map((member) => `${member.nickname} / ${member.seatLabel}`),
            lotteryFlippingCardId: ""
        });
        this.syncSeatDrawRollingTimer(pageData);
        this.syncVoteRefreshTimer(pageData);
    },
    syncSeatDrawRollingTimer(pageData) {
        var _a;
        const shouldSync = pageData.toolType === "seat-draw" && ((_a = pageData.seatDrawDetail) === null || _a === void 0 ? void 0 : _a.phase) === "rolling";
        if (!shouldSync) {
            clearSeatDrawRollingTimer();
            return;
        }
        if (seatDrawRollingSyncTimer !== null) {
            return;
        }
        seatDrawRollingSyncTimer = setInterval(() => {
            this.refreshPage();
        }, 120);
    },
    syncVoteRefreshTimer(pageData) {
        var _a;
        const shouldSync = pageData.toolType === "vote" &&
            pageData.isStarted &&
            ((_a = pageData.voteDetail) === null || _a === void 0 ? void 0 : _a.phase) === "active" &&
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
        }, VOTE_REFRESH_INTERVAL_MS);
    },
    handlePageError(error) {
        if (error instanceof errors_1.BusinessError &&
            (error.code === "AUTH_REQUIRED" || error.code === "TRIP_REQUIRED")) {
            (0, feedback_1.showErrorToast)(error);
            wx.switchTab({
                url: "/pages/home/index"
            });
            return;
        }
        (0, feedback_1.showErrorToast)(error);
    },
    handleActionError(error) {
        if (error instanceof errors_1.BusinessError && error.code === "TOOL_NOT_STARTED") {
            this.refreshPage();
            (0, feedback_1.showErrorToast)(new errors_1.BusinessError("TOOL_NOT_STARTED", "当前玩法已关闭，页面已切回未开启状态"));
            return;
        }
        if (error instanceof errors_1.BusinessError &&
            (error.code === "AUTH_REQUIRED" || error.code === "TRIP_REQUIRED")) {
            this.handlePageError(error);
            return;
        }
        (0, feedback_1.showErrorToast)(error);
    },
    handleBack() {
        if (getCurrentPages().length > 1) {
            wx.navigateBack();
            return;
        }
        wx.switchTab({
            url: "/pages/home/index"
        });
    },
    handleCreateDraft() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
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
            const eligibleUsers = (_c = (_b = (_a = this.data.pageData) === null || _a === void 0 ? void 0 : _a.wheelDetail) === null || _b === void 0 ? void 0 : _b.eligibleUsers) !== null && _c !== void 0 ? _c : [];
            const defaultAssignedUserId = (_g = (_e = (_d = eligibleUsers.find((member) => member.isSelf)) === null || _d === void 0 ? void 0 : _d.userId) !== null && _e !== void 0 ? _e : (_f = eligibleUsers[0]) === null || _f === void 0 ? void 0 : _f.userId) !== null && _g !== void 0 ? _g : "";
            const defaultAssignedUserIndex = Math.max(0, eligibleUsers.findIndex((member) => member.userId === defaultAssignedUserId));
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
            const eligibleUsers = (_k = (_j = (_h = this.data.pageData) === null || _h === void 0 ? void 0 : _h.lotteryDetail) === null || _j === void 0 ? void 0 : _j.eligibleUsers) !== null && _k !== void 0 ? _k : [];
            const defaultAssignedUserId = (_p = (_m = (_l = eligibleUsers.find((member) => member.isSelf)) === null || _l === void 0 ? void 0 : _l.userId) !== null && _m !== void 0 ? _m : (_o = eligibleUsers[0]) === null || _o === void 0 ? void 0 : _o.userId) !== null && _p !== void 0 ? _p : "";
            const defaultAssignedUserIndex = Math.max(0, eligibleUsers.findIndex((member) => member.userId === defaultAssignedUserId));
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
        if (this.data.toolType === "seat-draw") {
            try {
                const pageData = trip_service_1.tripService.closeSeatDraw();
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
                (0, feedback_1.showSuccessToast)("已清除原有内容，请重新创建");
            }
            catch (error) {
                this.handleActionError(error);
            }
            return;
        }
        if (this.data.toolType === "lottery") {
            const eligibleUsers = (_c = (_b = (_a = this.data.pageData) === null || _a === void 0 ? void 0 : _a.lotteryDetail) === null || _b === void 0 ? void 0 : _b.eligibleUsers) !== null && _c !== void 0 ? _c : [];
            const assignedUserId = (_k = (_h = (_f = (_e = (_d = this.data.pageData) === null || _d === void 0 ? void 0 : _d.lotteryDetail) === null || _e === void 0 ? void 0 : _e.assignedUserId) !== null && _f !== void 0 ? _f : (_g = eligibleUsers.find((member) => member.isSelf)) === null || _g === void 0 ? void 0 : _g.userId) !== null && _h !== void 0 ? _h : (_j = eligibleUsers[0]) === null || _j === void 0 ? void 0 : _j.userId) !== null && _k !== void 0 ? _k : "";
            const assignedUserIndex = Math.max(0, eligibleUsers.findIndex((member) => member.userId === assignedUserId));
            this.setData({
                isDraftEditing: true,
                isRecreateMode: true,
                showActionSheet: false,
                lotteryTopicInput: (_o = (_m = (_l = this.data.pageData) === null || _l === void 0 ? void 0 : _l.lotteryDetail) === null || _m === void 0 ? void 0 : _m.topic) !== null && _o !== void 0 ? _o : "",
                lotteryAnswersInput: (_r = (_q = (_p = this.data.pageData) === null || _p === void 0 ? void 0 : _p.lotteryDetail) === null || _q === void 0 ? void 0 : _q.answers.join("\n")) !== null && _r !== void 0 ? _r : "",
                lotteryDrawLimitInput: String((_u = (_t = (_s = this.data.pageData) === null || _s === void 0 ? void 0 : _s.lotteryDetail) === null || _t === void 0 ? void 0 : _t.drawLimitPerUser) !== null && _u !== void 0 ? _u : 1),
                lotteryAllowAssignedUser: (_x = (_w = (_v = this.data.pageData) === null || _v === void 0 ? void 0 : _v.lotteryDetail) === null || _w === void 0 ? void 0 : _w.allowAssignedUser) !== null && _x !== void 0 ? _x : false,
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
    handleSheetPanelTap() { },
    handleSeatDrawTopicInput(event) {
        this.setData({
            seatDrawTopicInput: event.detail.value
        });
    },
    handleSeatDrawCountChange(event) {
        var _a;
        const value = Number((_a = event.detail.value) !== null && _a !== void 0 ? _a : 0);
        this.setData({
            drawCountPickerValue: value,
            seatDrawCountLabel: `${(value || 0) + 1}人`
        });
    },
    handleSeatDrawExcludeHistoryChange(event) {
        this.setData({
            seatDrawExcludePreviouslyDrawn: Boolean(event.detail.value)
        });
    },
    handleSeatDrawExcludeAdminChange(event) {
        this.setData({
            seatDrawExcludeAdmin: Boolean(event.detail.value)
        });
    },
    handleSeatDrawPublish() {
        var _a;
        try {
            const input = {
                topic: this.data.seatDrawTopicInput,
                drawCount: this.data.drawCountPickerValue + 1,
                excludePreviouslyDrawn: this.data.seatDrawExcludePreviouslyDrawn,
                excludeAdmin: this.data.seatDrawExcludeAdmin
            };
            const pageData = ((_a = this.data.pageData) === null || _a === void 0 ? void 0 : _a.isStarted)
                ? trip_service_1.tripService.recreateSeatDrawTool(input)
                : trip_service_1.tripService.publishSeatDrawTool(input);
            this.applyPageData(pageData);
            (0, feedback_1.showSuccessToast)(this.data.isRecreateMode ? "玩法已重新创建" : "玩法已创建");
        }
        catch (error) {
            this.handleActionError(error);
        }
    },
    handleSeatDrawRun() {
        try {
            const nextPageData = trip_service_1.tripService.startSeatDrawRound();
            this.applyPageData(nextPageData);
        }
        catch (error) {
            this.handleActionError(error);
        }
    },
    handleVoteTopicInput(event) {
        this.setData({
            voteTopicInput: event.detail.value
        });
    },
    handleVoteOptionsInput(event) {
        this.setData({
            voteOptionsInput: event.detail.value
        });
    },
    handleVoteModeSelect(event) {
        const mode = String(event.currentTarget.dataset.mode);
        if (!["single", "multiple"].includes(mode)) {
            return;
        }
        this.setData({
            voteSelectionMode: mode,
            voteMaxSelectionsInput: mode === "single"
                ? "1"
                : Number(this.data.voteMaxSelectionsInput) > 1
                    ? this.data.voteMaxSelectionsInput
                    : "2",
            voteModeLabel: mode === "single" ? "单选" : "多选",
            voteModeSingleClass: mode === "single" ? "mode-chip is-active" : "mode-chip",
            voteModeMultipleClass: mode === "multiple" ? "mode-chip is-active" : "mode-chip"
        });
    },
    handleVoteMaxSelectionsInput(event) {
        this.setData({
            voteMaxSelectionsInput: event.detail.value
        });
    },
    handleVoteExcludeAdminChange(event) {
        this.setData({
            voteExcludeAdmin: Boolean(event.detail.value)
        });
    },
    handleVotePublish() {
        try {
            const isRecreateMode = this.data.isRecreateMode;
            const pageData = this.data.isRecreateMode
                ? trip_service_1.tripService.recreateVoteTool({
                    topic: this.data.voteTopicInput,
                    options: parseVoteOptions(this.data.voteOptionsInput),
                    selectionMode: this.data.voteSelectionMode,
                    maxSelections: this.data.voteSelectionMode === "multiple"
                        ? Number(this.data.voteMaxSelectionsInput)
                        : 1,
                    excludeAdmin: this.data.voteExcludeAdmin
                })
                : trip_service_1.tripService.publishVoteTool({
                    topic: this.data.voteTopicInput,
                    options: parseVoteOptions(this.data.voteOptionsInput),
                    selectionMode: this.data.voteSelectionMode,
                    maxSelections: this.data.voteSelectionMode === "multiple"
                        ? Number(this.data.voteMaxSelectionsInput)
                        : 1,
                    excludeAdmin: this.data.voteExcludeAdmin
                });
            this.applyPageData(pageData);
            (0, feedback_1.showSuccessToast)(isRecreateMode ? "投票已重新创建" : "投票已发布");
        }
        catch (error) {
            this.handleActionError(error);
        }
    },
    handleVoteOptionSelect(event) {
        const optionId = String(event.currentTarget.dataset.optionId || "");
        const pageData = this.data.pageData;
        const detail = pageData === null || pageData === void 0 ? void 0 : pageData.voteDetail;
        if (!optionId || !(detail === null || detail === void 0 ? void 0 : detail.viewerEligible)) {
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
        }
        else if (exists) {
            nextIds = currentIds.filter((id) => id !== optionId);
        }
        else {
            if (currentIds.length >= detail.maxSelections) {
                (0, feedback_1.showErrorToast)(new errors_1.BusinessError("VOTE_SELECTION_LIMIT_EXCEEDED", `当前投票最多可选择 ${detail.maxSelections} 项。`));
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
    handleVoteSubmit(event) {
        const choice = String(event.currentTarget.dataset.choice);
        if ((choice === "approve" && this.data.voteApproveDisabled) ||
            (choice === "abstain" && this.data.voteAbstainDisabled)) {
            return;
        }
        try {
            const pageData = trip_service_1.tripService.submitVote({
                choice,
                optionIds: choice === "approve" ? this.data.voteSelectedOptionIds : []
            });
            this.applyPageData(pageData);
            (0, feedback_1.showSuccessToast)("已完成投票");
        }
        catch (error) {
            this.handleActionError(error);
        }
    },
    handleVoteEnd() {
        try {
            const pageData = trip_service_1.tripService.endVote();
            this.applyPageData(pageData);
            (0, feedback_1.showSuccessToast)("投票已结束");
        }
        catch (error) {
            this.handleActionError(error);
        }
    },
    handleWheelItemsInput(event) {
        this.setData({
            wheelItemsInput: event.detail.value
        });
    },
    handleWheelTopicInput(event) {
        this.setData({
            wheelTopicInput: event.detail.value
        });
    },
    handleWheelAllowAssignedUserChange(event) {
        this.setData({
            wheelAllowAssignedUser: Boolean(event.detail.value)
        });
    },
    handleWheelAssignedUserChange(event) {
        var _a, _b, _c, _d, _e, _f, _g;
        const index = Number((_a = event.detail.value) !== null && _a !== void 0 ? _a : 0);
        const eligibleUsers = (_d = (_c = (_b = this.data.pageData) === null || _b === void 0 ? void 0 : _b.wheelDetail) === null || _c === void 0 ? void 0 : _c.eligibleUsers) !== null && _d !== void 0 ? _d : [];
        const targetUser = (_f = (_e = eligibleUsers[index]) !== null && _e !== void 0 ? _e : eligibleUsers[0]) !== null && _f !== void 0 ? _f : null;
        this.setData({
            wheelAssignedUserIndex: index,
            wheelAssignedUserId: (_g = targetUser === null || targetUser === void 0 ? void 0 : targetUser.userId) !== null && _g !== void 0 ? _g : ""
        });
    },
    handleWheelPublish() {
        try {
            const isRecreateMode = this.data.isRecreateMode;
            const pageData = this.data.isRecreateMode
                ? trip_service_1.tripService.recreateWheelTool({
                    topic: this.data.wheelTopicInput,
                    items: parseWheelItems(this.data.wheelItemsInput),
                    allowAssignedUser: this.data.wheelAllowAssignedUser,
                    assignedUserId: this.data.wheelAllowAssignedUser ? this.data.wheelAssignedUserId : null
                })
                : trip_service_1.tripService.publishWheelTool({
                    topic: this.data.wheelTopicInput,
                    items: parseWheelItems(this.data.wheelItemsInput),
                    allowAssignedUser: this.data.wheelAllowAssignedUser,
                    assignedUserId: this.data.wheelAllowAssignedUser ? this.data.wheelAssignedUserId : null
                });
            this.applyPageData(pageData);
            (0, feedback_1.showSuccessToast)(isRecreateMode ? "转盘已重新创建" : "转盘内容已确定");
        }
        catch (error) {
            this.handleActionError(error);
        }
    },
    async handleWheelSpin() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        if (this.data.wheelSpinning || !((_b = (_a = this.data.pageData) === null || _a === void 0 ? void 0 : _a.wheelDetail) === null || _b === void 0 ? void 0 : _b.viewerCanSpin)) {
            return;
        }
        try {
            const currentItems = (_e = (_d = (_c = this.data.pageData) === null || _c === void 0 ? void 0 : _c.wheelDetail) === null || _d === void 0 ? void 0 : _d.items) !== null && _e !== void 0 ? _e : [];
            const previousHistoryLabels = this.data.wheelVisibleHistoryLabels.slice();
            const selectedIndex = await pickSecureRandomIndex(currentItems.length);
            const pageData = trip_service_1.tripService.spinWheel(selectedIndex);
            const nextItems = (_g = (_f = pageData.wheelDetail) === null || _f === void 0 ? void 0 : _f.items) !== null && _g !== void 0 ? _g : [];
            const resultIndex = (_j = (_h = pageData.wheelDetail) === null || _h === void 0 ? void 0 : _h.resultIndex) !== null && _j !== void 0 ? _j : 0;
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
                var _a, _b;
                this.setData({
                    wheelSpinning: false,
                    wheelShowResult: true,
                    wheelVisibleHistoryLabels: (_b = (_a = pageData.wheelDetail) === null || _a === void 0 ? void 0 : _a.resultHistoryLabels) !== null && _b !== void 0 ? _b : []
                });
            }, 4800);
            (0, feedback_1.showSuccessToast)("大转盘已启动");
        }
        catch (error) {
            this.handleActionError(error);
        }
    },
    handleWheelCenterTap() {
        var _a;
        if (!((_a = this.data.pageData) === null || _a === void 0 ? void 0 : _a.isStarted) || this.data.isDraftEditing) {
            return;
        }
        this.handleWheelSpin();
    },
    handleLotteryAnswersInput(event) {
        this.setData({
            lotteryAnswersInput: event.detail.value
        });
    },
    handleLotteryTopicInput(event) {
        this.setData({
            lotteryTopicInput: event.detail.value
        });
    },
    handleLotteryDrawLimitInput(event) {
        this.setData({
            lotteryDrawLimitInput: event.detail.value
        });
    },
    handleLotteryAllowAssignedUserChange(event) {
        this.setData({
            lotteryAllowAssignedUser: Boolean(event.detail.value)
        });
    },
    handleLotteryAssignedUserChange(event) {
        var _a, _b, _c, _d, _e, _f, _g;
        const index = Number((_a = event.detail.value) !== null && _a !== void 0 ? _a : 0);
        const eligibleUsers = (_d = (_c = (_b = this.data.pageData) === null || _b === void 0 ? void 0 : _b.lotteryDetail) === null || _c === void 0 ? void 0 : _c.eligibleUsers) !== null && _d !== void 0 ? _d : [];
        const targetUser = (_f = (_e = eligibleUsers[index]) !== null && _e !== void 0 ? _e : eligibleUsers[0]) !== null && _f !== void 0 ? _f : null;
        this.setData({
            lotteryAssignedUserIndex: index,
            lotteryAssignedUserId: (_g = targetUser === null || targetUser === void 0 ? void 0 : targetUser.userId) !== null && _g !== void 0 ? _g : ""
        });
    },
    handleLotteryPublish() {
        try {
            const isRecreateMode = this.data.isRecreateMode;
            const pageData = this.data.isRecreateMode
                ? trip_service_1.tripService.recreateLotteryTool({
                    topic: this.data.lotteryTopicInput,
                    answers: parseLotteryAnswers(this.data.lotteryAnswersInput),
                    drawLimitPerUser: Number(this.data.lotteryDrawLimitInput),
                    allowAssignedUser: this.data.lotteryAllowAssignedUser,
                    assignedUserId: this.data.lotteryAllowAssignedUser ? this.data.lotteryAssignedUserId : null
                })
                : trip_service_1.tripService.publishLotteryTool({
                    topic: this.data.lotteryTopicInput,
                    answers: parseLotteryAnswers(this.data.lotteryAnswersInput),
                    drawLimitPerUser: Number(this.data.lotteryDrawLimitInput),
                    allowAssignedUser: this.data.lotteryAllowAssignedUser,
                    assignedUserId: this.data.lotteryAllowAssignedUser ? this.data.lotteryAssignedUserId : null
                });
            this.applyPageData(pageData);
            (0, feedback_1.showSuccessToast)(isRecreateMode ? "抓阄已重新创建" : "抓阄已发布");
        }
        catch (error) {
            this.handleActionError(error);
        }
    },
    handleLotteryCardTap(event) {
        var _a, _b, _c;
        const cardId = String(event.currentTarget.dataset.cardId || "");
        const cards = (_c = (_b = (_a = this.data.pageData) === null || _a === void 0 ? void 0 : _a.lotteryDetail) === null || _b === void 0 ? void 0 : _b.cards) !== null && _c !== void 0 ? _c : [];
        const card = cards.find((entry) => entry.id === cardId);
        if (!cardId || !(card === null || card === void 0 ? void 0 : card.canClaim)) {
            return;
        }
        try {
            const nextPageData = trip_service_1.tripService.claimLottery(cardId);
            this.applyPageData(nextPageData);
            this.setData({
                lotteryFlippingCardId: cardId
            });
            (0, feedback_1.showSuccessToast)("结果已揭晓");
        }
        catch (error) {
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
            let pageData;
            if (this.data.toolType === "seat-draw") {
                pageData = trip_service_1.tripService.resetSeatDraw();
            }
            else if (this.data.toolType === "vote") {
                pageData = trip_service_1.tripService.resetVote();
            }
            else if (this.data.toolType === "wheel") {
                pageData = trip_service_1.tripService.resetWheel();
            }
            else {
                pageData = trip_service_1.tripService.resetLottery();
            }
            this.applyPageData(pageData);
            (0, feedback_1.showSuccessToast)("已重置当前玩法");
        }
        catch (error) {
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
            let pageData;
            if (this.data.toolType === "seat-draw") {
                pageData = trip_service_1.tripService.closeSeatDraw();
            }
            else if (this.data.toolType === "vote") {
                pageData = trip_service_1.tripService.closeVote();
            }
            else if (this.data.toolType === "wheel") {
                pageData = trip_service_1.tripService.closeWheel();
            }
            else {
                pageData = trip_service_1.tripService.closeLottery();
            }
            this.applyPageData(pageData);
            (0, feedback_1.showSuccessToast)("玩法已关闭");
        }
        catch (error) {
            this.handleActionError(error);
        }
    }
});

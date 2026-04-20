"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../shared/constants");
const errors_1 = require("../../shared/errors");
const trip_service_1 = require("../../services/trip-service");
const feedback_1 = require("../../utils/feedback");
let seatDrawRollingSyncTimer = null;
let lotteryRollingInterval = null;
let lotteryRollingTimeout = null;
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
function buildWheelSlices(items) {
    const safeItems = items.slice(0, 10);
    const step = safeItems.length ? 360 / safeItems.length : 360;
    const radius = safeItems.length > 8 ? 142 : safeItems.length > 6 ? 152 : 160;
    const densityClassName = safeItems.length > 8 ? "wheel-slice is-tight" : "wheel-slice";
    const labelWidth = safeItems.length > 8 ? 122 : safeItems.length > 6 ? 132 : 142;
    return safeItems.map((item, index) => {
        const angle = Number((index * step + step / 2).toFixed(2));
        return {
            id: `slice-${index}`,
            label: item,
            style: `transform: translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}rpx);`,
            innerStyle: "transform: rotate(180deg);",
            dividerStyle: `transform: translate(-50%, -100%) rotate(${Number((index * step).toFixed(2))}deg);`,
            sliceClassName: densityClassName,
            labelStyle: `width: ${labelWidth}rpx;`
        };
    });
}
function buildWheelBackgroundStyle(items) {
    void items;
    return "background: radial-gradient(circle at center, #fffdf8 0%, #fff6ec 58%, #ffe7cf 100%);";
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
    const targetAngle = resultIndex * step + step / 2;
    return 360 - targetAngle;
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
    const validOptionIds = new Set(detail.options.map((option) => option.id));
    const currentSelectedIds = Array.from(new Set(selectedIds)).filter((optionId) => validOptionIds.has(optionId));
    const persistedOptionIds = new Set(detail.viewerSelectedOptionIds);
    const pendingOptionCount = currentSelectedIds.filter((optionId) => !persistedOptionIds.has(optionId)).length;
    const allOptionsSelected = detail.selectionMode === "multiple" &&
        detail.options.length > 0 &&
        detail.viewerSelectedOptionIds.length >= detail.options.length;
    let viewerResultLabel = "";
    if (detail.viewerChoice === "approve") {
        if (detail.selectionMode === "multiple" &&
            detail.viewerSelectedOptionIds.length > 0 &&
            detail.viewerSelectedOptionIds.length < detail.options.length) {
            viewerResultLabel = `你已投 ${detail.viewerSelectedOptionIds.length} 项，还可继续投票。`;
        }
        else {
            viewerResultLabel = "你已完成投票。";
        }
    }
    else if (detail.viewerChoice === "abstain") {
        viewerResultLabel = "你已完成弃权。";
    }
    else if (detail.viewerChoice === "reject") {
        viewerResultLabel = "你已完成否决。";
    }
    return {
        approveDisabled: detail.selectionMode === "single"
            ? detail.viewerHasSubmitted || currentSelectedIds.length === 0
            : detail.viewerChoice === "abstain" || allOptionsSelected || pendingOptionCount === 0,
        abstainDisabled: detail.viewerHasSubmitted,
        viewerResultLabel
    };
}
function pickRollingLabel(entry) {
    return `${entry.nickname} / ${entry.seatLabel}`;
}
function buildVoteOptionCards(pageData, selectedIds) {
    var _a, _b;
    const selectedIdSet = new Set(selectedIds);
    return ((_b = (_a = pageData === null || pageData === void 0 ? void 0 : pageData.voteDetail) === null || _a === void 0 ? void 0 : _a.options) !== null && _b !== void 0 ? _b : []).map((option) => ({
        id: option.id,
        label: option.label,
        supportCount: option.supportCount,
        isSelected: option.selectedByViewer || selectedIdSet.has(option.id),
        className: option.selectedByViewer || selectedIdSet.has(option.id) ? "vote-option-card is-selected" : "vote-option-card"
    }));
}
function clearSeatDrawRollingTimer() {
    if (seatDrawRollingSyncTimer !== null) {
        clearInterval(seatDrawRollingSyncTimer);
        seatDrawRollingSyncTimer = null;
    }
}
function clearLotteryRollingTimer() {
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
        toolType: "",
        toolTitle: "",
        pageData: null,
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
        wheelItemsInput: "",
        wheelRotation: 0,
        wheelTransitionMs: 0,
        wheelSlices: [],
        wheelBackgroundStyle: "",
        wheelLights: buildWheelLights(),
        wheelSpinning: false,
        wheelAllowAssignedUser: false,
        wheelAssignedUserId: "",
        wheelAssignedUserIndex: 0,
        wheelEligibleUserLabels: [],
        wheelShowResult: false,
        lotteryWinnerCountInput: "1",
        lotteryExcludeAdmin: false,
        lotteryRolling: false,
        lotteryRollingText: ""
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16;
        const voteSelectionMode = (_b = (_a = pageData.voteDetail) === null || _a === void 0 ? void 0 : _a.selectionMode) !== null && _b !== void 0 ? _b : "single";
        const voteSelectedOptionIds = (_d = (_c = pageData.voteDetail) === null || _c === void 0 ? void 0 : _c.viewerSelectedOptionIds) !== null && _d !== void 0 ? _d : [];
        const voteInteraction = buildVoteInteractionState(pageData, voteSelectedOptionIds);
        const seatDrawCount = Math.max(1, Math.min(5, (_f = (_e = pageData.seatDrawDetail) === null || _e === void 0 ? void 0 : _e.drawCount) !== null && _f !== void 0 ? _f : 1));
        const wheelEligibleUsers = (_h = (_g = pageData.wheelDetail) === null || _g === void 0 ? void 0 : _g.eligibleUsers) !== null && _h !== void 0 ? _h : [];
        const wheelAssignedUserId = (_p = (_m = (_k = (_j = pageData.wheelDetail) === null || _j === void 0 ? void 0 : _j.assignedUserId) !== null && _k !== void 0 ? _k : (_l = wheelEligibleUsers.find((member) => member.isSelf)) === null || _l === void 0 ? void 0 : _l.userId) !== null && _m !== void 0 ? _m : (_o = wheelEligibleUsers[0]) === null || _o === void 0 ? void 0 : _o.userId) !== null && _p !== void 0 ? _p : "";
        const wheelAssignedUserIndex = Math.max(0, wheelEligibleUsers.findIndex((member) => member.userId === wheelAssignedUserId));
        this.setData({
            pageData,
            toolTitle: pageData.toolTitle,
            isDraftEditing: false,
            isRecreateMode: false,
            showActionSheet: false,
            seatDrawTopicInput: (_r = (_q = pageData.seatDrawDetail) === null || _q === void 0 ? void 0 : _q.topic) !== null && _r !== void 0 ? _r : "",
            drawCountPickerValue: seatDrawCount - 1,
            seatDrawCountLabel: `${seatDrawCount}人`,
            seatDrawExcludePreviouslyDrawn: (_t = (_s = pageData.seatDrawDetail) === null || _s === void 0 ? void 0 : _s.excludePreviouslyDrawn) !== null && _t !== void 0 ? _t : false,
            seatDrawExcludeAdmin: (_v = (_u = pageData.seatDrawDetail) === null || _u === void 0 ? void 0 : _u.excludeAdmin) !== null && _v !== void 0 ? _v : false,
            voteTopicInput: (_x = (_w = pageData.voteDetail) === null || _w === void 0 ? void 0 : _w.topic) !== null && _x !== void 0 ? _x : "",
            voteOptionsInput: (_z = (_y = pageData.voteDetail) === null || _y === void 0 ? void 0 : _y.options.map((option) => option.label).join("\n")) !== null && _z !== void 0 ? _z : "",
            voteSelectionMode,
            voteExcludeAdmin: (_1 = (_0 = pageData.voteDetail) === null || _0 === void 0 ? void 0 : _0.excludeAdmin) !== null && _1 !== void 0 ? _1 : false,
            voteSelectedOptionIds,
            voteOptionCards: buildVoteOptionCards(pageData, voteSelectedOptionIds),
            votePhaseActive: ((_2 = pageData.voteDetail) === null || _2 === void 0 ? void 0 : _2.phase) === "active",
            voteModeLabel: voteSelectionMode === "single" ? "单选" : "多选",
            voteModeSingleClass: voteSelectionMode === "single" ? "mode-chip is-active" : "mode-chip",
            voteModeMultipleClass: voteSelectionMode === "multiple" ? "mode-chip is-active" : "mode-chip",
            voteViewerResultLabel: voteInteraction.viewerResultLabel,
            voteApproveDisabled: voteInteraction.approveDisabled,
            voteAbstainDisabled: voteInteraction.abstainDisabled,
            wheelItemsInput: (_4 = (_3 = pageData.wheelDetail) === null || _3 === void 0 ? void 0 : _3.items.join("\n")) !== null && _4 !== void 0 ? _4 : "",
            wheelRotation: ((_5 = pageData.wheelDetail) === null || _5 === void 0 ? void 0 : _5.resultIndex) != null && pageData.wheelDetail.items.length
                ? getWheelTargetRotation(pageData.wheelDetail.items.length, pageData.wheelDetail.resultIndex)
                : 0,
            wheelTransitionMs: 0,
            wheelSlices: buildWheelSlices((_7 = (_6 = pageData.wheelDetail) === null || _6 === void 0 ? void 0 : _6.items) !== null && _7 !== void 0 ? _7 : []),
            wheelBackgroundStyle: buildWheelBackgroundStyle((_9 = (_8 = pageData.wheelDetail) === null || _8 === void 0 ? void 0 : _8.items) !== null && _9 !== void 0 ? _9 : []),
            wheelSpinning: false,
            wheelAllowAssignedUser: (_11 = (_10 = pageData.wheelDetail) === null || _10 === void 0 ? void 0 : _10.allowAssignedUser) !== null && _11 !== void 0 ? _11 : false,
            wheelAssignedUserId,
            wheelAssignedUserIndex,
            wheelEligibleUserLabels: wheelEligibleUsers.map((member) => `${member.nickname} / ${member.seatLabel}`),
            wheelShowResult: Boolean((_12 = pageData.wheelDetail) === null || _12 === void 0 ? void 0 : _12.resultLabel),
            lotteryWinnerCountInput: String((_14 = (_13 = pageData.lotteryDetail) === null || _13 === void 0 ? void 0 : _13.winnerCount) !== null && _14 !== void 0 ? _14 : 1),
            lotteryExcludeAdmin: (_16 = (_15 = pageData.lotteryDetail) === null || _15 === void 0 ? void 0 : _15.excludeAdmin) !== null && _16 !== void 0 ? _16 : false,
            lotteryRolling: false,
            lotteryRollingText: ""
        });
        this.syncSeatDrawRollingTimer(pageData);
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
    handlePageError(error) {
        if (error instanceof errors_1.BusinessError &&
            (error.code === "AUTH_REQUIRED" || error.code === "TRIP_REQUIRED")) {
            (0, feedback_1.showErrorToast)(error);
            wx.switchTab({
                url: "/pages/tools/index"
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
            url: "/pages/tools/index"
        });
    },
    handleCreateDraft() {
        var _a, _b, _c, _d, _e, _f, _g;
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
                wheelItemsInput: "",
                wheelAllowAssignedUser: false,
                wheelAssignedUserId: defaultAssignedUserId,
                wheelAssignedUserIndex: defaultAssignedUserIndex
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
            (0, feedback_1.showSuccessToast)("抽号已开始");
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
            voteModeLabel: mode === "single" ? "单选" : "多选",
            voteModeSingleClass: mode === "single" ? "mode-chip is-active" : "mode-chip",
            voteModeMultipleClass: mode === "multiple" ? "mode-chip is-active" : "mode-chip"
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
                    excludeAdmin: this.data.voteExcludeAdmin
                })
                : trip_service_1.tripService.publishVoteTool({
                    topic: this.data.voteTopicInput,
                    options: parseVoteOptions(this.data.voteOptionsInput),
                    selectionMode: this.data.voteSelectionMode,
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
    handleWheelItemsInput(event) {
        this.setData({
            wheelItemsInput: event.detail.value
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
                    items: parseWheelItems(this.data.wheelItemsInput),
                    allowAssignedUser: this.data.wheelAllowAssignedUser,
                    assignedUserId: this.data.wheelAllowAssignedUser ? this.data.wheelAssignedUserId : null
                })
                : trip_service_1.tripService.publishWheelTool({
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
            const selectedIndex = await pickSecureRandomIndex(currentItems.length);
            const pageData = trip_service_1.tripService.spinWheel(selectedIndex);
            const nextItems = (_g = (_f = pageData.wheelDetail) === null || _f === void 0 ? void 0 : _f.items) !== null && _g !== void 0 ? _g : [];
            const resultIndex = (_j = (_h = pageData.wheelDetail) === null || _h === void 0 ? void 0 : _h.resultIndex) !== null && _j !== void 0 ? _j : 0;
            const targetRotation = this.data.wheelRotation + 2160 + getWheelTargetRotation(nextItems.length, resultIndex);
            this.setData({
                pageData,
                toolTitle: pageData.toolTitle,
                wheelSlices: buildWheelSlices(nextItems),
                wheelBackgroundStyle: buildWheelBackgroundStyle(nextItems),
                wheelSpinning: true,
                wheelShowResult: false,
                wheelTransitionMs: 4800,
                wheelRotation: targetRotation,
                isDraftEditing: false
            });
            setTimeout(() => {
                this.setData({
                    wheelSpinning: false,
                    wheelShowResult: true
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
    handleLotteryWinnerCountInput(event) {
        this.setData({
            lotteryWinnerCountInput: event.detail.value
        });
    },
    handleLotteryExcludeAdminChange(event) {
        this.setData({
            lotteryExcludeAdmin: Boolean(event.detail.value)
        });
    },
    handleLotteryPublish() {
        try {
            const isRecreateMode = this.data.isRecreateMode;
            const pageData = this.data.isRecreateMode
                ? trip_service_1.tripService.recreateLotteryTool({
                    winnerCount: Number(this.data.lotteryWinnerCountInput),
                    excludeAdmin: this.data.lotteryExcludeAdmin
                })
                : trip_service_1.tripService.publishLotteryTool({
                    winnerCount: Number(this.data.lotteryWinnerCountInput),
                    excludeAdmin: this.data.lotteryExcludeAdmin
                });
            this.applyPageData(pageData);
            (0, feedback_1.showSuccessToast)(isRecreateMode ? "抓阄已重新创建" : "抓阄已发布");
        }
        catch (error) {
            this.handleActionError(error);
        }
    },
    handleLotteryClaim() {
        var _a, _b;
        const pageData = this.data.pageData;
        const participants = (_b = (_a = pageData === null || pageData === void 0 ? void 0 : pageData.lotteryDetail) === null || _a === void 0 ? void 0 : _a.participants) !== null && _b !== void 0 ? _b : [];
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
        }, 90);
        lotteryRollingTimeout = setTimeout(() => {
            clearLotteryRollingTimer();
            try {
                const nextPageData = trip_service_1.tripService.claimLottery();
                this.applyPageData(nextPageData);
                (0, feedback_1.showSuccessToast)("结果已揭晓");
            }
            catch (error) {
                this.setData({
                    lotteryRolling: false
                });
                this.handleActionError(error);
            }
        }, 1200);
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

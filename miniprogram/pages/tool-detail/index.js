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
        wheelSpinning: false,
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3;
        const voteSelectionMode = (_b = (_a = pageData.voteDetail) === null || _a === void 0 ? void 0 : _a.selectionMode) !== null && _b !== void 0 ? _b : "single";
        const voteSelectedOptionIds = (_d = (_c = pageData.voteDetail) === null || _c === void 0 ? void 0 : _c.viewerSelectedOptionIds) !== null && _d !== void 0 ? _d : [];
        const voteInteraction = buildVoteInteractionState(pageData, voteSelectedOptionIds);
        const seatDrawCount = Math.max(1, Math.min(5, (_f = (_e = pageData.seatDrawDetail) === null || _e === void 0 ? void 0 : _e.drawCount) !== null && _f !== void 0 ? _f : 1));
        this.setData({
            pageData,
            toolTitle: pageData.toolTitle,
            isDraftEditing: false,
            isRecreateMode: false,
            showActionSheet: false,
            seatDrawTopicInput: (_h = (_g = pageData.seatDrawDetail) === null || _g === void 0 ? void 0 : _g.topic) !== null && _h !== void 0 ? _h : "",
            drawCountPickerValue: seatDrawCount - 1,
            seatDrawCountLabel: `${seatDrawCount}人`,
            seatDrawExcludePreviouslyDrawn: (_k = (_j = pageData.seatDrawDetail) === null || _j === void 0 ? void 0 : _j.excludePreviouslyDrawn) !== null && _k !== void 0 ? _k : false,
            seatDrawExcludeAdmin: (_m = (_l = pageData.seatDrawDetail) === null || _l === void 0 ? void 0 : _l.excludeAdmin) !== null && _m !== void 0 ? _m : false,
            voteTopicInput: (_p = (_o = pageData.voteDetail) === null || _o === void 0 ? void 0 : _o.topic) !== null && _p !== void 0 ? _p : "",
            voteOptionsInput: (_r = (_q = pageData.voteDetail) === null || _q === void 0 ? void 0 : _q.options.map((option) => option.label).join("\n")) !== null && _r !== void 0 ? _r : "",
            voteSelectionMode,
            voteExcludeAdmin: (_t = (_s = pageData.voteDetail) === null || _s === void 0 ? void 0 : _s.excludeAdmin) !== null && _t !== void 0 ? _t : false,
            voteSelectedOptionIds,
            voteOptionCards: buildVoteOptionCards(pageData, voteSelectedOptionIds),
            votePhaseActive: ((_u = pageData.voteDetail) === null || _u === void 0 ? void 0 : _u.phase) === "active",
            voteModeLabel: voteSelectionMode === "single" ? "单选" : "多选",
            voteModeSingleClass: voteSelectionMode === "single" ? "mode-chip is-active" : "mode-chip",
            voteModeMultipleClass: voteSelectionMode === "multiple" ? "mode-chip is-active" : "mode-chip",
            voteViewerResultLabel: voteInteraction.viewerResultLabel,
            voteApproveDisabled: voteInteraction.approveDisabled,
            voteAbstainDisabled: voteInteraction.abstainDisabled,
            wheelItemsInput: (_w = (_v = pageData.wheelDetail) === null || _v === void 0 ? void 0 : _v.items.join("\n")) !== null && _w !== void 0 ? _w : "",
            wheelRotation: ((_x = pageData.wheelDetail) === null || _x === void 0 ? void 0 : _x.resultIndex) != null && pageData.wheelDetail.items.length
                ? 360 - (360 / pageData.wheelDetail.items.length) * pageData.wheelDetail.resultIndex
                : 0,
            wheelTransitionMs: 0,
            wheelSlices: buildWheelSlices((_z = (_y = pageData.wheelDetail) === null || _y === void 0 ? void 0 : _y.items) !== null && _z !== void 0 ? _z : []),
            wheelSpinning: false,
            lotteryWinnerCountInput: String((_1 = (_0 = pageData.lotteryDetail) === null || _0 === void 0 ? void 0 : _0.winnerCount) !== null && _1 !== void 0 ? _1 : 1),
            lotteryExcludeAdmin: (_3 = (_2 = pageData.lotteryDetail) === null || _2 === void 0 ? void 0 : _2.excludeAdmin) !== null && _3 !== void 0 ? _3 : false,
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
    handleWheelPublish() {
        try {
            const isRecreateMode = this.data.isRecreateMode;
            const pageData = this.data.isRecreateMode
                ? trip_service_1.tripService.recreateWheelTool({
                    items: parseWheelItems(this.data.wheelItemsInput)
                })
                : trip_service_1.tripService.publishWheelTool({
                    items: parseWheelItems(this.data.wheelItemsInput)
                });
            this.applyPageData(pageData);
            (0, feedback_1.showSuccessToast)(isRecreateMode ? "转盘已重新创建" : "转盘内容已确定");
        }
        catch (error) {
            this.handleActionError(error);
        }
    },
    handleWheelSpin() {
        var _a, _b, _c, _d;
        if (this.data.wheelSpinning) {
            return;
        }
        try {
            const pageData = trip_service_1.tripService.spinWheel();
            const items = (_b = (_a = pageData.wheelDetail) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : [];
            const resultIndex = (_d = (_c = pageData.wheelDetail) === null || _c === void 0 ? void 0 : _c.resultIndex) !== null && _d !== void 0 ? _d : 0;
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
            (0, feedback_1.showSuccessToast)("大转盘已启动");
        }
        catch (error) {
            this.handleActionError(error);
        }
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

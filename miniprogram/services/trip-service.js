"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripService = exports.TripService = void 0;
const constants_1 = require("../shared/constants");
const errors_1 = require("../shared/errors");
const seat_1 = require("../shared/seat");
const format_1 = require("../utils/format");
const id_1 = require("../utils/id");
const app_state_repository_1 = require("../repositories/app-state-repository");
const session_repository_1 = require("../repositories/session-repository");
const storage_adapter_1 = require("../repositories/storage-adapter");
const trip_repository_1 = require("../repositories/trip-repository");
const user_repository_1 = require("../repositories/user-repository");
const SEAT_DRAW_MAX_COUNT = 5;
const SEAT_DRAW_ROLLING_DURATION_MS = 3000;
const TOOL_PAGE_META = {
    vote: {
        displayTitle: "投票",
        displayDescription: "选出你喜欢的",
        imageUrl: "/assets/icons/icon_tools_投票.png",
        ctaLabel: "玩这个>",
        sortOrder: 1
    },
    "seat-draw": {
        displayTitle: "随机选号",
        displayDescription: "看看谁运气好",
        imageUrl: "/assets/icons/icon_tools_随机选号.png",
        ctaLabel: "玩这个>",
        sortOrder: 2
    },
    lottery: {
        displayTitle: "抽签",
        displayDescription: "谁是天选之人",
        imageUrl: "/assets/icons/icon_tools_抽签.png",
        ctaLabel: "玩这个>",
        sortOrder: 3
    },
    wheel: {
        displayTitle: "幸运大转盘",
        displayDescription: "幸运转转转",
        imageUrl: "/assets/icons/icon_tools_幸运大转盘.png",
        ctaLabel: "玩这个>",
        sortOrder: 4
    }
};
function assertTripName(tripName) {
    if (!tripName.trim()) {
        throw new errors_1.BusinessError("INVALID_TRIP_NAME", "请填写车次名称。");
    }
}
function assertPassword(password) {
    if (!/^\d{6}$/.test(password)) {
        throw new errors_1.BusinessError("INVALID_PASSWORD", "请输入 6 位数字密码。");
    }
}
function assertTemplateExists(templateId) {
    if (!constants_1.TRIP_TEMPLATES.some((template) => template.id === templateId)) {
        throw new errors_1.BusinessError("INVALID_TEMPLATE", "请选择座位模板。");
    }
}
function assertNickname(nickname, fallback) {
    const trimmed = nickname.trim();
    if (trimmed) {
        return trimmed;
    }
    if (fallback) {
        return fallback;
    }
    throw new errors_1.BusinessError("INVALID_NICKNAME", "请填写昵称。");
}
function assertVoteTopic(topic) {
    const trimmed = topic.trim();
    if (!trimmed) {
        throw new errors_1.BusinessError("INVALID_VOTE_TOPIC", "请填写投票议题。");
    }
    return trimmed;
}
function assertSeatDrawTopic(topic) {
    const trimmed = topic.trim();
    if (!trimmed) {
        throw new errors_1.BusinessError("INVALID_SEAT_DRAW_TOPIC", "请填写抽号主题。");
    }
    if (trimmed.length > 20) {
        throw new errors_1.BusinessError("SEAT_DRAW_TOPIC_TOO_LONG", "主题最多输入 20 个字。");
    }
    return trimmed;
}
function assertVoteChoice(choice) {
    if (!["approve", "reject", "abstain"].includes(choice)) {
        throw new errors_1.BusinessError("INVALID_VOTE_CHOICE", "未识别的投票选项。");
    }
    return choice;
}
function assertVoteSelectionMode(selectionMode) {
    if (!["single", "multiple"].includes(selectionMode)) {
        throw new errors_1.BusinessError("INVALID_VOTE_MODE", "未识别的投票方式。");
    }
    return selectionMode;
}
function assertVoteOptions(options) {
    const normalized = options
        .map((option) => option.trim())
        .filter(Boolean)
        .slice(0, 49);
    if (!normalized.length) {
        throw new errors_1.BusinessError("INVALID_VOTE_OPTIONS", "请至少填写 1 个投票选项。");
    }
    const uniqueSize = new Set(normalized).size;
    if (uniqueSize !== normalized.length) {
        throw new errors_1.BusinessError("DUPLICATE_VOTE_OPTIONS", "投票选项不能重复。");
    }
    return normalized;
}
function assertVoteMaxSelections(maxSelections, selectionMode, optionCount) {
    if (selectionMode === "single") {
        return 1;
    }
    const normalized = assertPositiveCount(maxSelections !== null && maxSelections !== void 0 ? maxSelections : optionCount, "INVALID_VOTE_MAX_SELECTIONS", "请填写正确的最多可选项数。");
    if (normalized > optionCount) {
        throw new errors_1.BusinessError("VOTE_MAX_SELECTIONS_TOO_LARGE", "最多可选项数不能超过投票选项数。");
    }
    return normalized;
}
function assertWheelItems(items) {
    const normalized = items
        .map((item) => item.trim())
        .filter(Boolean);
    if (normalized.length < 2) {
        throw new errors_1.BusinessError("INVALID_WHEEL_ITEMS", "请至少填写 2 个转盘内容。");
    }
    if (normalized.length > constants_1.WHEEL_MAX_ITEMS) {
        throw new errors_1.BusinessError("WHEEL_ITEMS_LIMIT_EXCEEDED", `大转盘最多可填写 ${constants_1.WHEEL_MAX_ITEMS} 个奖品项。`);
    }
    return normalized;
}
function assertLotteryAnswers(answers) {
    const normalized = answers
        .map((answer) => answer.trim())
        .filter(Boolean);
    if (!normalized.length) {
        throw new errors_1.BusinessError("INVALID_LOTTERY_ANSWERS", "请至少填写 1 个答案。");
    }
    return normalized;
}
function assertLotteryDrawLimit(count) {
    return assertPositiveCount(count, "INVALID_LOTTERY_DRAW_LIMIT", "请填写正确的抽取次数。");
}
function isLegacyGeneratedWheelItem(item) {
    return /^选项\d+\s*[-—:：]\s*.+$/.test(item.trim());
}
function assertPositiveCount(count, code, message) {
    const normalized = Number(count);
    if (!Number.isInteger(normalized) || normalized <= 0) {
        throw new errors_1.BusinessError(code, message);
    }
    return normalized;
}
function assertSeatDrawCount(count) {
    const normalized = assertPositiveCount(count, "INVALID_DRAW_COUNT", "请选择正确的抽号人数。");
    if (normalized > SEAT_DRAW_MAX_COUNT) {
        throw new errors_1.BusinessError("DRAW_COUNT_LIMIT_EXCEEDED", "单次抽号人数最多为 5 人。");
    }
    return normalized;
}
function getTemplateLabel(templateId) {
    if (templateId === "template-49") {
        return "49 座";
    }
    if (templateId === "template-53") {
        return "53 座";
    }
    return "57 座";
}
function resolveHomePersonaImageUrl(homePersonaAssetId) {
    var _a, _b;
    if (!homePersonaAssetId) {
        return "";
    }
    return (_b = (_a = constants_1.HOME_PERSONA_OPTIONS.find((option) => option.id === homePersonaAssetId)) === null || _a === void 0 ? void 0 : _a.imageUrl) !== null && _b !== void 0 ? _b : "";
}
function normalizeProfileText(value) {
    return value.trim();
}
function normalizeProfileBio(value) {
    const normalized = value.trim();
    if (normalized.length > 40) {
        throw new errors_1.BusinessError("PROFILE_BIO_TOO_LONG", "个人签名最多输入 40 个字。");
    }
    return normalized;
}
function normalizeProfileTags(tagsInput) {
    const tags = (0, format_1.parseTags)(tagsInput);
    if (tags.length > 4) {
        throw new errors_1.BusinessError("PROFILE_TAGS_LIMIT_EXCEEDED", "最多填写 4 个标签。");
    }
    const oversizedTag = tags.find((tag) => tag.length > 6);
    if (oversizedTag) {
        throw new errors_1.BusinessError("PROFILE_TAG_TOO_LONG", "每个标签最多输入 6 个字。");
    }
    return tags;
}
function normalizeAge(value) {
    return value.replace(/\D+/g, "").slice(0, 3);
}
function uniqueByUserId(entries) {
    const map = new Map();
    entries.forEach((entry) => {
        map.set(entry.userId, entry);
    });
    return Array.from(map.values());
}
function shuffleArray(items) {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
        const targetIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    }
    return next;
}
function pickRandomItems(items, count) {
    return shuffleArray(items).slice(0, count);
}
function buildLotteryCards(answers) {
    return shuffleArray(answers).map((answer, index) => ({
        id: `${(0, id_1.createId)("lottery-card")}-${index + 1}`,
        order: index + 1,
        answer,
        claimedByUserId: null,
        claimedAt: null
    }));
}
function buildVoteOptions(optionLabels) {
    return optionLabels.map((label) => ({
        id: (0, id_1.createId)("vote-option"),
        label
    }));
}
function remapVoteOptionIds(previousOptions, nextOptions, optionIds) {
    const previousLabelById = previousOptions.reduce((accumulator, option) => {
        accumulator[option.id] = option.label;
        return accumulator;
    }, {});
    const nextIdByLabel = nextOptions.reduce((accumulator, option) => {
        accumulator[option.label] = option.id;
        return accumulator;
    }, {});
    return Array.from(new Set(optionIds
        .map((optionId) => { var _a; return (_a = previousLabelById[optionId]) !== null && _a !== void 0 ? _a : ""; })
        .filter(Boolean)
        .map((label) => { var _a; return (_a = nextIdByLabel[label]) !== null && _a !== void 0 ? _a : ""; })
        .filter(Boolean)));
}
function getToolPhaseLabel(toolState) {
    if (!toolState) {
        return "未开启";
    }
    if (toolState.type === "seat-draw") {
        if (toolState.phase === "rolling") {
            return "抽号中";
        }
        return toolState.phase === "result" ? "已结束" : "待开始";
    }
    if (toolState.type === "vote") {
        if (toolState.phase === "active") {
            return "投票中";
        }
        return toolState.phase === "ended" ? "已结束" : "待发布";
    }
    if (toolState.type === "wheel") {
        return toolState.phase === "result" ? "已落点" : "待转动";
    }
    return toolState.cards.some((card) => !card.claimedByUserId) ? "进行中" : "已抽完";
}
function getVoteChoiceLabel(choice) {
    if (choice === "approve") {
        return "投票";
    }
    if (choice === "reject") {
        return "否决";
    }
    if (choice === "abstain") {
        return "弃权";
    }
    return "未投票";
}
function compareVoteResultOptions(left, right) {
    if (right.supportCount !== left.supportCount) {
        return right.supportCount - left.supportCount;
    }
    return left.label.localeCompare(right.label, "zh-Hans-CN");
}
class TripService {
    constructor(storageAdapter = storage_adapter_1.wxStorageAdapter) {
        this.appStateRepository = new app_state_repository_1.AppStateRepository(storageAdapter);
        this.userRepository = new user_repository_1.UserRepository(this.appStateRepository);
        this.tripRepository = new trip_repository_1.TripRepository(this.appStateRepository);
        this.sessionRepository = new session_repository_1.SessionRepository(this.appStateRepository);
    }
    bootstrapApp() {
        const currentUser = this.getActiveUser();
        return {
            currentUser,
            demoUsers: this.buildDemoUsers(currentUser.id),
            homeMode: currentUser.currentTripId ? "trip" : "landing",
            currentTrip: currentUser.currentTripId
                ? this.buildCurrentTripView(currentUser.currentTripId, currentUser.id)
                : null
        };
    }
    ensureAuthorizedAccess() {
        const currentUser = this.getActiveUser();
        this.assertAuthorizedUser(currentUser);
        return currentUser;
    }
    getToolsPageData() {
        const currentUser = this.getActiveUser();
        const accessState = this.buildAccessState(currentUser);
        let currentTrip = currentUser.currentTripId
            ? this.tripRepository.getTrip(currentUser.currentTripId)
            : null;
        if (currentTrip && this.finalizeSeatDrawRoundIfDueForTrip(currentTrip.id)) {
            currentTrip = this.tripRepository.getTrip(currentTrip.id);
        }
        const role = currentTrip ? this.requireMembership(currentTrip.id, currentUser.id).role : null;
        return Object.assign(Object.assign({}, accessState), { tripName: currentTrip ? (0, format_1.displayTripName)(currentTrip.tripName) : "未加入车次", viewerRoleLabel: role === "admin" ? "管理员" : role === "member" ? "成员" : "暂未加入", isAdmin: role === "admin", emptyTitle: currentTrip ? "所有玩法都在这里" : "先创建或加入车次", emptyDescription: currentTrip
                ? "每个玩法都可以单独进入详情页；管理员创建并确定后，普通用户才会看到已发布内容。"
                : "加入车次后，才能进入玩法详情页。", toolCards: this.buildToolCards(currentUser, currentTrip, role) });
    }
    getToolDetailPageData(toolType) {
        const context = this.requireTripContext();
        this.assertAuthorizedUser(context.currentUser);
        if (toolType === "seat-draw") {
            this.finalizeSeatDrawRoundIfDueForTrip(context.tripId);
        }
        const trip = this.tripRepository.getTrip(context.tripId);
        const toolState = this.getPublishedToolState(trip, toolType);
        return Object.assign(Object.assign({}, this.buildAccessState(context.currentUser)), { tripName: (0, format_1.displayTripName)(trip.tripName), viewerRoleLabel: context.role === "admin" ? "管理员" : "成员", isAdmin: context.role === "admin", toolType, toolTitle: constants_1.TOOL_META[toolType].title, toolDescription: constants_1.TOOL_META[toolType].description, isStarted: Boolean(toolState), phaseLabel: getToolPhaseLabel(toolState), statusMessage: this.buildToolStatusMessage(toolType, toolState, context.currentUser.id, context.role), seatDrawDetail: toolType === "seat-draw"
                ? this.buildSeatDrawDetail(trip, toolState, context.currentUser.id)
                : null, voteDetail: toolType === "vote"
                ? this.buildVoteDetail(toolState, context.currentUser.id)
                : null, wheelDetail: toolType === "wheel"
                ? this.buildWheelDetail(trip, toolState, context.currentUser.id, context.role)
                : null, lotteryDetail: toolType === "lottery"
                ? this.buildLotteryDetail(context.trip, toolState, context.currentUser.id)
                : null });
    }
    publishSeatDrawTool(input) {
        const context = this.requireAdminTripContext();
        if (this.getPublishedToolState(context.trip, "seat-draw")) {
            throw new errors_1.BusinessError("TOOL_ALREADY_STARTED", "玩法已创建，不能再次修改，请使用重置。");
        }
        const topic = assertSeatDrawTopic(input.topic);
        const drawCount = assertSeatDrawCount(input.drawCount);
        const excludeAdmin = Boolean(input.excludeAdmin);
        const excludePreviouslyDrawn = Boolean(input.excludePreviouslyDrawn);
        const eligibleCount = this.getSeatDrawEligibleSnapshots(context.trip, excludeAdmin, []).length;
        if (!eligibleCount) {
            throw new errors_1.BusinessError("DRAW_POOL_EMPTY", "当前没有可抽取的成员。");
        }
        if (drawCount > eligibleCount) {
            throw new errors_1.BusinessError("DRAW_COUNT_TOO_LARGE", "抽取数量不能超过当前可抽成员数。");
        }
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            trip.tools["seat-draw"] = {
                type: "seat-draw",
                publishedAt: Date.now(),
                publishedByUserId: context.currentUser.id,
                phase: "ready",
                topic,
                config: {
                    drawCount,
                    excludePreviouslyDrawn,
                    excludeAdmin
                },
                rollingDisplayEntries: [],
                pendingResult: [],
                drawnEntries: [],
                resultRounds: [],
                rollingStartedAt: null,
                rollingEndsAt: null,
                lastResult: [],
            };
        });
        return this.getToolDetailPageData("seat-draw");
    }
    recreateSeatDrawTool(input) {
        const context = this.requireAdminTripContext();
        const toolState = this.requireStartedTool(context.trip, "seat-draw");
        const topic = assertSeatDrawTopic(input.topic);
        const drawCount = assertSeatDrawCount(input.drawCount);
        const excludeAdmin = Boolean(input.excludeAdmin);
        const excludePreviouslyDrawn = Boolean(input.excludePreviouslyDrawn);
        const eligibleCount = this.getSeatDrawEligibleSnapshots(context.trip, excludeAdmin, excludePreviouslyDrawn ? toolState.drawnEntries : []).length;
        if (!eligibleCount) {
            throw new errors_1.BusinessError("DRAW_POOL_EMPTY", "当前没有可抽取的成员。");
        }
        if (drawCount > eligibleCount) {
            throw new errors_1.BusinessError("DRAW_COUNT_TOO_LARGE", "抽取数量不能超过当前可抽成员数。");
        }
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "seat-draw");
            nextState.publishedAt = Date.now();
            nextState.publishedByUserId = context.currentUser.id;
            nextState.phase = "ready";
            nextState.topic = topic;
            nextState.config = {
                drawCount,
                excludePreviouslyDrawn,
                excludeAdmin
            };
            nextState.rollingDisplayEntries = [];
            nextState.pendingResult = [];
            nextState.drawnEntries = [];
            nextState.resultRounds = [];
            nextState.rollingStartedAt = null;
            nextState.rollingEndsAt = null;
            nextState.lastResult = [];
        });
        return this.getToolDetailPageData("seat-draw");
    }
    startSeatDrawRound() {
        const context = this.requireAdminTripContext();
        this.finalizeSeatDrawRoundIfDueForTrip(context.tripId);
        const trip = this.tripRepository.getTrip(context.tripId);
        const toolState = this.requireStartedTool(trip, "seat-draw");
        if (toolState.phase === "rolling") {
            throw new errors_1.BusinessError("SEAT_DRAW_ROLLING", "当前正在抽号中。");
        }
        const eligibleMembers = this.getSeatDrawEligibleSnapshots(trip, toolState.config.excludeAdmin, toolState.config.excludePreviouslyDrawn ? toolState.drawnEntries : []);
        if (!eligibleMembers.length) {
            throw new errors_1.BusinessError("DRAW_POOL_EMPTY", "当前没有可抽取的成员。");
        }
        const drawCount = Math.min(toolState.config.drawCount, eligibleMembers.length);
        const pendingResult = pickRandomItems(eligibleMembers, drawCount);
        const rollingDisplayEntries = this.createSeatDrawRollingFrame(eligibleMembers, drawCount);
        const rollingStartedAt = Date.now();
        const rollingEndsAt = rollingStartedAt + SEAT_DRAW_ROLLING_DURATION_MS;
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "seat-draw");
            nextState.phase = "rolling";
            nextState.rollingDisplayEntries = rollingDisplayEntries;
            nextState.pendingResult = pendingResult;
            nextState.rollingStartedAt = rollingStartedAt;
            nextState.rollingEndsAt = rollingEndsAt;
            nextState.lastResult = [];
        });
        return this.getToolDetailPageData("seat-draw");
    }
    advanceSeatDrawRollingFrame() {
        const context = this.requireAdminTripContext();
        if (this.finalizeSeatDrawRoundIfDueForTrip(context.tripId)) {
            return this.getToolDetailPageData("seat-draw");
        }
        const trip = this.tripRepository.getTrip(context.tripId);
        const toolState = this.requireStartedTool(trip, "seat-draw");
        if (toolState.phase !== "rolling") {
            return this.getToolDetailPageData("seat-draw");
        }
        const eligibleMembers = this.getSeatDrawEligibleSnapshots(trip, toolState.config.excludeAdmin, toolState.config.excludePreviouslyDrawn ? toolState.drawnEntries : []);
        const displayCount = Math.max(toolState.pendingResult.length, 1);
        const rollingDisplayEntries = this.createSeatDrawRollingFrame(eligibleMembers, displayCount);
        this.tripRepository.updateTrip(context.tripId, (nextTrip) => {
            const nextState = this.requireStartedTool(nextTrip, "seat-draw");
            if (nextState.phase !== "rolling") {
                return;
            }
            nextState.rollingDisplayEntries = rollingDisplayEntries;
        });
        return this.getToolDetailPageData("seat-draw");
    }
    finalizeSeatDrawRoundIfDue() {
        const context = this.requireTripContext();
        this.finalizeSeatDrawRoundIfDueForTrip(context.tripId);
        return this.getToolDetailPageData("seat-draw");
    }
    drawSeat() {
        const context = this.requireAdminTripContext();
        this.startSeatDrawRound();
        this.finalizeSeatDrawRoundIfDueForTrip(context.tripId, true);
        return this.getToolDetailPageData("seat-draw");
    }
    resetSeatDraw() {
        const context = this.requireAdminTripContext();
        this.requireStartedTool(context.trip, "seat-draw");
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "seat-draw");
            nextState.phase = "ready";
            nextState.rollingDisplayEntries = [];
            nextState.pendingResult = [];
            nextState.drawnEntries = [];
            nextState.resultRounds = [];
            nextState.rollingStartedAt = null;
            nextState.rollingEndsAt = null;
            nextState.lastResult = [];
        });
        return this.getToolDetailPageData("seat-draw");
    }
    closeSeatDraw() {
        return this.closeTool("seat-draw");
    }
    publishVoteTool(input) {
        const context = this.requireAdminTripContext();
        if (this.getPublishedToolState(context.trip, "vote")) {
            throw new errors_1.BusinessError("TOOL_ALREADY_STARTED", "玩法已创建，不能再次修改，请使用重置。");
        }
        const topic = assertVoteTopic(input.topic);
        const selectionMode = assertVoteSelectionMode(input.selectionMode);
        const optionLabels = assertVoteOptions(input.options);
        const maxSelections = assertVoteMaxSelections(input.maxSelections, selectionMode, optionLabels.length);
        const excludeAdmin = Boolean(input.excludeAdmin);
        const participantUserIds = this.listTripParticipantUserIds(context.tripId, excludeAdmin);
        if (!participantUserIds.length) {
            throw new errors_1.BusinessError("VOTE_NO_PARTICIPANTS", "当前没有可参与投票的成员。");
        }
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            trip.tools.vote = {
                type: "vote",
                publishedAt: Date.now(),
                publishedByUserId: context.currentUser.id,
                phase: "active",
                topic,
                selectionMode,
                maxSelections,
                options: buildVoteOptions(optionLabels),
                excludeAdmin,
                participantUserIds,
                submissions: {}
            };
        });
        return this.getToolDetailPageData("vote");
    }
    recreateVoteTool(input) {
        const context = this.requireAdminTripContext();
        const toolState = this.requireStartedTool(context.trip, "vote");
        const topic = assertVoteTopic(input.topic);
        const selectionMode = assertVoteSelectionMode(input.selectionMode);
        const optionLabels = assertVoteOptions(input.options);
        const maxSelections = assertVoteMaxSelections(input.maxSelections, selectionMode, optionLabels.length);
        const excludeAdmin = Boolean(input.excludeAdmin);
        const participantUserIds = this.listTripParticipantUserIds(context.tripId, excludeAdmin);
        if (!participantUserIds.length) {
            throw new errors_1.BusinessError("VOTE_NO_PARTICIPANTS", "当前没有可参与投票的成员。");
        }
        const nextOptions = buildVoteOptions(optionLabels);
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "vote");
            const previousOptions = nextState.options;
            const previousSubmissions = nextState.submissions;
            const nextSubmissions = Object.entries(previousSubmissions).reduce((accumulator, [userId, submission]) => {
                const remappedOptionIds = remapVoteOptionIds(previousOptions, nextOptions, submission.optionIds);
                accumulator[userId] = Object.assign(Object.assign({}, submission), { optionIds: selectionMode === "single"
                        ? remappedOptionIds.slice(0, 1)
                        : remappedOptionIds.slice(0, maxSelections) });
                return accumulator;
            }, {});
            nextState.publishedAt = Date.now();
            nextState.publishedByUserId = context.currentUser.id;
            nextState.topic = topic;
            nextState.selectionMode = selectionMode;
            nextState.maxSelections = maxSelections;
            nextState.excludeAdmin = excludeAdmin;
            nextState.options = nextOptions;
            nextState.participantUserIds = participantUserIds;
            nextState.submissions = nextSubmissions;
        });
        return this.getToolDetailPageData("vote");
    }
    submitVote(input) {
        var _a;
        const context = this.requireTripContext();
        const safeChoice = assertVoteChoice(input.choice);
        const optionIds = Array.isArray(input.optionIds)
            ? input.optionIds.map((optionId) => optionId.trim()).filter(Boolean)
            : [];
        const toolState = this.requireStartedTool(context.trip, "vote");
        const existingSubmission = (_a = toolState.submissions[context.currentUser.id]) !== null && _a !== void 0 ? _a : null;
        if (toolState.phase === "draft") {
            throw new errors_1.BusinessError("VOTE_NOT_STARTED", "管理员还没有发布本轮投票。");
        }
        if (toolState.phase === "ended") {
            throw new errors_1.BusinessError("VOTE_ENDED", "本轮投票已结束。");
        }
        if (!toolState.participantUserIds.includes(context.currentUser.id)) {
            throw new errors_1.BusinessError("VOTE_NOT_ALLOWED", "你不在本轮投票名单中。");
        }
        if (existingSubmission &&
            !(toolState.selectionMode === "multiple" &&
                safeChoice === "approve" &&
                existingSubmission.choice === "approve")) {
            throw new errors_1.BusinessError("VOTE_ALREADY_SUBMITTED", "本轮投票只能提交一次。");
        }
        const validOptionIds = new Set(toolState.options.map((option) => option.id));
        const normalizedOptionIds = Array.from(new Set(optionIds)).filter((optionId) => validOptionIds.has(optionId));
        const existingOptionIds = (existingSubmission === null || existingSubmission === void 0 ? void 0 : existingSubmission.choice) === "approve" ? existingSubmission.optionIds : [];
        const mergedOptionIds = Array.from(new Set([...existingOptionIds, ...normalizedOptionIds]));
        if (safeChoice === "approve" && !normalizedOptionIds.length) {
            throw new errors_1.BusinessError("VOTE_OPTION_REQUIRED", "请先选择投票选项。");
        }
        if (toolState.selectionMode === "single" && normalizedOptionIds.length > 1) {
            throw new errors_1.BusinessError("VOTE_SINGLE_OPTION_ONLY", "当前投票为单选，请只选择 1 个选项。");
        }
        if (toolState.selectionMode === "multiple" &&
            safeChoice === "approve" &&
            (existingSubmission === null || existingSubmission === void 0 ? void 0 : existingSubmission.choice) === "approve") {
            if (existingOptionIds.length >= toolState.maxSelections) {
                throw new errors_1.BusinessError("VOTE_ALREADY_SUBMITTED", "可投选项都已经投完了。");
            }
            if (mergedOptionIds.length === existingOptionIds.length) {
                throw new errors_1.BusinessError("VOTE_OPTION_REQUIRED", "请先选择新的投票选项。");
            }
        }
        if (toolState.selectionMode === "multiple" && mergedOptionIds.length > toolState.maxSelections) {
            throw new errors_1.BusinessError("VOTE_SELECTION_LIMIT_EXCEEDED", `当前投票最多可选择 ${toolState.maxSelections} 项。`);
        }
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "vote");
            nextState.submissions[context.currentUser.id] = {
                choice: safeChoice,
                optionIds: nextState.selectionMode === "multiple" && safeChoice === "approve"
                    ? mergedOptionIds
                    : normalizedOptionIds,
                submittedAt: Date.now()
            };
        });
        return this.getToolDetailPageData("vote");
    }
    resetVote() {
        const context = this.requireAdminTripContext();
        const toolState = this.requireStartedTool(context.trip, "vote");
        const participantUserIds = this.listTripParticipantUserIds(context.tripId, toolState.excludeAdmin);
        if (!participantUserIds.length) {
            throw new errors_1.BusinessError("VOTE_NO_PARTICIPANTS", "当前没有可参与投票的成员。");
        }
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "vote");
            nextState.phase = "active";
            nextState.participantUserIds = participantUserIds;
            nextState.submissions = {};
        });
        return this.getToolDetailPageData("vote");
    }
    endVote() {
        const context = this.requireAdminTripContext();
        const toolState = this.requireStartedTool(context.trip, "vote");
        if (toolState.phase === "ended") {
            throw new errors_1.BusinessError("VOTE_ALREADY_ENDED", "本轮投票已经结束。");
        }
        if (toolState.phase !== "active") {
            throw new errors_1.BusinessError("VOTE_NOT_STARTED", "管理员还没有发布本轮投票。");
        }
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "vote");
            nextState.phase = "ended";
        });
        return this.getToolDetailPageData("vote");
    }
    closeVote() {
        return this.closeTool("vote");
    }
    publishWheelTool(input) {
        const context = this.requireAdminTripContext();
        if (this.getPublishedToolState(context.trip, "wheel")) {
            throw new errors_1.BusinessError("TOOL_ALREADY_STARTED", "玩法已创建，不能再次修改，请使用重置。");
        }
        const items = assertWheelItems(input.items);
        const permissionConfig = this.resolveWheelPermissionConfig(context.tripId, input);
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            trip.tools.wheel = {
                type: "wheel",
                publishedAt: Date.now(),
                publishedByUserId: context.currentUser.id,
                phase: "draft",
                items,
                allowAssignedUser: permissionConfig.allowAssignedUser,
                assignedUserId: permissionConfig.assignedUserId,
                resultIndex: null,
                resultHistoryLabels: [],
                spunAt: null
            };
        });
        return this.getToolDetailPageData("wheel");
    }
    recreateWheelTool(input) {
        var _a;
        const context = this.requireAdminTripContext();
        const toolState = this.requireStartedTool(context.trip, "wheel");
        const items = assertWheelItems(input.items);
        const permissionConfig = this.resolveWheelPermissionConfig(context.tripId, input);
        const previousResultLabel = toolState.resultIndex === null ? null : (_a = toolState.items[toolState.resultIndex]) !== null && _a !== void 0 ? _a : null;
        const nextResultIndex = previousResultLabel ? items.indexOf(previousResultLabel) : -1;
        const previousHistoryLabels = Array.isArray(toolState.resultHistoryLabels)
            ? toolState.resultHistoryLabels.filter((label) => items.includes(label))
            : [];
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "wheel");
            nextState.publishedAt = Date.now();
            nextState.publishedByUserId = context.currentUser.id;
            nextState.items = items;
            nextState.allowAssignedUser = permissionConfig.allowAssignedUser;
            nextState.assignedUserId = permissionConfig.assignedUserId;
            nextState.resultIndex = nextResultIndex >= 0 ? nextResultIndex : null;
            nextState.resultHistoryLabels = previousHistoryLabels;
            nextState.phase = nextState.resultIndex === null ? "draft" : "result";
        });
        return this.getToolDetailPageData("wheel");
    }
    spinWheel(selectedIndex) {
        const context = this.requireTripContext();
        const toolState = this.requireStartedTool(context.trip, "wheel");
        this.assertViewerCanSpinWheel(toolState, context.currentUser.id, context.role);
        const items = assertWheelItems(toolState.items);
        const resultIndex = typeof selectedIndex === "number" && Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < items.length
            ? selectedIndex
            : Math.floor(Math.random() * items.length);
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "wheel");
            nextState.phase = "result";
            nextState.resultIndex = resultIndex;
            nextState.resultHistoryLabels = [
                ...(Array.isArray(nextState.resultHistoryLabels) ? nextState.resultHistoryLabels : []),
                items[resultIndex]
            ];
            nextState.spunAt = Date.now();
        });
        return this.getToolDetailPageData("wheel");
    }
    resetWheel() {
        const context = this.requireAdminTripContext();
        this.requireStartedTool(context.trip, "wheel");
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "wheel");
            nextState.phase = "draft";
            nextState.resultIndex = null;
            nextState.resultHistoryLabels = [];
            nextState.spunAt = null;
        });
        return this.getToolDetailPageData("wheel");
    }
    closeWheel() {
        return this.closeTool("wheel");
    }
    publishLotteryTool(input) {
        const context = this.requireAdminTripContext();
        if (this.getPublishedToolState(context.trip, "lottery")) {
            throw new errors_1.BusinessError("TOOL_ALREADY_STARTED", "玩法已创建，不能再次修改，请使用重置。");
        }
        const answers = assertLotteryAnswers(input.answers);
        const drawLimitPerUser = assertLotteryDrawLimit(input.drawLimitPerUser);
        const permissionConfig = this.resolveLotteryPermissionConfig(context.tripId, context.currentUser.id, input);
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            trip.tools.lottery = {
                type: "lottery",
                publishedAt: Date.now(),
                publishedByUserId: context.currentUser.id,
                phase: "active",
                answers,
                cards: buildLotteryCards(answers),
                allowAssignedUser: permissionConfig.allowAssignedUser,
                assignedUserId: permissionConfig.assignedUserId,
                drawLimitPerUser,
                claimsByUserId: {}
            };
        });
        return this.getToolDetailPageData("lottery");
    }
    recreateLotteryTool(input) {
        const context = this.requireAdminTripContext();
        this.requireStartedTool(context.trip, "lottery");
        const answers = assertLotteryAnswers(input.answers);
        const drawLimitPerUser = assertLotteryDrawLimit(input.drawLimitPerUser);
        const permissionConfig = this.resolveLotteryPermissionConfig(context.tripId, context.currentUser.id, input);
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "lottery");
            nextState.publishedAt = Date.now();
            nextState.publishedByUserId = context.currentUser.id;
            nextState.phase = "active";
            nextState.answers = answers;
            nextState.cards = buildLotteryCards(answers);
            nextState.allowAssignedUser = permissionConfig.allowAssignedUser;
            nextState.assignedUserId = permissionConfig.assignedUserId;
            nextState.drawLimitPerUser = drawLimitPerUser;
            nextState.claimsByUserId = {};
        });
        return this.getToolDetailPageData("lottery");
    }
    claimLottery(cardId) {
        var _a;
        const context = this.requireTripContext();
        const toolState = this.requireStartedTool(context.trip, "lottery");
        if (toolState.phase !== "active") {
            throw new errors_1.BusinessError("LOTTERY_NOT_STARTED", "管理员还没有发布本轮抓阄。");
        }
        this.assertViewerCanClaimLottery(toolState, context.currentUser.id);
        const viewerClaims = (_a = toolState.claimsByUserId[context.currentUser.id]) !== null && _a !== void 0 ? _a : [];
        if (viewerClaims.length >= toolState.drawLimitPerUser) {
            throw new errors_1.BusinessError("LOTTERY_DRAW_LIMIT_REACHED", "你的抽取次数已用完。");
        }
        if (!toolState.cards.some((card) => !card.claimedByUserId)) {
            throw new errors_1.BusinessError("LOTTERY_NO_CARDS_LEFT", "所有卡片都已被抽取。");
        }
        const targetCard = toolState.cards.find((card) => card.id === cardId);
        if (!targetCard) {
            throw new errors_1.BusinessError("LOTTERY_CARD_NOT_FOUND", "未找到对应卡片。");
        }
        if (targetCard.claimedByUserId) {
            throw new errors_1.BusinessError("LOTTERY_CARD_ALREADY_CLAIMED", "这张卡片已经被抽取。");
        }
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            var _a;
            const nextState = this.requireStartedTool(trip, "lottery");
            const nextCard = nextState.cards.find((card) => card.id === cardId);
            if (!nextCard) {
                throw new errors_1.BusinessError("LOTTERY_CARD_NOT_FOUND", "未找到对应卡片。");
            }
            if (nextCard.claimedByUserId) {
                throw new errors_1.BusinessError("LOTTERY_CARD_ALREADY_CLAIMED", "这张卡片已经被抽取。");
            }
            const claimedAt = Date.now();
            nextCard.claimedByUserId = context.currentUser.id;
            nextCard.claimedAt = claimedAt;
            const nextClaims = (_a = nextState.claimsByUserId[context.currentUser.id]) !== null && _a !== void 0 ? _a : [];
            if (nextClaims.length >= nextState.drawLimitPerUser) {
                throw new errors_1.BusinessError("LOTTERY_DRAW_LIMIT_REACHED", "你的抽取次数已用完。");
            }
            nextClaims.push({
                cardId: nextCard.id,
                order: nextCard.order,
                answer: nextCard.answer,
                claimedAt
            });
            nextState.claimsByUserId[context.currentUser.id] = nextClaims;
        });
        return this.getToolDetailPageData("lottery");
    }
    resetLottery() {
        const context = this.requireAdminTripContext();
        this.requireStartedTool(context.trip, "lottery");
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            const nextState = this.requireStartedTool(trip, "lottery");
            nextState.phase = "active";
            nextState.cards = nextState.cards.map((card) => (Object.assign(Object.assign({}, card), { claimedByUserId: null, claimedAt: null })));
            nextState.claimsByUserId = {};
        });
        return this.getToolDetailPageData("lottery");
    }
    closeLottery() {
        return this.closeTool("lottery");
    }
    getProfilePageData() {
        var _a, _b;
        const currentUser = this.getActiveUser();
        const currentTrip = currentUser.currentTripId
            ? this.buildCurrentTripView(currentUser.currentTripId, currentUser.id)
            : null;
        const primaryActionKind = this.getProfilePrimaryActionKind(currentTrip);
        return Object.assign(Object.assign({}, this.buildAccessState(currentUser)), { demoUsers: this.buildDemoUsers(currentUser.id), currentUserInitial: (0, format_1.getInitial)(currentUser.nickname), currentTripTitle: (_a = currentTrip === null || currentTrip === void 0 ? void 0 : currentTrip.tripMeta.tripName) !== null && _a !== void 0 ? _a : "未加入车次", currentSeatLabel: (_b = currentTrip === null || currentTrip === void 0 ? void 0 : currentTrip.tripMeta.viewerSeatCode) !== null && _b !== void 0 ? _b : "未入座", currentRoleLabel: currentTrip
                ? currentTrip.tripMeta.viewerRole === "admin"
                    ? "管理员"
                    : "普通成员"
                : "暂未加入", profileSummary: currentUser.bio || "去完善个人资料", livingLocationDisplay: (0, format_1.formatLivingLocationDisplay)(currentUser.livingCity), hometownLocationDisplay: (0, format_1.formatHometownLocationDisplay)(currentUser.hometown), tags: currentUser.tags, showTagsCard: true, showPrimaryAction: Boolean(currentTrip), primaryActionKind, primaryActionLabel: primaryActionKind === "dissolve"
                ? "解散车次"
                : primaryActionKind === "leave"
                    ? "退出车次"
                    : "" });
    }
    getTagEditorData() {
        const currentUser = this.ensureAuthorizedAccess();
        const tripName = currentUser.currentTripId
            ? this.tripRepository.getTrip(currentUser.currentTripId).tripName
            : undefined;
        return this.buildTagEditorView(currentUser, tripName);
    }
    getTripSettings() {
        const currentUser = this.getActiveUser();
        this.assertAuthorizedUser(currentUser);
        if (!currentUser.currentTripId) {
            throw new errors_1.BusinessError("TRIP_REQUIRED", "你当前不在任何车次中。");
        }
        const trip = this.tripRepository.getTrip(currentUser.currentTripId);
        const relation = this.requireMembership(currentUser.currentTripId, currentUser.id);
        return {
            tripId: trip.id,
            tripName: (0, format_1.displayTripName)(trip.tripName),
            departureTime: (0, format_1.displayDepartureTime)(trip.departureTime),
            password: trip.password,
            templateId: trip.templateId,
            role: relation.role
        };
    }
    switchActiveUser(userId) {
        this.userRepository.getUser(userId);
        this.sessionRepository.setActiveUserId(userId);
        return this.bootstrapApp();
    }
    updateProfile(input) {
        const currentUser = this.ensureAuthorizedAccess();
        this.userRepository.updateUser(currentUser.id, (user) => {
            user.tags = normalizeProfileTags(input.tagsInput);
            user.bio = normalizeProfileBio(input.bio);
            user.livingCity = normalizeProfileText(input.livingCity);
            user.hometown = normalizeProfileText(input.hometown);
            user.age = normalizeAge(input.age);
        });
        const nextUser = this.userRepository.getUser(currentUser.id);
        return this.buildTagEditorView(nextUser);
    }
    updateTags(tagsInput) {
        const currentUser = this.ensureAuthorizedAccess();
        return this.updateProfile({
            tagsInput,
            bio: currentUser.bio,
            livingCity: currentUser.livingCity,
            hometown: currentUser.hometown,
            age: currentUser.age
        });
    }
    updateHomePersona(homePersonaAssetId) {
        const currentUser = this.ensureAuthorizedAccess();
        const normalizedHomePersonaAssetId = homePersonaAssetId && constants_1.HOME_PERSONA_OPTIONS.some((option) => option.id === homePersonaAssetId)
            ? homePersonaAssetId
            : null;
        this.userRepository.updateUser(currentUser.id, (user) => {
            user.homePersonaAssetId = normalizedHomePersonaAssetId;
        });
        return this.bootstrapApp();
    }
    authorizeProfile(input) {
        const currentUser = this.getActiveUser();
        this.userRepository.updateUser(currentUser.id, (user) => {
            user.isAuthorized = true;
            user.nickname = assertNickname(input.nickname, user.nickname);
            user.avatarUrl = input.avatarUrl.trim() || user.avatarUrl;
        });
        return this.bootstrapApp();
    }
    createTrip(input) {
        const currentUser = this.getActiveUser();
        this.assertAuthorizedUser(currentUser);
        this.assertUserIsFree(currentUser);
        assertTripName(input.tripName);
        assertPassword(input.password);
        assertTemplateExists(input.templateId);
        this.tripRepository.ensurePasswordAvailable(input.password);
        const seatCodes = (0, seat_1.generateSeatCodes)(input.templateId);
        const tripId = (0, id_1.createId)("trip");
        const createdAt = Date.now();
        this.tripRepository.saveTrip({
            id: tripId,
            tripName: input.tripName.trim(),
            departureTime: input.departureTime.trim(),
            password: input.password,
            templateId: input.templateId,
            creatorUserId: currentUser.id,
            status: "active",
            seatCodes,
            seatMap: (0, seat_1.createSeatMap)(seatCodes),
            tools: (0, constants_1.createEmptyTripTools)(),
            createdAt
        });
        this.tripRepository.addTripMember(tripId, currentUser.id, "admin", createdAt);
        this.userRepository.setCurrentTripId(currentUser.id, tripId);
        return this.bootstrapApp();
    }
    joinTripByPassword(password) {
        const currentUser = this.getActiveUser();
        this.assertAuthorizedUser(currentUser);
        this.assertUserIsFree(currentUser);
        assertPassword(password);
        const trip = this.tripRepository.findActiveTripByPassword(password);
        if (!trip) {
            throw new errors_1.BusinessError("TRIP_NOT_FOUND", "密码错误或车次不存在。");
        }
        this.tripRepository.addTripMember(trip.id, currentUser.id, "member", Date.now());
        this.userRepository.setCurrentTripId(currentUser.id, trip.id);
        return this.bootstrapApp();
    }
    leaveCurrentTrip() {
        const currentUser = this.getActiveUser();
        this.assertAuthorizedUser(currentUser);
        if (!currentUser.currentTripId) {
            throw new errors_1.BusinessError("TRIP_REQUIRED", "你当前不在任何车次中。");
        }
        const relation = this.requireMembership(currentUser.currentTripId, currentUser.id);
        if (relation.role === "admin") {
            throw new errors_1.BusinessError("ADMIN_CANNOT_LEAVE", "管理员请先解散车次。");
        }
        const currentSeat = this.getCurrentSeatCode(currentUser.currentTripId, currentUser.id);
        if (currentSeat) {
            this.tripRepository.updateTrip(currentUser.currentTripId, (trip) => {
                trip.seatMap[currentSeat] = null;
            });
        }
        this.tripRepository.removeTripMember(currentUser.currentTripId, currentUser.id);
        this.userRepository.setCurrentTripId(currentUser.id, null);
        return this.bootstrapApp();
    }
    dissolveCurrentTrip() {
        const currentUser = this.getActiveUser();
        this.assertAuthorizedUser(currentUser);
        if (!currentUser.currentTripId) {
            throw new errors_1.BusinessError("TRIP_REQUIRED", "你当前不在任何车次中。");
        }
        const relation = this.requireMembership(currentUser.currentTripId, currentUser.id);
        if (relation.role !== "admin") {
            throw new errors_1.BusinessError("ADMIN_ONLY", "只有管理员可以解散车次。");
        }
        const tripId = currentUser.currentTripId;
        const memberRelations = this.tripRepository.listTripMembers(tripId);
        memberRelations.forEach((memberRelation) => {
            this.userRepository.setCurrentTripId(memberRelation.userId, null);
        });
        this.tripRepository.removeAllTripMembers(tripId);
        this.tripRepository.updateTrip(tripId, (trip) => {
            trip.status = "dissolved";
            trip.seatMap = (0, seat_1.createSeatMap)(trip.seatCodes);
            trip.tools = (0, constants_1.createEmptyTripTools)();
        });
        return this.bootstrapApp();
    }
    claimSeat(seatCode, profileInput) {
        const currentUser = this.getActiveUser();
        this.assertAuthorizedUser(currentUser);
        const tripId = this.requireCurrentTripId(currentUser);
        this.requireMembership(tripId, currentUser.id);
        const trip = this.tripRepository.getTrip(tripId);
        if (!Object.prototype.hasOwnProperty.call(trip.seatMap, seatCode)) {
            throw new errors_1.BusinessError("SEAT_NOT_FOUND", "未找到这个座位。");
        }
        if (this.getCurrentSeatCode(tripId, currentUser.id)) {
            throw new errors_1.BusinessError("ALREADY_SEATED", "你已经入座了。");
        }
        if (trip.seatMap[seatCode]) {
            throw new errors_1.BusinessError("SEAT_OCCUPIED", "这个座位已经有人了。");
        }
        this.tripRepository.updateTrip(tripId, (draftTrip) => {
            draftTrip.seatMap[seatCode] = currentUser.id;
        });
        return this.bootstrapApp();
    }
    switchSeat(targetSeatCode) {
        const currentUser = this.getActiveUser();
        this.assertAuthorizedUser(currentUser);
        const tripId = this.requireCurrentTripId(currentUser);
        this.requireMembership(tripId, currentUser.id);
        const currentSeatCode = this.getCurrentSeatCode(tripId, currentUser.id);
        if (!currentSeatCode) {
            throw new errors_1.BusinessError("SEAT_REQUIRED", "你还没有入座。");
        }
        const trip = this.tripRepository.getTrip(tripId);
        if (!Object.prototype.hasOwnProperty.call(trip.seatMap, targetSeatCode)) {
            throw new errors_1.BusinessError("SEAT_NOT_FOUND", "未找到这个座位。");
        }
        if (trip.seatMap[targetSeatCode]) {
            throw new errors_1.BusinessError("SEAT_OCCUPIED", "该座位已被占用。");
        }
        this.tripRepository.updateTrip(tripId, (draftTrip) => {
            draftTrip.seatMap[targetSeatCode] = currentUser.id;
            draftTrip.seatMap[currentSeatCode] = null;
        });
        return this.bootstrapApp();
    }
    releaseMySeat() {
        const currentUser = this.getActiveUser();
        this.assertAuthorizedUser(currentUser);
        const tripId = this.requireCurrentTripId(currentUser);
        const currentSeatCode = this.getCurrentSeatCode(tripId, currentUser.id);
        if (!currentSeatCode) {
            throw new errors_1.BusinessError("SEAT_REQUIRED", "你当前还没有座位。");
        }
        this.tripRepository.updateTrip(tripId, (trip) => {
            trip.seatMap[currentSeatCode] = null;
        });
        return this.bootstrapApp();
    }
    adminReleaseSeat(targetUserId) {
        const currentUser = this.getActiveUser();
        this.assertAuthorizedUser(currentUser);
        const tripId = this.requireCurrentTripId(currentUser);
        const relation = this.requireMembership(tripId, currentUser.id);
        if (relation.role !== "admin") {
            throw new errors_1.BusinessError("ADMIN_ONLY", "只有管理员可以解除他人座位。");
        }
        if (targetUserId === currentUser.id) {
            throw new errors_1.BusinessError("SELF_RELEASE_ONLY", "请从自己的座位卡中解除当前座位。");
        }
        const targetSeatCode = this.getCurrentSeatCode(tripId, targetUserId);
        if (!targetSeatCode) {
            throw new errors_1.BusinessError("TARGET_NOT_SEATED", "对方当前还没有入座。");
        }
        this.tripRepository.updateTrip(tripId, (trip) => {
            trip.seatMap[targetSeatCode] = null;
        });
        return this.bootstrapApp();
    }
    getActiveUser() {
        this.repairState();
        return this.userRepository.getUser(this.sessionRepository.getActiveUserId());
    }
    repairState() {
        this.appStateRepository.update((state) => {
            if (!state.users[state.activeUserId]) {
                const fallbackUserId = Object.keys(state.users)[0];
                if (fallbackUserId) {
                    state.activeUserId = fallbackUserId;
                }
            }
            state.tripMembers = state.tripMembers.filter((member) => {
                const user = state.users[member.userId];
                const trip = state.trips[member.tripId];
                return Boolean(user && trip && trip.status === "active");
            });
            const dedupedMembers = new Map();
            state.tripMembers.forEach((member) => {
                const key = `${member.tripId}:${member.userId}`;
                const existing = dedupedMembers.get(key);
                if (!existing) {
                    dedupedMembers.set(key, Object.assign({}, member));
                    return;
                }
                existing.role = existing.role === "admin" || member.role === "admin" ? "admin" : "member";
                existing.joinedAt = Math.min(existing.joinedAt, member.joinedAt);
            });
            state.tripMembers = Array.from(dedupedMembers.values());
            const initialMembershipSet = new Set(state.tripMembers.map((member) => `${member.tripId}:${member.userId}`));
            Object.values(state.users).forEach((user) => {
                if (!user.currentTripId) {
                    return;
                }
                const trip = state.trips[user.currentTripId];
                const hasMembership = initialMembershipSet.has(`${user.currentTripId}:${user.id}`);
                if (!trip || trip.status !== "active" || !hasMembership) {
                    user.currentTripId = null;
                }
            });
            state.tripMembers = state.tripMembers.filter((member) => {
                const user = state.users[member.userId];
                return Boolean(user && user.currentTripId === member.tripId);
            });
            const membersByTripId = state.tripMembers.reduce((accumulator, member) => {
                if (!accumulator[member.tripId]) {
                    accumulator[member.tripId] = [];
                }
                accumulator[member.tripId].push(member);
                return accumulator;
            }, {});
            Object.values(state.trips).forEach((trip) => {
                var _a, _b;
                trip.tools = (_a = trip.tools) !== null && _a !== void 0 ? _a : (0, constants_1.createEmptyTripTools)();
                if (trip.status !== "active") {
                    trip.tools = (0, constants_1.createEmptyTripTools)();
                    return;
                }
                const tripMembers = (_b = membersByTripId[trip.id]) !== null && _b !== void 0 ? _b : [];
                if (!tripMembers.length) {
                    trip.status = "dissolved";
                    trip.seatMap = (0, seat_1.createSeatMap)(trip.seatCodes);
                    trip.tools = (0, constants_1.createEmptyTripTools)();
                    return;
                }
                const hadAdmin = tripMembers.some((member) => member.role === "admin");
                if (!hadAdmin) {
                    const promotedMember = [...tripMembers].sort((left, right) => {
                        if (left.joinedAt !== right.joinedAt) {
                            return left.joinedAt - right.joinedAt;
                        }
                        return left.userId.localeCompare(right.userId);
                    })[0];
                    promotedMember.role = "admin";
                    trip.tools = (0, constants_1.createEmptyTripTools)();
                }
                constants_1.TOOL_TYPES.forEach((toolType) => {
                    const toolState = trip.tools[toolType];
                    if (!toolState || toolState.type !== toolType) {
                        trip.tools[toolType] = null;
                        return;
                    }
                    const publisherRelation = tripMembers.find((member) => member.userId === toolState.publishedByUserId);
                    if (!publisherRelation || publisherRelation.role !== "admin") {
                        trip.tools[toolType] = null;
                        return;
                    }
                    if (toolType === "wheel") {
                        const wheelState = toolState;
                        const normalizedItems = Array.isArray(wheelState.items)
                            ? wheelState.items
                                .map((item) => (typeof item === "string" ? item.trim() : ""))
                                .filter(Boolean)
                            : [];
                        if (normalizedItems.length && normalizedItems.every(isLegacyGeneratedWheelItem)) {
                            wheelState.items = constants_1.DEFAULT_WHEEL_ITEMS.slice(0, constants_1.WHEEL_MAX_ITEMS);
                            wheelState.phase = "draft";
                            wheelState.resultIndex = null;
                            wheelState.resultHistoryLabels = [];
                            wheelState.spunAt = null;
                            return;
                        }
                        wheelState.items = normalizedItems.slice(0, constants_1.WHEEL_MAX_ITEMS);
                        if (wheelState.items.length < 2) {
                            trip.tools[toolType] = null;
                            return;
                        }
                        wheelState.allowAssignedUser = Boolean(wheelState.allowAssignedUser);
                        if (!wheelState.allowAssignedUser ||
                            typeof wheelState.assignedUserId !== "string" ||
                            !state.tripMembers.some((member) => member.tripId === trip.id && member.userId === wheelState.assignedUserId)) {
                            wheelState.allowAssignedUser = false;
                            wheelState.assignedUserId = null;
                        }
                        if (typeof wheelState.resultIndex !== "number" ||
                            wheelState.resultIndex < 0 ||
                            wheelState.resultIndex >= wheelState.items.length) {
                            wheelState.resultIndex = null;
                        }
                        wheelState.resultHistoryLabels = Array.isArray(wheelState.resultHistoryLabels)
                            ? wheelState.resultHistoryLabels.filter((label) => wheelState.items.includes(label))
                            : [];
                        return;
                    }
                    if (toolType === "lottery") {
                        const lotteryState = toolState;
                        if (!Array.isArray(lotteryState.cards) || !lotteryState.cards.length) {
                            trip.tools[toolType] = null;
                            return;
                        }
                        lotteryState.phase = "active";
                        lotteryState.drawLimitPerUser =
                            Number.isInteger(lotteryState.drawLimitPerUser) && lotteryState.drawLimitPerUser > 0
                                ? lotteryState.drawLimitPerUser
                                : 1;
                        lotteryState.answers = Array.isArray(lotteryState.answers)
                            ? lotteryState.answers
                                .map((answer) => (typeof answer === "string" ? answer.trim() : ""))
                                .filter(Boolean)
                            : [];
                        if (!lotteryState.answers.length) {
                            lotteryState.answers = lotteryState.cards.map((card) => card.answer);
                        }
                        const validMemberIds = new Set(tripMembers.map((member) => member.userId));
                        const fallbackAssignedUserId = toolState.publishedByUserId;
                        lotteryState.allowAssignedUser = Boolean(lotteryState.allowAssignedUser);
                        if (!lotteryState.allowAssignedUser ||
                            typeof lotteryState.assignedUserId !== "string" ||
                            !validMemberIds.has(lotteryState.assignedUserId)) {
                            lotteryState.allowAssignedUser = false;
                            lotteryState.assignedUserId = fallbackAssignedUserId;
                        }
                        const claimedCardsByUserId = lotteryState.cards.reduce((accumulator, card) => {
                            if (!card.claimedByUserId) {
                                card.claimedAt = null;
                                return accumulator;
                            }
                            if (!validMemberIds.has(card.claimedByUserId)) {
                                card.claimedByUserId = null;
                                card.claimedAt = null;
                                return accumulator;
                            }
                            const claimedAt = typeof card.claimedAt === "number" ? card.claimedAt : 0;
                            card.claimedAt = claimedAt;
                            if (!accumulator[card.claimedByUserId]) {
                                accumulator[card.claimedByUserId] = [];
                            }
                            accumulator[card.claimedByUserId].push({
                                cardId: card.id,
                                order: card.order,
                                answer: card.answer,
                                claimedAt
                            });
                            return accumulator;
                        }, {});
                        Object.entries(claimedCardsByUserId).forEach(([userId, records]) => {
                            const sortedRecords = [...records].sort((left, right) => left.claimedAt - right.claimedAt);
                            const keptCardIds = new Set(sortedRecords
                                .slice(0, lotteryState.drawLimitPerUser)
                                .map((record) => record.cardId));
                            lotteryState.cards.forEach((card) => {
                                if (card.claimedByUserId === userId && !keptCardIds.has(card.id)) {
                                    card.claimedByUserId = null;
                                    card.claimedAt = null;
                                }
                            });
                        });
                        lotteryState.claimsByUserId = lotteryState.cards.reduce((accumulator, card) => {
                            if (!card.claimedByUserId || typeof card.claimedAt !== "number") {
                                return accumulator;
                            }
                            if (!accumulator[card.claimedByUserId]) {
                                accumulator[card.claimedByUserId] = [];
                            }
                            accumulator[card.claimedByUserId].push({
                                cardId: card.id,
                                order: card.order,
                                answer: card.answer,
                                claimedAt: card.claimedAt
                            });
                            accumulator[card.claimedByUserId].sort((left, right) => left.claimedAt - right.claimedAt);
                            return accumulator;
                        }, {});
                    }
                });
            });
            const validMembershipSet = new Set(state.tripMembers.map((member) => `${member.tripId}:${member.userId}`));
            Object.values(state.trips).forEach((trip) => {
                const seenUsers = new Set();
                Object.keys(trip.seatMap).forEach((seatCode) => {
                    const occupiedUserId = trip.seatMap[seatCode];
                    if (!occupiedUserId) {
                        return;
                    }
                    const user = state.users[occupiedUserId];
                    const hasValidMembership = validMembershipSet.has(`${trip.id}:${occupiedUserId}`);
                    const isValid = trip.status === "active" &&
                        Boolean(user) &&
                        user.currentTripId === trip.id &&
                        hasValidMembership &&
                        !seenUsers.has(occupiedUserId);
                    if (!isValid) {
                        trip.seatMap[seatCode] = null;
                        return;
                    }
                    seenUsers.add(occupiedUserId);
                });
            });
        });
    }
    assertUserIsFree(user) {
        if (user.currentTripId) {
            throw new errors_1.BusinessError("USER_BUSY", "当前身份已经在其他车次里了。");
        }
    }
    assertAuthorizedUser(user) {
        if (!user.isAuthorized) {
            throw new errors_1.BusinessError("AUTH_REQUIRED", "请先完成微信授权。");
        }
    }
    requireCurrentTripId(user) {
        if (!user.currentTripId) {
            throw new errors_1.BusinessError("TRIP_REQUIRED", "你当前不在任何车次中。");
        }
        return user.currentTripId;
    }
    requireMembership(tripId, userId) {
        const relation = this.tripRepository.getTripMember(tripId, userId);
        if (!relation) {
            throw new errors_1.BusinessError("MEMBER_REQUIRED", "你不在当前车次成员列表中。");
        }
        return relation;
    }
    requireTripContext() {
        const currentUser = this.getActiveUser();
        const tripId = this.requireCurrentTripId(currentUser);
        const trip = this.tripRepository.getTrip(tripId);
        const role = this.requireMembership(tripId, currentUser.id).role;
        return {
            currentUser,
            tripId,
            trip,
            role
        };
    }
    requireAdminTripContext() {
        const context = this.requireTripContext();
        if (context.role !== "admin") {
            throw new errors_1.BusinessError("ADMIN_ONLY", "只有管理员可以操作当前玩法。");
        }
        return context;
    }
    closeTool(toolType) {
        const context = this.requireAdminTripContext();
        this.requireStartedTool(context.trip, toolType);
        this.tripRepository.updateTrip(context.tripId, (trip) => {
            trip.tools[toolType] = null;
        });
        return this.getToolDetailPageData(toolType);
    }
    finalizeSeatDrawRoundIfDueForTrip(tripId, force = false) {
        const trip = this.tripRepository.getTrip(tripId);
        const toolState = this.getPublishedToolState(trip, "seat-draw");
        if (!toolState || toolState.phase !== "rolling") {
            return false;
        }
        if (!force && (!toolState.rollingEndsAt || toolState.rollingEndsAt > Date.now())) {
            return false;
        }
        this.tripRepository.updateTrip(tripId, (nextTrip) => {
            const nextState = this.requireStartedTool(nextTrip, "seat-draw");
            if (nextState.phase !== "rolling") {
                return;
            }
            const finalResult = nextState.pendingResult.length
                ? nextState.pendingResult
                : nextState.rollingDisplayEntries;
            nextState.phase = "result";
            nextState.lastResult = finalResult;
            nextState.drawnEntries = uniqueByUserId([...nextState.drawnEntries, ...finalResult]);
            nextState.resultRounds = [...nextState.resultRounds, finalResult];
            nextState.rollingDisplayEntries = [];
            nextState.pendingResult = [];
            nextState.rollingStartedAt = null;
            nextState.rollingEndsAt = null;
        });
        return true;
    }
    createSeatDrawRollingFrame(eligibleMembers, displayCount) {
        if (!eligibleMembers.length || displayCount <= 0) {
            return [];
        }
        return pickRandomItems(eligibleMembers, Math.min(displayCount, eligibleMembers.length));
    }
    getCurrentSeatCode(tripId, userId) {
        const trip = this.tripRepository.getTrip(tripId);
        return (0, seat_1.findSeatCodeByUserId)(trip.seatMap, userId);
    }
    getPublishedToolState(trip, toolType) {
        const toolState = trip.tools[toolType];
        if (!toolState || toolState.type !== toolType) {
            return null;
        }
        return toolState;
    }
    requireStartedTool(trip, toolType) {
        const toolState = this.getPublishedToolState(trip, toolType);
        if (!toolState) {
            throw new errors_1.BusinessError("TOOL_NOT_STARTED", "当前玩法未开启。");
        }
        return toolState;
    }
    buildAccessState(currentUser) {
        return {
            currentUser,
            isAuthorized: currentUser.isAuthorized,
            hasCurrentTrip: Boolean(currentUser.currentTripId)
        };
    }
    buildToolCards(currentUser, trip, role) {
        return constants_1.TOOL_TYPES.map((toolType) => {
            const toolState = trip ? this.getPublishedToolState(trip, toolType) : null;
            const hasCurrentTrip = Boolean(trip);
            const displayMeta = TOOL_PAGE_META[toolType];
            let helperText = "先授权";
            if (currentUser.isAuthorized && !hasCurrentTrip) {
                helperText = "先加入车次";
            }
            else if (currentUser.isAuthorized && hasCurrentTrip) {
                if (toolState) {
                    helperText = role === "admin" ? "进入详情操作" : "进入详情参与";
                }
                else {
                    helperText = role === "admin" ? "进入详情创建" : "等待管理员开启";
                }
            }
            return {
                type: toolType,
                title: constants_1.TOOL_META[toolType].title,
                description: constants_1.TOOL_META[toolType].description,
                iconGlyph: constants_1.TOOL_META[toolType].iconGlyph,
                iconClassName: constants_1.TOOL_META[toolType].iconClassName,
                displayTitle: displayMeta.displayTitle,
                displayDescription: displayMeta.displayDescription,
                imageUrl: displayMeta.imageUrl,
                themeKey: toolType,
                ctaLabel: displayMeta.ctaLabel,
                sortOrder: displayMeta.sortOrder,
                stateLabel: toolState ? "已开启" : "未开启",
                stateClassName: toolState ? "tool-state is-active" : "tool-state",
                helperText,
                isStarted: Boolean(toolState),
                canEnter: Boolean(currentUser.isAuthorized && hasCurrentTrip)
            };
        }).sort((left, right) => left.sortOrder - right.sortOrder);
    }
    buildToolStatusMessage(toolType, toolState, viewerId, viewerRole) {
        var _a, _b;
        if (!toolState) {
            return viewerRole === "admin"
                ? "点击“创建玩法”后先在本地设置，点“确定”才会同步给大家。"
                : "玩法未开启，等待管理员创建。";
        }
        if (toolType === "seat-draw") {
            const seatDrawState = toolState;
            if (seatDrawState.phase === "rolling") {
                return viewerRole === "admin" ? "正在抽号中，请等待本轮结束。" : "管理员正在抽号，结果即将公布。";
            }
            if (seatDrawState.phase === "result") {
                return viewerRole === "admin"
                    ? "抽号已结束，可再抽一次或通过更多操作重置。"
                    : "本轮抽号已结束，结果已经同步。";
            }
            return viewerRole === "admin"
                ? "当前配置已发布，点击“开始抽号”开启本轮随机抽号。"
                : "抽号即将开始，请等待管理员操作。";
        }
        if (toolType === "vote") {
            const voteState = toolState;
            if (voteState.phase === "draft") {
                return viewerRole === "admin"
                    ? "当前玩法已开启，但本轮投票还未发布。"
                    : "等待管理员发布下一轮投票。";
            }
            if (voteState.phase === "ended") {
                return "本轮投票已结束，最终结果已公布。";
            }
            if (!voteState.participantUserIds.includes(viewerId)) {
                return "你不在本轮投票名单中。";
            }
            const submission = voteState.submissions[viewerId];
            if ((submission === null || submission === void 0 ? void 0 : submission.choice) === "approve" &&
                voteState.selectionMode === "multiple" &&
                submission.optionIds.length < voteState.maxSelections) {
                return `你已投 ${submission.optionIds.length} / ${voteState.maxSelections} 项，还可以继续投票。`;
            }
            return submission
                ? `你已完成投票：${getVoteChoiceLabel(submission.choice)}`
                : "请选择一个选项完成本轮投票。";
        }
        if (toolType === "wheel") {
            const wheelState = toolState;
            const canSpin = this.canViewerSpinWheel(wheelState, viewerId, viewerRole);
            const assignedUserLabel = wheelState.allowAssignedUser && wheelState.assignedUserId
                ? this.userRepository.getUser(wheelState.assignedUserId).nickname
                : "";
            return wheelState.resultIndex === null
                ? canSpin
                    ? "当前配置已发布，点击“开始”生成结果。"
                    : wheelState.allowAssignedUser && assignedUserLabel
                        ? `当前由 ${assignedUserLabel} 转动大转盘。`
                        : "当前由管理员转动大转盘。"
                : "当前转盘结果已经同步。";
        }
        const lotteryState = toolState;
        const remainingCardCount = lotteryState.cards.filter((card) => !card.claimedByUserId).length;
        if (!remainingCardCount) {
            return "卡片已抽完。";
        }
        if (!this.canViewerClaimLottery(lotteryState, viewerId)) {
            const assignedUserLabel = lotteryState.allowAssignedUser && lotteryState.assignedUserId
                ? this.userRepository.getUser(lotteryState.assignedUserId).nickname
                : "管理员";
            return `当前由 ${assignedUserLabel} 抽取卡片。`;
        }
        const viewerClaimedCount = (_b = (_a = lotteryState.claimsByUserId[viewerId]) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        if (viewerClaimedCount >= lotteryState.drawLimitPerUser) {
            return "你的抽取次数已用完。";
        }
        return "点击卡片开始翻签。";
    }
    buildSeatDrawDetail(trip, toolState, viewerId) {
        if (!toolState) {
            return null;
        }
        const remainingCount = this.getSeatDrawEligibleSnapshots(trip, toolState.config.excludeAdmin, toolState.config.excludePreviouslyDrawn ? toolState.drawnEntries : []).length;
        const eligibleMembers = this.getSeatDrawEligibleSnapshots(trip, toolState.config.excludeAdmin, toolState.config.excludePreviouslyDrawn ? toolState.drawnEntries : []);
        const displayEntries = toolState.phase === "rolling"
            ? toolState.rollingDisplayEntries
            : toolState.phase === "result"
                ? toolState.lastResult
                : [];
        const slotCount = toolState.phase === "rolling"
            ? Math.max(toolState.pendingResult.length, displayEntries.length, 1)
            : toolState.phase === "result" && toolState.lastResult.length
                ? toolState.lastResult.length
                : Math.min(toolState.config.drawCount, Math.max(remainingCount, 1));
        const displaySlots = Array.from({ length: slotCount }, (_, index) => {
            var _a, _b;
            const entry = (_a = displayEntries[index]) !== null && _a !== void 0 ? _a : null;
            return {
                id: `seat-draw-slot-${index + 1}`,
                label: (_b = entry === null || entry === void 0 ? void 0 : entry.seatCode) !== null && _b !== void 0 ? _b : "😊",
                isPlaceholder: !entry
            };
        });
        return {
            phase: toolState.phase,
            topic: toolState.topic,
            drawCount: toolState.config.drawCount,
            maxDrawCount: Math.max(remainingCount, toolState.config.drawCount),
            excludePreviouslyDrawn: toolState.config.excludePreviouslyDrawn,
            excludeAdmin: toolState.config.excludeAdmin,
            remainingCount,
            displaySlots,
            eligibleMembers: eligibleMembers.map((entry) => this.buildToolResultMemberView(entry, viewerId)),
            lastResult: toolState.lastResult.map((entry) => this.buildToolResultMemberView(entry, viewerId)),
            resultRounds: toolState.resultRounds.map((roundEntries, index) => ({
                id: `seat-draw-round-${index + 1}`,
                labels: roundEntries.map((entry) => { var _a; return (_a = entry.seatCode) !== null && _a !== void 0 ? _a : "未入座"; }),
                displayText: roundEntries.map((entry) => { var _a; return (_a = entry.seatCode) !== null && _a !== void 0 ? _a : "未入座"; }).join("、")
            })),
            canDrawAgain: remainingCount > 0 && toolState.phase !== "rolling",
            rollingEndsAt: toolState.rollingEndsAt
        };
    }
    buildVoteDetail(toolState, viewerId) {
        var _a, _b, _c;
        if (!toolState) {
            return null;
        }
        const selectionMode = toolState.selectionMode === "multiple" ? "multiple" : "single";
        const participantUserIds = Array.isArray(toolState.participantUserIds)
            ? toolState.participantUserIds.filter((userId) => typeof userId === "string" && Boolean(userId))
            : [];
        const submissionsRecord = toolState.submissions && typeof toolState.submissions === "object" ? toolState.submissions : {};
        const submissions = Object.values(submissionsRecord);
        const viewerSubmission = (_a = submissionsRecord[viewerId]) !== null && _a !== void 0 ? _a : null;
        const options = Array.isArray(toolState.options) ? toolState.options : [];
        const supportCountByOptionId = submissions.reduce((accumulator, submission) => {
            if (submission.choice !== "approve") {
                return accumulator;
            }
            submission.optionIds.forEach((optionId) => {
                var _a;
                accumulator[optionId] = ((_a = accumulator[optionId]) !== null && _a !== void 0 ? _a : 0) + 1;
            });
            return accumulator;
        }, {});
        const optionViews = options.map((option) => {
            var _a;
            return ({
                id: option.id,
                label: option.label,
                supportCount: (_a = supportCountByOptionId[option.id]) !== null && _a !== void 0 ? _a : 0,
                selectedByViewer: Boolean(viewerSubmission === null || viewerSubmission === void 0 ? void 0 : viewerSubmission.optionIds.includes(option.id))
            });
        });
        return {
            phase: toolState.phase,
            topic: toolState.topic,
            excludeAdmin: toolState.excludeAdmin,
            selectionMode,
            maxSelections: toolState.maxSelections,
            participantCount: participantUserIds.length,
            submittedCount: Object.keys(submissionsRecord).length,
            approveCount: submissions.filter((submission) => submission.choice === "approve").length,
            rejectCount: submissions.filter((submission) => submission.choice === "reject").length,
            abstainCount: submissions.filter((submission) => submission.choice === "abstain").length,
            options: optionViews,
            resultOptions: [...optionViews].sort(compareVoteResultOptions),
            viewerChoice: (_b = viewerSubmission === null || viewerSubmission === void 0 ? void 0 : viewerSubmission.choice) !== null && _b !== void 0 ? _b : null,
            viewerSelectedOptionIds: (_c = viewerSubmission === null || viewerSubmission === void 0 ? void 0 : viewerSubmission.optionIds) !== null && _c !== void 0 ? _c : [],
            viewerHasSubmitted: Boolean(viewerSubmission),
            viewerEligible: participantUserIds.includes(viewerId)
        };
    }
    buildWheelDetail(trip, toolState, viewerId, viewerRole) {
        var _a, _b, _c, _d, _e, _f, _g;
        const eligibleUsers = this.listToolEligibleUsers(trip, viewerId);
        const assignedUserId = (toolState === null || toolState === void 0 ? void 0 : toolState.allowAssignedUser) ? (_a = toolState.assignedUserId) !== null && _a !== void 0 ? _a : null : null;
        const assignedUser = assignedUserId
            ? (_b = eligibleUsers.find((member) => member.userId === assignedUserId)) !== null && _b !== void 0 ? _b : null
            : null;
        const resultHistoryLabels = Array.isArray(toolState === null || toolState === void 0 ? void 0 : toolState.resultHistoryLabels)
            ? toolState.resultHistoryLabels.filter((label) => typeof label === "string" && Boolean(label))
            : [];
        return {
            phase: (_c = toolState === null || toolState === void 0 ? void 0 : toolState.phase) !== null && _c !== void 0 ? _c : "draft",
            items: (_d = toolState === null || toolState === void 0 ? void 0 : toolState.items) !== null && _d !== void 0 ? _d : [],
            viewerCanSpin: toolState ? this.canViewerSpinWheel(toolState, viewerId, viewerRole) : false,
            allowAssignedUser: Boolean(toolState === null || toolState === void 0 ? void 0 : toolState.allowAssignedUser),
            assignedUserId,
            assignedUserLabel: (_e = assignedUser === null || assignedUser === void 0 ? void 0 : assignedUser.nickname) !== null && _e !== void 0 ? _e : null,
            eligibleUsers,
            resultIndex: (_f = toolState === null || toolState === void 0 ? void 0 : toolState.resultIndex) !== null && _f !== void 0 ? _f : null,
            resultLabel: toolState && toolState.resultIndex !== null ? (_g = toolState.items[toolState.resultIndex]) !== null && _g !== void 0 ? _g : null : null,
            resultHistoryLabels
        };
    }
    resolveWheelPermissionConfig(tripId, input) {
        const allowAssignedUser = Boolean(input.allowAssignedUser);
        if (!allowAssignedUser) {
            return {
                allowAssignedUser: false,
                assignedUserId: null
            };
        }
        const assignedUserId = typeof input.assignedUserId === "string" ? input.assignedUserId : "";
        const participantUserIds = this.listTripParticipantUserIds(tripId, false);
        if (!assignedUserId || !participantUserIds.includes(assignedUserId)) {
            throw new errors_1.BusinessError("INVALID_WHEEL_ASSIGNED_USER", "请选择可使用大转盘的成员。");
        }
        return {
            allowAssignedUser: true,
            assignedUserId
        };
    }
    resolveLotteryPermissionConfig(tripId, adminUserId, input) {
        const allowAssignedUser = Boolean(input.allowAssignedUser);
        if (!allowAssignedUser) {
            return {
                allowAssignedUser: false,
                assignedUserId: adminUserId
            };
        }
        const assignedUserId = typeof input.assignedUserId === "string" ? input.assignedUserId : "";
        const participantUserIds = this.listTripParticipantUserIds(tripId, false);
        if (!assignedUserId || !participantUserIds.includes(assignedUserId)) {
            throw new errors_1.BusinessError("INVALID_LOTTERY_ASSIGNED_USER", "请选择可使用抓阄的成员。");
        }
        return {
            allowAssignedUser: true,
            assignedUserId
        };
    }
    canViewerSpinWheel(toolState, viewerId, viewerRole) {
        if (toolState.allowAssignedUser) {
            return toolState.assignedUserId === viewerId;
        }
        return viewerRole === "admin";
    }
    assertViewerCanSpinWheel(toolState, viewerId, viewerRole) {
        if (!this.canViewerSpinWheel(toolState, viewerId, viewerRole)) {
            throw new errors_1.BusinessError("WHEEL_FORBIDDEN", "当前没有使用大转盘的权限。");
        }
    }
    canViewerClaimLottery(toolState, viewerId) {
        if (toolState.allowAssignedUser) {
            return toolState.assignedUserId === viewerId;
        }
        return toolState.publishedByUserId === viewerId;
    }
    assertViewerCanClaimLottery(toolState, viewerId) {
        if (!this.canViewerClaimLottery(toolState, viewerId)) {
            throw new errors_1.BusinessError("LOTTERY_FORBIDDEN", "当前没有抽卡权限。");
        }
    }
    buildLotteryDetail(trip, toolState, viewerId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const eligibleUsers = this.listToolEligibleUsers(trip, viewerId);
        const assignedUserId = (toolState === null || toolState === void 0 ? void 0 : toolState.allowAssignedUser) ? (_a = toolState.assignedUserId) !== null && _a !== void 0 ? _a : null : (_b = toolState === null || toolState === void 0 ? void 0 : toolState.publishedByUserId) !== null && _b !== void 0 ? _b : null;
        const assignedUser = assignedUserId
            ? (_c = eligibleUsers.find((member) => member.userId === assignedUserId)) !== null && _c !== void 0 ? _c : null
            : null;
        const viewerClaimRecords = [...((_d = toolState === null || toolState === void 0 ? void 0 : toolState.claimsByUserId[viewerId]) !== null && _d !== void 0 ? _d : [])]
            .sort((left, right) => right.claimedAt - left.claimedAt)
            .map((record) => ({
            cardId: record.cardId,
            order: record.order,
            answer: record.answer,
            claimedAt: record.claimedAt
        }));
        const remainingCardCount = (_e = toolState === null || toolState === void 0 ? void 0 : toolState.cards.filter((card) => !card.claimedByUserId).length) !== null && _e !== void 0 ? _e : 0;
        const viewerEligible = toolState ? this.canViewerClaimLottery(toolState, viewerId) : false;
        const drawLimitPerUser = (_f = toolState === null || toolState === void 0 ? void 0 : toolState.drawLimitPerUser) !== null && _f !== void 0 ? _f : 1;
        const viewerCanDraw = Boolean(toolState) &&
            viewerEligible &&
            remainingCardCount > 0 &&
            viewerClaimRecords.length < drawLimitPerUser;
        return {
            phase: (_g = toolState === null || toolState === void 0 ? void 0 : toolState.phase) !== null && _g !== void 0 ? _g : "active",
            answers: (_h = toolState === null || toolState === void 0 ? void 0 : toolState.answers) !== null && _h !== void 0 ? _h : [],
            cardCount: (_j = toolState === null || toolState === void 0 ? void 0 : toolState.cards.length) !== null && _j !== void 0 ? _j : 0,
            claimedCardCount: ((_k = toolState === null || toolState === void 0 ? void 0 : toolState.cards.length) !== null && _k !== void 0 ? _k : 0) - remainingCardCount,
            remainingCardCount,
            drawLimitPerUser,
            viewerClaimedCount: viewerClaimRecords.length,
            viewerRemainingDrawCount: Math.max(0, drawLimitPerUser - viewerClaimRecords.length),
            viewerEligible,
            viewerCanDraw,
            allowAssignedUser: Boolean(toolState === null || toolState === void 0 ? void 0 : toolState.allowAssignedUser),
            assignedUserId,
            assignedUserLabel: (_l = assignedUser === null || assignedUser === void 0 ? void 0 : assignedUser.nickname) !== null && _l !== void 0 ? _l : null,
            eligibleUsers,
            cards: (_m = toolState === null || toolState === void 0 ? void 0 : toolState.cards.map((card) => ({
                id: card.id,
                order: card.order,
                state: card.claimedByUserId === viewerId
                    ? "viewer"
                    : card.claimedByUserId
                        ? "claimed"
                        : "available",
                answer: card.claimedByUserId === viewerId ? card.answer : null,
                canClaim: viewerCanDraw && !card.claimedByUserId
            }))) !== null && _m !== void 0 ? _m : [],
            viewerClaimRecords
        };
    }
    buildToolResultMemberView(snapshot, viewerId) {
        var _a;
        const user = this.userRepository.getUser(snapshot.userId);
        return {
            userId: user.id,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            initial: (0, format_1.getInitial)(user.nickname),
            seatLabel: (_a = snapshot.seatCode) !== null && _a !== void 0 ? _a : "未入座",
            isSelf: user.id === viewerId
        };
    }
    listToolEligibleUsers(trip, viewerId) {
        return this.listTripParticipantUserIds(trip.id, false).map((userId) => this.buildToolResultMemberView({
            userId,
            seatCode: (0, seat_1.findSeatCodeByUserId)(trip.seatMap, userId)
        }, viewerId));
    }
    listTripParticipantUserIds(tripId, excludeAdmin) {
        return this.tripRepository
            .listTripMembers(tripId)
            .slice()
            .sort((left, right) => {
            if (left.joinedAt !== right.joinedAt) {
                return left.joinedAt - right.joinedAt;
            }
            return left.userId.localeCompare(right.userId);
        })
            .filter((member) => !excludeAdmin || member.role !== "admin")
            .map((member) => member.userId);
    }
    getSeatDrawEligibleSnapshots(trip, excludeAdmin, historyEntries) {
        const excludedUserIds = new Set(historyEntries.map((entry) => entry.userId));
        return Object.keys(trip.seatMap)
            .map((seatCode) => ({
            seatCode,
            userId: trip.seatMap[seatCode]
        }))
            .filter((entry) => Boolean(entry.userId))
            .filter((entry) => {
            const relation = this.tripRepository.getTripMember(trip.id, entry.userId);
            if (!relation) {
                return false;
            }
            if (excludeAdmin && relation.role === "admin") {
                return false;
            }
            return !excludedUserIds.has(entry.userId);
        })
            .map((entry) => ({
            userId: entry.userId,
            seatCode: entry.seatCode
        }));
    }
    buildDemoUsers(activeUserId) {
        const demoUserMap = this.userRepository.listUsers().reduce((accumulator, user) => {
            accumulator[user.id] = user;
            return accumulator;
        }, {});
        return constants_1.DEMO_SWITCHABLE_USER_IDS.map((userId) => demoUserMap[userId])
            .filter((user) => Boolean(user))
            .map((user) => {
            const tripName = user.currentTripId
                ? (0, format_1.displayTripName)(this.tripRepository.getTrip(user.currentTripId).tripName)
                : "未加入车次";
            return {
                id: user.id,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                initial: (0, format_1.getInitial)(user.nickname),
                isActive: user.id === activeUserId,
                currentTripName: tripName,
                switchLabel: user.id === activeUserId ? "已选中" : "切换"
            };
        });
    }
    getProfilePrimaryActionKind(currentTrip) {
        if (!currentTrip) {
            return "none";
        }
        return currentTrip.tripMeta.viewerRole === "admin" ? "dissolve" : "leave";
    }
    buildTagEditorView(currentUser, tripName) {
        var _a;
        return {
            currentUser,
            currentUserInitial: (0, format_1.getInitial)(currentUser.nickname),
            currentTripTitle: (0, format_1.displayTripName)(tripName !== null && tripName !== void 0 ? tripName : this.getCurrentTripName(currentUser)),
            authNickname: currentUser.nickname,
            authAvatarUrl: currentUser.avatarUrl,
            currentPersonaId: (_a = currentUser.homePersonaAssetId) !== null && _a !== void 0 ? _a : "",
            currentPersonaImageUrl: resolveHomePersonaImageUrl(currentUser.homePersonaAssetId),
            bio: currentUser.bio,
            livingCity: currentUser.livingCity,
            livingRegion: (0, format_1.regionValueToArray)(currentUser.livingCity, "district"),
            hometown: currentUser.hometown,
            hometownRegion: (0, format_1.regionValueToArray)(currentUser.hometown, "city"),
            age: currentUser.age,
            tags: currentUser.tags,
            tagsInput: currentUser.tags.join("\n"),
            previewTags: currentUser.tags
        };
    }
    getCurrentTripName(currentUser) {
        if (!currentUser.currentTripId) {
            return "";
        }
        return this.tripRepository.getTrip(currentUser.currentTripId).tripName;
    }
    buildCurrentTripView(tripId, viewerId) {
        var _a, _b, _c, _d;
        const trip = this.tripRepository.getTrip(tripId);
        if (trip.status !== "active") {
            throw new errors_1.BusinessError("TRIP_INACTIVE", "当前车次已经结束。");
        }
        const members = this.buildMemberViews(trip, viewerId);
        const seatMap = (0, seat_1.buildSeatOccupantMap)(trip.seatMap, members);
        const viewerRole = (_b = (_a = members.find((member) => member.userId === viewerId)) === null || _a === void 0 ? void 0 : _a.role) !== null && _b !== void 0 ? _b : "member";
        const viewerSeatCode = (_d = (_c = members.find((member) => member.userId === viewerId)) === null || _c === void 0 ? void 0 : _c.seatCode) !== null && _d !== void 0 ? _d : null;
        const tripMeta = {
            tripId: trip.id,
            tripName: (0, format_1.displayTripName)(trip.tripName),
            departureTime: (0, format_1.displayDepartureTime)(trip.departureTime),
            password: trip.password,
            templateId: trip.templateId,
            templateLabel: getTemplateLabel(trip.templateId),
            seatCount: trip.seatCodes.length,
            seatedCount: members.filter((member) => Boolean(member.seatCode)).length,
            memberCount: members.length,
            viewerRole,
            viewerRoleLabel: viewerRole === "admin" ? "管理员" : "成员",
            viewerRoleClassName: viewerRole === "admin" ? "is-admin" : "",
            isAdmin: viewerRole === "admin",
            viewerSeatCode,
            viewerSeatLabel: viewerSeatCode ? `我在 ${viewerSeatCode}` : "我还未入座"
        };
        return {
            tripMeta,
            seatMap,
            seatRows: (0, seat_1.buildSeatRows)(trip.seatCodes, seatMap, viewerId),
            members
        };
    }
    buildMemberViews(trip, viewerId) {
        const relations = this.tripRepository.listTripMembers(trip.id);
        return relations
            .map((relation) => {
            const user = this.userRepository.getUser(relation.userId);
            const seatCode = (0, seat_1.findSeatCodeByUserId)(trip.seatMap, user.id);
            return {
                userId: user.id,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                initial: (0, format_1.getInitial)(user.nickname),
                bio: user.bio,
                livingCity: user.livingCity,
                hometown: user.hometown,
                livingLocationDisplay: (0, format_1.formatLivingLocationDisplay)(user.livingCity),
                hometownLocationDisplay: (0, format_1.formatHometownLocationDisplay)(user.hometown),
                age: user.age,
                homePersonaImageUrl: resolveHomePersonaImageUrl(user.homePersonaAssetId),
                tags: user.tags,
                role: relation.role,
                isAdmin: relation.role === "admin",
                showMeta: relation.role === "admin" || user.id === viewerId,
                seatCode,
                seatLabel: seatCode !== null && seatCode !== void 0 ? seatCode : "未入座",
                isSelf: user.id === viewerId
            };
        })
            .sort(seat_1.sortMembers);
    }
}
exports.TripService = TripService;
exports.tripService = new TripService();

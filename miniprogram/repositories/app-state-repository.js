"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppStateRepository = void 0;
exports.initializeAppState = initializeAppState;
const constants_1 = require("../shared/constants");
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function normalizeVoteSelectionMode(value) {
    return value === "multiple" ? "multiple" : "single";
}
function normalizeVoteChoice(value) {
    if (value === "reject" || value === "abstain") {
        return value;
    }
    return "approve";
}
function normalizeVoteOptions(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const seenLabels = new Set();
    return value.reduce((accumulator, option, index) => {
        if (typeof option === "string") {
            const label = option.trim();
            if (!label || seenLabels.has(label)) {
                return accumulator;
            }
            seenLabels.add(label);
            accumulator.push({
                id: `legacy-vote-option-${index + 1}`,
                label
            });
            return accumulator;
        }
        if (!isRecord(option)) {
            return accumulator;
        }
        const label = typeof option.label === "string" ? option.label.trim() : "";
        if (!label || seenLabels.has(label)) {
            return accumulator;
        }
        const id = typeof option.id === "string" && option.id.trim()
            ? option.id.trim()
            : `legacy-vote-option-${index + 1}`;
        seenLabels.add(label);
        accumulator.push({
            id,
            label
        });
        return accumulator;
    }, []);
}
function normalizeVoteSubmissions(value, validOptionIds) {
    if (!isRecord(value)) {
        return {};
    }
    return Object.entries(value).reduce((accumulator, [userId, submission]) => {
        if (!isRecord(submission)) {
            return accumulator;
        }
        accumulator[userId] = {
            choice: normalizeVoteChoice(submission.choice),
            optionIds: normalizeStringArray(submission.optionIds).filter((optionId) => validOptionIds.has(optionId)),
            submittedAt: typeof submission.submittedAt === "number" ? submission.submittedAt : 0
        };
        return accumulator;
    }, {});
}
function normalizeVoteToolState(toolState) {
    if (!isRecord(toolState)) {
        return null;
    }
    const options = normalizeVoteOptions(toolState.options);
    const participantUserIds = Array.from(new Set(normalizeStringArray(toolState.participantUserIds)));
    if (!options.length || !participantUserIds.length) {
        return null;
    }
    return {
        type: "vote",
        publishedAt: typeof toolState.publishedAt === "number" ? toolState.publishedAt : 0,
        publishedByUserId: typeof toolState.publishedByUserId === "string" ? toolState.publishedByUserId : "",
        phase: toolState.phase === "draft" ? "draft" : "active",
        topic: typeof toolState.topic === "string" && toolState.topic.trim() ? toolState.topic.trim() : "投票",
        excludeAdmin: Boolean(toolState.excludeAdmin),
        selectionMode: normalizeVoteSelectionMode(toolState.selectionMode),
        options,
        participantUserIds,
        submissions: normalizeVoteSubmissions(toolState.submissions, new Set(options.map((option) => option.id)))
    };
}
function normalizeSeatDrawSnapshots(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.reduce((accumulator, entry) => {
        if (!isRecord(entry) || typeof entry.userId !== "string" || !entry.userId.trim()) {
            return accumulator;
        }
        accumulator.push({
            userId: entry.userId,
            seatCode: typeof entry.seatCode === "string" && entry.seatCode.trim() ? entry.seatCode : null
        });
        return accumulator;
    }, []);
}
function normalizeSeatDrawRounds(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((round) => normalizeSeatDrawSnapshots(round))
        .filter((round) => round.length > 0);
}
function normalizeSeatDrawToolState(toolState) {
    if (!isRecord(toolState)) {
        return null;
    }
    const config = isRecord(toolState.config) ? toolState.config : {};
    const drawCount = typeof config.drawCount === "number" ? Math.trunc(config.drawCount) : 1;
    const lastResult = normalizeSeatDrawSnapshots(toolState.lastResult);
    const legacyHistoryEntries = normalizeSeatDrawSnapshots(toolState.historyEntries);
    const drawnEntries = normalizeSeatDrawSnapshots(toolState.drawnEntries);
    const resultRounds = normalizeSeatDrawRounds(toolState.resultRounds);
    const normalizedRounds = resultRounds.length
        ? resultRounds
        : lastResult.length
            ? [lastResult]
            : [];
    return {
        type: "seat-draw",
        publishedAt: typeof toolState.publishedAt === "number" ? toolState.publishedAt : 0,
        publishedByUserId: typeof toolState.publishedByUserId === "string" ? toolState.publishedByUserId : "",
        phase: toolState.phase === "rolling" ? "rolling" : toolState.phase === "result" ? "result" : "ready",
        topic: typeof toolState.topic === "string" && toolState.topic.trim() ? toolState.topic.trim() : "随机抽号",
        config: {
            drawCount: drawCount > 0 ? drawCount : 1,
            excludePreviouslyDrawn: Boolean(config.excludePreviouslyDrawn),
            excludeAdmin: Boolean(config.excludeAdmin)
        },
        rollingDisplayEntries: normalizeSeatDrawSnapshots(toolState.rollingDisplayEntries),
        pendingResult: normalizeSeatDrawSnapshots(toolState.pendingResult),
        drawnEntries: drawnEntries.length ? drawnEntries : legacyHistoryEntries,
        resultRounds: normalizedRounds,
        rollingStartedAt: typeof toolState.rollingStartedAt === "number" ? toolState.rollingStartedAt : null,
        rollingEndsAt: typeof toolState.rollingEndsAt === "number" ? toolState.rollingEndsAt : null,
        lastResult
    };
}
function normalizeToolState(toolType, toolState) {
    var _a;
    if (toolType === "seat-draw") {
        return normalizeSeatDrawToolState(toolState);
    }
    if (toolType === "vote") {
        return normalizeVoteToolState(toolState);
    }
    return (_a = toolState) !== null && _a !== void 0 ? _a : null;
}
function normalizeTrip(trip) {
    const nextTools = (0, constants_1.createEmptyTripTools)();
    constants_1.TOOL_TYPES.forEach((toolType) => {
        var _a, _b;
        nextTools[toolType] = normalizeToolState(toolType, (_b = (_a = trip.tools) === null || _a === void 0 ? void 0 : _a[toolType]) !== null && _b !== void 0 ? _b : null);
    });
    return Object.assign(Object.assign({}, trip), { tools: nextTools });
}
function normalizeUser(user) {
    var _a;
    const nextHomePersonaAssetId = typeof user.homePersonaAssetId === "string" &&
        ((_a = user.homePersonaAssetId) === null || _a === void 0 ? void 0 : _a.trim())
        ? user.homePersonaAssetId.trim()
        : null;
    return Object.assign(Object.assign({}, user), { tags: normalizeStringArray(user.tags), homePersonaAssetId: nextHomePersonaAssetId });
}
function normalizeState(state) {
    if (!state) {
        return (0, constants_1.createInitialAppState)();
    }
    const normalizedUsers = Object.entries(state.users).reduce((accumulator, [userId, user]) => {
        accumulator[userId] = normalizeUser(user);
        return accumulator;
    }, {});
    const nextState = Object.assign(Object.assign({}, state), { version: constants_1.APP_STATE_VERSION, users: constants_1.DEMO_USERS.reduce((accumulator, demoUser) => {
            var _a;
            accumulator[demoUser.id] = (_a = accumulator[demoUser.id]) !== null && _a !== void 0 ? _a : Object.assign({}, demoUser);
            return accumulator;
        }, normalizedUsers), trips: Object.values(state.trips).reduce((accumulator, trip) => {
            accumulator[trip.id] = normalizeTrip(trip);
            return accumulator;
        }, {}) });
    return nextState;
}
class AppStateRepository {
    constructor(storageAdapter) {
        this.storageAdapter = storageAdapter;
    }
    read() {
        return normalizeState(this.storageAdapter.getState());
    }
    write(state) {
        this.storageAdapter.setState(state);
    }
    update(updater) {
        const state = this.read();
        const result = updater(state);
        this.write(state);
        return result;
    }
}
exports.AppStateRepository = AppStateRepository;
function initializeAppState(storageAdapter) {
    const repository = new AppStateRepository(storageAdapter);
    const state = repository.read();
    repository.write(state);
    return state;
}

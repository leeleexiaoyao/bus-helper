"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, _71, _72, _73, _74, _75, _76, _77, _78, _79, _80, _81, _82, _83, _84, _85, _86, _87, _88, _89, _90, _91, _92, _93, _94, _95, _96, _97, _98, _99, _100, _101, _102, _103, _104, _105, _106, _107, _108, _109, _110, _111, _112, _113, _114, _115, _116, _117, _118, _119, _120, _121, _122, _123, _124, _125, _126, _127, _128, _129, _130, _131, _132, _133, _134, _135, _136, _137, _138, _139, _140, _141, _142, _143, _144, _145, _146, _147, _148, _149, _150, _151, _152, _153, _154, _155, _156, _157, _158, _159, _160, _161, _162, _163, _164, _165, _166, _167, _168, _169, _170, _171, _172, _173, _174, _175, _176, _177, _178, _179, _180, _181, _182, _183;
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const constants_1 = require("../miniprogram/shared/constants");
const errors_1 = require("../miniprogram/shared/errors");
const storage_adapter_1 = require("../miniprogram/repositories/storage-adapter");
const seat_1 = require("../miniprogram/shared/seat");
const trip_service_1 = require("../miniprogram/services/trip-service");
function createService() {
    const storage = new storage_adapter_1.MemoryStorageAdapter((0, constants_1.createInitialAppState)());
    const service = new trip_service_1.TripService(storage);
    return {
        storage,
        service
    };
}
function createServiceWithUserCount(userCount) {
    const initialState = (0, constants_1.createInitialAppState)();
    for (let index = 5; index <= userCount; index += 1) {
        initialState.users[`user-${index}`] = {
            id: `user-${index}`,
            nickname: `成员${index}`,
            avatarUrl: `https://example.com/user-${index}.png`,
            homePersonaAssetId: null,
            tags: [],
            currentTripId: null,
            isAuthorized: false
        };
    }
    const storage = new storage_adapter_1.MemoryStorageAdapter(initialState);
    const service = new trip_service_1.TripService(storage);
    return {
        storage,
        service
    };
}
function createServiceWithUsers(userCount) {
    const state = (0, constants_1.createInitialAppState)();
    for (let index = 5; index <= userCount; index += 1) {
        const userId = `user-${index}`;
        state.users[userId] = {
            id: userId,
            nickname: `成员${String(index).padStart(2, "0")}`,
            avatarUrl: `https://example.com/${userId}.png`,
            homePersonaAssetId: null,
            tags: [`模拟${index}`],
            currentTripId: null,
            isAuthorized: false
        };
    }
    const storage = new storage_adapter_1.MemoryStorageAdapter(state);
    const service = new trip_service_1.TripService(storage);
    return {
        storage,
        service
    };
}
function expectBusinessError(action, code) {
    try {
        action();
        strict_1.default.fail(`Expected ${code}`);
    }
    catch (error) {
        if (!(error instanceof errors_1.BusinessError)) {
            throw error;
        }
        strict_1.default.equal(error.code, code);
    }
}
function authorizeActiveUser(service, nickname) {
    service.authorizeProfile({
        nickname,
        avatarUrl: `https://example.com/${nickname}.png`
    });
}
function joinTripAndSeat(service, userId, nickname, password, seatCode) {
    service.switchActiveUser(userId);
    authorizeActiveUser(service, nickname);
    service.joinTripByPassword(password);
    service.claimSeat(seatCode, {
        profileMode: "custom",
        nickname,
        avatarUrl: ""
    });
}
function setupTripWithMembers() {
    var _a, _b;
    const { service, storage } = createService();
    authorizeActiveUser(service, "小雨");
    const createdTrip = service.createTrip({
        tripName: "周末上山线",
        departureTime: "4/20 07:30",
        password: "123456",
        templateId: "template-49"
    });
    const tripId = (_b = (_a = createdTrip.currentTrip) === null || _a === void 0 ? void 0 : _a.tripMeta.tripId) !== null && _b !== void 0 ? _b : "";
    service.claimSeat("1A", {
        profileMode: "custom",
        nickname: "小雨",
        avatarUrl: ""
    });
    joinTripAndSeat(service, "user-2", "阿山", "123456", "1B");
    joinTripAndSeat(service, "user-3", "Miya", "123456", "1C");
    joinTripAndSeat(service, "user-4", "老周", "123456", "1D");
    service.switchActiveUser("user-1");
    return {
        service,
        storage,
        tripId
    };
}
function setupTripWithMemberCount(memberCount) {
    var _a, _b;
    const { service, storage } = createServiceWithUserCount(memberCount);
    const seatCodes = (0, seat_1.generateSeatCodes)("template-49");
    if (memberCount > seatCodes.length) {
        throw new Error(`Too many members for template-49: ${memberCount}`);
    }
    authorizeActiveUser(service, "小雨");
    const createdTrip = service.createTrip({
        tripName: "49人联调线",
        departureTime: "4/20 07:30",
        password: "123456",
        templateId: "template-49"
    });
    const tripId = (_b = (_a = createdTrip.currentTrip) === null || _a === void 0 ? void 0 : _a.tripMeta.tripId) !== null && _b !== void 0 ? _b : "";
    service.claimSeat(seatCodes[0], {
        profileMode: "custom",
        nickname: "小雨",
        avatarUrl: ""
    });
    for (let index = 2; index <= memberCount; index += 1) {
        joinTripAndSeat(service, `user-${index}`, `成员${index}`, "123456", seatCodes[index - 1]);
    }
    service.switchActiveUser("user-1");
    return {
        service,
        storage,
        tripId
    };
}
function getToolCard(service, toolType) {
    const card = service.getToolsPageData().toolCards.find((entry) => entry.type === toolType);
    strict_1.default.ok(card, `Expected tool card ${toolType}`);
    return card;
}
function getVoteDetail(service) {
    const detail = service.getToolDetailPageData("vote");
    strict_1.default.ok(detail.voteDetail, "Expected vote detail");
    return detail;
}
function submitVoteChoice(service, choice, optionIds = []) {
    const input = {
        choice,
        optionIds
    };
    return service.submitVote(input);
}
function withMockedRandom(value, action) {
    const math = Math;
    const originalRandom = math.random;
    math.random = () => value;
    try {
        return action();
    }
    finally {
        math.random = originalRandom;
    }
}
function buildSequentialLabels(prefix, count) {
    return Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`);
}
function flattenSeatCodes(createdTrip) {
    if (!createdTrip) {
        return [];
    }
    return createdTrip.seatRows.reduce((accumulator, row) => {
        row.slots.forEach((slot) => {
            if (slot) {
                accumulator.push(slot.code);
            }
        });
        return accumulator;
    }, []);
}
function setupTripWith49Members() {
    var _a, _b;
    const { service, storage } = createServiceWithUsers(49);
    authorizeActiveUser(service, "小雨");
    const createdTrip = service.createTrip({
        tripName: "49 人压力测试线",
        departureTime: "4/20 07:30",
        password: "123456",
        templateId: "template-49"
    });
    const tripId = (_b = (_a = createdTrip.currentTrip) === null || _a === void 0 ? void 0 : _a.tripMeta.tripId) !== null && _b !== void 0 ? _b : "";
    const seatCodes = flattenSeatCodes(createdTrip.currentTrip);
    strict_1.default.equal(seatCodes.length, 49);
    service.claimSeat(seatCodes[0], {
        profileMode: "custom",
        nickname: "小雨",
        avatarUrl: ""
    });
    for (let index = 2; index <= 49; index += 1) {
        joinTripAndSeat(service, `user-${index}`, `成员${String(index).padStart(2, "0")}`, "123456", seatCodes[index - 1]);
    }
    service.switchActiveUser("user-1");
    return {
        service,
        storage,
        tripId,
        seatCodes
    };
}
{
    const { service } = createService();
    let toolsPage = service.getToolsPageData();
    strict_1.default.equal(toolsPage.isAuthorized, false);
    strict_1.default.equal(toolsPage.hasCurrentTrip, false);
    strict_1.default.equal(toolsPage.toolCards.length, 4);
    strict_1.default.deepEqual(toolsPage.toolCards.map((card) => card.type), ["vote", "seat-draw", "lottery", "wheel"]);
    strict_1.default.deepEqual(toolsPage.toolCards.map((card) => ({
        type: card.type,
        displayTitle: card.displayTitle,
        displayDescription: card.displayDescription,
        ctaLabel: card.ctaLabel
    })), [
        {
            type: "vote",
            displayTitle: "投票",
            displayDescription: "选出你喜欢的",
            ctaLabel: "玩这个>"
        },
        {
            type: "seat-draw",
            displayTitle: "随机选号",
            displayDescription: "看看谁运气好",
            ctaLabel: "玩这个>"
        },
        {
            type: "lottery",
            displayTitle: "抽签",
            displayDescription: "谁是天选之人",
            ctaLabel: "玩这个>"
        },
        {
            type: "wheel",
            displayTitle: "幸运大转盘",
            displayDescription: "幸运转转转",
            ctaLabel: "玩这个>"
        }
    ]);
    strict_1.default.equal(toolsPage.toolCards.every((card) => card.stateLabel === "未开启"), true);
    strict_1.default.equal(toolsPage.toolCards.every((card) => !card.isStarted), true);
    strict_1.default.equal(toolsPage.toolCards.every((card) => !card.canEnter), true);
    expectBusinessError(() => service.getToolDetailPageData("seat-draw"), "TRIP_REQUIRED");
    authorizeActiveUser(service, "小雨");
    toolsPage = service.getToolsPageData();
    strict_1.default.equal(toolsPage.isAuthorized, true);
    strict_1.default.equal(toolsPage.hasCurrentTrip, false);
    strict_1.default.equal(toolsPage.toolCards.every((card) => !card.canEnter), true);
    const createdTrip = service.createTrip({
        tripName: "周末上山线",
        departureTime: "4/20 07:30",
        password: "123456",
        templateId: "template-49"
    });
    strict_1.default.equal((_a = createdTrip.currentTrip) === null || _a === void 0 ? void 0 : _a.tripMeta.viewerRole, "admin");
    service.claimSeat("1A", {
        profileMode: "custom",
        nickname: "小雨",
        avatarUrl: ""
    });
    joinTripAndSeat(service, "user-2", "阿山", "123456", "1B");
    joinTripAndSeat(service, "user-3", "Miya", "123456", "1C");
    joinTripAndSeat(service, "user-4", "老周", "123456", "1D");
    service.switchActiveUser("user-1");
    toolsPage = service.getToolsPageData();
    strict_1.default.equal(toolsPage.hasCurrentTrip, true);
    strict_1.default.equal(toolsPage.isAdmin, true);
    strict_1.default.equal(toolsPage.toolCards.every((card) => card.canEnter), true);
    strict_1.default.equal(toolsPage.toolCards.every((card) => !card.isStarted), true);
    const adminSeatDraw = service.getToolDetailPageData("seat-draw");
    strict_1.default.equal(adminSeatDraw.isStarted, false);
    strict_1.default.equal(adminSeatDraw.seatDrawDetail, null);
    strict_1.default.equal(adminSeatDraw.statusMessage.includes("创建玩法"), true);
    service.switchActiveUser("user-2");
    const memberSeatDraw = service.getToolDetailPageData("seat-draw");
    strict_1.default.equal(memberSeatDraw.isStarted, false);
    strict_1.default.equal(memberSeatDraw.seatDrawDetail, null);
    strict_1.default.equal(memberSeatDraw.statusMessage.includes("玩法未开启"), true);
}
{
    const { service } = setupTripWithMembers();
    service.publishSeatDrawTool({
        topic: "上台表演",
        drawCount: 2,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
    });
    service.publishVoteTool({
        topic: "今晚是否提前十分钟集合",
        excludeAdmin: false,
        selectionMode: "single",
        options: ["投票", "否决", "弃权"]
    });
    service.publishWheelTool({
        items: ["唱歌", "真心话", "讲冷笑话"]
    });
    service.publishLotteryTool({
        winnerCount: 2,
        excludeAdmin: false
    });
    const toolsPage = service.getToolsPageData();
    strict_1.default.equal(toolsPage.toolCards.every((card) => card.isStarted), true);
    strict_1.default.equal(toolsPage.toolCards.every((card) => card.stateLabel === "已开启"), true);
    strict_1.default.equal(getToolCard(service, "seat-draw").canEnter, true);
    strict_1.default.equal(getToolCard(service, "vote").canEnter, true);
    strict_1.default.equal(getToolCard(service, "wheel").canEnter, true);
    strict_1.default.equal(getToolCard(service, "lottery").canEnter, true);
    service.closeVote();
    strict_1.default.equal(getToolCard(service, "vote").isStarted, false);
    strict_1.default.equal(getToolCard(service, "seat-draw").isStarted, true);
    strict_1.default.equal(getToolCard(service, "wheel").isStarted, true);
    strict_1.default.equal(getToolCard(service, "lottery").isStarted, true);
    strict_1.default.equal(service.getToolDetailPageData("vote").isStarted, false);
}
{
    const { service } = setupTripWithMembers();
    expectBusinessError(() => service.publishSeatDrawTool({
        topic: "",
        drawCount: 1,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
    }), "INVALID_SEAT_DRAW_TOPIC");
    expectBusinessError(() => service.publishSeatDrawTool({
        topic: "123456789012345678901",
        drawCount: 1,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
    }), "SEAT_DRAW_TOPIC_TOO_LONG");
    expectBusinessError(() => service.publishSeatDrawTool({
        topic: "人数超限",
        drawCount: 6,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
    }), "DRAW_COUNT_LIMIT_EXCEEDED");
    service.publishSeatDrawTool({
        topic: "上台表演",
        drawCount: 2,
        excludePreviouslyDrawn: true,
        excludeAdmin: true
    });
    let detail = service.getToolDetailPageData("seat-draw");
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_b = detail.seatDrawDetail) === null || _b === void 0 ? void 0 : _b.phase, "ready");
    strict_1.default.equal((_c = detail.seatDrawDetail) === null || _c === void 0 ? void 0 : _c.topic, "上台表演");
    strict_1.default.equal((_d = detail.seatDrawDetail) === null || _d === void 0 ? void 0 : _d.excludeAdmin, true);
    strict_1.default.equal((_e = detail.seatDrawDetail) === null || _e === void 0 ? void 0 : _e.excludePreviouslyDrawn, true);
    strict_1.default.equal((_f = detail.seatDrawDetail) === null || _f === void 0 ? void 0 : _f.remainingCount, 3);
    detail = service.drawSeat();
    const firstRoundUserIds = new Set((_g = detail.seatDrawDetail) === null || _g === void 0 ? void 0 : _g.lastResult.map((member) => member.userId));
    strict_1.default.equal((_h = detail.seatDrawDetail) === null || _h === void 0 ? void 0 : _h.lastResult.length, 2);
    strict_1.default.equal((_j = detail.seatDrawDetail) === null || _j === void 0 ? void 0 : _j.resultRounds.length, 1);
    strict_1.default.equal((_k = detail.seatDrawDetail) === null || _k === void 0 ? void 0 : _k.remainingCount, 1);
    strict_1.default.equal((_l = detail.seatDrawDetail) === null || _l === void 0 ? void 0 : _l.lastResult.some((member) => member.userId === "user-1"), false);
    detail = service.drawSeat();
    strict_1.default.equal((_m = detail.seatDrawDetail) === null || _m === void 0 ? void 0 : _m.lastResult.length, 1);
    strict_1.default.equal((_o = detail.seatDrawDetail) === null || _o === void 0 ? void 0 : _o.resultRounds.length, 2);
    strict_1.default.equal((_p = detail.seatDrawDetail) === null || _p === void 0 ? void 0 : _p.remainingCount, 0);
    strict_1.default.equal((_q = detail.seatDrawDetail) === null || _q === void 0 ? void 0 : _q.canDrawAgain, false);
    strict_1.default.equal(firstRoundUserIds.has((_t = (_s = (_r = detail.seatDrawDetail) === null || _r === void 0 ? void 0 : _r.lastResult[0]) === null || _s === void 0 ? void 0 : _s.userId) !== null && _t !== void 0 ? _t : ""), false);
    detail = service.resetSeatDraw();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_u = detail.seatDrawDetail) === null || _u === void 0 ? void 0 : _u.phase, "ready");
    strict_1.default.equal((_v = detail.seatDrawDetail) === null || _v === void 0 ? void 0 : _v.lastResult.length, 0);
    strict_1.default.equal((_w = detail.seatDrawDetail) === null || _w === void 0 ? void 0 : _w.resultRounds.length, 0);
    strict_1.default.equal((_x = detail.seatDrawDetail) === null || _x === void 0 ? void 0 : _x.remainingCount, 3);
    detail = service.closeSeatDraw();
    strict_1.default.equal(detail.isStarted, false);
    strict_1.default.equal(detail.seatDrawDetail, null);
    strict_1.default.equal(getToolCard(service, "seat-draw").isStarted, false);
}
{
    const { service } = setupTripWithMembers();
    service.publishVoteTool({
        topic: "今晚是否提前十分钟集合",
        excludeAdmin: true,
        selectionMode: "multiple",
        options: ["方案A", "方案B", "方案C"]
    });
    let detail = getVoteDetail(service);
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_y = detail.voteDetail) === null || _y === void 0 ? void 0 : _y.phase, "active");
    strict_1.default.equal((_z = detail.voteDetail) === null || _z === void 0 ? void 0 : _z.participantCount, 3);
    strict_1.default.equal((_0 = detail.voteDetail) === null || _0 === void 0 ? void 0 : _0.excludeAdmin, true);
    strict_1.default.equal((_1 = detail.voteDetail) === null || _1 === void 0 ? void 0 : _1.selectionMode, "multiple");
    strict_1.default.equal((_2 = detail.voteDetail) === null || _2 === void 0 ? void 0 : _2.options.length, 3);
    strict_1.default.deepEqual((_3 = detail.voteDetail) === null || _3 === void 0 ? void 0 : _3.options.map((option) => option.label), ["方案A", "方案B", "方案C"]);
    strict_1.default.equal((_4 = detail.voteDetail) === null || _4 === void 0 ? void 0 : _4.viewerHasSubmitted, false);
    strict_1.default.equal((_5 = detail.voteDetail) === null || _5 === void 0 ? void 0 : _5.viewerEligible, false);
    strict_1.default.equal(detail.statusMessage.includes("创建玩法"), false);
    expectBusinessError(() => submitVoteChoice(service, "approve"), "VOTE_NOT_ALLOWED");
    service.switchActiveUser("user-2");
    detail = getVoteDetail(service);
    strict_1.default.equal((_6 = detail.voteDetail) === null || _6 === void 0 ? void 0 : _6.viewerEligible, true);
    const multiOptionIds = (_8 = (_7 = detail.voteDetail) === null || _7 === void 0 ? void 0 : _7.options.map((option) => option.id)) !== null && _8 !== void 0 ? _8 : [];
    detail = submitVoteChoice(service, "approve", [(_9 = multiOptionIds[0]) !== null && _9 !== void 0 ? _9 : ""]);
    strict_1.default.equal((_10 = detail.voteDetail) === null || _10 === void 0 ? void 0 : _10.viewerChoice, "approve");
    strict_1.default.equal((_11 = detail.voteDetail) === null || _11 === void 0 ? void 0 : _11.viewerHasSubmitted, true);
    strict_1.default.deepEqual((_12 = detail.voteDetail) === null || _12 === void 0 ? void 0 : _12.viewerSelectedOptionIds, [multiOptionIds[0]]);
    strict_1.default.equal((_13 = detail.voteDetail) === null || _13 === void 0 ? void 0 : _13.submittedCount, 1);
    detail = submitVoteChoice(service, "approve", [(_14 = multiOptionIds[1]) !== null && _14 !== void 0 ? _14 : ""]);
    strict_1.default.deepEqual((_15 = detail.voteDetail) === null || _15 === void 0 ? void 0 : _15.viewerSelectedOptionIds, [
        multiOptionIds[0],
        multiOptionIds[1]
    ]);
    strict_1.default.equal((_16 = detail.voteDetail) === null || _16 === void 0 ? void 0 : _16.submittedCount, 1);
    detail = submitVoteChoice(service, "approve", [(_17 = multiOptionIds[2]) !== null && _17 !== void 0 ? _17 : ""]);
    strict_1.default.deepEqual((_18 = detail.voteDetail) === null || _18 === void 0 ? void 0 : _18.viewerSelectedOptionIds, multiOptionIds);
    strict_1.default.equal((_19 = detail.voteDetail) === null || _19 === void 0 ? void 0 : _19.options.every((option) => option.selectedByViewer), true);
    strict_1.default.equal((_20 = detail.voteDetail) === null || _20 === void 0 ? void 0 : _20.submittedCount, 1);
    expectBusinessError(() => submitVoteChoice(service, "reject"), "VOTE_ALREADY_SUBMITTED");
    service.switchActiveUser("user-3");
    detail = submitVoteChoice(service, "reject");
    strict_1.default.equal((_21 = detail.voteDetail) === null || _21 === void 0 ? void 0 : _21.submittedCount, 2);
    service.switchActiveUser("user-4");
    detail = submitVoteChoice(service, "abstain");
    strict_1.default.equal((_22 = detail.voteDetail) === null || _22 === void 0 ? void 0 : _22.approveCount, 1);
    strict_1.default.equal((_23 = detail.voteDetail) === null || _23 === void 0 ? void 0 : _23.rejectCount, 1);
    strict_1.default.equal((_24 = detail.voteDetail) === null || _24 === void 0 ? void 0 : _24.abstainCount, 1);
    strict_1.default.equal((_25 = detail.voteDetail) === null || _25 === void 0 ? void 0 : _25.submittedCount, 3);
    service.switchActiveUser("user-1");
    detail = service.resetVote();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_26 = detail.voteDetail) === null || _26 === void 0 ? void 0 : _26.phase, "active");
    strict_1.default.equal((_27 = detail.voteDetail) === null || _27 === void 0 ? void 0 : _27.topic, "今晚是否提前十分钟集合");
    strict_1.default.equal((_28 = detail.voteDetail) === null || _28 === void 0 ? void 0 : _28.selectionMode, "multiple");
    strict_1.default.equal((_29 = detail.voteDetail) === null || _29 === void 0 ? void 0 : _29.participantCount, 3);
    strict_1.default.equal((_30 = detail.voteDetail) === null || _30 === void 0 ? void 0 : _30.submittedCount, 0);
    strict_1.default.equal((_31 = detail.voteDetail) === null || _31 === void 0 ? void 0 : _31.viewerHasSubmitted, false);
    strict_1.default.equal(detail.statusMessage.includes("创建玩法"), false);
    service.switchActiveUser("user-1");
    expectBusinessError(() => service.publishVoteTool({
        topic: "重新确认上车时间",
        excludeAdmin: false,
        selectionMode: "single",
        options: ["投票", "否决", "弃权"]
    }), "TOOL_ALREADY_STARTED");
    detail = service.closeVote();
    strict_1.default.equal(detail.isStarted, false);
    strict_1.default.equal(detail.voteDetail, null);
    strict_1.default.equal(getToolCard(service, "vote").isStarted, false);
}
{
    const { service, storage, tripId } = setupTripWithMembers();
    service.publishSeatDrawTool({
        topic: "随机上台",
        drawCount: 3,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
    });
    let detail = service.startSeatDrawRound();
    strict_1.default.equal((_32 = detail.seatDrawDetail) === null || _32 === void 0 ? void 0 : _32.phase, "rolling");
    strict_1.default.equal((_33 = detail.seatDrawDetail) === null || _33 === void 0 ? void 0 : _33.displaySlots.length, 3);
    strict_1.default.equal(new Set((_34 = detail.seatDrawDetail) === null || _34 === void 0 ? void 0 : _34.displaySlots.map((slot) => slot.label)).size, 3);
    detail = service.advanceSeatDrawRollingFrame();
    strict_1.default.equal((_35 = detail.seatDrawDetail) === null || _35 === void 0 ? void 0 : _35.phase, "rolling");
    strict_1.default.equal(new Set((_36 = detail.seatDrawDetail) === null || _36 === void 0 ? void 0 : _36.displaySlots.map((slot) => slot.label)).size, 3);
    const state = storage.getState();
    if (!state) {
        throw new Error("Expected memory state");
    }
    const toolState = state.trips[tripId].tools["seat-draw"];
    if (!toolState || toolState.type !== "seat-draw") {
        throw new Error("Expected seat draw tool state");
    }
    toolState.rollingEndsAt = Date.now() - 1;
    storage.setState(state);
    detail = service.finalizeSeatDrawRoundIfDue();
    strict_1.default.equal((_37 = detail.seatDrawDetail) === null || _37 === void 0 ? void 0 : _37.phase, "result");
    strict_1.default.equal((_38 = detail.seatDrawDetail) === null || _38 === void 0 ? void 0 : _38.lastResult.length, 3);
    strict_1.default.equal((_39 = detail.seatDrawDetail) === null || _39 === void 0 ? void 0 : _39.resultRounds.length, 1);
}
{
    const { service } = setupTripWithMembers();
    service.publishSeatDrawTool({
        topic: "自由抽号",
        drawCount: 2,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
    });
    service.drawSeat();
    let detail = service.recreateSeatDrawTool({
        topic: "重新抽号",
        drawCount: 1,
        excludePreviouslyDrawn: true,
        excludeAdmin: true
    });
    strict_1.default.equal((_40 = detail.seatDrawDetail) === null || _40 === void 0 ? void 0 : _40.topic, "重新抽号");
    strict_1.default.equal((_41 = detail.seatDrawDetail) === null || _41 === void 0 ? void 0 : _41.drawCount, 1);
    strict_1.default.equal((_42 = detail.seatDrawDetail) === null || _42 === void 0 ? void 0 : _42.excludePreviouslyDrawn, true);
    strict_1.default.equal((_43 = detail.seatDrawDetail) === null || _43 === void 0 ? void 0 : _43.excludeAdmin, true);
    strict_1.default.equal((_44 = detail.seatDrawDetail) === null || _44 === void 0 ? void 0 : _44.resultRounds.length, 0);
}
{
    const { service } = setupTripWithMembers();
    service.publishVoteTool({
        topic: "重新创建投票",
        excludeAdmin: false,
        selectionMode: "multiple",
        options: ["方案A", "方案B"]
    });
    service.switchActiveUser("user-2");
    let detail = getVoteDetail(service);
    const firstOptionId = (_47 = (_46 = (_45 = detail.voteDetail) === null || _45 === void 0 ? void 0 : _45.options[0]) === null || _46 === void 0 ? void 0 : _46.id) !== null && _47 !== void 0 ? _47 : "";
    detail = submitVoteChoice(service, "approve", [firstOptionId]);
    service.switchActiveUser("user-1");
    detail = service.recreateVoteTool({
        topic: "重新创建投票 v2",
        excludeAdmin: false,
        selectionMode: "single",
        options: ["方案A", "方案C"]
    });
    strict_1.default.equal((_48 = detail.voteDetail) === null || _48 === void 0 ? void 0 : _48.topic, "重新创建投票 v2");
    strict_1.default.equal((_49 = detail.voteDetail) === null || _49 === void 0 ? void 0 : _49.selectionMode, "single");
    strict_1.default.equal((_50 = detail.voteDetail) === null || _50 === void 0 ? void 0 : _50.options.length, 2);
    strict_1.default.equal((_51 = detail.voteDetail) === null || _51 === void 0 ? void 0 : _51.approveCount, 1);
    service.switchActiveUser("user-2");
    detail = getVoteDetail(service);
    strict_1.default.equal((_52 = detail.voteDetail) === null || _52 === void 0 ? void 0 : _52.viewerHasSubmitted, true);
    strict_1.default.equal((_53 = detail.voteDetail) === null || _53 === void 0 ? void 0 : _53.viewerSelectedOptionIds.length, 1);
    strict_1.default.equal((_55 = (_54 = detail.voteDetail) === null || _54 === void 0 ? void 0 : _54.options[0]) === null || _55 === void 0 ? void 0 : _55.selectedByViewer, true);
}
{
    const { service } = setupTripWithMembers();
    service.publishVoteTool({
        topic: "单选投票测试",
        excludeAdmin: false,
        selectionMode: "single",
        options: ["投票", "否决", "弃权"]
    });
    let detail = getVoteDetail(service);
    strict_1.default.equal((_56 = detail.voteDetail) === null || _56 === void 0 ? void 0 : _56.selectionMode, "single");
    strict_1.default.equal((_57 = detail.voteDetail) === null || _57 === void 0 ? void 0 : _57.options.length, 3);
    service.switchActiveUser("user-2");
    detail = getVoteDetail(service);
    const singleOptionIds = (_59 = (_58 = detail.voteDetail) === null || _58 === void 0 ? void 0 : _58.options.map((option) => option.id)) !== null && _59 !== void 0 ? _59 : [];
    expectBusinessError(() => submitVoteChoice(service, "approve", singleOptionIds), "VOTE_SINGLE_OPTION_ONLY");
    detail = submitVoteChoice(service, "approve", [(_60 = singleOptionIds[0]) !== null && _60 !== void 0 ? _60 : ""]);
    strict_1.default.equal((_61 = detail.voteDetail) === null || _61 === void 0 ? void 0 : _61.viewerSelectedOptionIds.length, 1);
    strict_1.default.equal((_62 = detail.voteDetail) === null || _62 === void 0 ? void 0 : _62.viewerHasSubmitted, true);
    service.switchActiveUser("user-1");
    detail = service.closeVote();
    strict_1.default.equal(detail.isStarted, false);
    strict_1.default.equal(detail.voteDetail, null);
    strict_1.default.equal(getToolCard(service, "vote").isStarted, false);
}
{
    const { service } = setupTripWithMembers();
    service.publishVoteTool({
        topic: "否决选项保留测试",
        excludeAdmin: false,
        selectionMode: "multiple",
        options: ["方案A", "方案B"]
    });
    service.switchActiveUser("user-2");
    let detail = getVoteDetail(service);
    const optionIds = (_64 = (_63 = detail.voteDetail) === null || _63 === void 0 ? void 0 : _63.options.map((option) => option.id)) !== null && _64 !== void 0 ? _64 : [];
    detail = submitVoteChoice(service, "reject", [(_65 = optionIds[0]) !== null && _65 !== void 0 ? _65 : ""]);
    strict_1.default.equal((_66 = detail.voteDetail) === null || _66 === void 0 ? void 0 : _66.viewerChoice, "reject");
    strict_1.default.deepEqual((_67 = detail.voteDetail) === null || _67 === void 0 ? void 0 : _67.viewerSelectedOptionIds, [optionIds[0]]);
    strict_1.default.equal((_69 = (_68 = detail.voteDetail) === null || _68 === void 0 ? void 0 : _68.options[0]) === null || _69 === void 0 ? void 0 : _69.selectedByViewer, true);
    strict_1.default.equal((_71 = (_70 = detail.voteDetail) === null || _70 === void 0 ? void 0 : _70.options[0]) === null || _71 === void 0 ? void 0 : _71.supportCount, 0);
}
{
    const { service, storage, tripId } = setupTripWithMembers();
    const corruptedState = storage.getState();
    if (!corruptedState) {
        throw new Error("Expected memory state");
    }
    corruptedState.version = 4;
    corruptedState.trips[tripId].tools.vote = {
        type: "vote",
        publishedAt: 1,
        publishedByUserId: "user-1",
        phase: "active",
        topic: "旧缓存投票",
        excludeAdmin: false,
        options: ["方案A", "方案B"],
        participantUserIds: ["user-1", "user-2"],
        submissions: {
            "user-2": {
                choice: "approve",
                optionIds: ["legacy-vote-option-1"],
                submittedAt: 1
            }
        }
    };
    storage.setState(corruptedState);
    const migratedService = new trip_service_1.TripService(storage);
    migratedService.switchActiveUser("user-2");
    const detail = migratedService.getToolDetailPageData("vote");
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_72 = detail.voteDetail) === null || _72 === void 0 ? void 0 : _72.selectionMode, "single");
    strict_1.default.deepEqual((_73 = detail.voteDetail) === null || _73 === void 0 ? void 0 : _73.options.map((option) => option.label), ["方案A", "方案B"]);
    strict_1.default.equal((_74 = detail.voteDetail) === null || _74 === void 0 ? void 0 : _74.viewerHasSubmitted, true);
    strict_1.default.deepEqual((_75 = detail.voteDetail) === null || _75 === void 0 ? void 0 : _75.viewerSelectedOptionIds, ["legacy-vote-option-1"]);
    strict_1.default.equal((_77 = (_76 = detail.voteDetail) === null || _76 === void 0 ? void 0 : _76.options[0]) === null || _77 === void 0 ? void 0 : _77.selectedByViewer, true);
    strict_1.default.equal((_79 = (_78 = detail.voteDetail) === null || _78 === void 0 ? void 0 : _78.options[0]) === null || _79 === void 0 ? void 0 : _79.supportCount, 1);
}
{
    const { service } = setupTripWithMembers();
    service.publishWheelTool({
        items: ["唱歌", "真心话", "讲冷笑话"]
    });
    let detail = service.getToolDetailPageData("wheel");
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_80 = detail.wheelDetail) === null || _80 === void 0 ? void 0 : _80.phase, "draft");
    strict_1.default.equal((_81 = detail.wheelDetail) === null || _81 === void 0 ? void 0 : _81.items.length, 3);
    strict_1.default.equal((_82 = detail.wheelDetail) === null || _82 === void 0 ? void 0 : _82.viewerCanSpin, true);
    strict_1.default.equal((_83 = detail.wheelDetail) === null || _83 === void 0 ? void 0 : _83.allowAssignedUser, false);
    strict_1.default.equal((_84 = detail.wheelDetail) === null || _84 === void 0 ? void 0 : _84.resultIndex, null);
    strict_1.default.equal((_85 = detail.wheelDetail) === null || _85 === void 0 ? void 0 : _85.resultLabel, null);
    strict_1.default.deepEqual((_86 = detail.wheelDetail) === null || _86 === void 0 ? void 0 : _86.resultHistoryLabels, []);
    detail = withMockedRandom(0, () => service.spinWheel());
    strict_1.default.equal((_87 = detail.wheelDetail) === null || _87 === void 0 ? void 0 : _87.phase, "result");
    strict_1.default.equal((_88 = detail.wheelDetail) === null || _88 === void 0 ? void 0 : _88.resultIndex, 0);
    strict_1.default.equal((_89 = detail.wheelDetail) === null || _89 === void 0 ? void 0 : _89.resultLabel, "唱歌");
    strict_1.default.deepEqual((_90 = detail.wheelDetail) === null || _90 === void 0 ? void 0 : _90.resultHistoryLabels, ["唱歌"]);
    detail = service.resetWheel();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_91 = detail.wheelDetail) === null || _91 === void 0 ? void 0 : _91.phase, "draft");
    strict_1.default.equal((_92 = detail.wheelDetail) === null || _92 === void 0 ? void 0 : _92.resultIndex, null);
    strict_1.default.equal((_93 = detail.wheelDetail) === null || _93 === void 0 ? void 0 : _93.resultLabel, null);
    strict_1.default.deepEqual((_94 = detail.wheelDetail) === null || _94 === void 0 ? void 0 : _94.resultHistoryLabels, []);
    detail = service.closeWheel();
    strict_1.default.equal(detail.isStarted, false);
    strict_1.default.equal((_95 = detail.wheelDetail) === null || _95 === void 0 ? void 0 : _95.items.length, 0);
    strict_1.default.equal((_96 = detail.wheelDetail) === null || _96 === void 0 ? void 0 : _96.viewerCanSpin, false);
    strict_1.default.equal((_97 = detail.wheelDetail) === null || _97 === void 0 ? void 0 : _97.eligibleUsers.length, 4);
    strict_1.default.equal(getToolCard(service, "wheel").isStarted, false);
}
{
    const { service } = setupTripWithMembers();
    service.publishWheelTool({
        items: ["免单", "再来一次", "零食礼包"],
        allowAssignedUser: true,
        assignedUserId: "user-2"
    });
    let detail = service.getToolDetailPageData("wheel");
    strict_1.default.equal((_98 = detail.wheelDetail) === null || _98 === void 0 ? void 0 : _98.viewerCanSpin, false);
    strict_1.default.equal((_99 = detail.wheelDetail) === null || _99 === void 0 ? void 0 : _99.allowAssignedUser, true);
    strict_1.default.equal((_100 = detail.wheelDetail) === null || _100 === void 0 ? void 0 : _100.assignedUserId, "user-2");
    strict_1.default.equal((_101 = detail.wheelDetail) === null || _101 === void 0 ? void 0 : _101.assignedUserLabel, "阿山");
    strict_1.default.equal((_102 = detail.wheelDetail) === null || _102 === void 0 ? void 0 : _102.eligibleUsers.length, 4);
    expectBusinessError(() => service.spinWheel(), "WHEEL_FORBIDDEN");
    service.switchActiveUser("user-2");
    detail = service.getToolDetailPageData("wheel");
    strict_1.default.equal((_103 = detail.wheelDetail) === null || _103 === void 0 ? void 0 : _103.viewerCanSpin, true);
    detail = withMockedRandom(0.5, () => service.spinWheel());
    strict_1.default.equal((_104 = detail.wheelDetail) === null || _104 === void 0 ? void 0 : _104.phase, "result");
    strict_1.default.equal((_105 = detail.wheelDetail) === null || _105 === void 0 ? void 0 : _105.resultLabel, "再来一次");
    service.switchActiveUser("user-1");
    detail = service.recreateWheelTool({
        items: ["唱歌", "真心话"],
        allowAssignedUser: true,
        assignedUserId: "user-1"
    });
    strict_1.default.equal((_106 = detail.wheelDetail) === null || _106 === void 0 ? void 0 : _106.assignedUserId, "user-1");
    strict_1.default.equal((_107 = detail.wheelDetail) === null || _107 === void 0 ? void 0 : _107.assignedUserLabel, "小雨");
    strict_1.default.equal((_108 = detail.wheelDetail) === null || _108 === void 0 ? void 0 : _108.viewerCanSpin, true);
    service.switchActiveUser("user-3");
    detail = service.getToolDetailPageData("wheel");
    strict_1.default.equal((_109 = detail.wheelDetail) === null || _109 === void 0 ? void 0 : _109.viewerCanSpin, false);
    expectBusinessError(() => service.spinWheel(), "WHEEL_FORBIDDEN");
}
{
    const { service } = setupTripWithMembers();
    service.publishLotteryTool({
        winnerCount: 2,
        excludeAdmin: true
    });
    let detail = service.getToolDetailPageData("lottery");
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_110 = detail.lotteryDetail) === null || _110 === void 0 ? void 0 : _110.phase, "active");
    strict_1.default.equal((_111 = detail.lotteryDetail) === null || _111 === void 0 ? void 0 : _111.excludeAdmin, true);
    strict_1.default.equal((_112 = detail.lotteryDetail) === null || _112 === void 0 ? void 0 : _112.participantCount, 3);
    strict_1.default.equal((_113 = detail.lotteryDetail) === null || _113 === void 0 ? void 0 : _113.viewerEligible, false);
    expectBusinessError(() => service.claimLottery(), "LOTTERY_NOT_ALLOWED");
    service.switchActiveUser("user-2");
    detail = service.claimLottery();
    strict_1.default.equal((_114 = detail.lotteryDetail) === null || _114 === void 0 ? void 0 : _114.viewerHasClaimed, true);
    strict_1.default.equal((_115 = detail.lotteryDetail) === null || _115 === void 0 ? void 0 : _115.claimedCount, 1);
    strict_1.default.equal(typeof ((_116 = detail.lotteryDetail) === null || _116 === void 0 ? void 0 : _116.viewerIsWinner), "boolean");
    expectBusinessError(() => service.claimLottery(), "LOTTERY_ALREADY_CLAIMED");
    service.switchActiveUser("user-3");
    detail = service.claimLottery();
    strict_1.default.equal((_117 = detail.lotteryDetail) === null || _117 === void 0 ? void 0 : _117.claimedCount, 2);
    strict_1.default.equal((_118 = detail.lotteryDetail) === null || _118 === void 0 ? void 0 : _118.participants.filter((participant) => participant.claimed).length, 2);
    service.switchActiveUser("user-4");
    detail = service.claimLottery();
    strict_1.default.equal((_119 = detail.lotteryDetail) === null || _119 === void 0 ? void 0 : _119.claimedCount, 3);
    strict_1.default.equal((_120 = detail.lotteryDetail) === null || _120 === void 0 ? void 0 : _120.participants.every((participant) => participant.claimed), true);
    service.switchActiveUser("user-1");
    detail = service.resetLottery();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_121 = detail.lotteryDetail) === null || _121 === void 0 ? void 0 : _121.phase, "active");
    strict_1.default.equal((_122 = detail.lotteryDetail) === null || _122 === void 0 ? void 0 : _122.participantCount, 3);
    strict_1.default.equal((_123 = detail.lotteryDetail) === null || _123 === void 0 ? void 0 : _123.claimedCount, 0);
    strict_1.default.equal((_124 = detail.lotteryDetail) === null || _124 === void 0 ? void 0 : _124.participants.length, 3);
    detail = service.closeLottery();
    strict_1.default.equal(detail.isStarted, false);
    strict_1.default.equal(detail.lotteryDetail, null);
    strict_1.default.equal(getToolCard(service, "lottery").isStarted, false);
}
{
    const { service, storage, tripId } = setupTripWithMembers();
    service.publishSeatDrawTool({
        topic: "修复状态",
        drawCount: 1,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
    });
    service.publishVoteTool({
        topic: "状态修复测试",
        excludeAdmin: false,
        selectionMode: "single",
        options: ["投票", "否决", "弃权"]
    });
    service.publishWheelTool({
        items: ["唱歌", "真心话"]
    });
    service.publishLotteryTool({
        winnerCount: 1,
        excludeAdmin: false
    });
    const corruptedState = storage.getState();
    if (!corruptedState) {
        throw new Error("Expected memory state");
    }
    corruptedState.users["user-1"].currentTripId = null;
    storage.setState(corruptedState);
    service.switchActiveUser("user-2");
    const repairedToolsPage = service.getToolsPageData();
    strict_1.default.equal(repairedToolsPage.hasCurrentTrip, true);
    strict_1.default.equal(repairedToolsPage.toolCards.every((card) => !card.isStarted), true);
    const repairedState = storage.getState();
    strict_1.default.equal(repairedState === null || repairedState === void 0 ? void 0 : repairedState.trips[tripId].tools["seat-draw"], null);
    strict_1.default.equal(repairedState === null || repairedState === void 0 ? void 0 : repairedState.trips[tripId].tools.vote, null);
    strict_1.default.equal(repairedState === null || repairedState === void 0 ? void 0 : repairedState.trips[tripId].tools.wheel, null);
    strict_1.default.equal(repairedState === null || repairedState === void 0 ? void 0 : repairedState.trips[tripId].tools.lottery, null);
}
{
    const { service, storage, tripId } = setupTripWithMembers();
    service.publishWheelTool({
        items: ["唱歌", "真心话"]
    });
    service.switchActiveUser("user-1");
    service.dissolveCurrentTrip();
    const dissolvedState = storage.getState();
    strict_1.default.equal(dissolvedState === null || dissolvedState === void 0 ? void 0 : dissolvedState.trips[tripId].status, "dissolved");
    strict_1.default.equal(Object.values((_125 = dissolvedState === null || dissolvedState === void 0 ? void 0 : dissolvedState.trips[tripId].tools) !== null && _125 !== void 0 ? _125 : {}).every((tool) => tool === null), true);
    strict_1.default.equal(service.bootstrapApp().homeMode, "landing");
}
{
    const legacyState = (0, constants_1.createInitialAppState)();
    legacyState.version = 4;
    legacyState.users = {
        "user-1": legacyState.users["user-1"],
        "user-2": legacyState.users["user-2"],
        "user-3": legacyState.users["user-3"],
        "user-4": legacyState.users["user-4"]
    };
    const storage = new storage_adapter_1.MemoryStorageAdapter(legacyState);
    const service = new trip_service_1.TripService(storage);
    const bootstrap = service.bootstrapApp();
    strict_1.default.equal(bootstrap.demoUsers.length, 4);
    const normalizedState = storage.getState();
    strict_1.default.equal(Object.keys((_126 = normalizedState === null || normalizedState === void 0 ? void 0 : normalizedState.users) !== null && _126 !== void 0 ? _126 : {}).length, 4);
}
{
    const { service } = setupTripWith49Members();
    service.publishSeatDrawTool({
        topic: "49人测试",
        drawCount: 5,
        excludePreviouslyDrawn: true,
        excludeAdmin: false
    });
    expectBusinessError(() => service.publishSeatDrawTool({
        topic: "49人测试",
        drawCount: 5,
        excludePreviouslyDrawn: true,
        excludeAdmin: false
    }), "TOOL_ALREADY_STARTED");
    let detail = service.getToolDetailPageData("seat-draw");
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_127 = detail.seatDrawDetail) === null || _127 === void 0 ? void 0 : _127.eligibleMembers.length, 49);
    strict_1.default.equal((_128 = detail.seatDrawDetail) === null || _128 === void 0 ? void 0 : _128.remainingCount, 49);
    detail = withMockedRandom(0, () => service.drawSeat());
    strict_1.default.equal((_129 = detail.seatDrawDetail) === null || _129 === void 0 ? void 0 : _129.lastResult.length, 5);
    strict_1.default.equal((_130 = detail.seatDrawDetail) === null || _130 === void 0 ? void 0 : _130.resultRounds.length, 1);
    strict_1.default.equal((_131 = detail.seatDrawDetail) === null || _131 === void 0 ? void 0 : _131.remainingCount, 44);
    strict_1.default.equal(new Set((_132 = detail.seatDrawDetail) === null || _132 === void 0 ? void 0 : _132.lastResult.map((member) => member.userId)).size, 5);
    detail = service.resetSeatDraw();
    strict_1.default.equal((_133 = detail.seatDrawDetail) === null || _133 === void 0 ? void 0 : _133.phase, "ready");
    strict_1.default.equal((_134 = detail.seatDrawDetail) === null || _134 === void 0 ? void 0 : _134.lastResult.length, 0);
    strict_1.default.equal((_135 = detail.seatDrawDetail) === null || _135 === void 0 ? void 0 : _135.resultRounds.length, 0);
    strict_1.default.equal((_136 = detail.seatDrawDetail) === null || _136 === void 0 ? void 0 : _136.remainingCount, 49);
}
{
    const { service } = setupTripWith49Members();
    const optionLabels = buildSequentialLabels("选项", 49);
    service.publishVoteTool({
        topic: "49 人投票压力测试",
        excludeAdmin: false,
        selectionMode: "multiple",
        options: optionLabels
    });
    expectBusinessError(() => service.publishVoteTool({
        topic: "49 人投票压力测试",
        excludeAdmin: false,
        selectionMode: "multiple",
        options: optionLabels
    }), "TOOL_ALREADY_STARTED");
    let detail = getVoteDetail(service);
    strict_1.default.equal((_137 = detail.voteDetail) === null || _137 === void 0 ? void 0 : _137.participantCount, 49);
    strict_1.default.equal((_138 = detail.voteDetail) === null || _138 === void 0 ? void 0 : _138.options.length, 49);
    strict_1.default.equal((_139 = detail.voteDetail) === null || _139 === void 0 ? void 0 : _139.viewerEligible, true);
    const optionIds = (_141 = (_140 = detail.voteDetail) === null || _140 === void 0 ? void 0 : _140.options.map((option) => option.id)) !== null && _141 !== void 0 ? _141 : [];
    for (let index = 1; index <= 49; index += 1) {
        service.switchActiveUser(`user-${index}`);
        detail = submitVoteChoice(service, "approve", optionIds);
        strict_1.default.equal((_142 = detail.voteDetail) === null || _142 === void 0 ? void 0 : _142.submittedCount, index);
    }
    service.switchActiveUser("user-1");
    detail = getVoteDetail(service);
    strict_1.default.equal((_143 = detail.voteDetail) === null || _143 === void 0 ? void 0 : _143.submittedCount, 49);
    strict_1.default.equal((_144 = detail.voteDetail) === null || _144 === void 0 ? void 0 : _144.approveCount, 49);
    strict_1.default.equal((_145 = detail.voteDetail) === null || _145 === void 0 ? void 0 : _145.rejectCount, 0);
    strict_1.default.equal((_146 = detail.voteDetail) === null || _146 === void 0 ? void 0 : _146.abstainCount, 0);
    strict_1.default.equal((_147 = detail.voteDetail) === null || _147 === void 0 ? void 0 : _147.options.every((option) => option.supportCount === 49), true);
    strict_1.default.equal((_148 = detail.voteDetail) === null || _148 === void 0 ? void 0 : _148.viewerHasSubmitted, true);
    strict_1.default.equal((_149 = detail.voteDetail) === null || _149 === void 0 ? void 0 : _149.viewerSelectedOptionIds.length, 49);
    detail = service.resetVote();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_150 = detail.voteDetail) === null || _150 === void 0 ? void 0 : _150.phase, "active");
    strict_1.default.equal((_151 = detail.voteDetail) === null || _151 === void 0 ? void 0 : _151.participantCount, 49);
    strict_1.default.equal((_152 = detail.voteDetail) === null || _152 === void 0 ? void 0 : _152.submittedCount, 0);
    strict_1.default.equal((_153 = detail.voteDetail) === null || _153 === void 0 ? void 0 : _153.viewerHasSubmitted, false);
}
{
    const { service } = setupTripWith49Members();
    const wheelItems = buildSequentialLabels("奖品", 10);
    const overflowWheelItems = buildSequentialLabels("奖品", 11);
    service.publishWheelTool({
        items: wheelItems
    });
    expectBusinessError(() => service.publishWheelTool({
        items: wheelItems
    }), "TOOL_ALREADY_STARTED");
    let detail = service.getToolDetailPageData("wheel");
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_154 = detail.wheelDetail) === null || _154 === void 0 ? void 0 : _154.items.length, 10);
    strict_1.default.equal((_155 = detail.wheelDetail) === null || _155 === void 0 ? void 0 : _155.eligibleUsers.length, 49);
    strict_1.default.equal((_156 = detail.wheelDetail) === null || _156 === void 0 ? void 0 : _156.resultIndex, null);
    strict_1.default.equal((_157 = detail.wheelDetail) === null || _157 === void 0 ? void 0 : _157.resultLabel, null);
    strict_1.default.deepEqual((_158 = detail.wheelDetail) === null || _158 === void 0 ? void 0 : _158.resultHistoryLabels, []);
    detail = withMockedRandom(0.99, () => service.spinWheel());
    strict_1.default.equal((_159 = detail.wheelDetail) === null || _159 === void 0 ? void 0 : _159.phase, "result");
    strict_1.default.equal((_160 = detail.wheelDetail) === null || _160 === void 0 ? void 0 : _160.resultIndex, 9);
    strict_1.default.equal((_161 = detail.wheelDetail) === null || _161 === void 0 ? void 0 : _161.resultLabel, (_162 = detail.wheelDetail) === null || _162 === void 0 ? void 0 : _162.items[9]);
    strict_1.default.deepEqual((_163 = detail.wheelDetail) === null || _163 === void 0 ? void 0 : _163.resultHistoryLabels, [(_165 = (_164 = detail.wheelDetail) === null || _164 === void 0 ? void 0 : _164.items[9]) !== null && _165 !== void 0 ? _165 : ""]);
    detail = service.resetWheel();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_166 = detail.wheelDetail) === null || _166 === void 0 ? void 0 : _166.phase, "draft");
    strict_1.default.equal((_167 = detail.wheelDetail) === null || _167 === void 0 ? void 0 : _167.resultIndex, null);
    strict_1.default.equal((_168 = detail.wheelDetail) === null || _168 === void 0 ? void 0 : _168.resultLabel, null);
    strict_1.default.deepEqual((_169 = detail.wheelDetail) === null || _169 === void 0 ? void 0 : _169.resultHistoryLabels, []);
    expectBusinessError(() => service.recreateWheelTool({
        items: overflowWheelItems
    }), "WHEEL_ITEMS_LIMIT_EXCEEDED");
}
{
    const { service } = setupTripWith49Members();
    service.publishLotteryTool({
        winnerCount: 49,
        excludeAdmin: false
    });
    expectBusinessError(() => service.publishLotteryTool({
        winnerCount: 49,
        excludeAdmin: false
    }), "TOOL_ALREADY_STARTED");
    let detail = service.getToolDetailPageData("lottery");
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_170 = detail.lotteryDetail) === null || _170 === void 0 ? void 0 : _170.participantCount, 49);
    strict_1.default.equal((_171 = detail.lotteryDetail) === null || _171 === void 0 ? void 0 : _171.winnerCount, 49);
    strict_1.default.equal((_172 = detail.lotteryDetail) === null || _172 === void 0 ? void 0 : _172.viewerEligible, true);
    strict_1.default.equal((_173 = detail.lotteryDetail) === null || _173 === void 0 ? void 0 : _173.claimedCount, 0);
    for (let index = 1; index <= 49; index += 1) {
        service.switchActiveUser(`user-${index}`);
        detail = service.claimLottery();
        strict_1.default.equal((_174 = detail.lotteryDetail) === null || _174 === void 0 ? void 0 : _174.claimedCount, index);
        strict_1.default.equal((_175 = detail.lotteryDetail) === null || _175 === void 0 ? void 0 : _175.viewerHasClaimed, true);
        strict_1.default.equal((_176 = detail.lotteryDetail) === null || _176 === void 0 ? void 0 : _176.viewerIsWinner, true);
    }
    service.switchActiveUser("user-1");
    detail = service.getToolDetailPageData("lottery");
    strict_1.default.equal((_177 = detail.lotteryDetail) === null || _177 === void 0 ? void 0 : _177.claimedCount, 49);
    strict_1.default.equal((_178 = detail.lotteryDetail) === null || _178 === void 0 ? void 0 : _178.participants.every((participant) => participant.claimed), true);
    strict_1.default.equal((_179 = detail.lotteryDetail) === null || _179 === void 0 ? void 0 : _179.participants.every((participant) => participant.statusText === "已抽中"), true);
    detail = service.resetLottery();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_180 = detail.lotteryDetail) === null || _180 === void 0 ? void 0 : _180.phase, "active");
    strict_1.default.equal((_181 = detail.lotteryDetail) === null || _181 === void 0 ? void 0 : _181.participantCount, 49);
    strict_1.default.equal((_182 = detail.lotteryDetail) === null || _182 === void 0 ? void 0 : _182.claimedCount, 0);
    strict_1.default.equal((_183 = detail.lotteryDetail) === null || _183 === void 0 ? void 0 : _183.viewerHasClaimed, false);
}
console.log("trip-service tests passed");

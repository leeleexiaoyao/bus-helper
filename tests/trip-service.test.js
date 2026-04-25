"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, _71, _72, _73, _74, _75, _76, _77, _78, _79, _80, _81, _82, _83, _84, _85, _86, _87, _88, _89, _90, _91, _92, _93, _94, _95, _96, _97, _98, _99, _100, _101, _102, _103, _104, _105, _106, _107, _108, _109, _110, _111, _112, _113, _114, _115, _116, _117, _118, _119, _120, _121, _122, _123, _124, _125, _126, _127, _128, _129, _130, _131, _132, _133, _134, _135, _136, _137, _138, _139, _140, _141, _142, _143, _144, _145, _146, _147, _148, _149, _150, _151, _152, _153, _154, _155, _156, _157, _158, _159, _160, _161, _162, _163, _164, _165, _166, _167, _168, _169, _170, _171, _172, _173, _174, _175, _176, _177, _178, _179, _180, _181, _182, _183, _184, _185, _186, _187, _188, _189, _190, _191, _192, _193, _194, _195, _196, _197, _198, _199, _200, _201, _202, _203, _204, _205, _206, _207, _208, _209, _210, _211, _212, _213, _214, _215, _216, _217, _218, _219, _220, _221, _222, _223, _224, _225, _226, _227;
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const constants_1 = require("../miniprogram/shared/constants");
const errors_1 = require("../miniprogram/shared/errors");
const storage_adapter_1 = require("../miniprogram/repositories/storage-adapter");
const seat_1 = require("../miniprogram/shared/seat");
const trip_service_1 = require("../miniprogram/services/trip-service");
const format_1 = require("../miniprogram/utils/format");
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
            bio: "",
            livingCity: "",
            hometown: "",
            age: "",
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
            bio: "",
            livingCity: "",
            hometown: "",
            age: "",
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
        departureTime: "2025-04-20 07:30",
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
        departureTime: "2025-04-20 07:30",
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
function getLotteryDetail(service) {
    const detail = service.getToolDetailPageData("lottery");
    strict_1.default.ok(detail.lotteryDetail, "Expected lottery detail");
    return detail;
}
function claimFirstAvailableLotteryCard(service) {
    var _a, _b;
    const detail = getLotteryDetail(service);
    const cardId = (_b = (_a = detail.lotteryDetail) === null || _a === void 0 ? void 0 : _a.cards.find((card) => card.canClaim)) === null || _b === void 0 ? void 0 : _b.id;
    strict_1.default.ok(cardId, "Expected available lottery card");
    return service.claimLottery(cardId);
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
        departureTime: "2025-04-20 07:30",
        password: "123456",
        templateId: "template-49"
    });
    const tripId = (_b = (_a = createdTrip.currentTrip) === null || _a === void 0 ? void 0 : _a.tripMeta.tripId) !== null && _b !== void 0 ? _b : "";
    const seatCodes = flattenSeatCodes(createdTrip.currentTrip);
    strict_1.default.equal(seatCodes.length, 49);
    strict_1.default.deepEqual(seatCodes.slice(-5), ["12A", "12B", "12E", "12C", "12D"]);
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
    strict_1.default.equal((0, format_1.displayDepartureTime)("2025-05-01 08:00"), "05月01日 08:00");
    strict_1.default.equal((0, format_1.displayDepartureTime)("4/20 07:30"), "04月20日 07:30");
}
{
    const { service } = createService();
    authorizeActiveUser(service, "小雨");
    expectBusinessError(() => service.createTrip({
        tripName: "缺少时间线",
        departureTime: "",
        password: "123456",
        templateId: "template-49"
    }), "INVALID_DEPARTURE_TIME");
}
{
    const { service } = createService();
    let toolsPage = service.getToolsPageData();
    strict_1.default.equal(toolsPage.isAuthorized, false);
    strict_1.default.equal(toolsPage.hasCurrentTrip, false);
    strict_1.default.equal(toolsPage.toolCards.length, 4);
    strict_1.default.deepEqual(toolsPage.toolCards.map((card) => card.type), ["seat-draw", "vote", "wheel", "lottery"]);
    strict_1.default.deepEqual(toolsPage.toolCards.map((card) => ({
        type: card.type,
        displayTitle: card.displayTitle,
        displayDescription: card.displayDescription,
        ctaLabel: card.ctaLabel
    })), [
        {
            type: "seat-draw",
            displayTitle: "随机抽",
            displayDescription: "公平随机抽号",
            ctaLabel: "去使用"
        },
        {
            type: "vote",
            displayTitle: "做选择",
            displayDescription: "选出最佳方案",
            ctaLabel: "去使用"
        },
        {
            type: "wheel",
            displayTitle: "大转盘",
            displayDescription: "大风车转啊转",
            ctaLabel: "去使用"
        },
        {
            type: "lottery",
            displayTitle: "幸运签",
            displayDescription: "抽好签配好运",
            ctaLabel: "去使用"
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
        departureTime: "2025-04-20 07:30",
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
    const { service, storage, tripId } = setupTripWithMembers();
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
        answers: ["A签", "B签", "C签"],
        drawLimitPerUser: 1
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
    const { service, storage, tripId } = setupTripWithMembers();
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
    const { service, storage, tripId } = setupTripWithMembers();
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
    strict_1.default.equal((_2 = detail.voteDetail) === null || _2 === void 0 ? void 0 : _2.maxSelections, 3);
    strict_1.default.equal((_3 = detail.voteDetail) === null || _3 === void 0 ? void 0 : _3.options.length, 3);
    strict_1.default.deepEqual((_4 = detail.voteDetail) === null || _4 === void 0 ? void 0 : _4.options.map((option) => option.label), ["方案A", "方案B", "方案C"]);
    strict_1.default.equal((_5 = detail.voteDetail) === null || _5 === void 0 ? void 0 : _5.viewerHasSubmitted, false);
    strict_1.default.equal((_6 = detail.voteDetail) === null || _6 === void 0 ? void 0 : _6.viewerEligible, false);
    strict_1.default.equal(detail.statusMessage.includes("创建玩法"), false);
    expectBusinessError(() => submitVoteChoice(service, "approve"), "VOTE_NOT_ALLOWED");
    service.switchActiveUser("user-2");
    detail = getVoteDetail(service);
    strict_1.default.equal((_7 = detail.voteDetail) === null || _7 === void 0 ? void 0 : _7.viewerEligible, true);
    const multiOptionIds = (_9 = (_8 = detail.voteDetail) === null || _8 === void 0 ? void 0 : _8.options.map((option) => option.id)) !== null && _9 !== void 0 ? _9 : [];
    detail = submitVoteChoice(service, "approve", [(_10 = multiOptionIds[0]) !== null && _10 !== void 0 ? _10 : ""]);
    strict_1.default.equal((_11 = detail.voteDetail) === null || _11 === void 0 ? void 0 : _11.viewerChoice, "approve");
    strict_1.default.equal((_12 = detail.voteDetail) === null || _12 === void 0 ? void 0 : _12.viewerHasSubmitted, true);
    strict_1.default.deepEqual((_13 = detail.voteDetail) === null || _13 === void 0 ? void 0 : _13.viewerSelectedOptionIds, [multiOptionIds[0]]);
    strict_1.default.equal((_14 = detail.voteDetail) === null || _14 === void 0 ? void 0 : _14.submittedCount, 1);
    detail = submitVoteChoice(service, "approve", [(_15 = multiOptionIds[1]) !== null && _15 !== void 0 ? _15 : ""]);
    strict_1.default.deepEqual((_16 = detail.voteDetail) === null || _16 === void 0 ? void 0 : _16.viewerSelectedOptionIds, [
        multiOptionIds[0],
        multiOptionIds[1]
    ]);
    strict_1.default.equal((_17 = detail.voteDetail) === null || _17 === void 0 ? void 0 : _17.submittedCount, 1);
    detail = submitVoteChoice(service, "approve", [(_18 = multiOptionIds[2]) !== null && _18 !== void 0 ? _18 : ""]);
    strict_1.default.deepEqual((_19 = detail.voteDetail) === null || _19 === void 0 ? void 0 : _19.viewerSelectedOptionIds, multiOptionIds);
    strict_1.default.equal((_20 = detail.voteDetail) === null || _20 === void 0 ? void 0 : _20.options.every((option) => option.selectedByViewer), true);
    strict_1.default.equal((_21 = detail.voteDetail) === null || _21 === void 0 ? void 0 : _21.submittedCount, 1);
    expectBusinessError(() => submitVoteChoice(service, "reject"), "VOTE_ALREADY_SUBMITTED");
    service.switchActiveUser("user-3");
    detail = submitVoteChoice(service, "reject");
    strict_1.default.equal((_22 = detail.voteDetail) === null || _22 === void 0 ? void 0 : _22.submittedCount, 2);
    service.switchActiveUser("user-4");
    detail = submitVoteChoice(service, "abstain");
    strict_1.default.equal((_23 = detail.voteDetail) === null || _23 === void 0 ? void 0 : _23.approveCount, 1);
    strict_1.default.equal((_24 = detail.voteDetail) === null || _24 === void 0 ? void 0 : _24.rejectCount, 1);
    strict_1.default.equal((_25 = detail.voteDetail) === null || _25 === void 0 ? void 0 : _25.abstainCount, 1);
    strict_1.default.equal((_26 = detail.voteDetail) === null || _26 === void 0 ? void 0 : _26.submittedCount, 3);
    service.switchActiveUser("user-1");
    detail = service.resetVote();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_27 = detail.voteDetail) === null || _27 === void 0 ? void 0 : _27.phase, "active");
    strict_1.default.equal((_28 = detail.voteDetail) === null || _28 === void 0 ? void 0 : _28.topic, "今晚是否提前十分钟集合");
    strict_1.default.equal((_29 = detail.voteDetail) === null || _29 === void 0 ? void 0 : _29.selectionMode, "multiple");
    strict_1.default.equal((_30 = detail.voteDetail) === null || _30 === void 0 ? void 0 : _30.participantCount, 3);
    strict_1.default.equal((_31 = detail.voteDetail) === null || _31 === void 0 ? void 0 : _31.submittedCount, 0);
    strict_1.default.equal((_32 = detail.voteDetail) === null || _32 === void 0 ? void 0 : _32.viewerHasSubmitted, false);
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
    strict_1.default.equal((_33 = detail.seatDrawDetail) === null || _33 === void 0 ? void 0 : _33.phase, "rolling");
    strict_1.default.equal((_34 = detail.seatDrawDetail) === null || _34 === void 0 ? void 0 : _34.displaySlots.length, 3);
    strict_1.default.equal(new Set((_35 = detail.seatDrawDetail) === null || _35 === void 0 ? void 0 : _35.displaySlots.map((slot) => slot.label)).size, 3);
    detail = service.advanceSeatDrawRollingFrame();
    strict_1.default.equal((_36 = detail.seatDrawDetail) === null || _36 === void 0 ? void 0 : _36.phase, "rolling");
    strict_1.default.equal(new Set((_37 = detail.seatDrawDetail) === null || _37 === void 0 ? void 0 : _37.displaySlots.map((slot) => slot.label)).size, 3);
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
    strict_1.default.equal((_38 = detail.seatDrawDetail) === null || _38 === void 0 ? void 0 : _38.phase, "result");
    strict_1.default.equal((_39 = detail.seatDrawDetail) === null || _39 === void 0 ? void 0 : _39.lastResult.length, 3);
    strict_1.default.equal((_40 = detail.seatDrawDetail) === null || _40 === void 0 ? void 0 : _40.resultRounds.length, 1);
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
    strict_1.default.equal((_41 = detail.seatDrawDetail) === null || _41 === void 0 ? void 0 : _41.topic, "重新抽号");
    strict_1.default.equal((_42 = detail.seatDrawDetail) === null || _42 === void 0 ? void 0 : _42.drawCount, 1);
    strict_1.default.equal((_43 = detail.seatDrawDetail) === null || _43 === void 0 ? void 0 : _43.excludePreviouslyDrawn, true);
    strict_1.default.equal((_44 = detail.seatDrawDetail) === null || _44 === void 0 ? void 0 : _44.excludeAdmin, true);
    strict_1.default.equal((_45 = detail.seatDrawDetail) === null || _45 === void 0 ? void 0 : _45.resultRounds.length, 0);
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
    const firstOptionId = (_48 = (_47 = (_46 = detail.voteDetail) === null || _46 === void 0 ? void 0 : _46.options[0]) === null || _47 === void 0 ? void 0 : _47.id) !== null && _48 !== void 0 ? _48 : "";
    detail = submitVoteChoice(service, "approve", [firstOptionId]);
    service.switchActiveUser("user-1");
    detail = service.recreateVoteTool({
        topic: "重新创建投票 v2",
        excludeAdmin: false,
        selectionMode: "single",
        options: ["方案A", "方案C"]
    });
    strict_1.default.equal((_49 = detail.voteDetail) === null || _49 === void 0 ? void 0 : _49.topic, "重新创建投票 v2");
    strict_1.default.equal((_50 = detail.voteDetail) === null || _50 === void 0 ? void 0 : _50.selectionMode, "single");
    strict_1.default.equal((_51 = detail.voteDetail) === null || _51 === void 0 ? void 0 : _51.maxSelections, 1);
    strict_1.default.equal((_52 = detail.voteDetail) === null || _52 === void 0 ? void 0 : _52.options.length, 2);
    strict_1.default.equal((_53 = detail.voteDetail) === null || _53 === void 0 ? void 0 : _53.approveCount, 1);
    service.switchActiveUser("user-2");
    detail = getVoteDetail(service);
    strict_1.default.equal((_54 = detail.voteDetail) === null || _54 === void 0 ? void 0 : _54.viewerHasSubmitted, true);
    strict_1.default.equal((_55 = detail.voteDetail) === null || _55 === void 0 ? void 0 : _55.viewerSelectedOptionIds.length, 1);
    strict_1.default.equal((_57 = (_56 = detail.voteDetail) === null || _56 === void 0 ? void 0 : _56.options[0]) === null || _57 === void 0 ? void 0 : _57.selectedByViewer, true);
}
{
    const { service } = setupTripWithMembers();
    service.publishVoteTool({
        topic: "多选上限测试",
        excludeAdmin: false,
        selectionMode: "multiple",
        maxSelections: 2,
        options: ["方案A", "方案B", "方案C"]
    });
    service.switchActiveUser("user-2");
    let detail = getVoteDetail(service);
    const optionIds = (_59 = (_58 = detail.voteDetail) === null || _58 === void 0 ? void 0 : _58.options.map((option) => option.id)) !== null && _59 !== void 0 ? _59 : [];
    detail = submitVoteChoice(service, "approve", [(_60 = optionIds[0]) !== null && _60 !== void 0 ? _60 : ""]);
    strict_1.default.deepEqual((_61 = detail.voteDetail) === null || _61 === void 0 ? void 0 : _61.viewerSelectedOptionIds, [optionIds[0]]);
    strict_1.default.equal((_62 = detail.voteDetail) === null || _62 === void 0 ? void 0 : _62.maxSelections, 2);
    detail = submitVoteChoice(service, "approve", [(_63 = optionIds[1]) !== null && _63 !== void 0 ? _63 : ""]);
    strict_1.default.deepEqual((_64 = detail.voteDetail) === null || _64 === void 0 ? void 0 : _64.viewerSelectedOptionIds, [optionIds[0], optionIds[1]]);
    expectBusinessError(() => { var _a; return submitVoteChoice(service, "approve", [(_a = optionIds[2]) !== null && _a !== void 0 ? _a : ""]); }, "VOTE_ALREADY_SUBMITTED");
    service.switchActiveUser("user-1");
    service.closeVote();
    expectBusinessError(() => service.publishVoteTool({
        topic: "非法多选上限",
        excludeAdmin: false,
        selectionMode: "multiple",
        maxSelections: 4,
        options: ["方案A", "方案B", "方案C"]
    }), "VOTE_MAX_SELECTIONS_TOO_LARGE");
}
{
    const { service } = setupTripWithMembers();
    service.publishVoteTool({
        topic: "结束投票测试",
        excludeAdmin: false,
        selectionMode: "multiple",
        maxSelections: 2,
        options: ["方案A", "方案B", "方案C"]
    });
    service.switchActiveUser("user-2");
    let detail = getVoteDetail(service);
    const optionIds = (_66 = (_65 = detail.voteDetail) === null || _65 === void 0 ? void 0 : _65.options.map((option) => option.id)) !== null && _66 !== void 0 ? _66 : [];
    submitVoteChoice(service, "approve", [(_67 = optionIds[1]) !== null && _67 !== void 0 ? _67 : ""]);
    service.switchActiveUser("user-3");
    submitVoteChoice(service, "approve", [(_68 = optionIds[0]) !== null && _68 !== void 0 ? _68 : "", (_69 = optionIds[1]) !== null && _69 !== void 0 ? _69 : ""]);
    service.switchActiveUser("user-4");
    submitVoteChoice(service, "approve", [(_70 = optionIds[1]) !== null && _70 !== void 0 ? _70 : ""]);
    service.switchActiveUser("user-1");
    detail = service.endVote();
    strict_1.default.equal((_71 = detail.voteDetail) === null || _71 === void 0 ? void 0 : _71.phase, "ended");
    strict_1.default.deepEqual((_72 = detail.voteDetail) === null || _72 === void 0 ? void 0 : _72.resultOptions.map((option) => ({
        label: option.label,
        supportCount: option.supportCount
    })), [
        { label: "方案B", supportCount: 3 },
        { label: "方案A", supportCount: 1 },
        { label: "方案C", supportCount: 0 }
    ]);
    strict_1.default.equal(detail.phaseLabel, "已结束");
    service.switchActiveUser("user-2");
    expectBusinessError(() => { var _a; return submitVoteChoice(service, "approve", [(_a = optionIds[2]) !== null && _a !== void 0 ? _a : ""]); }, "VOTE_ENDED");
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
    strict_1.default.equal((_73 = detail.voteDetail) === null || _73 === void 0 ? void 0 : _73.selectionMode, "single");
    strict_1.default.equal((_74 = detail.voteDetail) === null || _74 === void 0 ? void 0 : _74.maxSelections, 1);
    strict_1.default.equal((_75 = detail.voteDetail) === null || _75 === void 0 ? void 0 : _75.options.length, 3);
    service.switchActiveUser("user-2");
    detail = getVoteDetail(service);
    const singleOptionIds = (_77 = (_76 = detail.voteDetail) === null || _76 === void 0 ? void 0 : _76.options.map((option) => option.id)) !== null && _77 !== void 0 ? _77 : [];
    expectBusinessError(() => submitVoteChoice(service, "approve", singleOptionIds), "VOTE_SINGLE_OPTION_ONLY");
    detail = submitVoteChoice(service, "approve", [(_78 = singleOptionIds[0]) !== null && _78 !== void 0 ? _78 : ""]);
    strict_1.default.equal((_79 = detail.voteDetail) === null || _79 === void 0 ? void 0 : _79.viewerSelectedOptionIds.length, 1);
    strict_1.default.equal((_80 = detail.voteDetail) === null || _80 === void 0 ? void 0 : _80.viewerHasSubmitted, true);
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
    const optionIds = (_82 = (_81 = detail.voteDetail) === null || _81 === void 0 ? void 0 : _81.options.map((option) => option.id)) !== null && _82 !== void 0 ? _82 : [];
    detail = submitVoteChoice(service, "reject", [(_83 = optionIds[0]) !== null && _83 !== void 0 ? _83 : ""]);
    strict_1.default.equal((_84 = detail.voteDetail) === null || _84 === void 0 ? void 0 : _84.viewerChoice, "reject");
    strict_1.default.deepEqual((_85 = detail.voteDetail) === null || _85 === void 0 ? void 0 : _85.viewerSelectedOptionIds, [optionIds[0]]);
    strict_1.default.equal((_87 = (_86 = detail.voteDetail) === null || _86 === void 0 ? void 0 : _86.options[0]) === null || _87 === void 0 ? void 0 : _87.selectedByViewer, true);
    strict_1.default.equal((_89 = (_88 = detail.voteDetail) === null || _88 === void 0 ? void 0 : _88.options[0]) === null || _89 === void 0 ? void 0 : _89.supportCount, 0);
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
    strict_1.default.equal((_90 = detail.voteDetail) === null || _90 === void 0 ? void 0 : _90.selectionMode, "single");
    strict_1.default.equal((_91 = detail.voteDetail) === null || _91 === void 0 ? void 0 : _91.maxSelections, 1);
    strict_1.default.deepEqual((_92 = detail.voteDetail) === null || _92 === void 0 ? void 0 : _92.options.map((option) => option.label), ["方案A", "方案B"]);
    strict_1.default.equal((_93 = detail.voteDetail) === null || _93 === void 0 ? void 0 : _93.resultOptions.length, 2);
    strict_1.default.equal((_94 = detail.voteDetail) === null || _94 === void 0 ? void 0 : _94.viewerHasSubmitted, true);
    strict_1.default.deepEqual((_95 = detail.voteDetail) === null || _95 === void 0 ? void 0 : _95.viewerSelectedOptionIds, ["legacy-vote-option-1"]);
    strict_1.default.equal((_97 = (_96 = detail.voteDetail) === null || _96 === void 0 ? void 0 : _96.options[0]) === null || _97 === void 0 ? void 0 : _97.selectedByViewer, true);
    strict_1.default.equal((_99 = (_98 = detail.voteDetail) === null || _98 === void 0 ? void 0 : _98.options[0]) === null || _99 === void 0 ? void 0 : _99.supportCount, 1);
}
{
    const { service } = setupTripWithMembers();
    service.publishWheelTool({
        items: ["唱歌", "真心话", "讲冷笑话"]
    });
    let detail = service.getToolDetailPageData("wheel");
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_100 = detail.wheelDetail) === null || _100 === void 0 ? void 0 : _100.phase, "draft");
    strict_1.default.equal((_101 = detail.wheelDetail) === null || _101 === void 0 ? void 0 : _101.items.length, 3);
    strict_1.default.equal((_102 = detail.wheelDetail) === null || _102 === void 0 ? void 0 : _102.viewerCanSpin, true);
    strict_1.default.equal((_103 = detail.wheelDetail) === null || _103 === void 0 ? void 0 : _103.allowAssignedUser, false);
    strict_1.default.equal((_104 = detail.wheelDetail) === null || _104 === void 0 ? void 0 : _104.resultIndex, null);
    strict_1.default.equal((_105 = detail.wheelDetail) === null || _105 === void 0 ? void 0 : _105.resultLabel, null);
    strict_1.default.deepEqual((_106 = detail.wheelDetail) === null || _106 === void 0 ? void 0 : _106.resultHistoryLabels, []);
    detail = withMockedRandom(0, () => service.spinWheel());
    strict_1.default.equal((_107 = detail.wheelDetail) === null || _107 === void 0 ? void 0 : _107.phase, "result");
    strict_1.default.equal((_108 = detail.wheelDetail) === null || _108 === void 0 ? void 0 : _108.resultIndex, 0);
    strict_1.default.equal((_109 = detail.wheelDetail) === null || _109 === void 0 ? void 0 : _109.resultLabel, "唱歌");
    strict_1.default.deepEqual((_110 = detail.wheelDetail) === null || _110 === void 0 ? void 0 : _110.resultHistoryLabels, ["唱歌"]);
    detail = service.resetWheel();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_111 = detail.wheelDetail) === null || _111 === void 0 ? void 0 : _111.phase, "draft");
    strict_1.default.equal((_112 = detail.wheelDetail) === null || _112 === void 0 ? void 0 : _112.resultIndex, null);
    strict_1.default.equal((_113 = detail.wheelDetail) === null || _113 === void 0 ? void 0 : _113.resultLabel, null);
    strict_1.default.deepEqual((_114 = detail.wheelDetail) === null || _114 === void 0 ? void 0 : _114.resultHistoryLabels, []);
    detail = service.closeWheel();
    strict_1.default.equal(detail.isStarted, false);
    strict_1.default.equal((_115 = detail.wheelDetail) === null || _115 === void 0 ? void 0 : _115.items.length, 0);
    strict_1.default.equal((_116 = detail.wheelDetail) === null || _116 === void 0 ? void 0 : _116.viewerCanSpin, false);
    strict_1.default.equal((_117 = detail.wheelDetail) === null || _117 === void 0 ? void 0 : _117.eligibleUsers.length, 4);
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
    strict_1.default.equal((_118 = detail.wheelDetail) === null || _118 === void 0 ? void 0 : _118.viewerCanSpin, false);
    strict_1.default.equal((_119 = detail.wheelDetail) === null || _119 === void 0 ? void 0 : _119.allowAssignedUser, true);
    strict_1.default.equal((_120 = detail.wheelDetail) === null || _120 === void 0 ? void 0 : _120.assignedUserId, "user-2");
    strict_1.default.equal((_121 = detail.wheelDetail) === null || _121 === void 0 ? void 0 : _121.assignedUserLabel, "阿山");
    strict_1.default.equal((_122 = detail.wheelDetail) === null || _122 === void 0 ? void 0 : _122.eligibleUsers.length, 4);
    expectBusinessError(() => service.spinWheel(), "WHEEL_FORBIDDEN");
    service.switchActiveUser("user-2");
    detail = service.getToolDetailPageData("wheel");
    strict_1.default.equal((_123 = detail.wheelDetail) === null || _123 === void 0 ? void 0 : _123.viewerCanSpin, true);
    detail = withMockedRandom(0.5, () => service.spinWheel());
    strict_1.default.equal((_124 = detail.wheelDetail) === null || _124 === void 0 ? void 0 : _124.phase, "result");
    strict_1.default.equal((_125 = detail.wheelDetail) === null || _125 === void 0 ? void 0 : _125.resultLabel, "再来一次");
    service.switchActiveUser("user-1");
    detail = service.recreateWheelTool({
        items: ["唱歌", "真心话"],
        allowAssignedUser: true,
        assignedUserId: "user-1"
    });
    strict_1.default.equal((_126 = detail.wheelDetail) === null || _126 === void 0 ? void 0 : _126.assignedUserId, "user-1");
    strict_1.default.equal((_127 = detail.wheelDetail) === null || _127 === void 0 ? void 0 : _127.assignedUserLabel, "小雨");
    strict_1.default.equal((_128 = detail.wheelDetail) === null || _128 === void 0 ? void 0 : _128.viewerCanSpin, true);
    service.switchActiveUser("user-3");
    detail = service.getToolDetailPageData("wheel");
    strict_1.default.equal((_129 = detail.wheelDetail) === null || _129 === void 0 ? void 0 : _129.viewerCanSpin, false);
    expectBusinessError(() => service.spinWheel(), "WHEEL_FORBIDDEN");
}
{
    const { service, storage, tripId } = setupTripWithMembers();
    let detail = withMockedRandom(0, () => service.publishLotteryTool({
        answers: ["苹果", "", "香蕉", "樱桃"],
        drawLimitPerUser: 2
    }));
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_130 = detail.lotteryDetail) === null || _130 === void 0 ? void 0 : _130.phase, "active");
    strict_1.default.deepEqual((_131 = detail.lotteryDetail) === null || _131 === void 0 ? void 0 : _131.answers, ["苹果", "香蕉", "樱桃"]);
    strict_1.default.equal((_132 = detail.lotteryDetail) === null || _132 === void 0 ? void 0 : _132.cardCount, 3);
    strict_1.default.equal((_133 = detail.lotteryDetail) === null || _133 === void 0 ? void 0 : _133.remainingCardCount, 3);
    strict_1.default.equal((_134 = detail.lotteryDetail) === null || _134 === void 0 ? void 0 : _134.viewerEligible, true);
    strict_1.default.equal((_135 = detail.lotteryDetail) === null || _135 === void 0 ? void 0 : _135.viewerCanDraw, true);
    strict_1.default.equal((_136 = detail.lotteryDetail) === null || _136 === void 0 ? void 0 : _136.cards.length, 3);
    strict_1.default.equal((_137 = detail.lotteryDetail) === null || _137 === void 0 ? void 0 : _137.cards.every((card) => card.state === "available"), true);
    strict_1.default.notDeepEqual((_139 = (_138 = storage.getState()) === null || _138 === void 0 ? void 0 : _138.trips[tripId].tools.lottery) === null || _139 === void 0 ? void 0 : _139.cards.map((card) => card.answer), ["苹果", "香蕉", "樱桃"]);
    detail = claimFirstAvailableLotteryCard(service);
    strict_1.default.equal((_140 = detail.lotteryDetail) === null || _140 === void 0 ? void 0 : _140.viewerClaimedCount, 1);
    strict_1.default.equal((_141 = detail.lotteryDetail) === null || _141 === void 0 ? void 0 : _141.viewerRemainingDrawCount, 1);
    strict_1.default.equal((_142 = detail.lotteryDetail) === null || _142 === void 0 ? void 0 : _142.claimedCardCount, 1);
    strict_1.default.equal((_143 = detail.lotteryDetail) === null || _143 === void 0 ? void 0 : _143.viewerClaimRecords.length, 1);
    strict_1.default.equal((_144 = detail.lotteryDetail) === null || _144 === void 0 ? void 0 : _144.cards.filter((card) => card.state === "viewer").length, 1);
    detail = claimFirstAvailableLotteryCard(service);
    strict_1.default.equal((_145 = detail.lotteryDetail) === null || _145 === void 0 ? void 0 : _145.viewerClaimedCount, 2);
    strict_1.default.equal((_146 = detail.lotteryDetail) === null || _146 === void 0 ? void 0 : _146.viewerRemainingDrawCount, 0);
    strict_1.default.equal((_147 = detail.lotteryDetail) === null || _147 === void 0 ? void 0 : _147.viewerCanDraw, false);
    strict_1.default.equal((_148 = detail.lotteryDetail) === null || _148 === void 0 ? void 0 : _148.viewerClaimRecords.length, 2);
    strict_1.default.equal(((_149 = detail.lotteryDetail) === null || _149 === void 0 ? void 0 : _149.viewerClaimRecords[0].claimedAt) >= detail.lotteryDetail.viewerClaimRecords[1].claimedAt, true);
    expectBusinessError(() => { var _a, _b, _c; return service.claimLottery((_c = (_b = (_a = detail.lotteryDetail) === null || _a === void 0 ? void 0 : _a.cards.find((card) => card.state === "available")) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : ""); }, "LOTTERY_DRAW_LIMIT_REACHED");
    service.switchActiveUser("user-2");
    detail = getLotteryDetail(service);
    strict_1.default.equal((_150 = detail.lotteryDetail) === null || _150 === void 0 ? void 0 : _150.viewerEligible, false);
    strict_1.default.equal((_151 = detail.lotteryDetail) === null || _151 === void 0 ? void 0 : _151.viewerCanDraw, false);
    strict_1.default.equal((_152 = detail.lotteryDetail) === null || _152 === void 0 ? void 0 : _152.cards.filter((card) => card.state === "claimed").length, 2);
    expectBusinessError(() => { var _a, _b; return service.claimLottery((_b = (_a = detail.lotteryDetail) === null || _a === void 0 ? void 0 : _a.cards[0].id) !== null && _b !== void 0 ? _b : ""); }, "LOTTERY_FORBIDDEN");
    service.switchActiveUser("user-1");
    detail = service.resetLottery();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_153 = detail.lotteryDetail) === null || _153 === void 0 ? void 0 : _153.claimedCardCount, 0);
    strict_1.default.equal((_154 = detail.lotteryDetail) === null || _154 === void 0 ? void 0 : _154.remainingCardCount, 3);
    strict_1.default.equal((_155 = detail.lotteryDetail) === null || _155 === void 0 ? void 0 : _155.viewerClaimRecords.length, 0);
    strict_1.default.equal((_156 = detail.lotteryDetail) === null || _156 === void 0 ? void 0 : _156.cards.every((card) => card.state === "available"), true);
    detail = service.closeLottery();
    strict_1.default.equal(detail.isStarted, false);
    strict_1.default.equal((_157 = detail.lotteryDetail) === null || _157 === void 0 ? void 0 : _157.cardCount, 0);
    strict_1.default.equal(getToolCard(service, "lottery").isStarted, false);
}
{
    const { service } = setupTripWithMembers();
    service.publishLotteryTool({
        answers: ["一号签", "二号签"],
        drawLimitPerUser: 1,
        allowAssignedUser: true,
        assignedUserId: "user-2"
    });
    let detail = getLotteryDetail(service);
    strict_1.default.equal((_158 = detail.lotteryDetail) === null || _158 === void 0 ? void 0 : _158.viewerEligible, false);
    strict_1.default.equal((_159 = detail.lotteryDetail) === null || _159 === void 0 ? void 0 : _159.assignedUserId, "user-2");
    strict_1.default.equal((_160 = detail.lotteryDetail) === null || _160 === void 0 ? void 0 : _160.assignedUserLabel, "阿山");
    expectBusinessError(() => { var _a, _b; return service.claimLottery((_b = (_a = detail.lotteryDetail) === null || _a === void 0 ? void 0 : _a.cards[0].id) !== null && _b !== void 0 ? _b : ""); }, "LOTTERY_FORBIDDEN");
    service.switchActiveUser("user-2");
    detail = claimFirstAvailableLotteryCard(service);
    strict_1.default.equal((_161 = detail.lotteryDetail) === null || _161 === void 0 ? void 0 : _161.viewerEligible, true);
    strict_1.default.equal((_162 = detail.lotteryDetail) === null || _162 === void 0 ? void 0 : _162.viewerClaimedCount, 1);
    strict_1.default.equal((_163 = detail.lotteryDetail) === null || _163 === void 0 ? void 0 : _163.viewerRemainingDrawCount, 0);
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
        answers: ["修复签"],
        drawLimitPerUser: 1
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
    strict_1.default.equal(Object.values((_164 = dissolvedState === null || dissolvedState === void 0 ? void 0 : dissolvedState.trips[tripId].tools) !== null && _164 !== void 0 ? _164 : {}).every((tool) => tool === null), true);
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
    strict_1.default.equal(Object.keys((_165 = normalizedState === null || normalizedState === void 0 ? void 0 : normalizedState.users) !== null && _165 !== void 0 ? _165 : {}).length, 4);
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
    strict_1.default.equal((_166 = detail.seatDrawDetail) === null || _166 === void 0 ? void 0 : _166.eligibleMembers.length, 49);
    strict_1.default.equal((_167 = detail.seatDrawDetail) === null || _167 === void 0 ? void 0 : _167.remainingCount, 49);
    detail = withMockedRandom(0, () => service.drawSeat());
    strict_1.default.equal((_168 = detail.seatDrawDetail) === null || _168 === void 0 ? void 0 : _168.lastResult.length, 5);
    strict_1.default.equal((_169 = detail.seatDrawDetail) === null || _169 === void 0 ? void 0 : _169.resultRounds.length, 1);
    strict_1.default.equal((_170 = detail.seatDrawDetail) === null || _170 === void 0 ? void 0 : _170.remainingCount, 44);
    strict_1.default.equal(new Set((_171 = detail.seatDrawDetail) === null || _171 === void 0 ? void 0 : _171.lastResult.map((member) => member.userId)).size, 5);
    detail = service.resetSeatDraw();
    strict_1.default.equal((_172 = detail.seatDrawDetail) === null || _172 === void 0 ? void 0 : _172.phase, "ready");
    strict_1.default.equal((_173 = detail.seatDrawDetail) === null || _173 === void 0 ? void 0 : _173.lastResult.length, 0);
    strict_1.default.equal((_174 = detail.seatDrawDetail) === null || _174 === void 0 ? void 0 : _174.resultRounds.length, 0);
    strict_1.default.equal((_175 = detail.seatDrawDetail) === null || _175 === void 0 ? void 0 : _175.remainingCount, 49);
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
    strict_1.default.equal((_176 = detail.voteDetail) === null || _176 === void 0 ? void 0 : _176.participantCount, 49);
    strict_1.default.equal((_177 = detail.voteDetail) === null || _177 === void 0 ? void 0 : _177.options.length, 49);
    strict_1.default.equal((_178 = detail.voteDetail) === null || _178 === void 0 ? void 0 : _178.viewerEligible, true);
    const optionIds = (_180 = (_179 = detail.voteDetail) === null || _179 === void 0 ? void 0 : _179.options.map((option) => option.id)) !== null && _180 !== void 0 ? _180 : [];
    for (let index = 1; index <= 49; index += 1) {
        service.switchActiveUser(`user-${index}`);
        detail = submitVoteChoice(service, "approve", optionIds);
        strict_1.default.equal((_181 = detail.voteDetail) === null || _181 === void 0 ? void 0 : _181.submittedCount, index);
    }
    service.switchActiveUser("user-1");
    detail = getVoteDetail(service);
    strict_1.default.equal((_182 = detail.voteDetail) === null || _182 === void 0 ? void 0 : _182.submittedCount, 49);
    strict_1.default.equal((_183 = detail.voteDetail) === null || _183 === void 0 ? void 0 : _183.approveCount, 49);
    strict_1.default.equal((_184 = detail.voteDetail) === null || _184 === void 0 ? void 0 : _184.rejectCount, 0);
    strict_1.default.equal((_185 = detail.voteDetail) === null || _185 === void 0 ? void 0 : _185.abstainCount, 0);
    strict_1.default.equal((_186 = detail.voteDetail) === null || _186 === void 0 ? void 0 : _186.options.every((option) => option.supportCount === 49), true);
    strict_1.default.equal((_187 = detail.voteDetail) === null || _187 === void 0 ? void 0 : _187.viewerHasSubmitted, true);
    strict_1.default.equal((_188 = detail.voteDetail) === null || _188 === void 0 ? void 0 : _188.viewerSelectedOptionIds.length, 49);
    detail = service.resetVote();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_189 = detail.voteDetail) === null || _189 === void 0 ? void 0 : _189.phase, "active");
    strict_1.default.equal((_190 = detail.voteDetail) === null || _190 === void 0 ? void 0 : _190.participantCount, 49);
    strict_1.default.equal((_191 = detail.voteDetail) === null || _191 === void 0 ? void 0 : _191.submittedCount, 0);
    strict_1.default.equal((_192 = detail.voteDetail) === null || _192 === void 0 ? void 0 : _192.viewerHasSubmitted, false);
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
    strict_1.default.equal((_193 = detail.wheelDetail) === null || _193 === void 0 ? void 0 : _193.items.length, 10);
    strict_1.default.equal((_194 = detail.wheelDetail) === null || _194 === void 0 ? void 0 : _194.eligibleUsers.length, 49);
    strict_1.default.equal((_195 = detail.wheelDetail) === null || _195 === void 0 ? void 0 : _195.resultIndex, null);
    strict_1.default.equal((_196 = detail.wheelDetail) === null || _196 === void 0 ? void 0 : _196.resultLabel, null);
    strict_1.default.deepEqual((_197 = detail.wheelDetail) === null || _197 === void 0 ? void 0 : _197.resultHistoryLabels, []);
    detail = withMockedRandom(0.99, () => service.spinWheel());
    strict_1.default.equal((_198 = detail.wheelDetail) === null || _198 === void 0 ? void 0 : _198.phase, "result");
    strict_1.default.equal((_199 = detail.wheelDetail) === null || _199 === void 0 ? void 0 : _199.resultIndex, 9);
    strict_1.default.equal((_200 = detail.wheelDetail) === null || _200 === void 0 ? void 0 : _200.resultLabel, (_201 = detail.wheelDetail) === null || _201 === void 0 ? void 0 : _201.items[9]);
    strict_1.default.deepEqual((_202 = detail.wheelDetail) === null || _202 === void 0 ? void 0 : _202.resultHistoryLabels, [(_204 = (_203 = detail.wheelDetail) === null || _203 === void 0 ? void 0 : _203.items[9]) !== null && _204 !== void 0 ? _204 : ""]);
    detail = service.resetWheel();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_205 = detail.wheelDetail) === null || _205 === void 0 ? void 0 : _205.phase, "draft");
    strict_1.default.equal((_206 = detail.wheelDetail) === null || _206 === void 0 ? void 0 : _206.resultIndex, null);
    strict_1.default.equal((_207 = detail.wheelDetail) === null || _207 === void 0 ? void 0 : _207.resultLabel, null);
    strict_1.default.deepEqual((_208 = detail.wheelDetail) === null || _208 === void 0 ? void 0 : _208.resultHistoryLabels, []);
    expectBusinessError(() => service.recreateWheelTool({
        items: overflowWheelItems
    }), "WHEEL_ITEMS_LIMIT_EXCEEDED");
}
{
    const { service } = setupTripWith49Members();
    const answers = buildSequentialLabels("签文", 49);
    service.publishLotteryTool({
        answers,
        drawLimitPerUser: 49
    });
    expectBusinessError(() => service.publishLotteryTool({
        answers,
        drawLimitPerUser: 49
    }), "TOOL_ALREADY_STARTED");
    let detail = service.getToolDetailPageData("lottery");
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_209 = detail.lotteryDetail) === null || _209 === void 0 ? void 0 : _209.cardCount, 49);
    strict_1.default.equal((_210 = detail.lotteryDetail) === null || _210 === void 0 ? void 0 : _210.viewerEligible, true);
    strict_1.default.equal((_211 = detail.lotteryDetail) === null || _211 === void 0 ? void 0 : _211.claimedCardCount, 0);
    strict_1.default.equal((_212 = detail.lotteryDetail) === null || _212 === void 0 ? void 0 : _212.viewerRemainingDrawCount, 49);
    for (let index = 1; index <= 49; index += 1) {
        detail = claimFirstAvailableLotteryCard(service);
        strict_1.default.equal((_213 = detail.lotteryDetail) === null || _213 === void 0 ? void 0 : _213.claimedCardCount, index);
        strict_1.default.equal((_214 = detail.lotteryDetail) === null || _214 === void 0 ? void 0 : _214.viewerClaimedCount, index);
    }
    detail = service.getToolDetailPageData("lottery");
    strict_1.default.equal((_215 = detail.lotteryDetail) === null || _215 === void 0 ? void 0 : _215.claimedCardCount, 49);
    strict_1.default.equal((_216 = detail.lotteryDetail) === null || _216 === void 0 ? void 0 : _216.remainingCardCount, 0);
    strict_1.default.equal((_217 = detail.lotteryDetail) === null || _217 === void 0 ? void 0 : _217.cards.every((card) => card.state === "viewer"), true);
    detail = service.resetLottery();
    strict_1.default.equal(detail.isStarted, true);
    strict_1.default.equal((_218 = detail.lotteryDetail) === null || _218 === void 0 ? void 0 : _218.phase, "active");
    strict_1.default.equal((_219 = detail.lotteryDetail) === null || _219 === void 0 ? void 0 : _219.cardCount, 49);
    strict_1.default.equal((_220 = detail.lotteryDetail) === null || _220 === void 0 ? void 0 : _220.claimedCardCount, 0);
    strict_1.default.equal((_221 = detail.lotteryDetail) === null || _221 === void 0 ? void 0 : _221.viewerClaimedCount, 0);
}
{
    const legacyState = (0, constants_1.createInitialAppState)();
    legacyState.users["user-1"].isAuthorized = true;
    legacyState.users["user-1"].currentTripId = "trip-legacy";
    legacyState.trips["trip-legacy"] = {
        id: "trip-legacy",
        tripName: "旧抓阄车次",
        departureTime: "4/20 07:30",
        password: "123456",
        templateId: "template-49",
        creatorUserId: "user-1",
        status: "active",
        seatCodes: (0, seat_1.generateSeatCodes)("template-49"),
        seatMap: {},
        tools: {
            "seat-draw": null,
            vote: null,
            wheel: null,
            lottery: {
                type: "lottery",
                publishedAt: Date.now(),
                publishedByUserId: "user-1",
                phase: "active",
                winnerCount: 1,
                excludeAdmin: false,
                participantUserIds: ["user-1"],
                winnerUserIds: ["user-1"],
                claims: {}
            }
        },
        createdAt: Date.now()
    };
    legacyState.tripMembers = [
        {
            tripId: "trip-legacy",
            userId: "user-1",
            role: "admin",
            joinedAt: Date.now()
        }
    ];
    const storage = new storage_adapter_1.MemoryStorageAdapter(legacyState);
    const service = new trip_service_1.TripService(storage);
    const detail = service.getToolDetailPageData("lottery");
    strict_1.default.equal(detail.isStarted, false);
    strict_1.default.equal((_222 = detail.lotteryDetail) === null || _222 === void 0 ? void 0 : _222.cardCount, 0);
    strict_1.default.equal((_223 = storage.getState()) === null || _223 === void 0 ? void 0 : _223.trips["trip-legacy"].tools.lottery, null);
}
{
    const legacyState = (0, constants_1.createInitialAppState)();
    const legacyUser = legacyState.users["user-1"];
    delete legacyUser.bio;
    delete legacyUser.livingCity;
    delete legacyUser.hometown;
    delete legacyUser.age;
    const storage = new storage_adapter_1.MemoryStorageAdapter(legacyState);
    const service = new trip_service_1.TripService(storage);
    const profilePage = service.getProfilePageData();
    strict_1.default.equal(profilePage.currentUser.bio, "");
    strict_1.default.equal(profilePage.currentUser.livingCity, "");
    strict_1.default.equal(profilePage.currentUser.hometown, "");
    strict_1.default.equal(profilePage.currentUser.age, "");
}
{
    const { service } = setupTripWithMembers();
    service.switchActiveUser("user-2");
    service.updateHomePersona("home-persona-1");
    const editorData = service.updateProfile({
        bio: "土生土长本地人，带你打卡海边小岛",
        livingCity: "广东省深圳市宝安区",
        hometown: "广东省深圳市",
        age: "25岁",
        tagsInput: "师傅A\n师傅B\n热心向导"
    });
    strict_1.default.equal(editorData.bio, "土生土长本地人，带你打卡海边小岛");
    strict_1.default.equal(editorData.livingCity, "广东省深圳市宝安区");
    strict_1.default.deepEqual(editorData.livingRegion, ["广东省", "深圳市", "宝安区"]);
    strict_1.default.equal(editorData.hometown, "广东省深圳市");
    strict_1.default.deepEqual(editorData.hometownRegion, ["广东省", "深圳市"]);
    strict_1.default.equal(editorData.age, "25");
    strict_1.default.deepEqual(editorData.previewTags, ["师傅A", "师傅B", "热心向导"]);
    strict_1.default.equal(editorData.currentPersonaId, "home-persona-1");
    strict_1.default.equal(editorData.currentPersonaImageUrl.length > 0, true);
    const profilePage = service.getProfilePageData();
    strict_1.default.equal(profilePage.profileSummary, "土生土长本地人，带你打卡海边小岛");
    strict_1.default.equal(profilePage.livingLocationDisplay.primary, "宝安区");
    strict_1.default.equal(profilePage.livingLocationDisplay.secondary, "深圳市");
    strict_1.default.equal(profilePage.hometownLocationDisplay.primary, "深圳市");
    strict_1.default.equal(profilePage.hometownLocationDisplay.secondary, "广东省");
    service.switchActiveUser("user-1");
    const homeData = service.bootstrapApp().currentTrip;
    const member = homeData === null || homeData === void 0 ? void 0 : homeData.members.find((entry) => entry.userId === "user-2");
    strict_1.default.ok(member);
    strict_1.default.equal(member === null || member === void 0 ? void 0 : member.bio, "土生土长本地人，带你打卡海边小岛");
    strict_1.default.equal(member === null || member === void 0 ? void 0 : member.livingCity, "广东省深圳市宝安区");
    strict_1.default.equal(member === null || member === void 0 ? void 0 : member.livingLocationDisplay.primary, "宝安区");
    strict_1.default.equal(member === null || member === void 0 ? void 0 : member.livingLocationDisplay.secondary, "深圳市");
    strict_1.default.equal(member === null || member === void 0 ? void 0 : member.hometown, "广东省深圳市");
    strict_1.default.equal(member === null || member === void 0 ? void 0 : member.hometownLocationDisplay.primary, "深圳市");
    strict_1.default.equal(member === null || member === void 0 ? void 0 : member.hometownLocationDisplay.secondary, "广东省");
    strict_1.default.equal(member === null || member === void 0 ? void 0 : member.age, "25");
    strict_1.default.equal((member === null || member === void 0 ? void 0 : member.homePersonaImageUrl.length) ? true : false, true);
    strict_1.default.deepEqual(member === null || member === void 0 ? void 0 : member.tags, ["师傅A", "师傅B", "热心向导"]);
}
{
    const living = (0, format_1.formatLivingLocationDisplay)("广东省深圳市宝安区");
    const hometown = (0, format_1.formatHometownLocationDisplay)("广东省深圳市");
    strict_1.default.equal(living.primary, "宝安区");
    strict_1.default.equal(living.secondary, "深圳市");
    strict_1.default.equal(hometown.primary, "深圳市");
    strict_1.default.equal(hometown.secondary, "广东省");
}
{
    const { service } = createServiceWithUsers(5);
    authorizeActiveUser(service, "小雨");
    service.createTrip({
        tripName: "收藏测试线",
        departureTime: "2025-04-20 07:30",
        password: "123456",
        templateId: "template-49"
    });
    service.claimSeat("1A", {
        profileMode: "custom",
        nickname: "小雨",
        avatarUrl: ""
    });
    joinTripAndSeat(service, "user-2", "阿山", "123456", "1B");
    joinTripAndSeat(service, "user-3", "Miya", "123456", "1C");
    joinTripAndSeat(service, "user-4", "老周", "123456", "1D");
    service.switchActiveUser("user-5");
    authorizeActiveUser(service, "路人");
    service.createTrip({
        tripName: "旁路线",
        departureTime: "2025-04-21 08:30",
        password: "654321",
        templateId: "template-49"
    });
    service.claimSeat("1A", {
        profileMode: "custom",
        nickname: "路人",
        avatarUrl: ""
    });
    service.switchActiveUser("user-1");
    let currentTrip = service.bootstrapApp().currentTrip;
    strict_1.default.equal((_224 = currentTrip === null || currentTrip === void 0 ? void 0 : currentTrip.members.find((member) => member.userId === "user-2")) === null || _224 === void 0 ? void 0 : _224.isFavoritedByViewer, false);
    service.toggleFavoriteMember("user-2");
    currentTrip = service.bootstrapApp().currentTrip;
    strict_1.default.equal((_225 = currentTrip === null || currentTrip === void 0 ? void 0 : currentTrip.members.find((member) => member.userId === "user-2")) === null || _225 === void 0 ? void 0 : _225.isFavoritedByViewer, true);
    service.toggleFavoriteMember("user-2");
    currentTrip = service.bootstrapApp().currentTrip;
    strict_1.default.equal((_226 = currentTrip === null || currentTrip === void 0 ? void 0 : currentTrip.members.find((member) => member.userId === "user-2")) === null || _226 === void 0 ? void 0 : _226.isFavoritedByViewer, false);
    service.toggleFavoriteMember("user-2");
    service.toggleFavoriteMember("user-3");
    expectBusinessError(() => service.toggleFavoriteMember("user-4"), "FAVORITE_LIMIT_EXCEEDED");
    expectBusinessError(() => service.toggleFavoriteMember("user-1"), "FAVORITE_SELF_NOT_ALLOWED");
    expectBusinessError(() => service.toggleFavoriteMember("user-5"), "FAVORITE_TARGET_INVALID");
}
{
    const { service } = setupTripWithMembers();
    service.toggleFavoriteMember("user-2");
    service.toggleFavoriteMember("user-3");
    service.switchActiveUser("user-2");
    service.toggleFavoriteMember("user-1");
    service.switchActiveUser("user-3");
    service.toggleFavoriteMember("user-1");
    service.switchActiveUser("user-4");
    service.toggleFavoriteMember("user-2");
    service.switchActiveUser("user-1");
    const currentTrip = service.bootstrapApp().currentTrip;
    const member2 = currentTrip === null || currentTrip === void 0 ? void 0 : currentTrip.members.find((member) => member.userId === "user-2");
    const member4 = currentTrip === null || currentTrip === void 0 ? void 0 : currentTrip.members.find((member) => member.userId === "user-4");
    strict_1.default.equal(member2 === null || member2 === void 0 ? void 0 : member2.isMutualFavoriteWithViewer, true);
    strict_1.default.equal(member4 === null || member4 === void 0 ? void 0 : member4.isMutualFavoriteWithViewer, false);
    const favoritesPage = service.getFavoritesPageData();
    strict_1.default.equal(favoritesPage.showRankingTab, true);
    strict_1.default.equal(favoritesPage.favoriteCount, 2);
    strict_1.default.deepEqual(favoritesPage.ranking.map((item) => ({
        userId: item.userId,
        favoriteCount: item.favoriteCount
    })), [
        {
            userId: "user-1",
            favoriteCount: 2
        },
        {
            userId: "user-2",
            favoriteCount: 2
        },
        {
            userId: "user-3",
            favoriteCount: 1
        }
    ]);
    service.switchActiveUser("user-2");
    const memberFavoritesPage = service.getFavoritesPageData();
    strict_1.default.equal(memberFavoritesPage.showRankingTab, false);
}
{
    const { service, storage } = setupTripWithMembers();
    service.toggleFavoriteMember("user-2");
    service.toggleFavoriteMember("user-3");
    service.switchActiveUser("user-2");
    service.toggleFavoriteMember("user-1");
    service.leaveCurrentTrip();
    service.switchActiveUser("user-1");
    let state = storage.getState();
    strict_1.default.equal(state === null || state === void 0 ? void 0 : state.tripFavorites.length, 1);
    strict_1.default.equal((_227 = state === null || state === void 0 ? void 0 : state.tripFavorites[0]) === null || _227 === void 0 ? void 0 : _227.targetUserId, "user-3");
    service.dissolveCurrentTrip();
    state = storage.getState();
    strict_1.default.equal(state === null || state === void 0 ? void 0 : state.tripFavorites.length, 0);
}
{
    const { service, storage, tripId } = setupTripWithMembers();
    const state = storage.getState();
    strict_1.default.ok(state);
    state.tripFavorites = [
        {
            tripId,
            sourceUserId: "user-1",
            targetUserId: "user-2",
            createdAt: 20
        },
        {
            tripId,
            sourceUserId: "user-1",
            targetUserId: "user-2",
            createdAt: 10
        },
        {
            tripId,
            sourceUserId: "user-1",
            targetUserId: "user-1",
            createdAt: 30
        },
        {
            tripId: "missing-trip",
            sourceUserId: "user-1",
            targetUserId: "user-2",
            createdAt: 40
        },
        {
            tripId,
            sourceUserId: "missing-user",
            targetUserId: "user-2",
            createdAt: 50
        }
    ];
    storage.setState(state);
    service.bootstrapApp();
    const nextState = storage.getState();
    strict_1.default.equal(nextState === null || nextState === void 0 ? void 0 : nextState.tripFavorites.length, 1);
    strict_1.default.deepEqual(nextState === null || nextState === void 0 ? void 0 : nextState.tripFavorites[0], {
        tripId,
        sourceUserId: "user-1",
        targetUserId: "user-2",
        createdAt: 10
    });
}
console.log("trip-service tests passed");

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const constants_1 = require("../miniprogram/shared/constants");
const errors_1 = require("../miniprogram/shared/errors");
const storage_adapter_1 = require("../miniprogram/repositories/storage-adapter");
const trip_service_1 = require("../miniprogram/services/trip-service");
const storage = new storage_adapter_1.MemoryStorageAdapter((0, constants_1.createInitialAppState)());
const service = new trip_service_1.TripService(storage);
function expectBusinessError(action, code) {
    try {
        action();
        strict_1.default.fail(`Expected ${code}`);
    }
    catch (error) {
        strict_1.default.ok(error instanceof errors_1.BusinessError);
        strict_1.default.equal(error.code, code);
    }
}
function authorizeActiveUser(nickname) {
    service.authorizeProfile({
        nickname,
        avatarUrl: `https://example.com/${nickname}.png`
    });
}
let result = service.bootstrapApp();
strict_1.default.equal(result.homeMode, "landing");
strict_1.default.equal(result.currentUser.nickname, "小雨");
let profilePage = service.getProfilePageData();
strict_1.default.equal(profilePage.isAuthorized, false);
strict_1.default.equal(profilePage.showTagsCard, false);
strict_1.default.equal(profilePage.showPrimaryAction, false);
let toolsPage = service.getToolsPageData();
strict_1.default.equal(toolsPage.isAuthorized, false);
strict_1.default.equal(toolsPage.hasCurrentTrip, false);
strict_1.default.equal(toolsPage.emptyTitle, "先创建或加入车次");
expectBusinessError(() => service.createTrip({
    tripName: "周末上山线",
    departureTime: "4/20 07:30",
    password: "123456",
    templateId: "template-49"
}), "AUTH_REQUIRED");
expectBusinessError(() => service.getTagEditorData(), "AUTH_REQUIRED");
authorizeActiveUser("小雨");
expectBusinessError(() => service.createTrip({
    tripName: "   ",
    departureTime: "4/20 07:30",
    password: "123456",
    templateId: "template-49"
}), "INVALID_TRIP_NAME");
result = service.createTrip({
    tripName: "周末上山线",
    departureTime: "4/20 07:30",
    password: "123456",
    templateId: "template-49"
});
strict_1.default.equal(result.homeMode, "trip");
strict_1.default.equal((_a = result.currentTrip) === null || _a === void 0 ? void 0 : _a.tripMeta.viewerRole, "admin");
strict_1.default.equal((_b = result.currentTrip) === null || _b === void 0 ? void 0 : _b.tripMeta.memberCount, 1);
profilePage = service.getProfilePageData();
strict_1.default.equal(profilePage.primaryActionKind, "dissolve");
strict_1.default.equal(profilePage.showTagsCard, true);
toolsPage = service.getToolsPageData();
strict_1.default.equal(toolsPage.isAuthorized, true);
strict_1.default.equal(toolsPage.hasCurrentTrip, true);
strict_1.default.equal(toolsPage.emptyTitle, "工具页正在准备中");
result = service.claimSeat("1A", {
    profileMode: "custom",
    nickname: "不会生效",
    avatarUrl: ""
});
strict_1.default.equal((_c = result.currentTrip) === null || _c === void 0 ? void 0 : _c.tripMeta.viewerSeatCode, "1A");
strict_1.default.equal(result.currentUser.nickname, "小雨");
result = service.switchActiveUser("user-2");
strict_1.default.equal(result.homeMode, "landing");
profilePage = service.getProfilePageData();
strict_1.default.equal(profilePage.isAuthorized, false);
strict_1.default.equal(profilePage.showPrimaryAction, false);
toolsPage = service.getToolsPageData();
strict_1.default.equal(toolsPage.isAuthorized, false);
strict_1.default.equal(toolsPage.hasCurrentTrip, false);
expectBusinessError(() => service.joinTripByPassword("123456"), "AUTH_REQUIRED");
authorizeActiveUser("阿山");
profilePage = service.getProfilePageData();
strict_1.default.equal(profilePage.isAuthorized, true);
strict_1.default.equal(profilePage.showTagsCard, false);
toolsPage = service.getToolsPageData();
strict_1.default.equal(toolsPage.isAuthorized, true);
strict_1.default.equal(toolsPage.hasCurrentTrip, false);
strict_1.default.equal(toolsPage.emptyTitle, "先创建或加入车次");
expectBusinessError(() => service.updateTags("路痴"), "TRIP_REQUIRED");
result = service.joinTripByPassword("123456");
strict_1.default.equal((_d = result.currentTrip) === null || _d === void 0 ? void 0 : _d.tripMeta.memberCount, 2);
result = service.claimSeat("1B", {
    profileMode: "custom",
    nickname: "阿山",
    avatarUrl: ""
});
strict_1.default.equal((_e = result.currentTrip) === null || _e === void 0 ? void 0 : _e.tripMeta.viewerSeatCode, "1B");
let tagEditor = service.updateTags("路痴，INFJ，INFJ，工程师");
strict_1.default.deepEqual(tagEditor.tags, ["路痴", "INFJ", "工程师"]);
strict_1.default.equal(service.bootstrapApp().currentUser.nickname, "阿山");
tagEditor = service.getTagEditorData();
strict_1.default.equal(tagEditor.currentTripTitle, "周末上山线");
strict_1.default.deepEqual(tagEditor.previewTags, ["路痴", "INFJ", "工程师"]);
profilePage = service.getProfilePageData();
strict_1.default.equal(profilePage.primaryActionKind, "leave");
strict_1.default.deepEqual(profilePage.tags, ["路痴", "INFJ", "工程师"]);
expectBusinessError(() => service.switchSeat("1A"), "SEAT_OCCUPIED");
result = service.switchActiveUser("user-1");
strict_1.default.equal((_f = result.currentTrip) === null || _f === void 0 ? void 0 : _f.tripMeta.viewerRole, "admin");
result = service.adminReleaseSeat("user-2");
strict_1.default.equal((_h = (_g = result.currentTrip) === null || _g === void 0 ? void 0 : _g.members.find((member) => member.userId === "user-2")) === null || _h === void 0 ? void 0 : _h.seatCode, null);
result = service.switchActiveUser("user-2");
result = service.leaveCurrentTrip();
strict_1.default.equal(result.homeMode, "landing");
profilePage = service.getProfilePageData();
strict_1.default.equal(profilePage.primaryActionKind, "none");
strict_1.default.equal(profilePage.showTagsCard, false);
toolsPage = service.getToolsPageData();
strict_1.default.equal(toolsPage.hasCurrentTrip, false);
result = service.switchActiveUser("user-1");
result = service.dissolveCurrentTrip();
strict_1.default.equal(result.homeMode, "landing");
const corruptedState = storage.getState();
if (!corruptedState) {
    throw new Error("Expected memory state");
}
corruptedState.users["user-3"].currentTripId = "ghost-trip";
corruptedState.tripMembers.push({
    tripId: "ghost-trip",
    userId: "user-3",
    role: "member",
    joinedAt: Date.now()
});
storage.setState(corruptedState);
result = service.switchActiveUser("user-1");
result = service.createTrip({
    tripName: "修复后车次",
    departureTime: "",
    password: "654321",
    templateId: "template-49"
});
strict_1.default.equal((_j = result.currentTrip) === null || _j === void 0 ? void 0 : _j.tripMeta.memberCount, 1);
result = service.switchActiveUser("user-2");
authorizeActiveUser("阿山");
result = service.joinTripByPassword("654321");
strict_1.default.equal((_k = result.currentTrip) === null || _k === void 0 ? void 0 : _k.tripMeta.memberCount, 2);
const adminlessState = storage.getState();
if (!adminlessState) {
    throw new Error("Expected memory state");
}
adminlessState.users["user-1"].currentTripId = null;
storage.setState(adminlessState);
result = service.switchActiveUser("user-2");
strict_1.default.equal((_l = result.currentTrip) === null || _l === void 0 ? void 0 : _l.tripMeta.viewerRole, "admin");
result = service.switchActiveUser("user-3");
authorizeActiveUser("Miya");
strict_1.default.equal(result.currentUser.currentTripId, null);
result = service.joinTripByPassword("654321");
strict_1.default.equal(result.currentUser.id, "user-3");
strict_1.default.equal((_m = result.currentTrip) === null || _m === void 0 ? void 0 : _m.tripMeta.memberCount, 2);
const duplicatedState = storage.getState();
if (!duplicatedState) {
    throw new Error("Expected memory state");
}
duplicatedState.tripMembers.push({
    tripId: result.currentUser.currentTripId,
    userId: "user-3",
    role: "member",
    joinedAt: Date.now()
});
storage.setState(duplicatedState);
result = service.bootstrapApp();
strict_1.default.equal((_o = result.currentTrip) === null || _o === void 0 ? void 0 : _o.members.filter((member) => member.userId === "user-3").length, 1);
strict_1.default.equal((_p = result.currentTrip) === null || _p === void 0 ? void 0 : _p.tripMeta.memberCount, 2);
result = service.switchActiveUser("user-4");
authorizeActiveUser("老周");
result = service.createTrip({
    tripName: "将被清空的车次",
    departureTime: "",
    password: "111111",
    templateId: "template-49"
});
strict_1.default.equal((_q = result.currentTrip) === null || _q === void 0 ? void 0 : _q.tripMeta.viewerRole, "admin");
const emptyTripState = storage.getState();
if (!emptyTripState) {
    throw new Error("Expected memory state");
}
emptyTripState.users["user-4"].currentTripId = null;
storage.setState(emptyTripState);
result = service.switchActiveUser("user-4");
strict_1.default.equal(result.homeMode, "landing");
result = service.switchActiveUser("user-1");
expectBusinessError(() => service.joinTripByPassword("111111"), "TRIP_NOT_FOUND");
console.log("trip-service tests passed");

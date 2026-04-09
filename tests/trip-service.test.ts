import assert from "node:assert/strict";
import { createInitialAppState } from "../miniprogram/shared/constants";
import { BusinessError } from "../miniprogram/shared/errors";
import { MemoryStorageAdapter } from "../miniprogram/repositories/storage-adapter";
import { TripService } from "../miniprogram/services/trip-service";

const storage = new MemoryStorageAdapter(createInitialAppState());
const service = new TripService(storage);

function expectBusinessError(action: () => void, code: string): void {
  try {
    action();
    assert.fail(`Expected ${code}`);
  } catch (error) {
    assert.ok(error instanceof BusinessError);
    assert.equal(error.code, code);
  }
}

function authorizeActiveUser(nickname: string): void {
  service.authorizeProfile({
    nickname,
    avatarUrl: `https://example.com/${nickname}.png`
  });
}

let result = service.bootstrapApp();
assert.equal(result.homeMode, "landing");
assert.equal(result.currentUser.nickname, "小雨");

let profilePage = service.getProfilePageData();
assert.equal(profilePage.isAuthorized, false);
assert.equal(profilePage.showTagsCard, false);
assert.equal(profilePage.showPrimaryAction, false);

let toolsPage = service.getToolsPageData();
assert.equal(toolsPage.isAuthorized, false);
assert.equal(toolsPage.hasCurrentTrip, false);
assert.equal(toolsPage.emptyTitle, "先创建或加入车次");

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

assert.equal(result.homeMode, "trip");
assert.equal(result.currentTrip?.tripMeta.viewerRole, "admin");
assert.equal(result.currentTrip?.tripMeta.memberCount, 1);

profilePage = service.getProfilePageData();
assert.equal(profilePage.primaryActionKind, "dissolve");
assert.equal(profilePage.showTagsCard, true);

toolsPage = service.getToolsPageData();
assert.equal(toolsPage.isAuthorized, true);
assert.equal(toolsPage.hasCurrentTrip, true);
assert.equal(toolsPage.emptyTitle, "工具页正在准备中");

result = service.claimSeat("1A", {
  profileMode: "custom",
  nickname: "不会生效",
  avatarUrl: ""
});
assert.equal(result.currentTrip?.tripMeta.viewerSeatCode, "1A");
assert.equal(result.currentUser.nickname, "小雨");

result = service.switchActiveUser("user-2");
assert.equal(result.homeMode, "landing");

profilePage = service.getProfilePageData();
assert.equal(profilePage.isAuthorized, false);
assert.equal(profilePage.showPrimaryAction, false);

toolsPage = service.getToolsPageData();
assert.equal(toolsPage.isAuthorized, false);
assert.equal(toolsPage.hasCurrentTrip, false);

expectBusinessError(() => service.joinTripByPassword("123456"), "AUTH_REQUIRED");

authorizeActiveUser("阿山");

profilePage = service.getProfilePageData();
assert.equal(profilePage.isAuthorized, true);
assert.equal(profilePage.showTagsCard, false);

toolsPage = service.getToolsPageData();
assert.equal(toolsPage.isAuthorized, true);
assert.equal(toolsPage.hasCurrentTrip, false);
assert.equal(toolsPage.emptyTitle, "先创建或加入车次");

expectBusinessError(() => service.updateTags("路痴"), "TRIP_REQUIRED");

result = service.joinTripByPassword("123456");
assert.equal(result.currentTrip?.tripMeta.memberCount, 2);

result = service.claimSeat("1B", {
  profileMode: "custom",
  nickname: "阿山",
  avatarUrl: ""
});
assert.equal(result.currentTrip?.tripMeta.viewerSeatCode, "1B");

let tagEditor = service.updateTags("路痴，INFJ，INFJ，工程师");
assert.deepEqual(tagEditor.tags, ["路痴", "INFJ", "工程师"]);
assert.equal(service.bootstrapApp().currentUser.nickname, "阿山");

tagEditor = service.getTagEditorData();
assert.equal(tagEditor.currentTripTitle, "周末上山线");
assert.deepEqual(tagEditor.previewTags, ["路痴", "INFJ", "工程师"]);

profilePage = service.getProfilePageData();
assert.equal(profilePage.primaryActionKind, "leave");
assert.deepEqual(profilePage.tags, ["路痴", "INFJ", "工程师"]);

expectBusinessError(() => service.switchSeat("1A"), "SEAT_OCCUPIED");

result = service.switchActiveUser("user-1");
assert.equal(result.currentTrip?.tripMeta.viewerRole, "admin");

result = service.adminReleaseSeat("user-2");
assert.equal(
  result.currentTrip?.members.find((member) => member.userId === "user-2")?.seatCode,
  null
);

result = service.switchActiveUser("user-2");
result = service.leaveCurrentTrip();
assert.equal(result.homeMode, "landing");

profilePage = service.getProfilePageData();
assert.equal(profilePage.primaryActionKind, "none");
assert.equal(profilePage.showTagsCard, false);

toolsPage = service.getToolsPageData();
assert.equal(toolsPage.hasCurrentTrip, false);

result = service.switchActiveUser("user-1");
result = service.dissolveCurrentTrip();
assert.equal(result.homeMode, "landing");

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
assert.equal(result.currentTrip?.tripMeta.memberCount, 1);

result = service.switchActiveUser("user-2");
authorizeActiveUser("阿山");
result = service.joinTripByPassword("654321");
assert.equal(result.currentTrip?.tripMeta.memberCount, 2);

const adminlessState = storage.getState();
if (!adminlessState) {
  throw new Error("Expected memory state");
}

adminlessState.users["user-1"].currentTripId = null;
storage.setState(adminlessState);

result = service.switchActiveUser("user-2");
assert.equal(result.currentTrip?.tripMeta.viewerRole, "admin");

result = service.switchActiveUser("user-3");
authorizeActiveUser("Miya");
assert.equal(result.currentUser.currentTripId, null);
result = service.joinTripByPassword("654321");
assert.equal(result.currentUser.id, "user-3");
assert.equal(result.currentTrip?.tripMeta.memberCount, 2);

const duplicatedState = storage.getState();
if (!duplicatedState) {
  throw new Error("Expected memory state");
}

duplicatedState.tripMembers.push({
  tripId: result.currentUser.currentTripId!,
  userId: "user-3",
  role: "member",
  joinedAt: Date.now()
});
storage.setState(duplicatedState);

result = service.bootstrapApp();
assert.equal(
  result.currentTrip?.members.filter((member) => member.userId === "user-3").length,
  1
);
assert.equal(result.currentTrip?.tripMeta.memberCount, 2);

result = service.switchActiveUser("user-4");
authorizeActiveUser("老周");
result = service.createTrip({
  tripName: "将被清空的车次",
  departureTime: "",
  password: "111111",
  templateId: "template-49"
});
assert.equal(result.currentTrip?.tripMeta.viewerRole, "admin");

const emptyTripState = storage.getState();
if (!emptyTripState) {
  throw new Error("Expected memory state");
}

emptyTripState.users["user-4"].currentTripId = null;
storage.setState(emptyTripState);

result = service.switchActiveUser("user-4");
assert.equal(result.homeMode, "landing");

result = service.switchActiveUser("user-1");
expectBusinessError(() => service.joinTripByPassword("111111"), "TRIP_NOT_FOUND");

console.log("trip-service tests passed");

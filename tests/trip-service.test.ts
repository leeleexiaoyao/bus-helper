import assert from "node:assert/strict";
import {
  DEFAULT_HOME_TITLE,
  FIXED_TRIP_IDS,
  createInitialAppState
} from "../miniprogram/shared/constants";
import { BusinessError } from "../miniprogram/shared/errors";
import { MemoryStorageAdapter } from "../miniprogram/repositories/storage-adapter";
import { TripService } from "../miniprogram/services/trip-service";

function createService(initialState = createInitialAppState()) {
  const storage = new MemoryStorageAdapter(initialState);
  const service = new TripService(storage);
  return {
    storage,
    service
  };
}

function authorizeActiveUser(service: TripService, nickname = "已授权用户") {
  service.authorizeProfile({
    nickname,
    avatarUrl: ""
  });
}

function withMockedNow<T>(timestamp: number, callback: () => T): T {
  const originalNow = Date.now;
  Date.now = () => timestamp;
  try {
    return callback();
  } finally {
    Date.now = originalNow;
  }
}

function expectBusinessError(action: () => unknown | Promise<unknown>, code: string): Promise<void> | void {
  try {
    const result = action();
    if (result instanceof Promise) {
      return result.then(
        () => assert.fail(`Expected ${code}`),
        (error) => {
          assert.ok(error instanceof BusinessError);
          assert.equal(error.code, code);
        }
      );
    }

    assert.fail(`Expected ${code}`);
  } catch (error) {
    assert.ok(error instanceof BusinessError);
    assert.equal(error.code, code);
  }
}

(async () => {
{
  const { service } = createService();
  const bootstrap = service.bootstrapApp();

  assert.equal(bootstrap.homeMode, "trip");
  assert.equal(bootstrap.homeTitle, DEFAULT_HOME_TITLE);
  assert.equal(bootstrap.currentTripLabel, "1车");
  assert.equal(bootstrap.canEditHomeTitle, false);
  assert.equal(bootstrap.currentTrip.tripMeta.tripId, FIXED_TRIP_IDS.trip1);
  assert.equal(bootstrap.currentTrip.tripMeta.tripName, "1车");
  assert.equal(bootstrap.currentTrip.tripMeta.viewerRole, "member");
  assert.equal(bootstrap.tripSwitchOptions.length, 2);
  assert.deepEqual(
    bootstrap.tripSwitchOptions.map((option) => ({
      tripId: option.tripId,
      isSelected: option.isSelected,
      isOwnedByViewer: option.isOwnedByViewer,
      isReadOnly: option.isReadOnly
    })),
    [
      {
        tripId: FIXED_TRIP_IDS.trip1,
        isSelected: true,
        isOwnedByViewer: true,
        isReadOnly: false
      },
      {
        tripId: FIXED_TRIP_IDS.trip2,
        isSelected: false,
        isOwnedByViewer: true,
        isReadOnly: false
      }
    ]
  );
}

{
  const legacyState = createInitialAppState();
  legacyState.version = 11;
  legacyState.activeUserId = "user-3";
  legacyState.users["user-1"].currentTripId = FIXED_TRIP_IDS.trip2;

  const { storage, service } = createService(legacyState);
  const bootstrap = service.bootstrapApp();

  assert.equal(bootstrap.currentUser.id, "user-1");
  assert.equal(bootstrap.currentTrip.tripMeta.tripId, FIXED_TRIP_IDS.trip1);
  assert.equal(storage.getState()?.runtimeConfig.homeTitle, DEFAULT_HOME_TITLE);
}

{
  const state = createInitialAppState();
  state.users["cloud-openid-user"] = {
    id: "cloud-openid-user",
    nickname: "云端用户",
    avatarUrl: "",
    homePersonaAssetId: null,
    bio: "",
    livingCity: "",
    hometown: "",
    age: "",
    tags: [],
    memberTripId: FIXED_TRIP_IDS.trip1,
    currentTripId: FIXED_TRIP_IDS.trip1,
    isAuthorized: true,
    boardingRecordsByTripId: {}
  };
  state.activeUserId = "cloud-openid-user";

  const { storage, service } = createService(state);
  const bootstrap = service.bootstrapApp();
  const repairedState = storage.getState();

  assert.equal(bootstrap.currentTrip.tripMeta.tripId, FIXED_TRIP_IDS.trip1);
  assert.equal(bootstrap.currentTrip.tripMeta.viewerRole, "member");
  assert.equal(
    repairedState?.tripMembers.some(
      (member) => member.tripId === FIXED_TRIP_IDS.trip1 && member.userId === "cloud-openid-user"
    ),
    true
  );
  assert.equal(
    repairedState?.tripMembers.some(
      (member) => member.tripId === FIXED_TRIP_IDS.trip2 && member.userId === "cloud-openid-user"
    ),
    true
  );
}

{
  const { service } = createService();
  authorizeActiveUser(service, "阿山");

  const bootstrap = service.switchCurrentTrip(FIXED_TRIP_IDS.trip2);
  const profilePage = service.getProfilePageData();
  const toolsPage = service.getToolsPageData();
  const toolDetail = service.getToolDetailPageData("vote");

  assert.equal(bootstrap.currentTrip.tripMeta.tripId, FIXED_TRIP_IDS.trip2);
  assert.equal(bootstrap.currentTrip.tripMeta.viewerRole, "member");
  assert.equal(bootstrap.currentTrip.tripMeta.isReadOnlyView, false);
  assert.equal(bootstrap.viewerSeatSummary, "1车 1A");
  assert.equal(bootstrap.boardingButton.isDisabled, true);
  assert.equal(bootstrap.boardingButton.disabledReason, "seat-in-other-trip");
  assert.equal(profilePage.currentTripTitle, "2车");
  assert.equal(profilePage.currentRoleLabel, "成员");
  assert.equal(toolsPage.tripName, "2车");
  assert.equal(toolsPage.toolCards.every((tool) => tool.canEnter), true);
  assert.equal(toolDetail.tripName, "2车");
  assert.equal(toolDetail.viewerRoleLabel, "成员");
}

{
  const { service } = createService();
  const toolsPage = service.getToolsPageData();
  const toolDetail = service.getToolDetailPageData("wheel");

  assert.equal(toolsPage.tripName, "1车");
  assert.equal(toolsPage.isAuthorized, false);
  assert.equal(toolsPage.toolCards.every((tool) => tool.canEnter), true);
  assert.equal(toolDetail.isStarted, false);
  assert.equal(toolDetail.isAdmin, false);
}

{
  const { service } = createService();
  service.switchActiveUser("user-2");
  authorizeActiveUser(service, "阿山");

  const claimed = service.claimSeat("1B");
  assert.equal(claimed.currentTrip.tripMeta.viewerSeatCode, "1B");

  const switched = service.switchSeat("1C");
  assert.equal(switched.currentTrip.tripMeta.viewerSeatCode, "1C");

  const released = service.releaseMySeat();
  assert.equal(released.currentTrip.tripMeta.viewerSeatCode, null);
}

{
  const { service } = createService();
  authorizeActiveUser(service, "小雨");

  const switched = service.switchCurrentTrip(FIXED_TRIP_IDS.trip2);
  assert.equal(switched.viewerSeatSummary, "1车 1A");
  assert.equal(switched.boardingButton.isDisabled, true);
  assert.equal(switched.boardingButton.disabledReason, "seat-in-other-trip");

  const moved = service.claimSeat("1B");
  assert.equal(moved.currentTrip.tripMeta.tripId, FIXED_TRIP_IDS.trip2);
  assert.equal(moved.currentTrip.tripMeta.viewerSeatCode, "1B");
  assert.equal(moved.viewerSeatSummary, "2车 1B");

  service.switchCurrentTrip(FIXED_TRIP_IDS.trip1);
  assert.equal(service.bootstrapApp().currentTrip.tripMeta.viewerSeatCode, null);
}

{
  const { service } = createService();
  authorizeActiveUser(service, "小雨");
  const baseTime = Date.parse("2026-04-25T12:33:00+08:00");

  const firstToggle = withMockedNow(baseTime, () => service.toggleBoardingCheckIn());
  assert.equal(firstToggle.action, "checked-in");
  assert.equal(firstToggle.result.viewerSeatSummary, "1车 1A");
  assert.equal(firstToggle.result.boardingButton.label, "已上车");
  assert.equal(firstToggle.result.boardingButton.isActive, true);
  assert.equal(firstToggle.result.boardingButton.isDisabled, false);

  const recordPage = withMockedNow(baseTime, () => service.getBoardingRecordPageData());
  assert.equal(recordPage.isAdmin, false);
  assert.equal(recordPage.flatRecords.length, 1);
  assert.equal(recordPage.flatRecords[0].nickname, "小雨");
  assert.equal(recordPage.flatRecords[0].formattedTime, "2026年04月25日 12:33");

  const cancelToggle = withMockedNow(baseTime + 5000, () => service.toggleBoardingCheckIn());
  assert.equal(cancelToggle.action, "cancelled");
  assert.equal(cancelToggle.result.boardingButton.label, "上车");
  assert.equal(cancelToggle.result.boardingButton.isActive, false);
  assert.equal(service.getBoardingRecordPageData().flatRecords.length, 0);
}

{
  const { service } = createService();
  authorizeActiveUser(service, "小雨");
  const baseTime = Date.parse("2026-04-25T12:33:00+08:00");

  withMockedNow(baseTime, () => service.toggleBoardingCheckIn());

  const lockedBootstrap = withMockedNow(baseTime + 11000, () => service.bootstrapApp());
  assert.equal(lockedBootstrap.boardingButton.label, "已上车");
  assert.equal(lockedBootstrap.boardingButton.isDisabled, true);

  const resetBootstrap = withMockedNow(baseTime + 601000, () => service.bootstrapApp());
  assert.equal(resetBootstrap.boardingButton.label, "上车");
  assert.equal(resetBootstrap.boardingButton.isActive, false);
  assert.equal(resetBootstrap.boardingButton.isDisabled, false);

  const historyPage = withMockedNow(baseTime + 601000, () => service.getBoardingRecordPageData());
  assert.equal(historyPage.flatRecords.length, 1);
}

{
  const state = createInitialAppState();
  state.runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip1] = "user-1";
  state.runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip2] = "user-3";
  const { service } = createService(state);
  const trip1Time = Date.parse("2026-04-25T12:33:00+08:00");
  const trip2Time = Date.parse("2026-04-25T12:34:00+08:00");

  authorizeActiveUser(service, "小雨");
  withMockedNow(trip1Time, () => service.toggleBoardingCheckIn());

  service.switchActiveUser("user-3");
  authorizeActiveUser(service, "Miya");
  withMockedNow(trip2Time, () => service.toggleBoardingCheckIn());

  service.switchActiveUser("user-1");
  const adminRecordPage = withMockedNow(trip2Time, () => service.getBoardingRecordPageData());
  const trip1OnlyRecordPage = withMockedNow(trip2Time, () => service.getBoardingRecordPageData("trip1"));

  assert.equal(adminRecordPage.isAdmin, true);
  assert.equal(adminRecordPage.selectedTripFilter, "all");
  assert.deepEqual(
    adminRecordPage.memberGroups.map((group) => `${group.tripLabel}-${group.nickname}-${group.seatLabel}`),
    [
      "1车-小雨-1A",
      "1车-阿山-未入座",
      "1车-Miya-未入座",
      "1车-老周-未入座",
      "2车-Miya-1A",
      "2车-小雨-未入座",
      "2车-阿山-未入座",
      "2车-老周-未入座"
    ]
  );
  assert.equal(adminRecordPage.memberGroups[0].records.length, 1);
  assert.equal(adminRecordPage.memberGroups[1].records.length, 0);
  assert.equal(adminRecordPage.memberGroups[4].records[0].formattedTime, "2026年04月25日 12:34");
  assert.deepEqual(
    trip1OnlyRecordPage.memberGroups.map((group) => group.tripLabel),
    ["1车", "1车", "1车", "1车"]
  );
}

{
  const { service } = createService();
  service.switchActiveUser("user-2");
  expectBusinessError(() => service.claimSeat("1B"), "AUTH_REQUIRED");
}

{
  const { service } = createService();
  service.switchActiveUser("user-2");
  authorizeActiveUser(service, "阿山");
  service.switchCurrentTrip(FIXED_TRIP_IDS.trip2);

  const claimed = service.claimSeat("1B");
  assert.equal(claimed.currentTrip.tripMeta.tripId, FIXED_TRIP_IDS.trip2);
  assert.equal(claimed.currentTrip.tripMeta.viewerSeatCode, "1B");

  const favorited = service.toggleFavoriteMember("user-3");
  assert.equal(
    favorited.currentTrip.members.find((member) => member.userId === "user-3")?.isFavoritedByViewer,
    true
  );

  expectBusinessError(
    () =>
      service.publishVoteTool({
        topic: "晚饭吃什么",
        options: ["火锅", "烧烤"],
        selectionMode: "single",
        excludeAdmin: false
      }),
    "ADMIN_ONLY"
  );
}

{
  const { service } = createService();
  authorizeActiveUser(service, "小雨");
  service.toggleFavoriteMember("user-2");
  service.switchCurrentTrip(FIXED_TRIP_IDS.trip2);

  const favoritesPage = service.getFavoritesPageData();

  assert.equal(favoritesPage.tripName, "2车");
  assert.equal(favoritesPage.favoriteCount, 0);
  assert.equal(favoritesPage.showRankingTab, false);
}

{
  const { service } = createService();
  const passengersPage = service.getPassengerPageData();

  assert.equal(passengersPage.currentTripLabel, "1车");
  assert.deepEqual(
    passengersPage.filterOptions.map((option) => `${option.id}-${option.label}-${option.isSelected}`),
    ["all-全部-true", `${FIXED_TRIP_IDS.trip1}-1车-false`, `${FIXED_TRIP_IDS.trip2}-2车-false`]
  );
  assert.deepEqual(
    passengersPage.memberGroups.map((group) => `${group.tripLabel}-${group.memberCount}`),
    ["1车-4", "2车-4"]
  );
  assert.deepEqual(
    passengersPage.memberGroups[0].members.map(
      (member) => `${member.nickname}-${member.seatDisplayLabel}-${member.detailMode}`
    ),
    [
      "小雨-1车 1A-self-detail",
      "阿山-1车 未入座-member-detail",
      "Miya-1车 未入座-member-detail",
      "老周-1车 未入座-member-detail"
    ]
  );
  assert.deepEqual(
    passengersPage.memberGroups[1].members.map(
      (member) => `${member.nickname}-${member.seatDisplayLabel}-${member.detailMode}`
    ),
    [
      "Miya-2车 1A-readonly-member-detail",
      "小雨-2车 未入座-readonly-member-detail",
      "阿山-2车 未入座-readonly-member-detail",
      "老周-2车 未入座-readonly-member-detail"
    ]
  );
}

{
  const { storage, service } = createService();
  authorizeActiveUser(service, "小雨");
  service.enableSeedDemoData();

  const seededState = storage.getState();
  assert.equal(Object.keys(seededState?.trips ?? {}).sort().join(","), "trip-fixed-1,trip-fixed-2");
  assert.equal(Object.keys(seededState?.users ?? {}).length > 4, true);
  assert.equal((seededState?.tripMembers ?? []).length > 4, true);
  assert.equal(seededState?.runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip1], "user-1");
  assert.equal(service.getProfilePageData().seedDemoEnabled, true);

  service.disableSeedDemoData();
  const resetState = storage.getState();
  assert.equal(Object.keys(resetState?.users ?? {}).length, 4);
  assert.equal((resetState?.tripMembers ?? []).length, 8);
  assert.equal(resetState?.runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip1], null);
  assert.equal(service.getProfilePageData().seedDemoEnabled, false);
}

{
  const { service } = createService();
  const profilePage = service.getProfilePageData();

  assert.deepEqual(
    profilePage.demoUsers.map((user) => user.roleLabel),
    ["成员", "成员", "成员", "成员"]
  );
}

{
  const state = createInitialAppState();
  state.runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip1] = "user-2";

  const { service } = createService(state);
  service.switchActiveUser("user-2");
  authorizeActiveUser(service, "阿山");

  const bootstrap = service.bootstrapApp();
  const settingsPage = service.getHomeSettingsPageData();

  assert.equal(bootstrap.canEditHomeTitle, true);
  assert.equal(bootstrap.currentTrip.tripMeta.viewerRole, "admin");
  assert.equal(settingsPage.canEditHomeTitle, true);
}

{
  const state = createInitialAppState();
  state.runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip1] = "user-1";

  const { storage, service } = createService(state);
  authorizeActiveUser(service, "小雨");
  assert.equal(service.bootstrapApp().currentTrip.tripMeta.viewerRole, "admin");

  const nextState = storage.getState()!;
  nextState.runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip1] = "user-2";
  storage.setState(nextState);

  assert.equal(service.bootstrapApp().currentTrip.tripMeta.viewerRole, "member");
  service.switchActiveUser("user-2");
  assert.equal(service.bootstrapApp().currentTrip.tripMeta.viewerRole, "admin");
}

{
  const state = createInitialAppState();
  state.runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip1] = "user-1";

  const { service } = createService(state);
  authorizeActiveUser(service, "小雨");

  await service.saveHomeTitle("银河列车");

  assert.equal(service.bootstrapApp().homeTitle, "银河列车");
  assert.equal(service.getHomeSettingsPageData().homeTitle, "银河列车");
}

{
  const { service } = createService();
  authorizeActiveUser(service, "小雨");

  await expectBusinessError(() => service.saveHomeTitle(""), "ADMIN_ONLY");
}

{
  const { service } = createService();

  expectBusinessError(
    () =>
      service.createTrip({
        tripName: "新车次",
        departureTime: "2025-04-25 09:00",
        password: "123456",
        templateId: "template-49"
      }),
    "FIXED_TRIP_MODE"
  );
  expectBusinessError(() => service.joinTripByPassword("123456"), "FIXED_TRIP_MODE");
  expectBusinessError(() => service.leaveCurrentTrip(), "FIXED_TRIP_MODE");
  expectBusinessError(() => service.dissolveCurrentTrip(), "FIXED_TRIP_MODE");
}
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

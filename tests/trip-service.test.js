"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const constants_1 = require("../miniprogram/shared/constants");
const errors_1 = require("../miniprogram/shared/errors");
const storage_adapter_1 = require("../miniprogram/repositories/storage-adapter");
const trip_service_1 = require("../miniprogram/services/trip-service");
function createService(initialState = (0, constants_1.createInitialAppState)()) {
    const storage = new storage_adapter_1.MemoryStorageAdapter(initialState);
    const service = new trip_service_1.TripService(storage);
    return {
        storage,
        service
    };
}
function authorizeActiveUser(service, nickname = "已授权用户") {
    service.authorizeProfile({
        nickname,
        avatarUrl: ""
    });
}
function withMockedNow(timestamp, callback) {
    const originalNow = Date.now;
    Date.now = () => timestamp;
    try {
        return callback();
    }
    finally {
        Date.now = originalNow;
    }
}
function expectBusinessError(action, code) {
    try {
        const result = action();
        if (result instanceof Promise) {
            return result.then(() => strict_1.default.fail(`Expected ${code}`), (error) => {
                strict_1.default.ok(error instanceof errors_1.BusinessError);
                strict_1.default.equal(error.code, code);
            });
        }
        strict_1.default.fail(`Expected ${code}`);
    }
    catch (error) {
        strict_1.default.ok(error instanceof errors_1.BusinessError);
        strict_1.default.equal(error.code, code);
    }
}
(async () => {
    var _a, _b, _c, _d, _e, _f, _g;
    {
        const { service } = createService();
        const bootstrap = service.bootstrapApp();
        strict_1.default.equal(bootstrap.homeMode, "trip");
        strict_1.default.equal(bootstrap.homeTitle, constants_1.DEFAULT_HOME_TITLE);
        strict_1.default.equal(bootstrap.currentTripLabel, "1车");
        strict_1.default.equal(bootstrap.canEditHomeTitle, false);
        strict_1.default.equal(bootstrap.currentTrip.tripMeta.tripId, constants_1.FIXED_TRIP_IDS.trip1);
        strict_1.default.equal(bootstrap.currentTrip.tripMeta.tripName, "1车");
        strict_1.default.equal(bootstrap.currentTrip.tripMeta.viewerRole, "member");
        strict_1.default.equal(bootstrap.tripSwitchOptions.length, 2);
        strict_1.default.deepEqual(bootstrap.tripSwitchOptions.map((option) => ({
            tripId: option.tripId,
            isSelected: option.isSelected,
            isOwnedByViewer: option.isOwnedByViewer,
            isReadOnly: option.isReadOnly
        })), [
            {
                tripId: constants_1.FIXED_TRIP_IDS.trip1,
                isSelected: true,
                isOwnedByViewer: true,
                isReadOnly: false
            },
            {
                tripId: constants_1.FIXED_TRIP_IDS.trip2,
                isSelected: false,
                isOwnedByViewer: true,
                isReadOnly: false
            }
        ]);
    }
    {
        const legacyState = (0, constants_1.createInitialAppState)();
        legacyState.version = 11;
        legacyState.activeUserId = "user-3";
        legacyState.users["user-1"].currentTripId = constants_1.FIXED_TRIP_IDS.trip2;
        const { storage, service } = createService(legacyState);
        const bootstrap = service.bootstrapApp();
        strict_1.default.equal(bootstrap.currentUser.id, "user-1");
        strict_1.default.equal(bootstrap.currentTrip.tripMeta.tripId, constants_1.FIXED_TRIP_IDS.trip1);
        strict_1.default.equal((_a = storage.getState()) === null || _a === void 0 ? void 0 : _a.runtimeConfig.homeTitle, constants_1.DEFAULT_HOME_TITLE);
    }
    {
        const state = (0, constants_1.createInitialAppState)();
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
            memberTripId: constants_1.FIXED_TRIP_IDS.trip1,
            currentTripId: constants_1.FIXED_TRIP_IDS.trip1,
            isAuthorized: true,
            boardingRecordsByTripId: {}
        };
        state.activeUserId = "cloud-openid-user";
        const { storage, service } = createService(state);
        const bootstrap = service.bootstrapApp();
        const repairedState = storage.getState();
        strict_1.default.equal(bootstrap.currentTrip.tripMeta.tripId, constants_1.FIXED_TRIP_IDS.trip1);
        strict_1.default.equal(bootstrap.currentTrip.tripMeta.viewerRole, "member");
        strict_1.default.equal(repairedState === null || repairedState === void 0 ? void 0 : repairedState.tripMembers.some((member) => member.tripId === constants_1.FIXED_TRIP_IDS.trip1 && member.userId === "cloud-openid-user"), true);
        strict_1.default.equal(repairedState === null || repairedState === void 0 ? void 0 : repairedState.tripMembers.some((member) => member.tripId === constants_1.FIXED_TRIP_IDS.trip2 && member.userId === "cloud-openid-user"), true);
    }
    {
        const { service } = createService();
        authorizeActiveUser(service, "阿山");
        const bootstrap = service.switchCurrentTrip(constants_1.FIXED_TRIP_IDS.trip2);
        const profilePage = service.getProfilePageData();
        const toolsPage = service.getToolsPageData();
        const toolDetail = service.getToolDetailPageData("vote");
        strict_1.default.equal(bootstrap.currentTrip.tripMeta.tripId, constants_1.FIXED_TRIP_IDS.trip2);
        strict_1.default.equal(bootstrap.currentTrip.tripMeta.viewerRole, "member");
        strict_1.default.equal(bootstrap.currentTrip.tripMeta.isReadOnlyView, false);
        strict_1.default.equal(bootstrap.viewerSeatSummary, "1车 1A");
        strict_1.default.equal(bootstrap.boardingButton.isDisabled, true);
        strict_1.default.equal(bootstrap.boardingButton.disabledReason, "seat-in-other-trip");
        strict_1.default.equal(profilePage.currentTripTitle, "2车");
        strict_1.default.equal(profilePage.currentRoleLabel, "成员");
        strict_1.default.equal(toolsPage.tripName, "2车");
        strict_1.default.equal(toolsPage.toolCards.every((tool) => tool.canEnter), true);
        strict_1.default.equal(toolDetail.tripName, "2车");
        strict_1.default.equal(toolDetail.viewerRoleLabel, "成员");
    }
    {
        const { service } = createService();
        const toolsPage = service.getToolsPageData();
        const toolDetail = service.getToolDetailPageData("wheel");
        strict_1.default.equal(toolsPage.tripName, "1车");
        strict_1.default.equal(toolsPage.isAuthorized, false);
        strict_1.default.equal(toolsPage.toolCards.every((tool) => tool.canEnter), true);
        strict_1.default.equal(toolDetail.isStarted, false);
        strict_1.default.equal(toolDetail.isAdmin, false);
    }
    {
        const { service } = createService();
        service.switchActiveUser("user-2");
        authorizeActiveUser(service, "阿山");
        const claimed = service.claimSeat("1B");
        strict_1.default.equal(claimed.currentTrip.tripMeta.viewerSeatCode, "1B");
        const switched = service.switchSeat("1C");
        strict_1.default.equal(switched.currentTrip.tripMeta.viewerSeatCode, "1C");
        const released = service.releaseMySeat();
        strict_1.default.equal(released.currentTrip.tripMeta.viewerSeatCode, null);
    }
    {
        const { service } = createService();
        authorizeActiveUser(service, "小雨");
        const switched = service.switchCurrentTrip(constants_1.FIXED_TRIP_IDS.trip2);
        strict_1.default.equal(switched.viewerSeatSummary, "1车 1A");
        strict_1.default.equal(switched.boardingButton.isDisabled, true);
        strict_1.default.equal(switched.boardingButton.disabledReason, "seat-in-other-trip");
        const moved = service.claimSeat("1B");
        strict_1.default.equal(moved.currentTrip.tripMeta.tripId, constants_1.FIXED_TRIP_IDS.trip2);
        strict_1.default.equal(moved.currentTrip.tripMeta.viewerSeatCode, "1B");
        strict_1.default.equal(moved.viewerSeatSummary, "2车 1B");
        service.switchCurrentTrip(constants_1.FIXED_TRIP_IDS.trip1);
        strict_1.default.equal(service.bootstrapApp().currentTrip.tripMeta.viewerSeatCode, null);
    }
    {
        const { service } = createService();
        authorizeActiveUser(service, "小雨");
        const baseTime = Date.parse("2026-04-25T12:33:00+08:00");
        const firstToggle = withMockedNow(baseTime, () => service.toggleBoardingCheckIn());
        strict_1.default.equal(firstToggle.action, "checked-in");
        strict_1.default.equal(firstToggle.result.viewerSeatSummary, "1车 1A");
        strict_1.default.equal(firstToggle.result.boardingButton.label, "已上车");
        strict_1.default.equal(firstToggle.result.boardingButton.isActive, true);
        strict_1.default.equal(firstToggle.result.boardingButton.isDisabled, false);
        const recordPage = withMockedNow(baseTime, () => service.getBoardingRecordPageData());
        strict_1.default.equal(recordPage.isAdmin, false);
        strict_1.default.equal(recordPage.flatRecords.length, 1);
        strict_1.default.equal(recordPage.flatRecords[0].nickname, "小雨");
        strict_1.default.equal(recordPage.flatRecords[0].formattedTime, "2026年04月25日 12:33");
        const cancelToggle = withMockedNow(baseTime + 5000, () => service.toggleBoardingCheckIn());
        strict_1.default.equal(cancelToggle.action, "cancelled");
        strict_1.default.equal(cancelToggle.result.boardingButton.label, "上车");
        strict_1.default.equal(cancelToggle.result.boardingButton.isActive, false);
        strict_1.default.equal(service.getBoardingRecordPageData().flatRecords.length, 0);
    }
    {
        const { service } = createService();
        authorizeActiveUser(service, "小雨");
        const baseTime = Date.parse("2026-04-25T12:33:00+08:00");
        withMockedNow(baseTime, () => service.toggleBoardingCheckIn());
        const lockedBootstrap = withMockedNow(baseTime + 11000, () => service.bootstrapApp());
        strict_1.default.equal(lockedBootstrap.boardingButton.label, "已上车");
        strict_1.default.equal(lockedBootstrap.boardingButton.isDisabled, true);
        const resetBootstrap = withMockedNow(baseTime + 601000, () => service.bootstrapApp());
        strict_1.default.equal(resetBootstrap.boardingButton.label, "上车");
        strict_1.default.equal(resetBootstrap.boardingButton.isActive, false);
        strict_1.default.equal(resetBootstrap.boardingButton.isDisabled, false);
        const historyPage = withMockedNow(baseTime + 601000, () => service.getBoardingRecordPageData());
        strict_1.default.equal(historyPage.flatRecords.length, 1);
    }
    {
        const state = (0, constants_1.createInitialAppState)();
        state.runtimeConfig.tripAdminUserIds[constants_1.FIXED_TRIP_IDS.trip1] = "user-1";
        state.runtimeConfig.tripAdminUserIds[constants_1.FIXED_TRIP_IDS.trip2] = "user-3";
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
        strict_1.default.equal(adminRecordPage.isAdmin, true);
        strict_1.default.equal(adminRecordPage.selectedTripFilter, "all");
        strict_1.default.deepEqual(adminRecordPage.memberGroups.map((group) => `${group.tripLabel}-${group.nickname}-${group.seatLabel}`), [
            "1车-小雨-1A",
            "1车-阿山-未入座",
            "1车-Miya-未入座",
            "1车-老周-未入座",
            "2车-Miya-1A",
            "2车-小雨-未入座",
            "2车-阿山-未入座",
            "2车-老周-未入座"
        ]);
        strict_1.default.equal(adminRecordPage.memberGroups[0].records.length, 1);
        strict_1.default.equal(adminRecordPage.memberGroups[1].records.length, 0);
        strict_1.default.equal(adminRecordPage.memberGroups[4].records[0].formattedTime, "2026年04月25日 12:34");
        strict_1.default.deepEqual(trip1OnlyRecordPage.memberGroups.map((group) => group.tripLabel), ["1车", "1车", "1车", "1车"]);
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
        service.switchCurrentTrip(constants_1.FIXED_TRIP_IDS.trip2);
        const claimed = service.claimSeat("1B");
        strict_1.default.equal(claimed.currentTrip.tripMeta.tripId, constants_1.FIXED_TRIP_IDS.trip2);
        strict_1.default.equal(claimed.currentTrip.tripMeta.viewerSeatCode, "1B");
        const favorited = service.toggleFavoriteMember("user-3");
        strict_1.default.equal((_b = favorited.currentTrip.members.find((member) => member.userId === "user-3")) === null || _b === void 0 ? void 0 : _b.isFavoritedByViewer, true);
        expectBusinessError(() => service.publishVoteTool({
            topic: "晚饭吃什么",
            options: ["火锅", "烧烤"],
            selectionMode: "single",
            excludeAdmin: false
        }), "ADMIN_ONLY");
    }
    {
        const { service } = createService();
        authorizeActiveUser(service, "小雨");
        service.toggleFavoriteMember("user-2");
        service.switchCurrentTrip(constants_1.FIXED_TRIP_IDS.trip2);
        const favoritesPage = service.getFavoritesPageData();
        strict_1.default.equal(favoritesPage.tripName, "2车");
        strict_1.default.equal(favoritesPage.favoriteCount, 0);
        strict_1.default.equal(favoritesPage.showRankingTab, false);
    }
    {
        const { service } = createService();
        const passengersPage = service.getPassengerPageData();
        strict_1.default.equal(passengersPage.currentTripLabel, "1车");
        strict_1.default.deepEqual(passengersPage.filterOptions.map((option) => `${option.id}-${option.label}-${option.isSelected}`), ["all-全部-true", `${constants_1.FIXED_TRIP_IDS.trip1}-1车-false`, `${constants_1.FIXED_TRIP_IDS.trip2}-2车-false`]);
        strict_1.default.deepEqual(passengersPage.memberGroups.map((group) => `${group.tripLabel}-${group.memberCount}`), ["1车-4", "2车-4"]);
        strict_1.default.deepEqual(passengersPage.memberGroups[0].members.map((member) => `${member.nickname}-${member.seatDisplayLabel}-${member.detailMode}`), [
            "小雨-1车 1A-self-detail",
            "阿山-1车 未入座-member-detail",
            "Miya-1车 未入座-member-detail",
            "老周-1车 未入座-member-detail"
        ]);
        strict_1.default.deepEqual(passengersPage.memberGroups[1].members.map((member) => `${member.nickname}-${member.seatDisplayLabel}-${member.detailMode}`), [
            "Miya-2车 1A-readonly-member-detail",
            "小雨-2车 未入座-readonly-member-detail",
            "阿山-2车 未入座-readonly-member-detail",
            "老周-2车 未入座-readonly-member-detail"
        ]);
    }
    {
        const { storage, service } = createService();
        authorizeActiveUser(service, "小雨");
        service.enableSeedDemoData();
        const seededState = storage.getState();
        strict_1.default.equal(Object.keys((_c = seededState === null || seededState === void 0 ? void 0 : seededState.trips) !== null && _c !== void 0 ? _c : {}).sort().join(","), "trip-fixed-1,trip-fixed-2");
        strict_1.default.equal(Object.keys((_d = seededState === null || seededState === void 0 ? void 0 : seededState.users) !== null && _d !== void 0 ? _d : {}).length > 4, true);
        strict_1.default.equal(((_e = seededState === null || seededState === void 0 ? void 0 : seededState.tripMembers) !== null && _e !== void 0 ? _e : []).length > 4, true);
        strict_1.default.equal(seededState === null || seededState === void 0 ? void 0 : seededState.runtimeConfig.tripAdminUserIds[constants_1.FIXED_TRIP_IDS.trip1], "user-1");
        strict_1.default.equal(service.getProfilePageData().seedDemoEnabled, true);
        service.disableSeedDemoData();
        const resetState = storage.getState();
        strict_1.default.equal(Object.keys((_f = resetState === null || resetState === void 0 ? void 0 : resetState.users) !== null && _f !== void 0 ? _f : {}).length, 4);
        strict_1.default.equal(((_g = resetState === null || resetState === void 0 ? void 0 : resetState.tripMembers) !== null && _g !== void 0 ? _g : []).length, 8);
        strict_1.default.equal(resetState === null || resetState === void 0 ? void 0 : resetState.runtimeConfig.tripAdminUserIds[constants_1.FIXED_TRIP_IDS.trip1], null);
        strict_1.default.equal(service.getProfilePageData().seedDemoEnabled, false);
    }
    {
        const { service } = createService();
        const profilePage = service.getProfilePageData();
        strict_1.default.deepEqual(profilePage.demoUsers.map((user) => user.roleLabel), ["成员", "成员", "成员", "成员"]);
    }
    {
        const state = (0, constants_1.createInitialAppState)();
        state.runtimeConfig.tripAdminUserIds[constants_1.FIXED_TRIP_IDS.trip1] = "user-2";
        const { service } = createService(state);
        service.switchActiveUser("user-2");
        authorizeActiveUser(service, "阿山");
        const bootstrap = service.bootstrapApp();
        const settingsPage = service.getHomeSettingsPageData();
        strict_1.default.equal(bootstrap.canEditHomeTitle, true);
        strict_1.default.equal(bootstrap.currentTrip.tripMeta.viewerRole, "admin");
        strict_1.default.equal(settingsPage.canEditHomeTitle, true);
    }
    {
        const state = (0, constants_1.createInitialAppState)();
        state.runtimeConfig.tripAdminUserIds[constants_1.FIXED_TRIP_IDS.trip1] = "user-1";
        const { storage, service } = createService(state);
        authorizeActiveUser(service, "小雨");
        strict_1.default.equal(service.bootstrapApp().currentTrip.tripMeta.viewerRole, "admin");
        const nextState = storage.getState();
        nextState.runtimeConfig.tripAdminUserIds[constants_1.FIXED_TRIP_IDS.trip1] = "user-2";
        storage.setState(nextState);
        strict_1.default.equal(service.bootstrapApp().currentTrip.tripMeta.viewerRole, "member");
        service.switchActiveUser("user-2");
        strict_1.default.equal(service.bootstrapApp().currentTrip.tripMeta.viewerRole, "admin");
    }
    {
        const state = (0, constants_1.createInitialAppState)();
        state.runtimeConfig.tripAdminUserIds[constants_1.FIXED_TRIP_IDS.trip1] = "user-1";
        const { service } = createService(state);
        authorizeActiveUser(service, "小雨");
        await service.saveHomeTitle("银河列车");
        strict_1.default.equal(service.bootstrapApp().homeTitle, "银河列车");
        strict_1.default.equal(service.getHomeSettingsPageData().homeTitle, "银河列车");
    }
    {
        const { service } = createService();
        authorizeActiveUser(service, "小雨");
        await expectBusinessError(() => service.saveHomeTitle(""), "ADMIN_ONLY");
    }
    {
        const { service } = createService();
        expectBusinessError(() => service.createTrip({
            tripName: "新车次",
            departureTime: "2025-04-25 09:00",
            password: "123456",
            templateId: "template-49"
        }), "FIXED_TRIP_MODE");
        expectBusinessError(() => service.joinTripByPassword("123456"), "FIXED_TRIP_MODE");
        expectBusinessError(() => service.leaveCurrentTrip(), "FIXED_TRIP_MODE");
        expectBusinessError(() => service.dissolveCurrentTrip(), "FIXED_TRIP_MODE");
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

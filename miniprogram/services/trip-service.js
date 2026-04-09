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
function getTemplateLabel(templateId) {
    if (templateId === "template-49") {
        return "49 座";
    }
    if (templateId === "template-53") {
        return "53 座";
    }
    return "57 座";
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
        return Object.assign(Object.assign({}, this.buildAccessState(currentUser)), { emptyTitle: currentUser.currentTripId ? "工具页正在准备中" : "先创建或加入车次", emptyDescription: currentUser.currentTripId
                ? "这里会逐步补充更多乘车辅助工具。"
                : "创建或加入车次后，这里会出现更多和行程相关的工具。" });
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
                : "暂未加入", tags: currentTrip ? currentUser.tags : [], showTagsCard: Boolean(currentTrip), showPrimaryAction: Boolean(currentTrip), primaryActionKind, primaryActionLabel: primaryActionKind === "dissolve"
                ? "解散车次"
                : primaryActionKind === "leave"
                    ? "退出车次"
                    : "" });
    }
    getTagEditorData() {
        const currentUser = this.ensureAuthorizedAccess();
        const tripId = this.requireCurrentTripId(currentUser);
        const trip = this.tripRepository.getTrip(tripId);
        return this.buildTagEditorView(currentUser, trip.tripName);
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
        return this.updateTags(input.tagsInput);
    }
    updateTags(tagsInput) {
        const currentUser = this.ensureAuthorizedAccess();
        this.requireCurrentTripId(currentUser);
        this.userRepository.updateUser(currentUser.id, (user) => {
            user.tags = (0, format_1.parseTags)(tagsInput);
        });
        const nextUser = this.userRepository.getUser(currentUser.id);
        return this.buildTagEditorView(nextUser);
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
                var _a;
                if (trip.status !== "active") {
                    return;
                }
                const tripMembers = (_a = membersByTripId[trip.id]) !== null && _a !== void 0 ? _a : [];
                if (!tripMembers.length) {
                    trip.status = "dissolved";
                    trip.seatMap = (0, seat_1.createSeatMap)(trip.seatCodes);
                    return;
                }
                const hasAdmin = tripMembers.some((member) => member.role === "admin");
                if (!hasAdmin) {
                    const promotedMember = [...tripMembers].sort((left, right) => {
                        if (left.joinedAt !== right.joinedAt) {
                            return left.joinedAt - right.joinedAt;
                        }
                        return left.userId.localeCompare(right.userId);
                    })[0];
                    promotedMember.role = "admin";
                }
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
    getCurrentSeatCode(tripId, userId) {
        const trip = this.tripRepository.getTrip(tripId);
        return (0, seat_1.findSeatCodeByUserId)(trip.seatMap, userId);
    }
    buildAccessState(currentUser) {
        return {
            currentUser,
            isAuthorized: currentUser.isAuthorized,
            hasCurrentTrip: Boolean(currentUser.currentTripId)
        };
    }
    buildDemoUsers(activeUserId) {
        return this.userRepository.listUsers().map((user) => {
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
        return {
            currentUser,
            currentUserInitial: (0, format_1.getInitial)(currentUser.nickname),
            currentTripTitle: (0, format_1.displayTripName)(tripName !== null && tripName !== void 0 ? tripName : this.getCurrentTripName(currentUser)),
            tags: currentUser.tags,
            tagsInput: currentUser.tags.join("，"),
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

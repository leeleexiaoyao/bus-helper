import { TRIP_TEMPLATES } from "../shared/constants";
import { BusinessError } from "../shared/errors";
import {
  buildSeatOccupantMap,
  buildSeatRows,
  createSeatMap,
  findSeatCodeByUserId,
  generateSeatCodes,
  sortMembers
} from "../shared/seat";
import type {
  AccessStateViewModel,
  AuthorizeProfileInput,
  BootstrapResult,
  ClaimSeatProfileInput,
  CreateTripInput,
  CurrentTripViewModel,
  DemoUserOption,
  ProfilePageViewModel,
  ProfilePrimaryActionKind,
  MemberRole,
  MemberView,
  TagEditorViewModel,
  Trip,
  TripMetaView,
  TripSettingsViewModel,
  ToolsPageViewModel,
  UpdateProfileInput,
  User
} from "../shared/types";
import {
  displayDepartureTime,
  displayTripName,
  getInitial,
  parseTags
} from "../utils/format";
import { createId } from "../utils/id";
import { AppStateRepository } from "../repositories/app-state-repository";
import { SessionRepository } from "../repositories/session-repository";
import type { StorageAdapter } from "../repositories/storage-adapter";
import { wxStorageAdapter } from "../repositories/storage-adapter";
import { TripRepository } from "../repositories/trip-repository";
import { UserRepository } from "../repositories/user-repository";

function assertTripName(tripName: string): void {
  if (!tripName.trim()) {
    throw new BusinessError("INVALID_TRIP_NAME", "请填写车次名称。");
  }
}

function assertPassword(password: string): void {
  if (!/^\d{6}$/.test(password)) {
    throw new BusinessError("INVALID_PASSWORD", "请输入 6 位数字密码。");
  }
}

function assertTemplateExists(templateId: string): void {
  if (!TRIP_TEMPLATES.some((template) => template.id === templateId)) {
    throw new BusinessError("INVALID_TEMPLATE", "请选择座位模板。");
  }
}

function assertNickname(nickname: string, fallback?: string): string {
  const trimmed = nickname.trim();
  if (trimmed) {
    return trimmed;
  }
  if (fallback) {
    return fallback;
  }
  throw new BusinessError("INVALID_NICKNAME", "请填写昵称。");
}

function getTemplateLabel(templateId: string): string {
  if (templateId === "template-49") {
    return "49 座";
  }
  if (templateId === "template-53") {
    return "53 座";
  }
  return "57 座";
}

export class TripService {
  private readonly appStateRepository: AppStateRepository;
  private readonly userRepository: UserRepository;
  private readonly tripRepository: TripRepository;
  private readonly sessionRepository: SessionRepository;

  constructor(storageAdapter: StorageAdapter = wxStorageAdapter) {
    this.appStateRepository = new AppStateRepository(storageAdapter);
    this.userRepository = new UserRepository(this.appStateRepository);
    this.tripRepository = new TripRepository(this.appStateRepository);
    this.sessionRepository = new SessionRepository(this.appStateRepository);
  }

  bootstrapApp(): BootstrapResult {
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

  ensureAuthorizedAccess(): User {
    const currentUser = this.getActiveUser();
    this.assertAuthorizedUser(currentUser);
    return currentUser;
  }

  getToolsPageData(): ToolsPageViewModel {
    const currentUser = this.getActiveUser();
    return {
      ...this.buildAccessState(currentUser),
      emptyTitle: currentUser.currentTripId ? "工具页正在准备中" : "先创建或加入车次",
      emptyDescription: currentUser.currentTripId
        ? "这里会逐步补充更多乘车辅助工具。"
        : "创建或加入车次后，这里会出现更多和行程相关的工具。"
    };
  }

  getProfilePageData(): ProfilePageViewModel {
    const currentUser = this.getActiveUser();
    const currentTrip = currentUser.currentTripId
      ? this.buildCurrentTripView(currentUser.currentTripId, currentUser.id)
      : null;
    const primaryActionKind = this.getProfilePrimaryActionKind(currentTrip);

    return {
      ...this.buildAccessState(currentUser),
      demoUsers: this.buildDemoUsers(currentUser.id),
      currentUserInitial: getInitial(currentUser.nickname),
      currentTripTitle: currentTrip?.tripMeta.tripName ?? "未加入车次",
      currentSeatLabel: currentTrip?.tripMeta.viewerSeatCode ?? "未入座",
      currentRoleLabel: currentTrip
        ? currentTrip.tripMeta.viewerRole === "admin"
          ? "管理员"
          : "普通成员"
        : "暂未加入",
      tags: currentTrip ? currentUser.tags : [],
      showTagsCard: Boolean(currentTrip),
      showPrimaryAction: Boolean(currentTrip),
      primaryActionKind,
      primaryActionLabel:
        primaryActionKind === "dissolve"
          ? "解散车次"
          : primaryActionKind === "leave"
            ? "退出车次"
            : ""
    };
  }

  getTagEditorData(): TagEditorViewModel {
    const currentUser = this.ensureAuthorizedAccess();
    const tripId = this.requireCurrentTripId(currentUser);
    const trip = this.tripRepository.getTrip(tripId);
    return this.buildTagEditorView(currentUser, trip.tripName);
  }

  getTripSettings(): TripSettingsViewModel {
    const currentUser = this.getActiveUser();
    this.assertAuthorizedUser(currentUser);
    if (!currentUser.currentTripId) {
      throw new BusinessError("TRIP_REQUIRED", "你当前不在任何车次中。");
    }

    const trip = this.tripRepository.getTrip(currentUser.currentTripId);
    const relation = this.requireMembership(currentUser.currentTripId, currentUser.id);
    return {
      tripId: trip.id,
      tripName: displayTripName(trip.tripName),
      departureTime: displayDepartureTime(trip.departureTime),
      password: trip.password,
      templateId: trip.templateId,
      role: relation.role
    };
  }

  switchActiveUser(userId: string): BootstrapResult {
    this.userRepository.getUser(userId);
    this.sessionRepository.setActiveUserId(userId);
    return this.bootstrapApp();
  }

  updateProfile(input: UpdateProfileInput): TagEditorViewModel {
    return this.updateTags(input.tagsInput);
  }

  updateTags(tagsInput: string): TagEditorViewModel {
    const currentUser = this.ensureAuthorizedAccess();
    this.requireCurrentTripId(currentUser);

    this.userRepository.updateUser(currentUser.id, (user) => {
      user.tags = parseTags(tagsInput);
    });

    const nextUser = this.userRepository.getUser(currentUser.id);
    return this.buildTagEditorView(nextUser);
  }

  authorizeProfile(input: AuthorizeProfileInput): BootstrapResult {
    const currentUser = this.getActiveUser();
    this.userRepository.updateUser(currentUser.id, (user) => {
      user.isAuthorized = true;
      user.nickname = assertNickname(input.nickname, user.nickname);
      user.avatarUrl = input.avatarUrl.trim() || user.avatarUrl;
    });
    return this.bootstrapApp();
  }

  createTrip(input: CreateTripInput): BootstrapResult {
    const currentUser = this.getActiveUser();
    this.assertAuthorizedUser(currentUser);
    this.assertUserIsFree(currentUser);
    assertTripName(input.tripName);
    assertPassword(input.password);
    assertTemplateExists(input.templateId);
    this.tripRepository.ensurePasswordAvailable(input.password);

    const seatCodes = generateSeatCodes(input.templateId);
    const tripId = createId("trip");
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
      seatMap: createSeatMap(seatCodes),
      createdAt
    });

    this.tripRepository.addTripMember(tripId, currentUser.id, "admin", createdAt);
    this.userRepository.setCurrentTripId(currentUser.id, tripId);
    return this.bootstrapApp();
  }

  joinTripByPassword(password: string): BootstrapResult {
    const currentUser = this.getActiveUser();
    this.assertAuthorizedUser(currentUser);
    this.assertUserIsFree(currentUser);
    assertPassword(password);

    const trip = this.tripRepository.findActiveTripByPassword(password);
    if (!trip) {
      throw new BusinessError("TRIP_NOT_FOUND", "密码错误或车次不存在。");
    }

    this.tripRepository.addTripMember(trip.id, currentUser.id, "member", Date.now());
    this.userRepository.setCurrentTripId(currentUser.id, trip.id);
    return this.bootstrapApp();
  }

  leaveCurrentTrip(): BootstrapResult {
    const currentUser = this.getActiveUser();
    this.assertAuthorizedUser(currentUser);
    if (!currentUser.currentTripId) {
      throw new BusinessError("TRIP_REQUIRED", "你当前不在任何车次中。");
    }

    const relation = this.requireMembership(currentUser.currentTripId, currentUser.id);
    if (relation.role === "admin") {
      throw new BusinessError("ADMIN_CANNOT_LEAVE", "管理员请先解散车次。");
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

  dissolveCurrentTrip(): BootstrapResult {
    const currentUser = this.getActiveUser();
    this.assertAuthorizedUser(currentUser);
    if (!currentUser.currentTripId) {
      throw new BusinessError("TRIP_REQUIRED", "你当前不在任何车次中。");
    }

    const relation = this.requireMembership(currentUser.currentTripId, currentUser.id);
    if (relation.role !== "admin") {
      throw new BusinessError("ADMIN_ONLY", "只有管理员可以解散车次。");
    }

    const tripId = currentUser.currentTripId;
    const memberRelations = this.tripRepository.listTripMembers(tripId);
    memberRelations.forEach((memberRelation) => {
      this.userRepository.setCurrentTripId(memberRelation.userId, null);
    });

    this.tripRepository.removeAllTripMembers(tripId);
    this.tripRepository.updateTrip(tripId, (trip) => {
      trip.status = "dissolved";
      trip.seatMap = createSeatMap(trip.seatCodes);
    });

    return this.bootstrapApp();
  }

  claimSeat(seatCode: string, profileInput?: ClaimSeatProfileInput): BootstrapResult {
    const currentUser = this.getActiveUser();
    this.assertAuthorizedUser(currentUser);
    const tripId = this.requireCurrentTripId(currentUser);
    this.requireMembership(tripId, currentUser.id);

    const trip = this.tripRepository.getTrip(tripId);
    if (!Object.prototype.hasOwnProperty.call(trip.seatMap, seatCode)) {
      throw new BusinessError("SEAT_NOT_FOUND", "未找到这个座位。");
    }

    if (this.getCurrentSeatCode(tripId, currentUser.id)) {
      throw new BusinessError("ALREADY_SEATED", "你已经入座了。");
    }

    if (trip.seatMap[seatCode]) {
      throw new BusinessError("SEAT_OCCUPIED", "这个座位已经有人了。");
    }

    this.tripRepository.updateTrip(tripId, (draftTrip) => {
      draftTrip.seatMap[seatCode] = currentUser.id;
    });

    return this.bootstrapApp();
  }

  switchSeat(targetSeatCode: string): BootstrapResult {
    const currentUser = this.getActiveUser();
    this.assertAuthorizedUser(currentUser);
    const tripId = this.requireCurrentTripId(currentUser);
    this.requireMembership(tripId, currentUser.id);
    const currentSeatCode = this.getCurrentSeatCode(tripId, currentUser.id);
    if (!currentSeatCode) {
      throw new BusinessError("SEAT_REQUIRED", "你还没有入座。");
    }

    const trip = this.tripRepository.getTrip(tripId);
    if (!Object.prototype.hasOwnProperty.call(trip.seatMap, targetSeatCode)) {
      throw new BusinessError("SEAT_NOT_FOUND", "未找到这个座位。");
    }

    if (trip.seatMap[targetSeatCode]) {
      throw new BusinessError("SEAT_OCCUPIED", "该座位已被占用。");
    }

    this.tripRepository.updateTrip(tripId, (draftTrip) => {
      draftTrip.seatMap[targetSeatCode] = currentUser.id;
      draftTrip.seatMap[currentSeatCode] = null;
    });

    return this.bootstrapApp();
  }

  releaseMySeat(): BootstrapResult {
    const currentUser = this.getActiveUser();
    this.assertAuthorizedUser(currentUser);
    const tripId = this.requireCurrentTripId(currentUser);
    const currentSeatCode = this.getCurrentSeatCode(tripId, currentUser.id);
    if (!currentSeatCode) {
      throw new BusinessError("SEAT_REQUIRED", "你当前还没有座位。");
    }

    this.tripRepository.updateTrip(tripId, (trip) => {
      trip.seatMap[currentSeatCode] = null;
    });
    return this.bootstrapApp();
  }

  adminReleaseSeat(targetUserId: string): BootstrapResult {
    const currentUser = this.getActiveUser();
    this.assertAuthorizedUser(currentUser);
    const tripId = this.requireCurrentTripId(currentUser);
    const relation = this.requireMembership(tripId, currentUser.id);
    if (relation.role !== "admin") {
      throw new BusinessError("ADMIN_ONLY", "只有管理员可以解除他人座位。");
    }

    if (targetUserId === currentUser.id) {
      throw new BusinessError("SELF_RELEASE_ONLY", "请从自己的座位卡中解除当前座位。");
    }

    const targetSeatCode = this.getCurrentSeatCode(tripId, targetUserId);
    if (!targetSeatCode) {
      throw new BusinessError("TARGET_NOT_SEATED", "对方当前还没有入座。");
    }

    this.tripRepository.updateTrip(tripId, (trip) => {
      trip.seatMap[targetSeatCode] = null;
    });
    return this.bootstrapApp();
  }

  private getActiveUser(): User {
    this.repairState();
    return this.userRepository.getUser(this.sessionRepository.getActiveUserId());
  }

  private repairState(): void {
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

      const dedupedMembers = new Map<string, (typeof state.tripMembers)[number]>();
      state.tripMembers.forEach((member) => {
        const key = `${member.tripId}:${member.userId}`;
        const existing = dedupedMembers.get(key);
        if (!existing) {
          dedupedMembers.set(key, { ...member });
          return;
        }

        existing.role = existing.role === "admin" || member.role === "admin" ? "admin" : "member";
        existing.joinedAt = Math.min(existing.joinedAt, member.joinedAt);
      });
      state.tripMembers = Array.from(dedupedMembers.values());

      const initialMembershipSet = new Set(
        state.tripMembers.map((member) => `${member.tripId}:${member.userId}`)
      );

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

      const membersByTripId = state.tripMembers.reduce<
        Record<string, typeof state.tripMembers>
      >((accumulator, member) => {
        if (!accumulator[member.tripId]) {
          accumulator[member.tripId] = [];
        }
        accumulator[member.tripId].push(member);
        return accumulator;
      }, {});

      Object.values(state.trips).forEach((trip) => {
        if (trip.status !== "active") {
          return;
        }

        const tripMembers = membersByTripId[trip.id] ?? [];
        if (!tripMembers.length) {
          trip.status = "dissolved";
          trip.seatMap = createSeatMap(trip.seatCodes);
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

      const validMembershipSet = new Set(
        state.tripMembers.map((member) => `${member.tripId}:${member.userId}`)
      );

      Object.values(state.trips).forEach((trip) => {
        const seenUsers = new Set<string>();

        Object.keys(trip.seatMap).forEach((seatCode) => {
          const occupiedUserId = trip.seatMap[seatCode];
          if (!occupiedUserId) {
            return;
          }

          const user = state.users[occupiedUserId];
          const hasValidMembership = validMembershipSet.has(`${trip.id}:${occupiedUserId}`);
          const isValid =
            trip.status === "active" &&
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

  private assertUserIsFree(user: User): void {
    if (user.currentTripId) {
      throw new BusinessError("USER_BUSY", "当前身份已经在其他车次里了。");
    }
  }

  private assertAuthorizedUser(user: User): void {
    if (!user.isAuthorized) {
      throw new BusinessError("AUTH_REQUIRED", "请先完成微信授权。");
    }
  }

  private requireCurrentTripId(user: User): string {
    if (!user.currentTripId) {
      throw new BusinessError("TRIP_REQUIRED", "你当前不在任何车次中。");
    }
    return user.currentTripId;
  }

  private requireMembership(tripId: string, userId: string) {
    const relation = this.tripRepository.getTripMember(tripId, userId);
    if (!relation) {
      throw new BusinessError("MEMBER_REQUIRED", "你不在当前车次成员列表中。");
    }
    return relation;
  }

  private getCurrentSeatCode(tripId: string, userId: string): string | null {
    const trip = this.tripRepository.getTrip(tripId);
    return findSeatCodeByUserId(trip.seatMap, userId);
  }

  private buildAccessState(currentUser: User): AccessStateViewModel {
    return {
      currentUser,
      isAuthorized: currentUser.isAuthorized,
      hasCurrentTrip: Boolean(currentUser.currentTripId)
    };
  }

  private buildDemoUsers(activeUserId: string): DemoUserOption[] {
    return this.userRepository.listUsers().map((user) => {
      const tripName = user.currentTripId
        ? displayTripName(this.tripRepository.getTrip(user.currentTripId).tripName)
        : "未加入车次";

      return {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        initial: getInitial(user.nickname),
        isActive: user.id === activeUserId,
        currentTripName: tripName,
        switchLabel: user.id === activeUserId ? "已选中" : "切换"
      };
    });
  }

  private getProfilePrimaryActionKind(
    currentTrip: CurrentTripViewModel | null
  ): ProfilePrimaryActionKind {
    if (!currentTrip) {
      return "none";
    }
    return currentTrip.tripMeta.viewerRole === "admin" ? "dissolve" : "leave";
  }

  private buildTagEditorView(currentUser: User, tripName?: string): TagEditorViewModel {
    return {
      currentUser,
      currentUserInitial: getInitial(currentUser.nickname),
      currentTripTitle: displayTripName(tripName ?? this.getCurrentTripName(currentUser)),
      tags: currentUser.tags,
      tagsInput: currentUser.tags.join("，"),
      previewTags: currentUser.tags
    };
  }

  private getCurrentTripName(currentUser: User): string {
    if (!currentUser.currentTripId) {
      return "";
    }
    return this.tripRepository.getTrip(currentUser.currentTripId).tripName;
  }

  private buildCurrentTripView(tripId: string, viewerId: string): CurrentTripViewModel {
    const trip = this.tripRepository.getTrip(tripId);
    if (trip.status !== "active") {
      throw new BusinessError("TRIP_INACTIVE", "当前车次已经结束。");
    }

    const members = this.buildMemberViews(trip, viewerId);
    const seatMap = buildSeatOccupantMap(trip.seatMap, members);
    const viewerRole = members.find((member) => member.userId === viewerId)?.role ?? "member";
    const viewerSeatCode = members.find((member) => member.userId === viewerId)?.seatCode ?? null;

    const tripMeta: TripMetaView = {
      tripId: trip.id,
      tripName: displayTripName(trip.tripName),
      departureTime: displayDepartureTime(trip.departureTime),
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
      seatRows: buildSeatRows(trip.seatCodes, seatMap, viewerId),
      members
    };
  }

  private buildMemberViews(trip: Trip, viewerId: string): MemberView[] {
    const relations = this.tripRepository.listTripMembers(trip.id);

    return relations
      .map((relation) => {
        const user = this.userRepository.getUser(relation.userId);
        const seatCode = findSeatCodeByUserId(trip.seatMap, user.id);
        return {
          userId: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          initial: getInitial(user.nickname),
          tags: user.tags,
          role: relation.role as MemberRole,
          isAdmin: relation.role === "admin",
          showMeta: relation.role === "admin" || user.id === viewerId,
          seatCode,
          seatLabel: seatCode ?? "未入座",
          isSelf: user.id === viewerId
        };
      })
      .sort(sortMembers);
  }
}

export const tripService = new TripService();

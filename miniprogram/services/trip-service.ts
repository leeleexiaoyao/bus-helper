import {
  DEMO_SWITCHABLE_USER_IDS,
  TOOL_META,
  TOOL_TYPES,
  TRIP_TEMPLATES,
  createEmptyTripTools
} from "../shared/constants";
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
  LotteryDetailView,
  LotteryParticipantView,
  LotteryPublishInput,
  MemberRole,
  MemberView,
  ProfilePageViewModel,
  ProfilePrimaryActionKind,
  PublishedLotteryToolState,
  PublishedSeatDrawToolState,
  PublishedToolState,
  PublishedVoteToolState,
  PublishedWheelToolState,
  SeatDrawDetailView,
  SeatDrawPublishInput,
  TagEditorViewModel,
  ToolCardView,
  ToolDetailViewModel,
  ToolMemberSnapshot,
  ToolResultMemberView,
  ToolType,
  Trip,
  TripMetaView,
  TripSettingsViewModel,
  VoteChoice,
  VoteDetailView,
  VoteOption,
  VotePublishInput,
  VoteSelectionMode,
  VoteSubmitInput,
  WheelDetailView,
  WheelPublishInput,
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

const SEAT_DRAW_MAX_COUNT = 5;
const SEAT_DRAW_ROLLING_DURATION_MS = 3000;

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

function assertVoteTopic(topic: string): string {
  const trimmed = topic.trim();
  if (!trimmed) {
    throw new BusinessError("INVALID_VOTE_TOPIC", "请填写投票议题。");
  }
  return trimmed;
}

function assertSeatDrawTopic(topic: string): string {
  const trimmed = topic.trim();
  if (!trimmed) {
    throw new BusinessError("INVALID_SEAT_DRAW_TOPIC", "请填写抽号主题。");
  }
  if (trimmed.length > 10) {
    throw new BusinessError("SEAT_DRAW_TOPIC_TOO_LONG", "主题最多输入 10 个字。");
  }
  return trimmed;
}

function assertVoteChoice(choice: VoteChoice): VoteChoice {
  if (!["approve", "reject", "abstain"].includes(choice)) {
    throw new BusinessError("INVALID_VOTE_CHOICE", "未识别的投票选项。");
  }
  return choice;
}

function assertVoteSelectionMode(selectionMode: VoteSelectionMode): VoteSelectionMode {
  if (!["single", "multiple"].includes(selectionMode)) {
    throw new BusinessError("INVALID_VOTE_MODE", "未识别的投票方式。");
  }
  return selectionMode;
}

function assertVoteOptions(options: string[]): string[] {
  const normalized = options
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 49);

  if (!normalized.length) {
    throw new BusinessError("INVALID_VOTE_OPTIONS", "请至少填写 1 个投票选项。");
  }

  const uniqueSize = new Set(normalized).size;
  if (uniqueSize !== normalized.length) {
    throw new BusinessError("DUPLICATE_VOTE_OPTIONS", "投票选项不能重复。");
  }

  return normalized;
}

function assertWheelItems(items: string[]): string[] {
  const normalized = items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 49);

  if (normalized.length < 2) {
    throw new BusinessError("INVALID_WHEEL_ITEMS", "请至少填写 2 个转盘内容。");
  }

  return normalized;
}

function assertPositiveCount(count: number, code: string, message: string): number {
  const normalized = Number(count);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new BusinessError(code, message);
  }
  return normalized;
}

function assertSeatDrawCount(count: number): number {
  const normalized = assertPositiveCount(count, "INVALID_DRAW_COUNT", "请选择正确的抽号人数。");
  if (normalized > SEAT_DRAW_MAX_COUNT) {
    throw new BusinessError("DRAW_COUNT_LIMIT_EXCEEDED", "单次抽号人数最多为 5 人。");
  }
  return normalized;
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

function uniqueByUserId(entries: ToolMemberSnapshot[]): ToolMemberSnapshot[] {
  const map = new Map<string, ToolMemberSnapshot>();
  entries.forEach((entry) => {
    map.set(entry.userId, entry);
  });
  return Array.from(map.values());
}

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  }
  return next;
}

function pickRandomItems<T>(items: T[], count: number): T[] {
  return shuffleArray(items).slice(0, count);
}

function buildVoteOptions(optionLabels: string[]): VoteOption[] {
  return optionLabels.map((label) => ({
    id: createId("vote-option"),
    label
  }));
}

function remapVoteOptionIds(
  previousOptions: VoteOption[],
  nextOptions: VoteOption[],
  optionIds: string[]
): string[] {
  const previousLabelById = previousOptions.reduce<Record<string, string>>((accumulator, option) => {
    accumulator[option.id] = option.label;
    return accumulator;
  }, {});
  const nextIdByLabel = nextOptions.reduce<Record<string, string>>((accumulator, option) => {
    accumulator[option.label] = option.id;
    return accumulator;
  }, {});

  return Array.from(
    new Set(
      optionIds
        .map((optionId) => previousLabelById[optionId] ?? "")
        .filter(Boolean)
        .map((label) => nextIdByLabel[label] ?? "")
        .filter(Boolean)
    )
  );
}

function getToolPhaseLabel(toolState: PublishedToolState | null): string {
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
    return toolState.phase === "active" ? "投票中" : "待发布";
  }
  if (toolState.type === "wheel") {
    return toolState.phase === "result" ? "已落点" : "待转动";
  }
  return toolState.phase === "active" ? "抓阄中" : "待发布";
}

function getVoteChoiceLabel(choice: VoteChoice | null): string {
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

type TripContext = {
  currentUser: User;
  tripId: string;
  trip: Trip;
  role: MemberRole;
};

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
    const accessState = this.buildAccessState(currentUser);
    let currentTrip = currentUser.currentTripId
      ? this.tripRepository.getTrip(currentUser.currentTripId)
      : null;
    if (currentTrip && this.finalizeSeatDrawRoundIfDueForTrip(currentTrip.id)) {
      currentTrip = this.tripRepository.getTrip(currentTrip.id);
    }
    const role = currentTrip ? this.requireMembership(currentTrip.id, currentUser.id).role : null;

    return {
      ...accessState,
      tripName: currentTrip ? displayTripName(currentTrip.tripName) : "未加入车次",
      viewerRoleLabel: role === "admin" ? "管理员" : role === "member" ? "成员" : "暂未加入",
      isAdmin: role === "admin",
      emptyTitle: currentTrip ? "所有玩法都在这里" : "先创建或加入车次",
      emptyDescription: currentTrip
        ? "每个玩法都可以单独进入详情页；管理员创建并确定后，普通用户才会看到已发布内容。"
        : "加入车次后，才能进入玩法详情页。",
      toolCards: this.buildToolCards(currentUser, currentTrip, role)
    };
  }

  getToolDetailPageData(toolType: ToolType): ToolDetailViewModel {
    const context = this.requireTripContext();
    this.assertAuthorizedUser(context.currentUser);
    if (toolType === "seat-draw") {
      this.finalizeSeatDrawRoundIfDueForTrip(context.tripId);
    }
    const trip = this.tripRepository.getTrip(context.tripId);
    const toolState = this.getPublishedToolState(trip, toolType);

    return {
      ...this.buildAccessState(context.currentUser),
      tripName: displayTripName(trip.tripName),
      viewerRoleLabel: context.role === "admin" ? "管理员" : "成员",
      isAdmin: context.role === "admin",
      toolType,
      toolTitle: TOOL_META[toolType].title,
      toolDescription: TOOL_META[toolType].description,
      isStarted: Boolean(toolState),
      phaseLabel: getToolPhaseLabel(toolState),
      statusMessage: this.buildToolStatusMessage(toolType, toolState, context.currentUser.id, context.role),
      seatDrawDetail:
        toolType === "seat-draw"
          ? this.buildSeatDrawDetail(trip, toolState as PublishedSeatDrawToolState | null, context.currentUser.id)
          : null,
      voteDetail:
        toolType === "vote"
          ? this.buildVoteDetail(toolState as PublishedVoteToolState | null, context.currentUser.id)
          : null,
      wheelDetail:
        toolType === "wheel"
          ? this.buildWheelDetail(toolState as PublishedWheelToolState | null)
          : null,
      lotteryDetail:
        toolType === "lottery"
          ? this.buildLotteryDetail(context.trip, toolState as PublishedLotteryToolState | null, context.currentUser.id)
          : null
    };
  }

  publishSeatDrawTool(input: SeatDrawPublishInput): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    if (this.getPublishedToolState(context.trip, "seat-draw")) {
      throw new BusinessError("TOOL_ALREADY_STARTED", "玩法已创建，不能再次修改，请使用重置。");
    }
    const topic = assertSeatDrawTopic(input.topic);
    const drawCount = assertSeatDrawCount(input.drawCount);
    const excludeAdmin = Boolean(input.excludeAdmin);
    const excludePreviouslyDrawn = Boolean(input.excludePreviouslyDrawn);
    const eligibleCount = this.getSeatDrawEligibleSnapshots(
      context.trip,
      excludeAdmin,
      []
    ).length;

    if (!eligibleCount) {
      throw new BusinessError("DRAW_POOL_EMPTY", "当前没有可抽取的成员。");
    }
    if (drawCount > eligibleCount) {
      throw new BusinessError("DRAW_COUNT_TOO_LARGE", "抽取数量不能超过当前可抽成员数。");
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

  recreateSeatDrawTool(input: SeatDrawPublishInput): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    const toolState = this.requireStartedTool(context.trip, "seat-draw") as PublishedSeatDrawToolState;
    const topic = assertSeatDrawTopic(input.topic);
    const drawCount = assertSeatDrawCount(input.drawCount);
    const excludeAdmin = Boolean(input.excludeAdmin);
    const excludePreviouslyDrawn = Boolean(input.excludePreviouslyDrawn);
    const eligibleCount = this.getSeatDrawEligibleSnapshots(
      context.trip,
      excludeAdmin,
      excludePreviouslyDrawn ? toolState.drawnEntries : []
    ).length;

    if (!eligibleCount) {
      throw new BusinessError("DRAW_POOL_EMPTY", "当前没有可抽取的成员。");
    }
    if (drawCount > eligibleCount) {
      throw new BusinessError("DRAW_COUNT_TOO_LARGE", "抽取数量不能超过当前可抽成员数。");
    }

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "seat-draw") as PublishedSeatDrawToolState;
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

  startSeatDrawRound(): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    this.finalizeSeatDrawRoundIfDueForTrip(context.tripId);
    const trip = this.tripRepository.getTrip(context.tripId);
    const toolState = this.requireStartedTool(trip, "seat-draw") as PublishedSeatDrawToolState;
    if (toolState.phase === "rolling") {
      throw new BusinessError("SEAT_DRAW_ROLLING", "当前正在抽号中。");
    }
    const eligibleMembers = this.getSeatDrawEligibleSnapshots(
      trip,
      toolState.config.excludeAdmin,
      toolState.config.excludePreviouslyDrawn ? toolState.drawnEntries : []
    );

    if (!eligibleMembers.length) {
      throw new BusinessError("DRAW_POOL_EMPTY", "当前没有可抽取的成员。");
    }

    const drawCount = Math.min(toolState.config.drawCount, eligibleMembers.length);
    const pendingResult = pickRandomItems(eligibleMembers, drawCount);
    const rollingDisplayEntries = this.createSeatDrawRollingFrame(eligibleMembers, drawCount);
    const rollingStartedAt = Date.now();
    const rollingEndsAt = rollingStartedAt + SEAT_DRAW_ROLLING_DURATION_MS;

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "seat-draw") as PublishedSeatDrawToolState;
      nextState.phase = "rolling";
      nextState.rollingDisplayEntries = rollingDisplayEntries;
      nextState.pendingResult = pendingResult;
      nextState.rollingStartedAt = rollingStartedAt;
      nextState.rollingEndsAt = rollingEndsAt;
      nextState.lastResult = [];
    });

    return this.getToolDetailPageData("seat-draw");
  }

  advanceSeatDrawRollingFrame(): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    if (this.finalizeSeatDrawRoundIfDueForTrip(context.tripId)) {
      return this.getToolDetailPageData("seat-draw");
    }

    const trip = this.tripRepository.getTrip(context.tripId);
    const toolState = this.requireStartedTool(trip, "seat-draw") as PublishedSeatDrawToolState;
    if (toolState.phase !== "rolling") {
      return this.getToolDetailPageData("seat-draw");
    }

    const eligibleMembers = this.getSeatDrawEligibleSnapshots(
      trip,
      toolState.config.excludeAdmin,
      toolState.config.excludePreviouslyDrawn ? toolState.drawnEntries : []
    );
    const displayCount = Math.max(toolState.pendingResult.length, 1);
    const rollingDisplayEntries = this.createSeatDrawRollingFrame(eligibleMembers, displayCount);

    this.tripRepository.updateTrip(context.tripId, (nextTrip) => {
      const nextState = this.requireStartedTool(nextTrip, "seat-draw") as PublishedSeatDrawToolState;
      if (nextState.phase !== "rolling") {
        return;
      }
      nextState.rollingDisplayEntries = rollingDisplayEntries;
    });

    return this.getToolDetailPageData("seat-draw");
  }

  finalizeSeatDrawRoundIfDue(): ToolDetailViewModel {
    const context = this.requireTripContext();
    this.finalizeSeatDrawRoundIfDueForTrip(context.tripId);
    return this.getToolDetailPageData("seat-draw");
  }

  drawSeat(): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    this.startSeatDrawRound();
    this.finalizeSeatDrawRoundIfDueForTrip(context.tripId, true);
    return this.getToolDetailPageData("seat-draw");
  }

  resetSeatDraw(): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    this.requireStartedTool(context.trip, "seat-draw");

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "seat-draw") as PublishedSeatDrawToolState;
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

  closeSeatDraw(): ToolDetailViewModel {
    return this.closeTool("seat-draw");
  }

  publishVoteTool(input: VotePublishInput): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    if (this.getPublishedToolState(context.trip, "vote")) {
      throw new BusinessError("TOOL_ALREADY_STARTED", "玩法已创建，不能再次修改，请使用重置。");
    }
    const topic = assertVoteTopic(input.topic);
    const selectionMode = assertVoteSelectionMode(input.selectionMode);
    const optionLabels = assertVoteOptions(input.options);
    const excludeAdmin = Boolean(input.excludeAdmin);
    const participantUserIds = this.listTripParticipantUserIds(context.tripId, excludeAdmin);

    if (!participantUserIds.length) {
      throw new BusinessError("VOTE_NO_PARTICIPANTS", "当前没有可参与投票的成员。");
    }

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      trip.tools.vote = {
        type: "vote",
        publishedAt: Date.now(),
        publishedByUserId: context.currentUser.id,
        phase: "active",
        topic,
        selectionMode,
        options: buildVoteOptions(optionLabels),
        excludeAdmin,
        participantUserIds,
        submissions: {}
      };
    });

    return this.getToolDetailPageData("vote");
  }

  recreateVoteTool(input: VotePublishInput): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    const toolState = this.requireStartedTool(context.trip, "vote") as PublishedVoteToolState;
    const topic = assertVoteTopic(input.topic);
    const selectionMode = assertVoteSelectionMode(input.selectionMode);
    const optionLabels = assertVoteOptions(input.options);
    const excludeAdmin = Boolean(input.excludeAdmin);
    const participantUserIds = this.listTripParticipantUserIds(context.tripId, excludeAdmin);

    if (!participantUserIds.length) {
      throw new BusinessError("VOTE_NO_PARTICIPANTS", "当前没有可参与投票的成员。");
    }

    const nextOptions = buildVoteOptions(optionLabels);
    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "vote") as PublishedVoteToolState;
      const previousOptions = nextState.options;
      const previousSubmissions = nextState.submissions;
      const nextSubmissions = Object.entries(previousSubmissions).reduce<PublishedVoteToolState["submissions"]>(
        (accumulator, [userId, submission]) => {
          const remappedOptionIds = remapVoteOptionIds(previousOptions, nextOptions, submission.optionIds);
          accumulator[userId] = {
            ...submission,
            optionIds:
              selectionMode === "single" ? remappedOptionIds.slice(0, 1) : remappedOptionIds
          };
          return accumulator;
        },
        {}
      );

      nextState.publishedAt = Date.now();
      nextState.publishedByUserId = context.currentUser.id;
      nextState.topic = topic;
      nextState.selectionMode = selectionMode;
      nextState.excludeAdmin = excludeAdmin;
      nextState.options = nextOptions;
      nextState.participantUserIds = participantUserIds;
      nextState.submissions = nextSubmissions;
    });

    return this.getToolDetailPageData("vote");
  }

  submitVote(input: VoteSubmitInput): ToolDetailViewModel {
    const context = this.requireTripContext();
    const safeChoice = assertVoteChoice(input.choice);
    const optionIds = Array.isArray(input.optionIds)
      ? input.optionIds.map((optionId) => optionId.trim()).filter(Boolean)
      : [];
    const toolState = this.requireStartedTool(context.trip, "vote") as PublishedVoteToolState;
    const existingSubmission = toolState.submissions[context.currentUser.id] ?? null;

    if (toolState.phase !== "active") {
      throw new BusinessError("VOTE_NOT_STARTED", "管理员还没有发布本轮投票。");
    }
    if (!toolState.participantUserIds.includes(context.currentUser.id)) {
      throw new BusinessError("VOTE_NOT_ALLOWED", "你不在本轮投票名单中。");
    }
    if (
      existingSubmission &&
      !(
        toolState.selectionMode === "multiple" &&
        safeChoice === "approve" &&
        existingSubmission.choice === "approve"
      )
    ) {
      throw new BusinessError("VOTE_ALREADY_SUBMITTED", "本轮投票只能提交一次。");
    }

    const validOptionIds = new Set(toolState.options.map((option) => option.id));
    const normalizedOptionIds = Array.from(new Set(optionIds)).filter((optionId) =>
      validOptionIds.has(optionId)
    );
    const existingOptionIds =
      existingSubmission?.choice === "approve" ? existingSubmission.optionIds : [];
    const mergedOptionIds = Array.from(new Set([...existingOptionIds, ...normalizedOptionIds]));

    if (safeChoice === "approve" && !normalizedOptionIds.length) {
      throw new BusinessError("VOTE_OPTION_REQUIRED", "请先选择投票选项。");
    }
    if (toolState.selectionMode === "single" && normalizedOptionIds.length > 1) {
      throw new BusinessError("VOTE_SINGLE_OPTION_ONLY", "当前投票为单选，请只选择 1 个选项。");
    }
    if (
      toolState.selectionMode === "multiple" &&
      safeChoice === "approve" &&
      existingSubmission?.choice === "approve"
    ) {
      if (existingOptionIds.length >= toolState.options.length) {
        throw new BusinessError("VOTE_ALREADY_SUBMITTED", "可投选项都已经投完了。");
      }
      if (mergedOptionIds.length === existingOptionIds.length) {
        throw new BusinessError("VOTE_OPTION_REQUIRED", "请先选择新的投票选项。");
      }
    }

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "vote") as PublishedVoteToolState;
      nextState.submissions[context.currentUser.id] = {
        choice: safeChoice,
        optionIds:
          toolState.selectionMode === "multiple" && safeChoice === "approve"
            ? mergedOptionIds
            : normalizedOptionIds,
        submittedAt: Date.now()
      };
    });

    return this.getToolDetailPageData("vote");
  }

  resetVote(): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    const toolState = this.requireStartedTool(context.trip, "vote") as PublishedVoteToolState;
    const participantUserIds = this.listTripParticipantUserIds(context.tripId, toolState.excludeAdmin);

    if (!participantUserIds.length) {
      throw new BusinessError("VOTE_NO_PARTICIPANTS", "当前没有可参与投票的成员。");
    }

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "vote") as PublishedVoteToolState;
      nextState.phase = "active";
      nextState.participantUserIds = participantUserIds;
      nextState.submissions = {};
    });

    return this.getToolDetailPageData("vote");
  }

  closeVote(): ToolDetailViewModel {
    return this.closeTool("vote");
  }

  publishWheelTool(input: WheelPublishInput): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    if (this.getPublishedToolState(context.trip, "wheel")) {
      throw new BusinessError("TOOL_ALREADY_STARTED", "玩法已创建，不能再次修改，请使用重置。");
    }
    const items = assertWheelItems(input.items);

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      trip.tools.wheel = {
        type: "wheel",
        publishedAt: Date.now(),
        publishedByUserId: context.currentUser.id,
        phase: "draft",
        items,
        resultIndex: null,
        resultHistoryLabels: [],
        spunAt: null
      };
    });

    return this.getToolDetailPageData("wheel");
  }

  recreateWheelTool(input: WheelPublishInput): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    const toolState = this.requireStartedTool(context.trip, "wheel") as PublishedWheelToolState;
    const items = assertWheelItems(input.items);
    const previousResultLabel =
      toolState.resultIndex === null ? null : toolState.items[toolState.resultIndex] ?? null;
    const nextResultIndex = previousResultLabel ? items.indexOf(previousResultLabel) : -1;
    const previousHistoryLabels = Array.isArray(toolState.resultHistoryLabels)
      ? toolState.resultHistoryLabels.filter((label) => items.includes(label))
      : [];

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "wheel") as PublishedWheelToolState;
      nextState.publishedAt = Date.now();
      nextState.publishedByUserId = context.currentUser.id;
      nextState.items = items;
      nextState.resultIndex = nextResultIndex >= 0 ? nextResultIndex : null;
      nextState.resultHistoryLabels = previousHistoryLabels;
      nextState.phase = nextState.resultIndex === null ? "draft" : "result";
    });

    return this.getToolDetailPageData("wheel");
  }

  spinWheel(): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    const toolState = this.requireStartedTool(context.trip, "wheel") as PublishedWheelToolState;
    const items = assertWheelItems(toolState.items);
    const resultIndex = Math.floor(Math.random() * items.length);

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "wheel") as PublishedWheelToolState;
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

  resetWheel(): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    this.requireStartedTool(context.trip, "wheel");

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "wheel") as PublishedWheelToolState;
      nextState.phase = "draft";
      nextState.resultIndex = null;
      nextState.resultHistoryLabels = [];
      nextState.spunAt = null;
    });

    return this.getToolDetailPageData("wheel");
  }

  closeWheel(): ToolDetailViewModel {
    return this.closeTool("wheel");
  }

  publishLotteryTool(input: LotteryPublishInput): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    if (this.getPublishedToolState(context.trip, "lottery")) {
      throw new BusinessError("TOOL_ALREADY_STARTED", "玩法已创建，不能再次修改，请使用重置。");
    }
    const winnerCount = assertPositiveCount(
      input.winnerCount,
      "INVALID_LOTTERY_COUNT",
      "请填写正确的抽中人数。"
    );
    const excludeAdmin = Boolean(input.excludeAdmin);
    const participantUserIds = this.listTripParticipantUserIds(context.tripId, excludeAdmin);

    if (!participantUserIds.length) {
      throw new BusinessError("LOTTERY_NO_PARTICIPANTS", "当前没有可参与抓阄的成员。");
    }
    if (winnerCount > participantUserIds.length) {
      throw new BusinessError("LOTTERY_COUNT_TOO_LARGE", "抽中人数不能超过当前成员数。");
    }

    const winnerUserIds = pickRandomItems(participantUserIds, winnerCount);
    this.tripRepository.updateTrip(context.tripId, (trip) => {
      trip.tools.lottery = {
        type: "lottery",
        publishedAt: Date.now(),
        publishedByUserId: context.currentUser.id,
        phase: "active",
        winnerCount,
        excludeAdmin,
        participantUserIds,
        winnerUserIds,
        claims: {}
      };
    });

    return this.getToolDetailPageData("lottery");
  }

  recreateLotteryTool(input: LotteryPublishInput): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    const toolState = this.requireStartedTool(context.trip, "lottery") as PublishedLotteryToolState;
    const winnerCount = assertPositiveCount(
      input.winnerCount,
      "INVALID_LOTTERY_COUNT",
      "请填写正确的抽中人数。"
    );
    const excludeAdmin = Boolean(input.excludeAdmin);
    const participantUserIds = this.listTripParticipantUserIds(context.tripId, excludeAdmin);

    if (!participantUserIds.length) {
      throw new BusinessError("LOTTERY_NO_PARTICIPANTS", "当前没有可参与抓阄的成员。");
    }
    if (winnerCount > participantUserIds.length) {
      throw new BusinessError("LOTTERY_COUNT_TOO_LARGE", "抽中人数不能超过当前成员数。");
    }

    const previousWinnerUserIds = toolState.winnerUserIds.filter((userId) => participantUserIds.includes(userId));
    const missingWinnerCount = Math.max(0, winnerCount - previousWinnerUserIds.length);
    const candidateUserIds = participantUserIds.filter((userId) => !previousWinnerUserIds.includes(userId));
    const winnerUserIds = [
      ...previousWinnerUserIds,
      ...pickRandomItems(candidateUserIds, missingWinnerCount)
    ].slice(0, winnerCount);

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "lottery") as PublishedLotteryToolState;
      const nextClaims = Object.entries(nextState.claims).reduce<PublishedLotteryToolState["claims"]>(
        (accumulator, [userId, claim]) => {
          if (participantUserIds.includes(userId)) {
            accumulator[userId] = {
              ...claim,
              isWinner: winnerUserIds.includes(userId)
            };
          }
          return accumulator;
        },
        {}
      );

      nextState.publishedAt = Date.now();
      nextState.publishedByUserId = context.currentUser.id;
      nextState.excludeAdmin = excludeAdmin;
      nextState.winnerCount = winnerCount;
      nextState.participantUserIds = participantUserIds;
      nextState.winnerUserIds = winnerUserIds;
      nextState.claims = nextClaims;
    });

    return this.getToolDetailPageData("lottery");
  }

  claimLottery(): ToolDetailViewModel {
    const context = this.requireTripContext();
    const toolState = this.requireStartedTool(context.trip, "lottery") as PublishedLotteryToolState;

    if (toolState.phase !== "active") {
      throw new BusinessError("LOTTERY_NOT_STARTED", "管理员还没有发布本轮抓阄。");
    }
    if (!toolState.participantUserIds.includes(context.currentUser.id)) {
      throw new BusinessError("LOTTERY_NOT_ALLOWED", "你不在本轮抓阄名单中。");
    }
    if (toolState.claims[context.currentUser.id]) {
      throw new BusinessError("LOTTERY_ALREADY_CLAIMED", "你本轮已经抓过阄了。");
    }

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "lottery") as PublishedLotteryToolState;
      nextState.claims[context.currentUser.id] = {
        claimedAt: Date.now(),
        isWinner: nextState.winnerUserIds.includes(context.currentUser.id)
      };
    });

    return this.getToolDetailPageData("lottery");
  }

  resetLottery(): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    const toolState = this.requireStartedTool(context.trip, "lottery") as PublishedLotteryToolState;
    const participantUserIds = this.listTripParticipantUserIds(context.tripId, toolState.excludeAdmin);

    if (!participantUserIds.length) {
      throw new BusinessError("LOTTERY_NO_PARTICIPANTS", "当前没有可参与抓阄的成员。");
    }
    if (toolState.winnerCount > participantUserIds.length) {
      throw new BusinessError("LOTTERY_COUNT_TOO_LARGE", "抽中人数不能超过当前成员数。");
    }

    const winnerUserIds = pickRandomItems(participantUserIds, toolState.winnerCount);

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "lottery") as PublishedLotteryToolState;
      nextState.phase = "active";
      nextState.participantUserIds = participantUserIds;
      nextState.winnerUserIds = winnerUserIds;
      nextState.claims = {};
    });

    return this.getToolDetailPageData("lottery");
  }

  closeLottery(): ToolDetailViewModel {
    return this.closeTool("lottery");
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
      tools: createEmptyTripTools(),
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
      trip.tools = createEmptyTripTools();
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

      const membersByTripId = state.tripMembers.reduce<Record<string, typeof state.tripMembers>>(
        (accumulator, member) => {
          if (!accumulator[member.tripId]) {
            accumulator[member.tripId] = [];
          }
          accumulator[member.tripId].push(member);
          return accumulator;
        },
        {}
      );

      Object.values(state.trips).forEach((trip) => {
        trip.tools = trip.tools ?? createEmptyTripTools();

        if (trip.status !== "active") {
          trip.tools = createEmptyTripTools();
          return;
        }

        const tripMembers = membersByTripId[trip.id] ?? [];
        if (!tripMembers.length) {
          trip.status = "dissolved";
          trip.seatMap = createSeatMap(trip.seatCodes);
          trip.tools = createEmptyTripTools();
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
          trip.tools = createEmptyTripTools();
        }

        TOOL_TYPES.forEach((toolType) => {
          const toolState = trip.tools[toolType];
          if (!toolState || toolState.type !== toolType) {
            trip.tools[toolType] = null;
            return;
          }

          const publisherRelation = tripMembers.find(
            (member) => member.userId === toolState.publishedByUserId
          );
          if (!publisherRelation || publisherRelation.role !== "admin") {
            trip.tools[toolType] = null;
          }
        });
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

  private requireTripContext(): TripContext {
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

  private requireAdminTripContext(): TripContext {
    const context = this.requireTripContext();
    if (context.role !== "admin") {
      throw new BusinessError("ADMIN_ONLY", "只有管理员可以操作当前玩法。");
    }
    return context;
  }

  private closeTool(toolType: ToolType): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    this.requireStartedTool(context.trip, toolType);

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      trip.tools[toolType] = null;
    });

    return this.getToolDetailPageData(toolType);
  }

  private finalizeSeatDrawRoundIfDueForTrip(tripId: string, force = false): boolean {
    const trip = this.tripRepository.getTrip(tripId);
    const toolState = this.getPublishedToolState(trip, "seat-draw") as PublishedSeatDrawToolState | null;
    if (!toolState || toolState.phase !== "rolling") {
      return false;
    }
    if (!force && (!toolState.rollingEndsAt || toolState.rollingEndsAt > Date.now())) {
      return false;
    }

    this.tripRepository.updateTrip(tripId, (nextTrip) => {
      const nextState = this.requireStartedTool(nextTrip, "seat-draw") as PublishedSeatDrawToolState;
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

  private createSeatDrawRollingFrame(
    eligibleMembers: ToolMemberSnapshot[],
    displayCount: number
  ): ToolMemberSnapshot[] {
    if (!eligibleMembers.length || displayCount <= 0) {
      return [];
    }
    return pickRandomItems(eligibleMembers, Math.min(displayCount, eligibleMembers.length));
  }

  private getCurrentSeatCode(tripId: string, userId: string): string | null {
    const trip = this.tripRepository.getTrip(tripId);
    return findSeatCodeByUserId(trip.seatMap, userId);
  }

  private getPublishedToolState(trip: Trip, toolType: ToolType): PublishedToolState | null {
    const toolState = trip.tools[toolType];
    if (!toolState || toolState.type !== toolType) {
      return null;
    }
    return toolState;
  }

  private requireStartedTool(trip: Trip, toolType: ToolType): PublishedToolState {
    const toolState = this.getPublishedToolState(trip, toolType);
    if (!toolState) {
      throw new BusinessError("TOOL_NOT_STARTED", "当前玩法未开启。");
    }
    return toolState;
  }

  private buildAccessState(currentUser: User): AccessStateViewModel {
    return {
      currentUser,
      isAuthorized: currentUser.isAuthorized,
      hasCurrentTrip: Boolean(currentUser.currentTripId)
    };
  }

  private buildToolCards(
    currentUser: User,
    trip: Trip | null,
    role: MemberRole | null
  ): ToolCardView[] {
    return TOOL_TYPES.map((toolType) => {
      const toolState = trip ? this.getPublishedToolState(trip, toolType) : null;
      const hasCurrentTrip = Boolean(trip);
      let helperText = "先授权";

      if (currentUser.isAuthorized && !hasCurrentTrip) {
        helperText = "先加入车次";
      } else if (currentUser.isAuthorized && hasCurrentTrip) {
        if (toolState) {
          helperText = role === "admin" ? "进入详情操作" : "进入详情参与";
        } else {
          helperText = role === "admin" ? "进入详情创建" : "等待管理员开启";
        }
      }

      return {
        type: toolType,
        title: TOOL_META[toolType].title,
        description: TOOL_META[toolType].description,
        iconGlyph: TOOL_META[toolType].iconGlyph,
        iconClassName: TOOL_META[toolType].iconClassName,
        stateLabel: toolState ? "已开启" : "未开启",
        stateClassName: toolState ? "tool-state is-active" : "tool-state",
        helperText,
        isStarted: Boolean(toolState),
        canEnter: Boolean(currentUser.isAuthorized && hasCurrentTrip)
      };
    });
  }

  private buildToolStatusMessage(
    toolType: ToolType,
    toolState: PublishedToolState | null,
    viewerId: string,
    viewerRole: MemberRole
  ): string {
    if (!toolState) {
      return viewerRole === "admin"
        ? "点击“创建玩法”后先在本地设置，点“确定”才会同步给大家。"
        : "玩法未开启，等待管理员创建。";
    }

    if (toolType === "seat-draw") {
      const seatDrawState = toolState as PublishedSeatDrawToolState;
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
      const voteState = toolState as PublishedVoteToolState;
      if (voteState.phase === "draft") {
        return viewerRole === "admin"
          ? "当前玩法已开启，但本轮投票还未发布。"
          : "等待管理员发布下一轮投票。";
      }
      if (!voteState.participantUserIds.includes(viewerId)) {
        return "你不在本轮投票名单中。";
      }
      const submission = voteState.submissions[viewerId];
      if (
        submission?.choice === "approve" &&
        voteState.selectionMode === "multiple" &&
        submission.optionIds.length < voteState.options.length
      ) {
        return `你已投 ${submission.optionIds.length} 项，还可以继续投票。`;
      }
      return submission
        ? `你已完成投票：${getVoteChoiceLabel(submission.choice)}`
        : "请选择一个选项完成本轮投票。";
    }

    if (toolType === "wheel") {
      const wheelState = toolState as PublishedWheelToolState;
      return wheelState.resultIndex === null
        ? viewerRole === "admin"
          ? "当前配置已发布，点击“开始转动”生成结果。"
          : "玩法已开启，等待管理员开始转动。"
        : "当前转盘结果已经同步。";
    }

    const lotteryState = toolState as PublishedLotteryToolState;
    if (lotteryState.phase === "ready") {
      return viewerRole === "admin"
        ? "当前玩法已开启，点“确定”可开始新一轮抓阄。"
        : "等待管理员发布下一轮抓阄。";
    }
    if (!lotteryState.participantUserIds.includes(viewerId)) {
      return "你不在本轮抓阄名单中。";
    }
    if (lotteryState.claims[viewerId]) {
      return lotteryState.claims[viewerId].isWinner ? "你本轮抓中了。" : "你本轮没有抓中。";
    }
    return "点击按钮查看你本轮的个人结果。";
  }

  private buildSeatDrawDetail(
    trip: Trip,
    toolState: PublishedSeatDrawToolState | null,
    viewerId: string
  ): SeatDrawDetailView | null {
    if (!toolState) {
      return null;
    }

    const remainingCount = this.getSeatDrawEligibleSnapshots(
      trip,
      toolState.config.excludeAdmin,
      toolState.config.excludePreviouslyDrawn ? toolState.drawnEntries : []
    ).length;
    const eligibleMembers = this.getSeatDrawEligibleSnapshots(
      trip,
      toolState.config.excludeAdmin,
      toolState.config.excludePreviouslyDrawn ? toolState.drawnEntries : []
    );
    const displayEntries =
      toolState.phase === "rolling"
        ? toolState.rollingDisplayEntries
        : toolState.phase === "result"
          ? toolState.lastResult
          : [];
    const slotCount =
      toolState.phase === "rolling"
        ? Math.max(toolState.pendingResult.length, displayEntries.length, 1)
        : toolState.phase === "result" && toolState.lastResult.length
          ? toolState.lastResult.length
          : Math.min(toolState.config.drawCount, Math.max(remainingCount, 1));
    const displaySlots = Array.from({ length: slotCount }, (_, index) => {
      const entry = displayEntries[index] ?? null;
      return {
        id: `seat-draw-slot-${index + 1}`,
        label: entry?.seatCode ?? "😊",
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
        labels: roundEntries.map((entry) => entry.seatCode ?? "未入座"),
        displayText: roundEntries.map((entry) => entry.seatCode ?? "未入座").join("、")
      })),
      canDrawAgain: remainingCount > 0 && toolState.phase !== "rolling",
      rollingEndsAt: toolState.rollingEndsAt
    };
  }

  private buildVoteDetail(
    toolState: PublishedVoteToolState | null,
    viewerId: string
  ): VoteDetailView | null {
    if (!toolState) {
      return null;
    }

    const selectionMode = toolState.selectionMode === "multiple" ? "multiple" : "single";
    const participantUserIds = Array.isArray(toolState.participantUserIds)
      ? toolState.participantUserIds.filter((userId) => typeof userId === "string" && Boolean(userId))
      : [];
    const submissionsRecord =
      toolState.submissions && typeof toolState.submissions === "object" ? toolState.submissions : {};
    const submissions = Object.values(submissionsRecord);
    const viewerSubmission = submissionsRecord[viewerId] ?? null;
    const options = Array.isArray(toolState.options) ? toolState.options : [];
    return {
      phase: toolState.phase,
      topic: toolState.topic,
      excludeAdmin: toolState.excludeAdmin,
      selectionMode,
      participantCount: participantUserIds.length,
      submittedCount: Object.keys(submissionsRecord).length,
      approveCount: submissions.filter((submission) => submission.choice === "approve").length,
      rejectCount: submissions.filter((submission) => submission.choice === "reject").length,
      abstainCount: submissions.filter((submission) => submission.choice === "abstain").length,
      options: options.map((option) => ({
        id: option.id,
        label: option.label,
        supportCount: submissions.filter(
          (submission) =>
            submission.choice === "approve" && submission.optionIds.includes(option.id)
        ).length,
        selectedByViewer: Boolean(viewerSubmission?.optionIds.includes(option.id))
      })),
      viewerChoice: viewerSubmission?.choice ?? null,
      viewerSelectedOptionIds: viewerSubmission?.optionIds ?? [],
      viewerHasSubmitted: Boolean(viewerSubmission),
      viewerEligible: participantUserIds.includes(viewerId)
    };
  }

  private buildWheelDetail(toolState: PublishedWheelToolState | null): WheelDetailView | null {
    if (!toolState) {
      return null;
    }

    const resultHistoryLabels = Array.isArray(toolState.resultHistoryLabels)
      ? toolState.resultHistoryLabels.filter((label) => typeof label === "string" && Boolean(label))
      : [];

    return {
      phase: toolState.phase,
      items: toolState.items,
      resultIndex: toolState.resultIndex,
      resultLabel: toolState.resultIndex === null ? null : toolState.items[toolState.resultIndex] ?? null,
      resultHistoryLabels
    };
  }

  private buildLotteryDetail(
    trip: Trip,
    toolState: PublishedLotteryToolState | null,
    viewerId: string
  ): LotteryDetailView | null {
    if (!toolState) {
      return null;
    }

    const viewerClaim = toolState.claims[viewerId] ?? null;
    return {
      phase: toolState.phase,
      winnerCount: toolState.winnerCount,
      excludeAdmin: toolState.excludeAdmin,
      participantCount: toolState.participantUserIds.length,
      claimedCount: Object.keys(toolState.claims).length,
      viewerHasClaimed: Boolean(viewerClaim),
      viewerIsWinner: viewerClaim ? viewerClaim.isWinner : null,
      viewerResultText: !viewerClaim
        ? "尚未抓阄"
        : viewerClaim.isWinner
          ? "恭喜你，抽中了。"
          : "很遗憾，这次没有抽中。",
      viewerEligible: toolState.participantUserIds.includes(viewerId),
      participants: toolState.participantUserIds.map((userId) => {
        const claim = toolState.claims[userId] ?? null;
        return this.buildLotteryParticipantView(
          trip,
          userId,
          viewerId,
          claim?.isWinner ?? null,
          Boolean(claim)
        );
      })
    };
  }

  private buildToolResultMemberView(
    snapshot: ToolMemberSnapshot,
    viewerId: string
  ): ToolResultMemberView {
    const user = this.userRepository.getUser(snapshot.userId);
    return {
      userId: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      initial: getInitial(user.nickname),
      seatLabel: snapshot.seatCode ?? "未入座",
      isSelf: user.id === viewerId
    };
  }

  private buildLotteryParticipantView(
    trip: Trip,
    userId: string,
    viewerId: string,
    isWinner: boolean | null,
    claimed: boolean
  ): LotteryParticipantView {
    const user = this.userRepository.getUser(userId);
    const seatCode = findSeatCodeByUserId(trip.seatMap, userId);
    const statusText = !claimed ? "待抓阄" : isWinner ? "已抽中" : "未抽中";

    return {
      userId: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      initial: getInitial(user.nickname),
      seatLabel: seatCode ?? "未入座",
      isSelf: user.id === viewerId,
      statusText,
      statusClassName: !claimed ? "lottery-status" : isWinner ? "lottery-status is-hit" : "lottery-status is-miss",
      claimed
    };
  }

  private listTripParticipantUserIds(tripId: string, excludeAdmin: boolean): string[] {
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

  private getSeatDrawEligibleSnapshots(
    trip: Trip,
    excludeAdmin: boolean,
    historyEntries: ToolMemberSnapshot[]
  ): ToolMemberSnapshot[] {
    const excludedUserIds = new Set(historyEntries.map((entry) => entry.userId));
    return Object.keys(trip.seatMap)
      .map((seatCode) => ({
        seatCode,
        userId: trip.seatMap[seatCode]
      }))
      .filter((entry): entry is { seatCode: string; userId: string } => Boolean(entry.userId))
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

  private buildDemoUsers(activeUserId: string): DemoUserOption[] {
    const demoUserMap = this.userRepository.listUsers().reduce<Record<string, User>>((accumulator, user) => {
      accumulator[user.id] = user;
      return accumulator;
    }, {});

    return DEMO_SWITCHABLE_USER_IDS.map((userId) => demoUserMap[userId])
      .filter((user): user is User => Boolean(user))
      .map((user) => {
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

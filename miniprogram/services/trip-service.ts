import {
  DEFAULT_HOME_TITLE,
  DEFAULT_VIEW_TRIP_ID,
  DEFAULT_WHEEL_ITEMS,
  DEMO_SWITCHABLE_USER_IDS,
  FIXED_TRIP_IDS,
  FIXED_TRIP_LABELS,
  HOME_PERSONA_OPTIONS,
  MAX_MEMBER_FAVORITES_PER_TRIP,
  TOOL_META,
  TOOL_TYPES,
  TRIP_TEMPLATES,
  WHEEL_MAX_ITEMS,
  createEmptyTripTools,
  createInitialAppState,
  createSeededDemoAppState,
  isSeededDemoAppState
} from "../shared/constants";
import { BusinessError } from "../shared/errors";
import {
  buildSeatOccupantMap,
  buildSeatRows,
  createSeatMap,
  findSeatCodeByUserId,
  generateSeatCodes
} from "../shared/seat";
import type {
  AccessStateViewModel,
  AuthorizeProfileInput,
  BoardingButtonView,
  BoardingRecord,
  BoardingRecordListItemView,
  BoardingRecordMemberGroupView,
  BoardingRecordPageViewModel,
  BootstrapResult,
  ClaimSeatProfileInput,
  CreateTripInput,
  CurrentTripViewModel,
  DemoUserOption,
  FavoriteMemberCardView,
  FavoritePageViewModel,
  FavoriteRankingItemView,
  HomeSettingsPageViewModel,
  LotteryCard,
  LotteryCardView,
  LotteryClaimRecord,
  LotteryClaimRecordView,
  LotteryDetailView,
  LotteryPublishInput,
  MemberRole,
  MemberDetailMode,
  MemberView,
  PassengerFilterOptionView,
  PassengerMemberGroupView,
  PassengerMemberView,
  PassengerPageViewModel,
  ProfilePageViewModel,
  ProfilePrimaryActionKind,
  PublishedLotteryToolState,
  PublishedSeatDrawToolState,
  PublishedToolState,
  PublishedVoteToolState,
  PublishedWheelToolState,
  RuntimeConfig,
  SeatDrawDetailView,
  SeatDrawPublishInput,
  TagEditorViewModel,
  ToolCardView,
  ToolDetailViewModel,
  ToolMemberSnapshot,
  ToolResultMemberView,
  ToolType,
  Trip,
  TripFavoriteRelation,
  TripMember,
  TripMetaView,
  TripSwitchOption,
  TripSettingsViewModel,
  ViewerRole,
  VoteChoice,
  VoteDetailView,
  VoteOption,
  VoteOptionView,
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
  formatBoardingRecordTime,
  formatHometownLocationDisplay,
  formatLivingLocationDisplay,
  getInitial,
  parseTags,
  regionValueToArray
} from "../utils/format";
import { buildTagColorViews } from "../utils/tag-style";
import { createId } from "../utils/id";
import { AppStateRepository } from "../repositories/app-state-repository";
import { SessionRepository } from "../repositories/session-repository";
import type { StorageAdapter } from "../repositories/storage-adapter";
import { wxStorageAdapter } from "../repositories/storage-adapter";
import { TripRepository } from "../repositories/trip-repository";
import { UserRepository } from "../repositories/user-repository";
import { writeCloudRuntimeConfig } from "./cloud/cloud-runtime-config";

const SEAT_DRAW_MAX_COUNT = 5;
const SEAT_DRAW_ROLLING_DURATION_MS = 3000;
const HOME_TITLE_MAX_LENGTH = 20;
const BOARDING_CONFIRM_WINDOW_MS = 10 * 1000;
const BOARDING_RESET_WINDOW_MS = 10 * 60 * 1000;
const TOOL_PAGE_META: Record<
  ToolType,
  {
    displayTitle: string;
    displayDescription: string;
    imageUrl: string;
    ctaLabel: string;
    sortOrder: number;
  }
> = {
  vote: {
    displayTitle: "做选择",
    displayDescription: "选出最佳方案",
    imageUrl: "/assets/icons/icon_tools_投票.png",
    ctaLabel: "去使用",
    sortOrder: 2
  },
  "seat-draw": {
    displayTitle: "随机抽",
    displayDescription: "公平随机抽号",
    imageUrl: "/assets/icons/icon_tools_随机选号.png",
    ctaLabel: "去使用",
    sortOrder: 1
  },
  lottery: {
    displayTitle: "幸运签",
    displayDescription: "抽好签配好运",
    imageUrl: "/assets/icons/icon_tools_抽签.png",
    ctaLabel: "去使用",
    sortOrder: 4
  },
  wheel: {
    displayTitle: "大转盘",
    displayDescription: "大风车转啊转",
    imageUrl: "/assets/icons/icon_tools_幸运大转盘.png",
    ctaLabel: "去使用",
    sortOrder: 3
  }
};

function getFallbackTopic(topic: string | null | undefined, fallback: string): string {
  const normalized = typeof topic === "string" ? topic.trim() : "";
  return normalized || fallback;
}

function assertHomeTitle(title: string): string {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new BusinessError("HOME_TITLE_REQUIRED", "请填写首页标题。");
  }
  if (normalizedTitle.length > HOME_TITLE_MAX_LENGTH) {
    throw new BusinessError("HOME_TITLE_TOO_LONG", `首页标题最多 ${HOME_TITLE_MAX_LENGTH} 个字。`);
  }
  return normalizedTitle;
}

function assertTripName(tripName: string): void {
  if (!tripName.trim()) {
    throw new BusinessError("INVALID_TRIP_NAME", "请填写车次名称。");
  }
}

function assertPassword(password: string): void {
  if (!/^\d{6}$/.test(password)) {
    throw new BusinessError("INVALID_PASSWORD", "请输入 6 位数字口令。");
  }
}

function assertDepartureTime(departureTime: string): string {
  const trimmed = departureTime.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!match) {
    throw new BusinessError("INVALID_DEPARTURE_TIME", "请选择出发日期和时间。");
  }

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const candidate = new Date(year, month - 1, day, hour, minute);

  const isValidDate =
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day &&
    candidate.getHours() === hour &&
    candidate.getMinutes() === minute;

  if (!isValidDate) {
    throw new BusinessError("INVALID_DEPARTURE_TIME", "请选择正确的出发日期和时间。");
  }

  return trimmed;
}

function assertTemplateExists(templateId: string): void {
  if (!TRIP_TEMPLATES.some((template) => template.id === templateId)) {
    throw new BusinessError("INVALID_TEMPLATE", "请选择座位模板。");
  }
}

function createSixDigitPassword(seed: number): string {
  return String(seed).padStart(6, "0").slice(-6);
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
  if (trimmed.length > 20) {
    throw new BusinessError("SEAT_DRAW_TOPIC_TOO_LONG", "主题最多输入 20 个字。");
  }
  return trimmed;
}

function assertWheelTopic(topic: string): string {
  const trimmed = topic.trim();
  if (!trimmed) {
    throw new BusinessError("INVALID_WHEEL_TOPIC", "请填写主题名称。");
  }
  if (trimmed.length > 30) {
    throw new BusinessError("WHEEL_TOPIC_TOO_LONG", "主题名称最多输入 30 个字。");
  }
  return trimmed;
}

function assertLotteryTopic(topic: string): string {
  const trimmed = topic.trim();
  if (!trimmed) {
    throw new BusinessError("INVALID_LOTTERY_TOPIC", "请填写主题名称。");
  }
  if (trimmed.length > 30) {
    throw new BusinessError("LOTTERY_TOPIC_TOO_LONG", "主题名称最多输入 30 个字。");
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

function assertVoteMaxSelections(
  maxSelections: number | undefined,
  selectionMode: VoteSelectionMode,
  optionCount: number
): number {
  if (selectionMode === "single") {
    return 1;
  }

  const normalized = assertPositiveCount(
    maxSelections ?? optionCount,
    "INVALID_VOTE_MAX_SELECTIONS",
    "请填写正确的最多可选项数。"
  );
  if (normalized > optionCount) {
    throw new BusinessError(
      "VOTE_MAX_SELECTIONS_TOO_LARGE",
      "最多可选项数不能超过投票选项数。"
    );
  }
  return normalized;
}

function assertWheelItems(items: string[]): string[] {
  const normalized = items
    .map((item) => item.trim())
    .filter(Boolean);

  if (normalized.length < 2) {
    throw new BusinessError("INVALID_WHEEL_ITEMS", "请至少填写 2 个转盘内容。");
  }

  if (normalized.length > WHEEL_MAX_ITEMS) {
    throw new BusinessError("WHEEL_ITEMS_LIMIT_EXCEEDED", `大转盘最多可填写 ${WHEEL_MAX_ITEMS} 个奖品项。`);
  }

  return normalized;
}

function assertLotteryAnswers(answers: string[]): string[] {
  const normalized = answers
    .map((answer) => answer.trim())
    .filter(Boolean);

  if (!normalized.length) {
    throw new BusinessError("INVALID_LOTTERY_ANSWERS", "请至少填写 1 个答案。");
  }

  return normalized;
}

function assertLotteryDrawLimit(count: number): number {
  return assertPositiveCount(count, "INVALID_LOTTERY_DRAW_LIMIT", "请填写正确的抽取次数。");
}

function isLegacyGeneratedWheelItem(item: string): boolean {
  return /^选项\d+\s*[-—:：]\s*.+$/.test(item.trim());
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

function resolveHomePersonaImageUrl(homePersonaAssetId: string | null): string {
  if (!homePersonaAssetId) {
    return "";
  }

  return HOME_PERSONA_OPTIONS.find((option) => option.id === homePersonaAssetId)?.imageUrl ?? "";
}

function normalizeProfileText(value: string): string {
  return value.trim();
}

function normalizeProfileBio(value: string): string {
  const normalized = value.trim();
  if (normalized.length > 40) {
    throw new BusinessError("PROFILE_BIO_TOO_LONG", "个人签名最多输入 40 个字。");
  }
  return normalized;
}

function normalizeProfileTags(tagsInput: string): string[] {
  const tags = parseTags(tagsInput);
  if (tags.length > 4) {
    throw new BusinessError("PROFILE_TAGS_LIMIT_EXCEEDED", "最多填写 4 个标签。");
  }
  const oversizedTag = tags.find((tag) => tag.length > 6);
  if (oversizedTag) {
    throw new BusinessError("PROFILE_TAG_TOO_LONG", "每个标签最多输入 6 个字。");
  }
  return tags;
}

function normalizeAge(value: string): string {
  return value.replace(/\D+/g, "").slice(0, 3);
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

function buildLotteryCards(answers: string[]): LotteryCard[] {
  return shuffleArray(answers).map((answer, index) => ({
    id: `${createId("lottery-card")}-${index + 1}`,
    order: index + 1,
    answer,
    claimedByUserId: null,
    claimedAt: null
  }));
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
    if (toolState.phase === "active") {
      return "投票中";
    }
    return toolState.phase === "ended" ? "已结束" : "待发布";
  }
  if (toolState.type === "wheel") {
    return toolState.phase === "result" ? "已落点" : "待转动";
  }
  return toolState.cards.some((card) => !card.claimedByUserId) ? "进行中" : "已抽完";
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

function compareVoteResultOptions(left: VoteOptionView, right: VoteOptionView): number {
  if (right.supportCount !== left.supportCount) {
    return right.supportCount - left.supportCount;
  }
  return left.label.localeCompare(right.label, "zh-Hans-CN");
}

function compareFavoriteRankingItems(
  left: FavoriteRankingItemView & { joinedAt: number },
  right: FavoriteRankingItemView & { joinedAt: number }
): number {
  if (right.favoriteCount !== left.favoriteCount) {
    return right.favoriteCount - left.favoriteCount;
  }
  if (left.joinedAt !== right.joinedAt) {
    return left.joinedAt - right.joinedAt;
  }
  return left.userId.localeCompare(right.userId);
}

type TripContext = {
  currentUser: User;
  tripId: string;
  trip: Trip;
  role: ViewerRole;
  isOwnTrip: boolean;
};

type InteractiveTripContext = TripContext & {
  role: MemberRole;
  isOwnTrip: true;
};

type AdminTripContext = InteractiveTripContext & {
  role: "admin";
};

type BoardingToggleResult = {
  result: BootstrapResult;
  action: "checked-in" | "cancelled";
};

type SeatLocation = {
  tripId: string;
  seatCode: string;
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
    const currentTripId = this.requireCurrentTripId(currentUser);
    const now = Date.now();
    return {
      currentUser,
      demoUsers: this.buildDemoUsers(currentUser.id),
      homeMode: "trip",
      homeTitle: this.getHomeTitle(),
      currentTripLabel: this.getTripLabel(currentTripId),
      canEditHomeTitle: this.canCurrentUserEditHomeTitle(currentUser),
      currentTrip: this.buildCurrentTripView(currentTripId, currentUser.id),
      tripSwitchOptions: this.buildTripSwitchOptions(currentUser),
      viewerSeatSummary: this.buildViewerSeatSummary(currentUser),
      boardingButton: this.buildBoardingButton(currentUser, currentTripId, now)
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
    const currentTripId = this.requireCurrentTripId(currentUser);
    let currentTrip = this.tripRepository.getTrip(currentTripId);
    if (this.finalizeSeatDrawRoundIfDueForTrip(currentTrip.id)) {
      currentTrip = this.tripRepository.getTrip(currentTrip.id);
    }
    const role = this.getViewerRole(currentUser, currentTrip.id);

    return {
      ...accessState,
      tripName: displayTripName(currentTrip.tripName),
      viewerRoleLabel: this.getViewerRoleLabel(role),
      isAdmin: role === "admin",
      emptyTitle: "所有玩法都在这里",
      emptyDescription: "让旅途更有趣",
      toolCards: this.buildToolCards(currentUser, currentTrip, role)
    };
  }

  getToolDetailPageData(toolType: ToolType): ToolDetailViewModel {
    const context = this.requireTripContext();
    if (toolType === "seat-draw") {
      this.finalizeSeatDrawRoundIfDueForTrip(context.tripId);
    }
    const trip = this.tripRepository.getTrip(context.tripId);
    const toolState = this.getPublishedToolState(trip, toolType);

    return {
      ...this.buildAccessState(context.currentUser),
      tripName: displayTripName(trip.tripName),
      viewerRoleLabel: this.getViewerRoleLabel(context.role),
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
          ? this.buildWheelDetail(trip, toolState as PublishedWheelToolState | null, context.currentUser.id, context.role)
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
    const maxSelections = assertVoteMaxSelections(
      input.maxSelections,
      selectionMode,
      optionLabels.length
    );
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
        maxSelections,
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
    const maxSelections = assertVoteMaxSelections(
      input.maxSelections,
      selectionMode,
      optionLabels.length
    );
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
              selectionMode === "single"
                ? remappedOptionIds.slice(0, 1)
                : remappedOptionIds.slice(0, maxSelections)
          };
          return accumulator;
        },
        {}
      );

      nextState.publishedAt = Date.now();
      nextState.publishedByUserId = context.currentUser.id;
      nextState.topic = topic;
      nextState.selectionMode = selectionMode;
      nextState.maxSelections = maxSelections;
      nextState.excludeAdmin = excludeAdmin;
      nextState.options = nextOptions;
      nextState.participantUserIds = participantUserIds;
      nextState.submissions = nextSubmissions;
    });

    return this.getToolDetailPageData("vote");
  }

  submitVote(input: VoteSubmitInput): ToolDetailViewModel {
    const context = this.requireInteractiveTripContext();
    const safeChoice = assertVoteChoice(input.choice);
    const optionIds = Array.isArray(input.optionIds)
      ? input.optionIds.map((optionId) => optionId.trim()).filter(Boolean)
      : [];
    const toolState = this.requireStartedTool(context.trip, "vote") as PublishedVoteToolState;
    const existingSubmission = toolState.submissions[context.currentUser.id] ?? null;

    if (toolState.phase === "draft") {
      throw new BusinessError("VOTE_NOT_STARTED", "管理员还没有发布本轮投票。");
    }
    if (toolState.phase === "ended") {
      throw new BusinessError("VOTE_ENDED", "本轮投票已结束。");
    }
    if (!toolState.participantUserIds.includes(context.currentUser.id)) {
      throw new BusinessError("VOTE_NOT_ALLOWED", "你不在本轮投票名单中。");
    }
    if (existingSubmission) {
      throw new BusinessError("VOTE_ALREADY_SUBMITTED", "本轮投票只能提交一次。");
    }

    const validOptionIds = new Set(toolState.options.map((option) => option.id));
    const normalizedOptionIds = Array.from(new Set(optionIds)).filter((optionId) =>
      validOptionIds.has(optionId)
    );

    if (safeChoice === "approve" && !normalizedOptionIds.length) {
      throw new BusinessError("VOTE_OPTION_REQUIRED", "请先选择投票选项。");
    }
    if (toolState.selectionMode === "single" && normalizedOptionIds.length > 1) {
      throw new BusinessError("VOTE_SINGLE_OPTION_ONLY", "当前投票为单选，请只选择 1 个选项。");
    }
    if (toolState.selectionMode === "multiple" && normalizedOptionIds.length > toolState.maxSelections) {
      throw new BusinessError(
        "VOTE_SELECTION_LIMIT_EXCEEDED",
        `当前投票最多可选择 ${toolState.maxSelections} 项。`
      );
    }

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "vote") as PublishedVoteToolState;
      nextState.submissions[context.currentUser.id] = {
        choice: safeChoice,
        optionIds: normalizedOptionIds,
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

  endVote(): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    const toolState = this.requireStartedTool(context.trip, "vote") as PublishedVoteToolState;
    if (toolState.phase === "ended") {
      throw new BusinessError("VOTE_ALREADY_ENDED", "本轮投票已经结束。");
    }
    if (toolState.phase !== "active") {
      throw new BusinessError("VOTE_NOT_STARTED", "管理员还没有发布本轮投票。");
    }

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "vote") as PublishedVoteToolState;
      nextState.phase = "ended";
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
    const topic = assertWheelTopic(typeof input.topic === "string" ? input.topic : "大转盘");
    const items = assertWheelItems(input.items);
    const permissionConfig = this.resolveWheelPermissionConfig(context.tripId, input);

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      trip.tools.wheel = {
        type: "wheel",
        publishedAt: Date.now(),
        publishedByUserId: context.currentUser.id,
        phase: "draft",
        topic,
        items,
        allowAssignedUser: permissionConfig.allowAssignedUser,
        assignedUserId: permissionConfig.assignedUserId,
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
    const topic = assertWheelTopic(
      typeof input.topic === "string" ? input.topic : getFallbackTopic(toolState.topic, "大转盘")
    );
    const items = assertWheelItems(input.items);
    const permissionConfig = this.resolveWheelPermissionConfig(context.tripId, input);
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
      nextState.topic = topic;
      nextState.items = items;
      nextState.allowAssignedUser = permissionConfig.allowAssignedUser;
      nextState.assignedUserId = permissionConfig.assignedUserId;
      nextState.resultIndex = nextResultIndex >= 0 ? nextResultIndex : null;
      nextState.resultHistoryLabels = previousHistoryLabels;
      nextState.phase = nextState.resultIndex === null ? "draft" : "result";
    });

    return this.getToolDetailPageData("wheel");
  }

  spinWheel(selectedIndex?: number): ToolDetailViewModel {
    const context = this.requireInteractiveTripContext();
    const toolState = this.requireStartedTool(context.trip, "wheel") as PublishedWheelToolState;
    this.assertViewerCanSpinWheel(toolState, context.currentUser.id, context.role);
    const items = assertWheelItems(toolState.items);
    const resultIndex =
      typeof selectedIndex === "number" && Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < items.length
        ? selectedIndex
        : Math.floor(Math.random() * items.length);

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
    const topic = assertLotteryTopic(typeof input.topic === "string" ? input.topic : "幸运签");
    const answers = assertLotteryAnswers(input.answers);
    const drawLimitPerUser = assertLotteryDrawLimit(input.drawLimitPerUser);
    const permissionConfig = this.resolveLotteryPermissionConfig(context.tripId, context.currentUser.id, input);

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      trip.tools.lottery = {
        type: "lottery",
        publishedAt: Date.now(),
        publishedByUserId: context.currentUser.id,
        phase: "active",
        topic,
        answers,
        cards: buildLotteryCards(answers),
        allowAssignedUser: permissionConfig.allowAssignedUser,
        assignedUserId: permissionConfig.assignedUserId,
        drawLimitPerUser,
        claimsByUserId: {}
      };
    });

    return this.getToolDetailPageData("lottery");
  }

  recreateLotteryTool(input: LotteryPublishInput): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    this.requireStartedTool(context.trip, "lottery");
    const topic = assertLotteryTopic(typeof input.topic === "string" ? input.topic : "幸运签");
    const answers = assertLotteryAnswers(input.answers);
    const drawLimitPerUser = assertLotteryDrawLimit(input.drawLimitPerUser);
    const permissionConfig = this.resolveLotteryPermissionConfig(context.tripId, context.currentUser.id, input);

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "lottery") as PublishedLotteryToolState;
      nextState.publishedAt = Date.now();
      nextState.publishedByUserId = context.currentUser.id;
      nextState.phase = "active";
      nextState.topic = topic;
      nextState.answers = answers;
      nextState.cards = buildLotteryCards(answers);
      nextState.allowAssignedUser = permissionConfig.allowAssignedUser;
      nextState.assignedUserId = permissionConfig.assignedUserId;
      nextState.drawLimitPerUser = drawLimitPerUser;
      nextState.claimsByUserId = {};
    });

    return this.getToolDetailPageData("lottery");
  }

  claimLottery(cardId: string): ToolDetailViewModel {
    const context = this.requireInteractiveTripContext();
    const toolState = this.requireStartedTool(context.trip, "lottery") as PublishedLotteryToolState;

    if (toolState.phase !== "active") {
      throw new BusinessError("LOTTERY_NOT_STARTED", "管理员还没有发布本轮抓阄。");
    }
    this.assertViewerCanClaimLottery(toolState, context.currentUser.id);

    const viewerClaims = toolState.claimsByUserId[context.currentUser.id] ?? [];
    if (viewerClaims.length >= toolState.drawLimitPerUser) {
      throw new BusinessError("LOTTERY_DRAW_LIMIT_REACHED", "你的抽取次数已用完。");
    }
    if (!toolState.cards.some((card) => !card.claimedByUserId)) {
      throw new BusinessError("LOTTERY_NO_CARDS_LEFT", "所有卡片都已被抽取。");
    }

    const targetCard = toolState.cards.find((card) => card.id === cardId);
    if (!targetCard) {
      throw new BusinessError("LOTTERY_CARD_NOT_FOUND", "未找到对应卡片。");
    }
    if (targetCard.claimedByUserId) {
      throw new BusinessError("LOTTERY_CARD_ALREADY_CLAIMED", "这张卡片已经被抽取。");
    }

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "lottery") as PublishedLotteryToolState;
      const nextCard = nextState.cards.find((card) => card.id === cardId);
      if (!nextCard) {
        throw new BusinessError("LOTTERY_CARD_NOT_FOUND", "未找到对应卡片。");
      }
      if (nextCard.claimedByUserId) {
        throw new BusinessError("LOTTERY_CARD_ALREADY_CLAIMED", "这张卡片已经被抽取。");
      }

      const claimedAt = Date.now();
      nextCard.claimedByUserId = context.currentUser.id;
      nextCard.claimedAt = claimedAt;
      const nextClaims = nextState.claimsByUserId[context.currentUser.id] ?? [];
      if (nextClaims.length >= nextState.drawLimitPerUser) {
        throw new BusinessError("LOTTERY_DRAW_LIMIT_REACHED", "你的抽取次数已用完。");
      }
      nextClaims.push({
        cardId: nextCard.id,
        order: nextCard.order,
        answer: nextCard.answer,
        claimedAt
      });
      nextState.claimsByUserId[context.currentUser.id] = nextClaims;
    });

    return this.getToolDetailPageData("lottery");
  }

  resetLottery(): ToolDetailViewModel {
    const context = this.requireAdminTripContext();
    this.requireStartedTool(context.trip, "lottery");

    this.tripRepository.updateTrip(context.tripId, (trip) => {
      const nextState = this.requireStartedTool(trip, "lottery") as PublishedLotteryToolState;
      nextState.phase = "active";
      nextState.cards = nextState.cards.map((card) => ({
        ...card,
        claimedByUserId: null,
        claimedAt: null
      }));
      nextState.claimsByUserId = {};
    });

    return this.getToolDetailPageData("lottery");
  }

  closeLottery(): ToolDetailViewModel {
    return this.closeTool("lottery");
  }

  enableSeedDemoData(): void {
    this.replaceAppState(createSeededDemoAppState());
  }

  disableSeedDemoData(): void {
    this.replaceAppState(createInitialAppState());
  }

  getProfilePageData(): ProfilePageViewModel {
    const appState = this.appStateRepository.read();
    const currentUser = this.getActiveUser();
    const currentTripId = this.requireCurrentTripId(currentUser);
    const currentTrip = this.buildCurrentTripView(currentTripId, currentUser.id);
    const globalSeat = this.findUserSeatAcrossTrips(currentUser.id);

    return {
      ...this.buildAccessState(currentUser),
      demoUsers: this.buildDemoUsers(currentUser.id),
      seedDemoEnabled: isSeededDemoAppState(appState),
      currentUserInitial: getInitial(currentUser.nickname),
      currentTripTitle: currentTrip.tripMeta.tripName,
      currentSeatLabel: globalSeat ? `${this.getTripLabel(globalSeat.tripId)} ${globalSeat.seatCode}` : "未入座",
      currentRoleLabel: currentTrip.tripMeta.viewerRoleLabel,
      profileSummary: currentUser.bio || "去完善个人资料",
      livingLocationDisplay: formatLivingLocationDisplay(currentUser.livingCity),
      hometownLocationDisplay: formatHometownLocationDisplay(currentUser.hometown),
      tags: currentUser.tags,
      showTagsCard: true,
      showPrimaryAction: false,
      primaryActionKind: "none",
      primaryActionLabel: ""
    };
  }

  getHomeSettingsPageData(): HomeSettingsPageViewModel {
    const currentUser = this.getActiveUser();
    const currentTripId = this.requireCurrentTripId(currentUser);
    const memberRole = this.getViewerRole(currentUser, currentTripId);
    const homeTitle = this.getHomeTitle();

    return {
      ...this.buildAccessState(currentUser),
      homeTitle,
      draftHomeTitle: homeTitle,
      canEditHomeTitle: memberRole === "admin",
      currentTripLabel: this.getTripLabel(currentTripId),
      viewerRoleLabel: this.getViewerRoleLabel(memberRole),
      isSaving: false
    };
  }

  async saveHomeTitle(title: string): Promise<HomeSettingsPageViewModel> {
    const currentUser = this.getActiveUser();
    const currentTripId = this.requireCurrentTripId(currentUser);
    const memberRole = this.getViewerRole(currentUser, currentTripId);
    if (memberRole !== "admin") {
      throw new BusinessError("ADMIN_ONLY", "只有管理员可以修改首页标题。");
    }

    const normalizedTitle = assertHomeTitle(title);
    const previousRuntimeConfig = this.getRuntimeConfig();
    const nextRuntimeConfig: RuntimeConfig = {
      ...previousRuntimeConfig,
      homeTitle: normalizedTitle
    };

    this.appStateRepository.update((state) => {
      state.runtimeConfig = nextRuntimeConfig;
    });

    try {
      await writeCloudRuntimeConfig(nextRuntimeConfig);
    } catch (error) {
      this.appStateRepository.update((state) => {
        state.runtimeConfig = previousRuntimeConfig;
      });
      throw error;
    }

    return this.getHomeSettingsPageData();
  }

  toggleBoardingCheckIn(): BoardingToggleResult {
    const context = this.requireInteractiveTripContext();
    const targetTripId = context.tripId;
    const seatCode = this.getCurrentSeatCode(targetTripId, context.currentUser.id);
    if (!seatCode) {
      if (this.findUserSeatAcrossTrips(context.currentUser.id)) {
        throw new BusinessError("SEAT_RELEASE_REQUIRED", "请先释放座位。");
      }
      throw new BusinessError("SEAT_REQUIRED", "请先入座后再打卡。");
    }

    const now = Date.now();
    const activeRecord = this.getActiveBoardingRecord(context.currentUser, targetTripId, now);
    if (activeRecord && now < activeRecord.confirmDeadlineAt) {
      this.userRepository.updateUser(context.currentUser.id, (user) => {
        user.boardingRecordsByTripId[targetTripId] = this.listBoardingRecords(user, targetTripId).filter(
          (record) => record.id !== activeRecord.id
        );
      });
      return {
        result: this.bootstrapApp(),
        action: "cancelled"
      };
    }

    if (activeRecord) {
      throw new BusinessError("BOARDING_LOCKED", "当前打卡已锁定，请稍后再试。");
    }

    this.userRepository.updateUser(context.currentUser.id, (user) => {
      const record: BoardingRecord = {
        id: createId("boarding-record"),
        tripId: targetTripId,
        seatCode,
        createdAt: now,
        status: "pending",
        confirmDeadlineAt: now + BOARDING_CONFIRM_WINDOW_MS,
        resetAt: now + BOARDING_RESET_WINDOW_MS
      };
      user.boardingRecordsByTripId[targetTripId] = [
        record,
        ...this.listBoardingRecords(user, targetTripId)
      ];
    });

    return {
      result: this.bootstrapApp(),
      action: "checked-in"
    };
  }

  getBoardingRecordPageData(selectedTripFilter: "all" | "trip1" | "trip2" = "all"): BoardingRecordPageViewModel {
    const currentUser = this.ensureAuthorizedAccess();
    const currentTripId = this.requireCurrentTripId(currentUser);
    const viewerRole = this.getViewerRole(currentUser, currentTripId);
    const isAdmin = viewerRole === "admin";
    const flatRecords = isAdmin ? [] : this.buildViewerBoardingRecordItems(currentUser);
    const memberGroups = isAdmin ? this.buildAdminBoardingRecordGroups(selectedTripFilter) : [];

    return {
      ...this.buildAccessState(currentUser),
      isAdmin,
      viewerRoleLabel: this.getViewerRoleLabel(viewerRole),
      selectedTripFilter,
      tripFilterOptions: [
        { value: "all", label: "全部" },
        { value: "trip1", label: "1车" },
        { value: "trip2", label: "2车" }
      ],
      flatRecords,
      memberGroups
    };
  }

  getFavoritesPageData(): FavoritePageViewModel {
    const currentUser = this.getActiveUser();
    const accessState = this.buildAccessState(currentUser);
    const currentTrip = this.buildCurrentTripView(this.requireCurrentTripId(currentUser), currentUser.id);
    const favoriteMembers = currentTrip.members
      .filter((member) => member.isFavoritedByViewer)
      .map((member) => this.buildFavoriteMemberCardView(member));
    const ranking = currentTrip.tripMeta.viewerRole === "admin"
      ? this.buildFavoriteRankingItems(currentTrip.tripMeta.tripId, currentTrip.members)
      : [];

    return {
      ...accessState,
      tripName: currentTrip.tripMeta.tripName,
      viewerRoleLabel: currentTrip.tripMeta.viewerRoleLabel,
      isAdmin: currentTrip.tripMeta.isAdmin,
      favoriteLimit: MAX_MEMBER_FAVORITES_PER_TRIP,
      favoriteCount: favoriteMembers.length,
      showRankingTab: currentTrip.tripMeta.isAdmin,
      favorites: favoriteMembers,
      ranking
    };
  }

  getPassengerPageData(): PassengerPageViewModel {
    const currentUser = this.getActiveUser();
    const currentTripId = this.requireCurrentTripId(currentUser);

    return {
      ...this.buildAccessState(currentUser),
      currentTripId,
      currentTripLabel: this.getTripLabel(currentTripId),
      filterOptions: this.buildPassengerFilterOptions(),
      memberGroups: this.buildPassengerMemberGroups(currentUser, currentTripId)
    };
  }

  getTagEditorData(): TagEditorViewModel {
    const currentUser = this.ensureAuthorizedAccess();
    const tripName = this.tripRepository.getTrip(this.requireCurrentTripId(currentUser)).tripName;
    return this.buildTagEditorView(currentUser, tripName);
  }

  getTripSettings(): TripSettingsViewModel {
    const context = this.requireInteractiveTripContext();
    const relation = this.requireMembership(context.tripId, context.currentUser.id);
    return {
      tripId: context.trip.id,
      tripName: displayTripName(context.trip.tripName),
      departureTime: displayDepartureTime(context.trip.departureTime),
      password: context.trip.password,
      templateId: context.trip.templateId,
      role: relation.role
    };
  }

  switchActiveUser(userId: string): BootstrapResult {
    this.userRepository.getUser(userId);
    this.sessionRepository.setActiveUserId(userId);
    return this.bootstrapApp();
  }

  switchCurrentTrip(tripId: string): BootstrapResult {
    const currentUser = this.getActiveUser();
    const trip = this.tripRepository.getTrip(tripId);
    if (trip.status !== "active") {
      throw new BusinessError("TRIP_INACTIVE", "当前车次不可查看。");
    }

    this.userRepository.setCurrentTripId(currentUser.id, tripId);
    return this.bootstrapApp();
  }

  toggleFavoriteMember(targetUserId: string): BootstrapResult {
    const context = this.requireInteractiveTripContext();
    if (!this.tripRepository.getTripMember(context.tripId, targetUserId)) {
      throw new BusinessError("FAVORITE_TARGET_INVALID", "只能标记当前车次成员。");
    }
    if (targetUserId === context.currentUser.id) {
      throw new BusinessError("FAVORITE_SELF_NOT_ALLOWED", "不能标记自己。");
    }

    if (this.tripRepository.hasTripFavorite(context.tripId, context.currentUser.id, targetUserId)) {
      this.tripRepository.removeTripFavorite(context.tripId, context.currentUser.id, targetUserId);
      return this.bootstrapApp();
    }

    const currentFavoriteCount = this.tripRepository
      .listTripFavorites(context.tripId)
      .filter((favorite) => favorite.sourceUserId === context.currentUser.id).length;
    if (currentFavoriteCount >= MAX_MEMBER_FAVORITES_PER_TRIP) {
      throw new BusinessError(
        "FAVORITE_LIMIT_EXCEEDED",
        `最多可标记 ${MAX_MEMBER_FAVORITES_PER_TRIP} 人。`
      );
    }

    this.tripRepository.addTripFavorite(
      context.tripId,
      context.currentUser.id,
      targetUserId,
      Date.now()
    );
    return this.bootstrapApp();
  }

  updateProfile(input: UpdateProfileInput): TagEditorViewModel {
    const currentUser = this.ensureAuthorizedAccess();

    this.userRepository.updateUser(currentUser.id, (user) => {
      user.tags = normalizeProfileTags(input.tagsInput);
      user.bio = normalizeProfileBio(input.bio);
      user.livingCity = normalizeProfileText(input.livingCity);
      user.hometown = normalizeProfileText(input.hometown);
      user.age = normalizeAge(input.age);
    });

    const nextUser = this.userRepository.getUser(currentUser.id);
    return this.buildTagEditorView(nextUser);
  }

  updateTags(tagsInput: string): TagEditorViewModel {
    const currentUser = this.ensureAuthorizedAccess();
    return this.updateProfile({
      tagsInput,
      bio: currentUser.bio,
      livingCity: currentUser.livingCity,
      hometown: currentUser.hometown,
      age: currentUser.age
    });
  }

  updateHomePersona(homePersonaAssetId: string | null): BootstrapResult {
    const currentUser = this.ensureAuthorizedAccess();
    const normalizedHomePersonaAssetId =
      homePersonaAssetId && HOME_PERSONA_OPTIONS.some((option) => option.id === homePersonaAssetId)
        ? homePersonaAssetId
        : null;

    this.userRepository.updateUser(currentUser.id, (user) => {
      user.homePersonaAssetId = normalizedHomePersonaAssetId;
    });

    return this.bootstrapApp();
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

  generateAvailableTripPassword(): string {
    for (let index = 0; index < 1000; index += 1) {
      const candidate = createSixDigitPassword(Math.floor(Math.random() * 1000000));
      if (!this.tripRepository.findActiveTripByPassword(candidate)) {
        return candidate;
      }
    }

    for (let index = 0; index <= 999999; index += 1) {
      const candidate = createSixDigitPassword(index);
      if (!this.tripRepository.findActiveTripByPassword(candidate)) {
        return candidate;
      }
    }

    throw new BusinessError("PASSWORD_POOL_EXHAUSTED", "车次口令已用完，请稍后再试。");
  }

  createTrip(input: CreateTripInput): BootstrapResult {
    void input;
    throw new BusinessError("FIXED_TRIP_MODE", "固定双车次模式下直接查看 1车 或 2车。");
  }

  joinTripByPassword(password: string): BootstrapResult {
    void password;
    throw new BusinessError("FIXED_TRIP_MODE", "固定双车次模式下直接查看 1车 或 2车。");
  }

  leaveCurrentTrip(): BootstrapResult {
    throw new BusinessError("FIXED_TRIP_MODE", "固定双车次模式下不提供当前操作。");
  }

  dissolveCurrentTrip(): BootstrapResult {
    throw new BusinessError("FIXED_TRIP_MODE", "固定双车次模式下不提供当前操作。");
  }

  claimSeat(seatCode: string, profileInput?: ClaimSeatProfileInput): BootstrapResult {
    const context = this.requireInteractiveTripContext();
    const trip = this.tripRepository.getTrip(context.tripId);
    if (!Object.prototype.hasOwnProperty.call(trip.seatMap, seatCode)) {
      throw new BusinessError("SEAT_NOT_FOUND", "未找到这个座位。");
    }
    if (trip.seatMap[seatCode]) {
      throw new BusinessError("SEAT_OCCUPIED", "这个座位已经有人了。");
    }
    const globalSeat = this.findUserSeatAcrossTrips(context.currentUser.id);
    if (globalSeat?.tripId === context.tripId) {
      throw new BusinessError("ALREADY_SEATED", "你已经入座了。");
    }

    this.moveUserSeatToTrip(context.currentUser.id, context.tripId, seatCode);

    void profileInput;
    return this.bootstrapApp();
  }

  switchSeat(targetSeatCode: string): BootstrapResult {
    const context = this.requireInteractiveTripContext();
    const globalSeat = this.findUserSeatAcrossTrips(context.currentUser.id);
    if (!globalSeat) {
      throw new BusinessError("SEAT_REQUIRED", "你还没有入座。");
    }

    const trip = this.tripRepository.getTrip(context.tripId);
    if (!Object.prototype.hasOwnProperty.call(trip.seatMap, targetSeatCode)) {
      throw new BusinessError("SEAT_NOT_FOUND", "未找到这个座位。");
    }

    if (trip.seatMap[targetSeatCode]) {
      throw new BusinessError("SEAT_OCCUPIED", "该座位已被占用。");
    }
    if (globalSeat.tripId === context.tripId && globalSeat.seatCode === targetSeatCode) {
      throw new BusinessError("ALREADY_SEATED", "你已经在这个座位了。");
    }

    this.moveUserSeatToTrip(context.currentUser.id, context.tripId, targetSeatCode);

    return this.bootstrapApp();
  }

  releaseMySeat(): BootstrapResult {
    const context = this.requireInteractiveTripContext();
    const globalSeat = this.findUserSeatAcrossTrips(context.currentUser.id);
    if (!globalSeat) {
      throw new BusinessError("SEAT_REQUIRED", "你当前还没有座位。");
    }

    this.clearUserSeatsAcrossTrips(context.currentUser.id);
    return this.bootstrapApp();
  }

  adminReleaseSeat(targetUserId: string): BootstrapResult {
    const context = this.requireAdminTripContext();
    if (targetUserId === context.currentUser.id) {
      throw new BusinessError("SELF_RELEASE_ONLY", "请从自己的座位卡中解除当前座位。");
    }

    const targetSeatCode = this.getCurrentSeatCode(context.tripId, targetUserId);
    if (!targetSeatCode) {
      throw new BusinessError("TARGET_NOT_SEATED", "对方当前还没有入座。");
    }

    this.tripRepository.updateTrip(context.tripId, (trip) => {
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

      state.runtimeConfig = this.normalizeRuntimeConfig(state.runtimeConfig);

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

      Object.values(state.users).forEach((user) => {
        const hasCurrentTrip =
          Boolean(user.currentTripId) &&
          Boolean(state.trips[user.currentTripId!]) &&
          state.trips[user.currentTripId!].status === "active";
        user.currentTripId = hasCurrentTrip ? user.currentTripId : DEFAULT_VIEW_TRIP_ID;
        user.memberTripId = user.currentTripId;

        const normalizedBoardingRecords = Object.entries(user.boardingRecordsByTripId ?? {}).reduce<
          User["boardingRecordsByTripId"]
        >((accumulator, [tripId, records]) => {
          const trip = state.trips[tripId];
          if (!trip || trip.status !== "active" || !Array.isArray(records)) {
            return accumulator;
          }

          const nextRecords = records
            .filter((record) => typeof record.seatCode === "string" && Boolean(record.seatCode))
            .map((record) => ({
              ...record,
              tripId,
              status:
                record.status === "confirmed" || record.confirmDeadlineAt <= Date.now()
                  ? ("confirmed" as const)
                  : ("pending" as const)
            }))
            .sort((left, right) => right.createdAt - left.createdAt);

          accumulator[tripId] = nextRecords;
          return accumulator;
        }, {});

        user.boardingRecordsByTripId = normalizedBoardingRecords;
      });

      const membershipKeys = new Set(
        state.tripMembers.map((member) => `${member.tripId}:${member.userId}`)
      );
      Object.values(state.users).forEach((user) => {
        [FIXED_TRIP_IDS.trip1, FIXED_TRIP_IDS.trip2].forEach((tripId) => {
          const trip = state.trips[tripId];
          if (!trip || trip.status !== "active") {
            return;
          }

          const membershipKey = `${tripId}:${user.id}`;
          if (membershipKeys.has(membershipKey)) {
            return;
          }

          state.tripMembers.push({
            tripId,
            userId: user.id,
            role: "member",
            joinedAt: Math.max(Date.now(), trip.createdAt)
          });
          membershipKeys.add(membershipKey);
        });
      });

      const tripAdminUserIds = state.runtimeConfig.tripAdminUserIds;
      state.tripMembers.forEach((member) => {
        member.role = tripAdminUserIds[member.tripId] === member.userId ? "admin" : "member";
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

        TOOL_TYPES.forEach((toolType) => {
          const toolState = trip.tools[toolType];
          if (!toolState || toolState.type !== toolType) {
            trip.tools[toolType] = null;
            return;
          }

          const publisherRelation = tripMembers.find(
            (member) => member.userId === toolState.publishedByUserId
          );
          if (!publisherRelation) {
            trip.tools[toolType] = null;
            return;
          }

          if (toolType === "wheel") {
            const wheelState = toolState as PublishedWheelToolState;
            const normalizedItems = Array.isArray(wheelState.items)
              ? wheelState.items
                  .map((item) => (typeof item === "string" ? item.trim() : ""))
                  .filter(Boolean)
              : [];

            if (normalizedItems.length && normalizedItems.every(isLegacyGeneratedWheelItem)) {
              wheelState.items = DEFAULT_WHEEL_ITEMS.slice(0, WHEEL_MAX_ITEMS);
              wheelState.phase = "draft";
              wheelState.resultIndex = null;
              wheelState.resultHistoryLabels = [];
              wheelState.spunAt = null;
              return;
            }

            wheelState.items = normalizedItems.slice(0, WHEEL_MAX_ITEMS);
            if (wheelState.items.length < 2) {
              trip.tools[toolType] = null;
              return;
            }

            wheelState.allowAssignedUser = Boolean(wheelState.allowAssignedUser);
            if (
              !wheelState.allowAssignedUser ||
              typeof wheelState.assignedUserId !== "string" ||
              !state.tripMembers.some(
                (member) => member.tripId === trip.id && member.userId === wheelState.assignedUserId
              )
            ) {
              wheelState.allowAssignedUser = false;
              wheelState.assignedUserId = null;
            }

            if (
              typeof wheelState.resultIndex !== "number" ||
              wheelState.resultIndex < 0 ||
              wheelState.resultIndex >= wheelState.items.length
            ) {
              wheelState.resultIndex = null;
            }

            wheelState.resultHistoryLabels = Array.isArray(wheelState.resultHistoryLabels)
              ? wheelState.resultHistoryLabels.filter((label) => wheelState.items.includes(label))
              : [];
            return;
          }

          if (toolType === "lottery") {
            const lotteryState = toolState as PublishedLotteryToolState;
            if (!Array.isArray(lotteryState.cards) || !lotteryState.cards.length) {
              trip.tools[toolType] = null;
              return;
            }

            lotteryState.phase = "active";
            lotteryState.drawLimitPerUser =
              Number.isInteger(lotteryState.drawLimitPerUser) && lotteryState.drawLimitPerUser > 0
                ? lotteryState.drawLimitPerUser
                : 1;
            lotteryState.answers = Array.isArray(lotteryState.answers)
              ? lotteryState.answers
                  .map((answer) => (typeof answer === "string" ? answer.trim() : ""))
                  .filter(Boolean)
              : [];
            if (!lotteryState.answers.length) {
              lotteryState.answers = lotteryState.cards.map((card) => card.answer);
            }

            const validMemberIds = new Set(tripMembers.map((member) => member.userId));
            const fallbackAssignedUserId = toolState.publishedByUserId;
            lotteryState.allowAssignedUser = Boolean(lotteryState.allowAssignedUser);
            if (
              !lotteryState.allowAssignedUser ||
              typeof lotteryState.assignedUserId !== "string" ||
              !validMemberIds.has(lotteryState.assignedUserId)
            ) {
              lotteryState.allowAssignedUser = false;
              lotteryState.assignedUserId = fallbackAssignedUserId;
            }

            const claimedCardsByUserId = lotteryState.cards.reduce<Record<string, LotteryClaimRecord[]>>(
              (accumulator, card) => {
                if (!card.claimedByUserId) {
                  card.claimedAt = null;
                  return accumulator;
                }
                if (!validMemberIds.has(card.claimedByUserId)) {
                  card.claimedByUserId = null;
                  card.claimedAt = null;
                  return accumulator;
                }

                const claimedAt = typeof card.claimedAt === "number" ? card.claimedAt : 0;
                card.claimedAt = claimedAt;
                if (!accumulator[card.claimedByUserId]) {
                  accumulator[card.claimedByUserId] = [];
                }
                accumulator[card.claimedByUserId].push({
                  cardId: card.id,
                  order: card.order,
                  answer: card.answer,
                  claimedAt
                });
                return accumulator;
              },
              {}
            );

            Object.entries(claimedCardsByUserId).forEach(([userId, records]) => {
              const sortedRecords = [...records].sort((left, right) => left.claimedAt - right.claimedAt);
              const keptCardIds = new Set(
                sortedRecords
                  .slice(0, lotteryState.drawLimitPerUser)
                  .map((record) => record.cardId)
              );
              lotteryState.cards.forEach((card) => {
                if (card.claimedByUserId === userId && !keptCardIds.has(card.id)) {
                  card.claimedByUserId = null;
                  card.claimedAt = null;
                }
              });
            });

            lotteryState.claimsByUserId = lotteryState.cards.reduce<Record<string, LotteryClaimRecord[]>>(
              (accumulator, card) => {
                if (!card.claimedByUserId || typeof card.claimedAt !== "number") {
                  return accumulator;
                }

                if (!accumulator[card.claimedByUserId]) {
                  accumulator[card.claimedByUserId] = [];
                }
                accumulator[card.claimedByUserId].push({
                  cardId: card.id,
                  order: card.order,
                  answer: card.answer,
                  claimedAt: card.claimedAt
                });
                accumulator[card.claimedByUserId].sort((left, right) => left.claimedAt - right.claimedAt);
                return accumulator;
              },
              {}
            );
          }
        });
      });

      const validMembershipSet = new Set(
        state.tripMembers.map((member) => `${member.tripId}:${member.userId}`)
      );
      const dedupedFavorites = new Map<string, typeof state.tripFavorites[number]>();
      state.tripFavorites = (state.tripFavorites ?? []).filter((favorite) => {
        const trip = state.trips[favorite.tripId];
        if (!trip || trip.status !== "active") {
          return false;
        }
        if (!state.users[favorite.sourceUserId] || !state.users[favorite.targetUserId]) {
          return false;
        }
        if (favorite.sourceUserId === favorite.targetUserId) {
          return false;
        }
        if (
          !validMembershipSet.has(`${favorite.tripId}:${favorite.sourceUserId}`) ||
          !validMembershipSet.has(`${favorite.tripId}:${favorite.targetUserId}`)
        ) {
          return false;
        }

        const key = `${favorite.tripId}:${favorite.sourceUserId}:${favorite.targetUserId}`;
        const existing = dedupedFavorites.get(key);
        if (!existing || favorite.createdAt < existing.createdAt) {
          dedupedFavorites.set(key, favorite);
        }
        return !existing;
      });
      state.tripFavorites = Array.from(dedupedFavorites.values());

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
            hasValidMembership &&
            !seenUsers.has(occupiedUserId);

          if (!isValid) {
            trip.seatMap[seatCode] = null;
            return;
          }

          seenUsers.add(occupiedUserId);
        });
      });

      const seatLocationsByUserId = new Map<string, SeatLocation[]>();
      [FIXED_TRIP_IDS.trip1, FIXED_TRIP_IDS.trip2].forEach((tripId) => {
        const trip = state.trips[tripId];
        if (!trip || trip.status !== "active") {
          return;
        }

        Object.entries(trip.seatMap).forEach(([seatCode, occupiedUserId]) => {
          if (!occupiedUserId) {
            return;
          }
          const locations = seatLocationsByUserId.get(occupiedUserId) ?? [];
          locations.push({
            tripId,
            seatCode
          });
          seatLocationsByUserId.set(occupiedUserId, locations);
        });
      });

      seatLocationsByUserId.forEach((locations, userId) => {
        if (locations.length <= 1) {
          return;
        }

        const currentTripId = state.users[userId]?.currentTripId ?? DEFAULT_VIEW_TRIP_ID;
        const preferredLocation = locations.find((location) => location.tripId === currentTripId) ?? locations[0];

        locations.forEach((location) => {
          if (
            location.tripId === preferredLocation.tripId &&
            location.seatCode === preferredLocation.seatCode
          ) {
            return;
          }
          state.trips[location.tripId].seatMap[location.seatCode] = null;
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
    const tripId = user.currentTripId || this.getMemberTripId(user);
    if (!tripId) {
      throw new BusinessError("TRIP_REQUIRED", "当前没有可查看的车次。");
    }
    return tripId;
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
    const role = this.getViewerRole(currentUser, tripId);
    return {
      currentUser,
      tripId,
      trip,
      role,
      isOwnTrip: this.getMemberTripId(currentUser) === tripId
    };
  }

  private requireInteractiveTripContext(): InteractiveTripContext {
    const context = this.requireTripContext();
    this.assertAuthorizedUser(context.currentUser);
    if (context.role === "visitor") {
      throw new BusinessError("READ_ONLY_TRIP", "当前车次暂不支持操作。");
    }
    return context as InteractiveTripContext;
  }

  private requireAdminTripContext(): AdminTripContext {
    const context = this.requireInteractiveTripContext();
    if (context.role !== "admin") {
      throw new BusinessError("ADMIN_ONLY", "只有管理员可以操作当前玩法。");
    }
    return context as AdminTripContext;
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

  private findUserSeatAcrossTrips(userId: string): SeatLocation | null {
    for (const tripId of [FIXED_TRIP_IDS.trip1, FIXED_TRIP_IDS.trip2]) {
      const seatCode = this.getCurrentSeatCode(tripId, userId);
      if (seatCode) {
        return {
          tripId,
          seatCode
        };
      }
    }

    return null;
  }

  private clearUserSeatsAcrossTrips(userId: string): void {
    [FIXED_TRIP_IDS.trip1, FIXED_TRIP_IDS.trip2].forEach((tripId) => {
      this.tripRepository.updateTrip(tripId, (trip) => {
        Object.keys(trip.seatMap).forEach((seatCode) => {
          if (trip.seatMap[seatCode] === userId) {
            trip.seatMap[seatCode] = null;
          }
        });
      });
    });
  }

  private moveUserSeatToTrip(userId: string, targetTripId: string, targetSeatCode: string): void {
    this.clearUserSeatsAcrossTrips(userId);
    this.tripRepository.updateTrip(targetTripId, (trip) => {
      trip.seatMap[targetSeatCode] = userId;
    });
  }

  private listBoardingRecords(user: User, tripId: string): BoardingRecord[] {
    return Array.isArray(user.boardingRecordsByTripId[tripId])
      ? user.boardingRecordsByTripId[tripId]
      : [];
  }

  private getActiveBoardingRecord(
    user: User,
    tripId: string,
    now = Date.now()
  ): BoardingRecord | null {
    return (
      this.listBoardingRecords(user, tripId)
        .slice()
        .sort((left, right) => right.createdAt - left.createdAt)
        .find((record) => record.resetAt > now) ?? null
    );
  }

  private getSeatSortIndex(trip: Trip, seatCode: string | null): number {
    if (!seatCode) {
      return Number.MAX_SAFE_INTEGER;
    }
    const index = trip.seatCodes.indexOf(seatCode);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
  }

  private compareBoardingMembers(trip: Trip, left: TripMember, right: TripMember): number {
    const leftSeatIndex = this.getSeatSortIndex(trip, this.getCurrentSeatCode(trip.id, left.userId));
    const rightSeatIndex = this.getSeatSortIndex(trip, this.getCurrentSeatCode(trip.id, right.userId));
    if (leftSeatIndex !== rightSeatIndex) {
      return leftSeatIndex - rightSeatIndex;
    }
    if (left.joinedAt !== right.joinedAt) {
      return left.joinedAt - right.joinedAt;
    }
    return left.userId.localeCompare(right.userId);
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
      hasCurrentTrip: Boolean(this.requireCurrentTripId(currentUser))
    };
  }

  private buildToolCards(
    currentUser: User,
    trip: Trip | null,
    role: ViewerRole | null
  ): ToolCardView[] {
    return TOOL_TYPES.map((toolType) => {
      const toolState = trip ? this.getPublishedToolState(trip, toolType) : null;
      const hasCurrentTrip = Boolean(trip);
      const displayMeta = TOOL_PAGE_META[toolType];
      let helperText = "进入详情查看";

      if (!hasCurrentTrip) {
        helperText = "当前没有可查看车次";
      } else {
        if (role === "visitor") {
          helperText = toolState ? "进入详情查看" : "暂未开放";
        } else if (toolState) {
          helperText = role === "admin" ? "进入详情操作" : "进入详情参与";
        } else {
          helperText = role === "admin" ? "进入详情创建" : "暂未开放";
        }
      }

      return {
        type: toolType,
        title: TOOL_META[toolType].title,
        description: TOOL_META[toolType].description,
        iconGlyph: TOOL_META[toolType].iconGlyph,
        iconClassName: TOOL_META[toolType].iconClassName,
        displayTitle: displayMeta.displayTitle,
        displayDescription: displayMeta.displayDescription,
        imageUrl: displayMeta.imageUrl,
        themeKey: toolType,
        ctaLabel: displayMeta.ctaLabel,
        sortOrder: displayMeta.sortOrder,
        stateLabel: toolState ? "已开启" : "未开启",
        stateClassName: toolState ? "tool-state is-active" : "tool-state",
        helperText,
        isStarted: Boolean(toolState),
        canEnter: hasCurrentTrip
      };
    }).sort((left, right) => left.sortOrder - right.sortOrder);
  }

  private buildToolStatusMessage(
    toolType: ToolType,
    toolState: PublishedToolState | null,
    viewerId: string,
    viewerRole: ViewerRole
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
      if (voteState.phase === "ended") {
        return "本轮投票已结束，最终结果已公布。";
      }
      if (!voteState.participantUserIds.includes(viewerId)) {
        return "你不在本轮投票名单中。";
      }
      const submission = voteState.submissions[viewerId];
      return submission
        ? `你已完成投票：${getVoteChoiceLabel(submission.choice)}`
        : "请选择一个选项完成本轮投票。";
    }

    if (toolType === "wheel") {
      const wheelState = toolState as PublishedWheelToolState;
      const canSpin = this.canViewerSpinWheel(wheelState, viewerId, viewerRole);
      const assignedUserLabel =
        wheelState.allowAssignedUser && wheelState.assignedUserId
          ? this.userRepository.getUser(wheelState.assignedUserId).nickname
          : "";
      return wheelState.resultIndex === null
        ? canSpin
          ? "当前配置已发布，点击“开始”生成结果。"
          : wheelState.allowAssignedUser && assignedUserLabel
            ? `当前由 ${assignedUserLabel} 转动大转盘。`
            : "当前由管理员转动大转盘。"
        : "当前转盘结果已经同步。";
    }

    const lotteryState = toolState as PublishedLotteryToolState;
    const remainingCardCount = lotteryState.cards.filter((card) => !card.claimedByUserId).length;
    if (!remainingCardCount) {
      return "卡片已抽完。";
    }

    if (!this.canViewerClaimLottery(lotteryState, viewerId)) {
      const assignedUserLabel =
        lotteryState.allowAssignedUser && lotteryState.assignedUserId
          ? this.userRepository.getUser(lotteryState.assignedUserId).nickname
          : "管理员";
      return `当前由 ${assignedUserLabel} 抽取卡片。`;
    }

    const viewerClaimedCount = lotteryState.claimsByUserId[viewerId]?.length ?? 0;
    if (viewerClaimedCount >= lotteryState.drawLimitPerUser) {
      return "你的抽取次数已用完。";
    }
    return "点击卡片开始翻签。";
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
    const supportCountByOptionId = submissions.reduce<Record<string, number>>((accumulator, submission) => {
      if (submission.choice !== "approve") {
        return accumulator;
      }

      submission.optionIds.forEach((optionId) => {
        accumulator[optionId] = (accumulator[optionId] ?? 0) + 1;
      });
      return accumulator;
    }, {});
    const optionViews: VoteOptionView[] = options.map((option) => ({
      id: option.id,
      label: option.label,
      supportCount: supportCountByOptionId[option.id] ?? 0,
      selectedByViewer: Boolean(viewerSubmission?.optionIds.includes(option.id))
    }));
    return {
      phase: toolState.phase,
      topic: toolState.topic,
      excludeAdmin: toolState.excludeAdmin,
      selectionMode,
      maxSelections: toolState.maxSelections,
      participantCount: participantUserIds.length,
      submittedCount: Object.keys(submissionsRecord).length,
      approveCount: submissions.filter((submission) => submission.choice === "approve").length,
      rejectCount: submissions.filter((submission) => submission.choice === "reject").length,
      abstainCount: submissions.filter((submission) => submission.choice === "abstain").length,
      options: optionViews,
      resultOptions: [...optionViews].sort(compareVoteResultOptions),
      viewerChoice: viewerSubmission?.choice ?? null,
      viewerSelectedOptionIds: viewerSubmission?.optionIds ?? [],
      viewerHasSubmitted: Boolean(viewerSubmission),
      viewerEligible: participantUserIds.includes(viewerId)
    };
  }

  private buildWheelDetail(
    trip: Trip,
    toolState: PublishedWheelToolState | null,
    viewerId: string,
    viewerRole: ViewerRole
  ): WheelDetailView {
    const eligibleUsers = this.listToolEligibleUsers(trip, viewerId);
    const assignedUserId = toolState?.allowAssignedUser ? toolState.assignedUserId ?? null : null;
    const assignedUser = assignedUserId
      ? eligibleUsers.find((member) => member.userId === assignedUserId) ?? null
      : null;
    const resultHistoryLabels = Array.isArray(toolState?.resultHistoryLabels)
      ? toolState.resultHistoryLabels.filter((label) => typeof label === "string" && Boolean(label))
      : [];

    return {
      phase: toolState?.phase ?? "draft",
      topic: getFallbackTopic(toolState?.topic, "大转盘"),
      items: toolState?.items ?? [],
      viewerCanSpin: toolState ? this.canViewerSpinWheel(toolState, viewerId, viewerRole) : false,
      allowAssignedUser: Boolean(toolState?.allowAssignedUser),
      assignedUserId,
      assignedUserLabel: assignedUser?.nickname ?? null,
      eligibleUsers,
      resultIndex: toolState?.resultIndex ?? null,
      resultLabel:
        toolState && toolState.resultIndex !== null ? toolState.items[toolState.resultIndex] ?? null : null,
      resultHistoryLabels
    };
  }

  private resolveWheelPermissionConfig(
    tripId: string,
    input: WheelPublishInput
  ): { allowAssignedUser: boolean; assignedUserId: string | null } {
    const allowAssignedUser = Boolean(input.allowAssignedUser);
    if (!allowAssignedUser) {
      return {
        allowAssignedUser: false,
        assignedUserId: null
      };
    }

    const assignedUserId = typeof input.assignedUserId === "string" ? input.assignedUserId : "";
    const participantUserIds = this.listTripParticipantUserIds(tripId, false);
    if (!assignedUserId || !participantUserIds.includes(assignedUserId)) {
      throw new BusinessError("INVALID_WHEEL_ASSIGNED_USER", "请选择可使用大转盘的成员。");
    }

    return {
      allowAssignedUser: true,
      assignedUserId
    };
  }

  private resolveLotteryPermissionConfig(
    tripId: string,
    adminUserId: string,
    input: LotteryPublishInput
  ): { allowAssignedUser: boolean; assignedUserId: string | null } {
    const allowAssignedUser = Boolean(input.allowAssignedUser);
    if (!allowAssignedUser) {
      return {
        allowAssignedUser: false,
        assignedUserId: adminUserId
      };
    }

    const assignedUserId = typeof input.assignedUserId === "string" ? input.assignedUserId : "";
    const participantUserIds = this.listTripParticipantUserIds(tripId, false);
    if (!assignedUserId || !participantUserIds.includes(assignedUserId)) {
      throw new BusinessError("INVALID_LOTTERY_ASSIGNED_USER", "请选择可使用抓阄的成员。");
    }

    return {
      allowAssignedUser: true,
      assignedUserId
    };
  }

  private canViewerSpinWheel(
    toolState: PublishedWheelToolState,
    viewerId: string,
    viewerRole: ViewerRole
  ): boolean {
    if (toolState.allowAssignedUser) {
      return toolState.assignedUserId === viewerId;
    }
    return viewerRole === "admin";
  }

  private assertViewerCanSpinWheel(
    toolState: PublishedWheelToolState,
    viewerId: string,
    viewerRole: ViewerRole
  ): void {
    if (!this.canViewerSpinWheel(toolState, viewerId, viewerRole)) {
      throw new BusinessError("WHEEL_FORBIDDEN", "当前没有使用大转盘的权限。");
    }
  }

  private canViewerClaimLottery(toolState: PublishedLotteryToolState, viewerId: string): boolean {
    if (toolState.allowAssignedUser) {
      return toolState.assignedUserId === viewerId;
    }
    return toolState.publishedByUserId === viewerId;
  }

  private assertViewerCanClaimLottery(toolState: PublishedLotteryToolState, viewerId: string): void {
    if (!this.canViewerClaimLottery(toolState, viewerId)) {
      throw new BusinessError("LOTTERY_FORBIDDEN", "当前没有抽卡权限。");
    }
  }

  private buildLotteryDetail(
    trip: Trip,
    toolState: PublishedLotteryToolState | null,
    viewerId: string
  ): LotteryDetailView {
    const eligibleUsers = this.listToolEligibleUsers(trip, viewerId);
    const assignedUserId =
      toolState?.allowAssignedUser ? toolState.assignedUserId ?? null : toolState?.publishedByUserId ?? null;
    const assignedUser = assignedUserId
      ? eligibleUsers.find((member) => member.userId === assignedUserId) ?? null
      : null;
    const viewerClaimRecords = [...(toolState?.claimsByUserId[viewerId] ?? [])]
      .sort((left, right) => right.claimedAt - left.claimedAt)
      .map<LotteryClaimRecordView>((record) => ({
        cardId: record.cardId,
        order: record.order,
        answer: record.answer,
        claimedAt: record.claimedAt
      }));
    const remainingCardCount = toolState?.cards.filter((card) => !card.claimedByUserId).length ?? 0;
    const viewerEligible = toolState ? this.canViewerClaimLottery(toolState, viewerId) : false;
    const drawLimitPerUser = toolState?.drawLimitPerUser ?? 1;
    const viewerCanDraw =
      Boolean(toolState) &&
      viewerEligible &&
      remainingCardCount > 0 &&
      viewerClaimRecords.length < drawLimitPerUser;

    return {
      phase: toolState?.phase ?? "active",
      topic: getFallbackTopic(toolState?.topic, "幸运签"),
      answers: toolState?.answers ?? [],
      cardCount: toolState?.cards.length ?? 0,
      claimedCardCount: (toolState?.cards.length ?? 0) - remainingCardCount,
      remainingCardCount,
      drawLimitPerUser,
      viewerClaimedCount: viewerClaimRecords.length,
      viewerRemainingDrawCount: Math.max(0, drawLimitPerUser - viewerClaimRecords.length),
      viewerEligible,
      viewerCanDraw,
      allowAssignedUser: Boolean(toolState?.allowAssignedUser),
      assignedUserId,
      assignedUserLabel: assignedUser?.nickname ?? null,
      eligibleUsers,
      cards:
        toolState?.cards.map<LotteryCardView>((card) => ({
          id: card.id,
          order: card.order,
          state:
            card.claimedByUserId === viewerId
              ? "viewer"
              : card.claimedByUserId
                ? "claimed"
                : "available",
          answer: card.claimedByUserId === viewerId ? card.answer : null,
          canClaim: viewerCanDraw && !card.claimedByUserId
        })) ?? [],
      viewerClaimRecords
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

  private listToolEligibleUsers(trip: Trip, viewerId: string): ToolResultMemberView[] {
    return this.listTripParticipantUserIds(trip.id, false).map((userId) =>
      this.buildToolResultMemberView(
        {
          userId,
          seatCode: findSeatCodeByUserId(trip.seatMap, userId)
        },
        viewerId
      )
    );
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
        const currentTripId = this.requireCurrentTripId(user);
        const currentTripName = displayTripName(this.tripRepository.getTrip(currentTripId).tripName);
        const role = this.getViewerRole(user, currentTripId);

        return {
          id: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          initial: getInitial(user.nickname),
          isActive: user.id === activeUserId,
          roleLabel: this.getViewerRoleLabel(role),
          currentTripName: `当前查看 ${currentTripName}`,
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
      authNickname: currentUser.nickname,
      authAvatarUrl: currentUser.avatarUrl,
      currentPersonaId: currentUser.homePersonaAssetId ?? "",
      currentPersonaImageUrl: resolveHomePersonaImageUrl(currentUser.homePersonaAssetId),
      bio: currentUser.bio,
      livingCity: currentUser.livingCity,
      livingRegion: regionValueToArray(currentUser.livingCity, "district"),
      hometown: currentUser.hometown,
      hometownRegion: regionValueToArray(currentUser.hometown, "city"),
      age: currentUser.age,
      tags: currentUser.tags,
      tagsInput: currentUser.tags.join("\n"),
      previewTags: currentUser.tags
    };
  }

  private buildFavoriteMemberCardView(member: MemberView): FavoriteMemberCardView {
    return {
      userId: member.userId,
      nickname: member.nickname,
      avatarUrl: member.avatarUrl,
      initial: member.initial,
      seatLabel: member.seatLabel,
      isAdmin: member.isAdmin,
      tags: member.tags,
      tagViews: member.tagViews,
      isMutualFavoriteWithViewer: member.isMutualFavoriteWithViewer
    };
  }

  private buildFavoriteRankingItems(
    tripId: string,
    members: MemberView[]
  ): FavoriteRankingItemView[] {
    const favoriteCountMap = this.tripRepository
      .listTripFavorites(tripId)
      .reduce<Record<string, number>>((accumulator, favorite) => {
        accumulator[favorite.targetUserId] = (accumulator[favorite.targetUserId] ?? 0) + 1;
        return accumulator;
      }, {});
    const joinedAtMap = this.tripRepository
      .listTripMembers(tripId)
      .reduce<Record<string, number>>((accumulator, member) => {
        accumulator[member.userId] = member.joinedAt;
        return accumulator;
      }, {});

    return members
      .map((member) => ({
        userId: member.userId,
        nickname: member.nickname,
        avatarUrl: member.avatarUrl,
        initial: member.initial,
        seatLabel: member.seatLabel,
        isAdmin: member.isAdmin,
        favoriteCount: favoriteCountMap[member.userId] ?? 0,
        joinedAt: joinedAtMap[member.userId] ?? Number.MAX_SAFE_INTEGER
      }))
      .filter((member) => member.favoriteCount > 0)
      .sort(compareFavoriteRankingItems)
      .slice(0, 3)
      .map(({ joinedAt: _joinedAt, ...member }) => member);
  }

  private buildViewerSeatSummary(currentUser: User): string {
    const currentTripId = this.requireCurrentTripId(currentUser);
    const globalSeat = this.findUserSeatAcrossTrips(currentUser.id);
    const tripLabel = this.getTripLabel(globalSeat?.tripId ?? currentTripId);
    const seatCode = globalSeat?.seatCode ?? null;
    return `${tripLabel} ${seatCode ?? "未入座"}`;
  }

  private buildBoardingButton(currentUser: User, currentTripId: string, now: number): BoardingButtonView {
    const seatCode = this.getCurrentSeatCode(currentTripId, currentUser.id);
    const globalSeat = this.findUserSeatAcrossTrips(currentUser.id);
    const activeRecord = this.getActiveBoardingRecord(currentUser, currentTripId, now);

    if (!currentUser.isAuthorized) {
      return {
        label: activeRecord ? "已上车" : "上车",
        isActive: Boolean(activeRecord),
        isDisabled: true,
        nextRefreshAt: activeRecord
          ? (now < activeRecord.confirmDeadlineAt ? activeRecord.confirmDeadlineAt : activeRecord.resetAt)
          : null,
        disabledReason: "unseated"
      };
    }

    if (!seatCode) {
      return {
        label: "上车",
        isActive: false,
        isDisabled: true,
        nextRefreshAt: null,
        disabledReason: globalSeat ? "seat-in-other-trip" : "unseated"
      };
    }

    if (!activeRecord) {
      return {
        label: "上车",
        isActive: false,
        isDisabled: false,
        nextRefreshAt: null,
        disabledReason: null
      };
    }

    const isPending = now < activeRecord.confirmDeadlineAt;
    return {
      label: "已上车",
      isActive: true,
      isDisabled: !isPending,
      nextRefreshAt: isPending ? activeRecord.confirmDeadlineAt : activeRecord.resetAt,
      disabledReason: isPending ? null : "locked"
    };
  }

  private buildViewerBoardingRecordItems(
    currentUser: User
  ): BoardingRecordListItemView[] {
    return [FIXED_TRIP_IDS.trip1, FIXED_TRIP_IDS.trip2]
      .flatMap((tripId) =>
        this.listBoardingRecords(currentUser, tripId).map((record) => ({
          record,
          tripId
        }))
      )
      .sort((left, right) => right.record.createdAt - left.record.createdAt)
      .map(({ record, tripId }) => ({
        id: record.id,
        userId: currentUser.id,
        nickname: currentUser.nickname,
        avatarUrl: currentUser.avatarUrl,
        initial: getInitial(currentUser.nickname),
        seatLabel: record.seatCode,
        tripLabel: this.getTripLabel(tripId),
        formattedTime: formatBoardingRecordTime(record.createdAt),
        createdAt: record.createdAt
      }));
  }

  private buildAdminBoardingRecordGroups(selectedTripFilter: "all" | "trip1" | "trip2"): BoardingRecordMemberGroupView[] {
    const tripIds =
      selectedTripFilter === "trip1"
        ? [FIXED_TRIP_IDS.trip1]
        : selectedTripFilter === "trip2"
          ? [FIXED_TRIP_IDS.trip2]
          : [FIXED_TRIP_IDS.trip1, FIXED_TRIP_IDS.trip2];

    return tripIds.flatMap((tripId) => {
      const trip = this.tripRepository.getTrip(tripId);
      const members = this.tripRepository
        .listTripMembers(tripId)
        .slice()
        .sort((left, right) => this.compareBoardingMembers(trip, left, right));

      return members.map((member) => {
        const user = this.userRepository.getUser(member.userId);
        const seatCode = findSeatCodeByUserId(trip.seatMap, user.id);
        const records = this.listBoardingRecords(user, tripId)
          .slice()
          .sort((left, right) => right.createdAt - left.createdAt)
          .map((record) => ({
            id: record.id,
            userId: user.id,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            initial: getInitial(user.nickname),
            seatLabel: record.seatCode,
            tripLabel: this.getTripLabel(tripId),
            formattedTime: formatBoardingRecordTime(record.createdAt),
            createdAt: record.createdAt
          }));

        return {
          tripLabel: this.getTripLabel(tripId),
          userId: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          initial: getInitial(user.nickname),
          seatLabel: seatCode ?? "未入座",
          records
        };
      });
    });
  }

  private buildPassengerFilterOptions(): PassengerFilterOptionView[] {
    return [
      {
        id: "all",
        label: "全部",
        isSelected: true
      },
      {
        id: FIXED_TRIP_IDS.trip1,
        label: this.getTripLabel(FIXED_TRIP_IDS.trip1),
        isSelected: false
      },
      {
        id: FIXED_TRIP_IDS.trip2,
        label: this.getTripLabel(FIXED_TRIP_IDS.trip2),
        isSelected: false
      }
    ];
  }

  private buildPassengerMemberGroups(
    currentUser: User,
    currentTripId: string
  ): PassengerMemberGroupView[] {
    return [FIXED_TRIP_IDS.trip1, FIXED_TRIP_IDS.trip2].map((tripId) => {
      const trip = this.tripRepository.getTrip(tripId);
      const favorites = this.tripRepository.listTripFavorites(tripId);
      const members = this.buildMemberViews(trip, currentUser.id, favorites).map((member) =>
        this.buildPassengerMemberView(member, tripId, currentTripId, currentUser)
      );

      return {
        tripId,
        tripLabel: this.getTripLabel(tripId),
        memberCount: members.length,
        members
      };
    });
  }

  private buildPassengerMemberView(
    member: MemberView,
    tripId: string,
    currentTripId: string,
    currentUser: User
  ): PassengerMemberView {
    const tripLabel = this.getTripLabel(tripId);

    return {
      ...member,
      tripId,
      tripLabel,
      seatDisplayLabel: `${tripLabel} ${member.seatLabel}`,
      detailMode:
        tripId !== currentTripId
          ? "readonly-member-detail"
          : member.isSelf
            ? "self-detail"
            : this.getViewerRole(currentUser, currentTripId) === "admin"
              ? "admin-member-detail"
              : "member-detail"
    };
  }

  private getCurrentTripName(currentUser: User): string {
    return this.tripRepository.getTrip(this.requireCurrentTripId(currentUser)).tripName;
  }

  private getHomeTitle(): string {
    return this.getRuntimeConfig().homeTitle;
  }

  private getTripLabel(tripId: string): string {
    return FIXED_TRIP_LABELS[tripId] ?? displayTripName(this.tripRepository.getTrip(tripId).tripName);
  }

  private buildCurrentTripView(tripId: string, viewerId: string): CurrentTripViewModel {
    const trip = this.tripRepository.getTrip(tripId);
    if (trip.status !== "active") {
      throw new BusinessError("TRIP_INACTIVE", "当前车次已经结束。");
    }

    const favorites = this.tripRepository.listTripFavorites(trip.id);
    const members = this.buildMemberViews(trip, viewerId, favorites);
    const seatMap = buildSeatOccupantMap(trip.seatMap, members);
    const viewerUser = this.userRepository.getUser(viewerId);
    const viewerRole = this.getViewerRole(viewerUser, trip.id);
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
      viewerRoleLabel: this.getViewerRoleLabel(viewerRole),
      viewerRoleClassName: viewerRole === "admin" ? "is-admin" : "",
      isAdmin: viewerRole === "admin",
      viewerSeatCode,
      viewerSeatLabel: viewerSeatCode ? `我在 ${viewerSeatCode}` : "我还未入座",
      isReadOnlyView: false
    };

    return {
      tripMeta,
      seatMap,
      seatRows: buildSeatRows(trip.seatCodes, seatMap, viewerId),
      members
    };
  }

  private buildMemberViews(
    trip: Trip,
    viewerId: string,
    favorites: TripFavoriteRelation[]
  ): MemberView[] {
    const relations = this.tripRepository
      .listTripMembers(trip.id)
      .slice()
      .sort((left, right) => this.compareBoardingMembers(trip, left, right));
    const favoriteSet = new Set(
      favorites.map((favorite) => `${favorite.sourceUserId}:${favorite.targetUserId}`)
    );

    return relations
      .map((relation) => {
        const user = this.userRepository.getUser(relation.userId);
        const seatCode = findSeatCodeByUserId(trip.seatMap, user.id);
        const isFavoritedByViewer = favoriteSet.has(`${viewerId}:${user.id}`);
        return {
          userId: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          initial: getInitial(user.nickname),
          bio: user.bio,
          livingCity: user.livingCity,
          hometown: user.hometown,
          livingLocationDisplay: formatLivingLocationDisplay(user.livingCity),
          hometownLocationDisplay: formatHometownLocationDisplay(user.hometown),
          age: user.age,
          homePersonaImageUrl: resolveHomePersonaImageUrl(user.homePersonaAssetId),
          tags: user.tags,
          tagViews: buildTagColorViews(user.tags, 2),
          role: relation.role as MemberRole,
          isAdmin: relation.role === "admin",
          showMeta: relation.role === "admin" || user.id === viewerId,
          seatCode,
          seatLabel: seatCode ?? "未入座",
          seatDisplayLabel: seatCode ?? "未入座",
          isSelf: user.id === viewerId,
          isFavoritedByViewer,
          isMutualFavoriteWithViewer:
            user.id !== viewerId &&
            isFavoritedByViewer &&
            favoriteSet.has(`${user.id}:${viewerId}`)
        };
      });
  }

  private resolvePassengerMemberDetailMode(
    member: MemberView,
    tripId: string,
    currentTripId: string,
    currentUser: User
  ): MemberDetailMode {
    if (tripId !== currentTripId) {
      return "readonly-member-detail";
    }
    if (member.isSelf) {
      return "self-detail";
    }
    return this.getViewerRole(currentUser, currentTripId) === "admin"
      ? "admin-member-detail"
      : "member-detail";
  }

  private replaceAppState(state: ReturnType<typeof createInitialAppState>): void {
    this.appStateRepository.write(state);
  }

  private getRuntimeConfig(): RuntimeConfig {
    return this.normalizeRuntimeConfig(this.appStateRepository.read().runtimeConfig);
  }

  private normalizeRuntimeConfig(runtimeConfig: RuntimeConfig | null | undefined): RuntimeConfig {
    return {
      homeTitle:
        typeof runtimeConfig?.homeTitle === "string" && runtimeConfig.homeTitle.trim()
          ? runtimeConfig.homeTitle.trim()
          : DEFAULT_HOME_TITLE,
      tripAdminUserIds: {
        [FIXED_TRIP_IDS.trip1]:
          typeof runtimeConfig?.tripAdminUserIds?.[FIXED_TRIP_IDS.trip1] === "string" &&
          runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip1]?.trim()
            ? runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip1]!.trim()
            : null,
        [FIXED_TRIP_IDS.trip2]:
          typeof runtimeConfig?.tripAdminUserIds?.[FIXED_TRIP_IDS.trip2] === "string" &&
          runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip2]?.trim()
            ? runtimeConfig.tripAdminUserIds[FIXED_TRIP_IDS.trip2]!.trim()
            : null
      }
    };
  }

  private getMemberTripId(user: User): string {
    return user.currentTripId ?? user.memberTripId ?? DEFAULT_VIEW_TRIP_ID;
  }

  private getViewerRole(user: User, tripId: string): ViewerRole {
    return this.tripRepository.getTripMember(tripId, user.id)?.role ?? "visitor";
  }

  private getViewerRoleLabel(role: ViewerRole): string {
    if (role === "admin") {
      return "管理员";
    }
    if (role === "member") {
      return "成员";
    }
    return "访客";
  }

  private canCurrentUserEditHomeTitle(currentUser: User): boolean {
    return this.getViewerRole(currentUser, this.requireCurrentTripId(currentUser)) === "admin";
  }

  private buildTripSwitchOptions(currentUser: User): TripSwitchOption[] {
    const currentTripId = this.requireCurrentTripId(currentUser);
    return [FIXED_TRIP_IDS.trip1, FIXED_TRIP_IDS.trip2].map((tripId) => ({
      tripId,
      label: FIXED_TRIP_LABELS[tripId],
      isSelected: currentTripId === tripId,
      isOwnedByViewer: true,
      isReadOnly: false
    }));
  }
}

export const tripService = new TripService();

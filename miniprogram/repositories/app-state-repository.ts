import {
  APP_STATE_VERSION,
  createDefaultRuntimeConfig,
  DEMO_USERS,
  TOOL_TYPES,
  createEmptyTripTools,
  createInitialAppState
} from "../shared/constants";
import type {
  AppState,
  BoardingRecord,
  LotteryCard,
  LotteryClaimRecord,
  PublishedLotteryToolState,
  PublishedSeatDrawToolState,
  PublishedToolState,
  PublishedVoteToolState,
  PublishedWheelToolState,
  RuntimeConfig,
  TripFavoriteRelation,
  User,
  ToolType,
  Trip,
  ToolMemberSnapshot,
  VoteChoice,
  VoteOption,
  VoteSelectionMode,
  VoteSubmission
} from "../shared/types";
import type { StorageAdapter } from "./storage-adapter";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeVoteSelectionMode(value: unknown): VoteSelectionMode {
  return value === "multiple" ? "multiple" : "single";
}

function normalizeVoteMaxSelections(
  value: unknown,
  selectionMode: VoteSelectionMode,
  optionCount: number
): number {
  if (selectionMode === "single") {
    return 1;
  }

  const normalized = typeof value === "number" ? Math.trunc(value) : optionCount;
  if (!Number.isInteger(normalized) || normalized <= 0) {
    return optionCount;
  }
  return Math.min(normalized, optionCount);
}

function normalizeVoteChoice(value: unknown): VoteChoice {
  if (value === "reject" || value === "abstain") {
    return value;
  }
  return "approve";
}

function normalizeVoteOptions(value: unknown): VoteOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenLabels = new Set<string>();
  return value.reduce<VoteOption[]>((accumulator, option, index) => {
    if (typeof option === "string") {
      const label = option.trim();
      if (!label || seenLabels.has(label)) {
        return accumulator;
      }
      seenLabels.add(label);
      accumulator.push({
        id: `legacy-vote-option-${index + 1}`,
        label
      });
      return accumulator;
    }

    if (!isRecord(option)) {
      return accumulator;
    }

    const label = typeof option.label === "string" ? option.label.trim() : "";
    if (!label || seenLabels.has(label)) {
      return accumulator;
    }

    const id =
      typeof option.id === "string" && option.id.trim()
        ? option.id.trim()
        : `legacy-vote-option-${index + 1}`;

    seenLabels.add(label);
    accumulator.push({
      id,
      label
    });
    return accumulator;
  }, []);
}

function normalizeVoteSubmissions(
  value: unknown,
  validOptionIds: Set<string>
): Record<string, VoteSubmission> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, VoteSubmission>>((accumulator, [userId, submission]) => {
    if (!isRecord(submission)) {
      return accumulator;
    }

    accumulator[userId] = {
      choice: normalizeVoteChoice(submission.choice),
      optionIds: normalizeStringArray(submission.optionIds).filter((optionId) =>
        validOptionIds.has(optionId)
      ),
      submittedAt: typeof submission.submittedAt === "number" ? submission.submittedAt : 0
    };
    return accumulator;
  }, {});
}

function normalizeVoteToolState(toolState: unknown): PublishedVoteToolState | null {
  if (!isRecord(toolState)) {
    return null;
  }

  const options = normalizeVoteOptions(toolState.options);
  const participantUserIds = Array.from(new Set(normalizeStringArray(toolState.participantUserIds)));
  if (!options.length || !participantUserIds.length) {
    return null;
  }

  const selectionMode = normalizeVoteSelectionMode(toolState.selectionMode);

  return {
    type: "vote",
    publishedAt: typeof toolState.publishedAt === "number" ? toolState.publishedAt : 0,
    publishedByUserId:
      typeof toolState.publishedByUserId === "string" ? toolState.publishedByUserId : "",
    phase: toolState.phase === "draft" ? "draft" : toolState.phase === "ended" ? "ended" : "active",
    topic:
      typeof toolState.topic === "string" && toolState.topic.trim() ? toolState.topic.trim() : "投票",
    excludeAdmin: Boolean(toolState.excludeAdmin),
    selectionMode,
    maxSelections: normalizeVoteMaxSelections(toolState.maxSelections, selectionMode, options.length),
    options,
    participantUserIds,
    submissions: normalizeVoteSubmissions(
      toolState.submissions,
      new Set(options.map((option) => option.id))
    )
  };
}

function normalizeSeatDrawSnapshots(value: unknown): ToolMemberSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<ToolMemberSnapshot[]>((accumulator, entry) => {
    if (!isRecord(entry) || typeof entry.userId !== "string" || !entry.userId.trim()) {
      return accumulator;
    }

    accumulator.push({
      userId: entry.userId,
      seatCode: typeof entry.seatCode === "string" && entry.seatCode.trim() ? entry.seatCode : null
    });
    return accumulator;
  }, []);
}

function normalizeSeatDrawRounds(value: unknown): ToolMemberSnapshot[][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((round) => normalizeSeatDrawSnapshots(round))
    .filter((round) => round.length > 0);
}

function normalizeSeatDrawToolState(toolState: unknown): PublishedSeatDrawToolState | null {
  if (!isRecord(toolState)) {
    return null;
  }

  const config = isRecord(toolState.config) ? toolState.config : {};
  const drawCount = typeof config.drawCount === "number" ? Math.trunc(config.drawCount) : 1;
  const lastResult = normalizeSeatDrawSnapshots(toolState.lastResult);
  const legacyHistoryEntries = normalizeSeatDrawSnapshots(toolState.historyEntries);
  const drawnEntries = normalizeSeatDrawSnapshots(toolState.drawnEntries);
  const resultRounds = normalizeSeatDrawRounds(toolState.resultRounds);
  const normalizedRounds = resultRounds.length
    ? resultRounds
    : lastResult.length
      ? [lastResult]
      : [];

  return {
    type: "seat-draw",
    publishedAt: typeof toolState.publishedAt === "number" ? toolState.publishedAt : 0,
    publishedByUserId:
      typeof toolState.publishedByUserId === "string" ? toolState.publishedByUserId : "",
    phase:
      toolState.phase === "rolling" ? "rolling" : toolState.phase === "result" ? "result" : "ready",
    topic:
      typeof toolState.topic === "string" && toolState.topic.trim() ? toolState.topic.trim() : "随机抽号",
    config: {
      drawCount: drawCount > 0 ? drawCount : 1,
      excludePreviouslyDrawn: Boolean(config.excludePreviouslyDrawn),
      excludeAdmin: Boolean(config.excludeAdmin)
    },
    rollingDisplayEntries: normalizeSeatDrawSnapshots(toolState.rollingDisplayEntries),
    pendingResult: normalizeSeatDrawSnapshots(toolState.pendingResult),
    drawnEntries: drawnEntries.length ? drawnEntries : legacyHistoryEntries,
    resultRounds: normalizedRounds,
    rollingStartedAt: typeof toolState.rollingStartedAt === "number" ? toolState.rollingStartedAt : null,
    rollingEndsAt: typeof toolState.rollingEndsAt === "number" ? toolState.rollingEndsAt : null,
    lastResult
  };
}

function normalizeLotteryCards(value: unknown): LotteryCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenCardIds = new Set<string>();
  return value.reduce<LotteryCard[]>((accumulator, entry, index) => {
    if (!isRecord(entry)) {
      return accumulator;
    }

    const id =
      typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : `legacy-lottery-card-${index + 1}`;
    if (seenCardIds.has(id)) {
      return accumulator;
    }

    const answer = typeof entry.answer === "string" ? entry.answer.trim() : "";
    if (!answer) {
      return accumulator;
    }

    seenCardIds.add(id);
    accumulator.push({
      id,
      order:
        typeof entry.order === "number" && Number.isInteger(entry.order) && entry.order > 0
          ? entry.order
          : accumulator.length + 1,
      answer,
      claimedByUserId:
        typeof entry.claimedByUserId === "string" && entry.claimedByUserId.trim()
          ? entry.claimedByUserId.trim()
          : null,
      claimedAt: typeof entry.claimedAt === "number" ? entry.claimedAt : null
    });
    return accumulator;
  }, []);
}

function normalizeLotteryClaimRecords(value: unknown): LotteryClaimRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<LotteryClaimRecord[]>((accumulator, entry) => {
    if (!isRecord(entry)) {
      return accumulator;
    }

    const cardId = typeof entry.cardId === "string" ? entry.cardId.trim() : "";
    const answer = typeof entry.answer === "string" ? entry.answer.trim() : "";
    const claimedAt = typeof entry.claimedAt === "number" ? entry.claimedAt : NaN;
    const order = typeof entry.order === "number" ? Math.trunc(entry.order) : NaN;

    if (!cardId || !answer || !Number.isInteger(order) || order <= 0 || !Number.isFinite(claimedAt)) {
      return accumulator;
    }

    accumulator.push({
      cardId,
      order,
      answer,
      claimedAt
    });
    return accumulator;
  }, []);
}

function normalizeLotteryClaimsByUserId(value: unknown): Record<string, LotteryClaimRecord[]> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, LotteryClaimRecord[]>>((accumulator, [userId, records]) => {
    accumulator[userId] = normalizeLotteryClaimRecords(records);
    return accumulator;
  }, {});
}

function normalizeWheelToolState(toolState: unknown): PublishedWheelToolState | null {
  if (!isRecord(toolState)) {
    return null;
  }

  const items = normalizeStringArray(toolState.items);
  if (items.length < 2) {
    return null;
  }

  const resultIndex =
    typeof toolState.resultIndex === "number" && Number.isInteger(toolState.resultIndex)
      ? toolState.resultIndex
      : null;

  return {
    type: "wheel",
    publishedAt: typeof toolState.publishedAt === "number" ? toolState.publishedAt : 0,
    publishedByUserId:
      typeof toolState.publishedByUserId === "string" ? toolState.publishedByUserId.trim() : "",
    phase: toolState.phase === "result" ? "result" : "draft",
    topic:
      typeof toolState.topic === "string" && toolState.topic.trim() ? toolState.topic.trim() : "幸运转盘",
    items,
    allowAssignedUser: Boolean(toolState.allowAssignedUser),
    assignedUserId:
      typeof toolState.assignedUserId === "string" && toolState.assignedUserId.trim()
        ? toolState.assignedUserId.trim()
        : null,
    resultIndex:
      resultIndex !== null && resultIndex >= 0 && resultIndex < items.length ? resultIndex : null,
    resultHistoryLabels: normalizeStringArray(toolState.resultHistoryLabels).filter((label) =>
      items.includes(label)
    ),
    spunAt: typeof toolState.spunAt === "number" ? toolState.spunAt : null
  };
}

function normalizeLotteryToolState(toolState: unknown): PublishedLotteryToolState | null {
  if (!isRecord(toolState)) {
    return null;
  }

  const cards = normalizeLotteryCards(toolState.cards);
  if (!cards.length) {
    return null;
  }

  const answers = normalizeStringArray(toolState.answers);
  const drawLimitPerUser =
    typeof toolState.drawLimitPerUser === "number" && Number.isInteger(toolState.drawLimitPerUser)
      ? Math.max(1, toolState.drawLimitPerUser)
      : 1;

  return {
    type: "lottery",
    publishedAt: typeof toolState.publishedAt === "number" ? toolState.publishedAt : 0,
    publishedByUserId:
      typeof toolState.publishedByUserId === "string" ? toolState.publishedByUserId.trim() : "",
    phase: toolState.phase === "ready" ? "ready" : "active",
    topic:
      typeof toolState.topic === "string" && toolState.topic.trim() ? toolState.topic.trim() : "抓阄",
    answers: answers.length ? answers : cards.map((card) => card.answer),
    cards,
    allowAssignedUser: Boolean(toolState.allowAssignedUser),
    assignedUserId:
      typeof toolState.assignedUserId === "string" && toolState.assignedUserId.trim()
        ? toolState.assignedUserId.trim()
        : null,
    drawLimitPerUser,
    claimsByUserId: normalizeLotteryClaimsByUserId(toolState.claimsByUserId)
  };
}

function normalizeToolState(toolType: ToolType, toolState: unknown): PublishedToolState | null {
  if (toolType === "seat-draw") {
    return normalizeSeatDrawToolState(toolState);
  }
  if (toolType === "vote") {
    return normalizeVoteToolState(toolState);
  }
  if (toolType === "wheel") {
    return normalizeWheelToolState(toolState);
  }
  if (toolType === "lottery") {
    return normalizeLotteryToolState(toolState);
  }

  return (toolState as PublishedToolState | null) ?? null;
}

function normalizeTrip(trip: Trip): Trip {
  const nextTools = createEmptyTripTools();
  TOOL_TYPES.forEach((toolType) => {
    nextTools[toolType] = normalizeToolState(
      toolType,
      (trip as Trip & { tools?: Trip["tools"] }).tools?.[toolType] ?? null
    );
  });

  return {
    ...trip,
    tools: nextTools
  };
}

function normalizeUser(user: User): User {
  const nextHomePersonaAssetId =
    typeof (user as User & { homePersonaAssetId?: unknown }).homePersonaAssetId === "string" &&
    (user as User & { homePersonaAssetId?: string }).homePersonaAssetId?.trim()
      ? (user as User & { homePersonaAssetId: string }).homePersonaAssetId.trim()
      : null;
  const nextBio = typeof (user as User & { bio?: unknown }).bio === "string" ? user.bio.trim() : "";
  const nextLivingCity =
    typeof (user as User & { livingCity?: unknown }).livingCity === "string"
      ? user.livingCity.trim()
      : "";
  const nextHometown =
    typeof (user as User & { hometown?: unknown }).hometown === "string" ? user.hometown.trim() : "";
  const nextAge = typeof (user as User & { age?: unknown }).age === "string" ? user.age.trim() : "";
  const rawBoardingRecordsByTripId = isRecord(
    (user as User & { boardingRecordsByTripId?: unknown }).boardingRecordsByTripId
  )
    ? ((user as User & { boardingRecordsByTripId: Record<string, unknown> }).boardingRecordsByTripId)
    : {};
  const boardingRecordsByTripId = Object.entries(rawBoardingRecordsByTripId).reduce<Record<string, BoardingRecord[]>>(
    (accumulator, [tripId, records]) => {
      if (!tripId.trim() || !Array.isArray(records)) {
        return accumulator;
      }

      accumulator[tripId] = records.reduce<BoardingRecord[]>((recordAccumulator, record) => {
        if (!isRecord(record)) {
          return recordAccumulator;
        }

        const id = typeof record.id === "string" ? record.id.trim() : "";
        const seatCode = typeof record.seatCode === "string" ? record.seatCode.trim() : "";
        const createdAt = typeof record.createdAt === "number" ? record.createdAt : NaN;
        const confirmDeadlineAt =
          typeof record.confirmDeadlineAt === "number" ? record.confirmDeadlineAt : NaN;
        const resetAt = typeof record.resetAt === "number" ? record.resetAt : NaN;

        if (
          !id ||
          !seatCode ||
          !Number.isFinite(createdAt) ||
          !Number.isFinite(confirmDeadlineAt) ||
          !Number.isFinite(resetAt)
        ) {
          return recordAccumulator;
        }

        recordAccumulator.push({
          id,
          tripId: tripId.trim(),
          seatCode,
          createdAt,
          status: record.status === "confirmed" ? "confirmed" : "pending",
          confirmDeadlineAt,
          resetAt
        });
        return recordAccumulator;
      }, []);
      return accumulator;
    },
    {}
  );

  return {
    ...user,
    bio: nextBio,
    livingCity: nextLivingCity,
    hometown: nextHometown,
    age: nextAge,
    tags: normalizeStringArray(user.tags),
    homePersonaAssetId: nextHomePersonaAssetId,
    memberTripId:
      typeof (user as User & { memberTripId?: unknown }).memberTripId === "string" &&
      (user as User & { memberTripId?: string }).memberTripId?.trim()
        ? (user as User & { memberTripId: string }).memberTripId.trim()
        : null,
    currentTripId:
      typeof (user as User & { currentTripId?: unknown }).currentTripId === "string" &&
      (user as User & { currentTripId?: string }).currentTripId?.trim()
        ? (user as User & { currentTripId: string }).currentTripId.trim()
        : null,
    boardingRecordsByTripId
  };
}

function normalizeTripFavorites(value: unknown): TripFavoriteRelation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<TripFavoriteRelation[]>((accumulator, entry) => {
    if (!isRecord(entry)) {
      return accumulator;
    }

    const tripId = typeof entry.tripId === "string" ? entry.tripId.trim() : "";
    const sourceUserId = typeof entry.sourceUserId === "string" ? entry.sourceUserId.trim() : "";
    const targetUserId = typeof entry.targetUserId === "string" ? entry.targetUserId.trim() : "";
    const createdAt = typeof entry.createdAt === "number" ? entry.createdAt : 0;

    if (!tripId || !sourceUserId || !targetUserId || sourceUserId === targetUserId) {
      return accumulator;
    }

    accumulator.push({
      tripId,
      sourceUserId,
      targetUserId,
      createdAt
    });
    return accumulator;
  }, []);
}

function normalizeRuntimeConfig(value: unknown): RuntimeConfig {
  const fallback = createDefaultRuntimeConfig();
  if (!isRecord(value)) {
    return fallback;
  }

  const rawTripAdminUserIds = isRecord(value.tripAdminUserIds) ? value.tripAdminUserIds : {};

  return {
    homeTitle:
      typeof value.homeTitle === "string" && value.homeTitle.trim()
        ? value.homeTitle.trim()
        : fallback.homeTitle,
    tripAdminUserIds: Object.keys(fallback.tripAdminUserIds).reduce<Record<string, string | null>>(
      (accumulator, tripId) => {
        const rawUserId = rawTripAdminUserIds[tripId];
        accumulator[tripId] =
          typeof rawUserId === "string" && rawUserId.trim() ? rawUserId.trim() : null;
        return accumulator;
      },
      {}
    )
  };
}

function normalizeState(state: AppState | null): AppState {
  if (!state || state.version !== APP_STATE_VERSION) {
    return createInitialAppState();
  }

  const normalizedUsers = Object.entries(state.users).reduce<AppState["users"]>((accumulator, [userId, user]) => {
    accumulator[userId] = normalizeUser(user as User);
    return accumulator;
  }, {});

  const nextState: AppState = {
    ...state,
    version: APP_STATE_VERSION,
    users: DEMO_USERS.reduce<AppState["users"]>((accumulator, demoUser) => {
      accumulator[demoUser.id] = accumulator[demoUser.id] ?? { ...demoUser };
      return accumulator;
    }, normalizedUsers),
    trips: Object.values(state.trips).reduce<AppState["trips"]>((accumulator, trip) => {
      accumulator[trip.id] = normalizeTrip(trip as Trip);
      return accumulator;
    }, {}),
    tripFavorites: normalizeTripFavorites((state as AppState & { tripFavorites?: unknown }).tripFavorites),
    runtimeConfig: normalizeRuntimeConfig((state as AppState & { runtimeConfig?: unknown }).runtimeConfig)
  };

  const membershipSet = new Set(
    nextState.tripMembers.map((member) => `${member.tripId}:${member.userId}`)
  );
  const dedupedFavorites = new Map<string, TripFavoriteRelation>();
  nextState.tripFavorites.forEach((favorite) => {
    const trip = nextState.trips[favorite.tripId];
    if (!trip || trip.status !== "active") {
      return;
    }
    if (!nextState.users[favorite.sourceUserId] || !nextState.users[favorite.targetUserId]) {
      return;
    }
    if (
      !membershipSet.has(`${favorite.tripId}:${favorite.sourceUserId}`) ||
      !membershipSet.has(`${favorite.tripId}:${favorite.targetUserId}`)
    ) {
      return;
    }

    const key = `${favorite.tripId}:${favorite.sourceUserId}:${favorite.targetUserId}`;
    const existing = dedupedFavorites.get(key);
    if (!existing || favorite.createdAt < existing.createdAt) {
      dedupedFavorites.set(key, favorite);
    }
  });
  nextState.tripFavorites = Array.from(dedupedFavorites.values());

  return nextState;
}

export class AppStateRepository {
  constructor(private readonly storageAdapter: StorageAdapter) {}

  read(): AppState {
    return normalizeState(this.storageAdapter.getState());
  }

  write(state: AppState): void {
    this.storageAdapter.setState(state);
  }

  update<T>(updater: (state: AppState) => T): T {
    const state = this.read();
    const result = updater(state);
    this.write(state);
    return result;
  }
}

export function initializeAppState(storageAdapter: StorageAdapter): AppState {
  const repository = new AppStateRepository(storageAdapter);
  const state = repository.read();
  repository.write(state);
  return state;
}

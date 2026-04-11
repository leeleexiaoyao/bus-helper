import {
  APP_STATE_VERSION,
  DEMO_USERS,
  TOOL_TYPES,
  createEmptyTripTools,
  createInitialAppState
} from "../shared/constants";
import type {
  AppState,
  PublishedSeatDrawToolState,
  PublishedToolState,
  PublishedVoteToolState,
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

  return {
    type: "vote",
    publishedAt: typeof toolState.publishedAt === "number" ? toolState.publishedAt : 0,
    publishedByUserId:
      typeof toolState.publishedByUserId === "string" ? toolState.publishedByUserId : "",
    phase: toolState.phase === "draft" ? "draft" : "active",
    topic:
      typeof toolState.topic === "string" && toolState.topic.trim() ? toolState.topic.trim() : "投票",
    excludeAdmin: Boolean(toolState.excludeAdmin),
    selectionMode: normalizeVoteSelectionMode(toolState.selectionMode),
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

function normalizeToolState(toolType: ToolType, toolState: unknown): PublishedToolState | null {
  if (toolType === "seat-draw") {
    return normalizeSeatDrawToolState(toolState);
  }
  if (toolType === "vote") {
    return normalizeVoteToolState(toolState);
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

function normalizeState(state: AppState | null): AppState {
  if (!state) {
    return createInitialAppState();
  }

  const nextState: AppState = {
    ...state,
    version: APP_STATE_VERSION,
    users: DEMO_USERS.reduce<AppState["users"]>((accumulator, demoUser) => {
      accumulator[demoUser.id] = accumulator[demoUser.id] ?? { ...demoUser };
      return accumulator;
    }, { ...state.users }),
    trips: Object.values(state.trips).reduce<AppState["trips"]>((accumulator, trip) => {
      accumulator[trip.id] = normalizeTrip(trip as Trip);
      return accumulator;
    }, {})
  };

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

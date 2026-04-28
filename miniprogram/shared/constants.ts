import type {
  AppState,
  HomePersonaOption,
  RuntimeConfig,
  TemplateId,
  ToolType,
  Trip,
  TripMember,
  TripToolsState,
  User
} from "./types";

export const APP_STATE_VERSION = 14;
export const APP_STATE_STORAGE_KEY = "bus-seat-buddy-state";
export const MAX_MEMBER_FAVORITES_PER_TRIP = 2;

export const DEFAULT_TRIP_NAME = "未命名车次";
export const DEFAULT_DEPARTURE_TIME = "待定";
export const DEFAULT_AVATAR_URL = "";
export const DEFAULT_HOME_TITLE = "麒麟之旅";
export const HOME_PERSONA_IMAGE_URL = "/assets/personas/home-persona.png";
export const WHEEL_MAX_ITEMS = 10;
export const DEFAULT_WHEEL_ITEMS = ["免单", "零食礼包", "饮料一杯", "神秘福袋", "再来一次", "感谢参与"];
export const HOME_PERSONA_OPTIONS: HomePersonaOption[] = Array.from({ length: 9 }, (_, index) => ({
  id: `home-persona-${index + 1}`,
  imageUrl: HOME_PERSONA_IMAGE_URL
}));

export const FIXED_TRIP_IDS = {
  trip1: "trip-fixed-1",
  trip2: "trip-fixed-2"
} as const;

export const DEFAULT_VIEW_TRIP_ID = FIXED_TRIP_IDS.trip1;
export const FIXED_TRIP_LABELS: Record<string, string> = {
  [FIXED_TRIP_IDS.trip1]: "1车",
  [FIXED_TRIP_IDS.trip2]: "2车"
};

export const TRIP_TEMPLATES: Array<{
  id: TemplateId;
  name: string;
  seatCount: number;
  rowSeatCounts: number[];
}> = [
  {
    id: "template-49",
    name: "49 座模板",
    seatCount: 49,
    rowSeatCounts: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5]
  },
  {
    id: "template-53",
    name: "53 座模板",
    seatCount: 53,
    rowSeatCounts: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5]
  },
  {
    id: "template-57",
    name: "57 座模板",
    seatCount: 57,
    rowSeatCounts: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5]
  }
];

export const DEMO_USERS: User[] = [
  {
    id: "user-1",
    nickname: "小雨",
    avatarUrl: DEFAULT_AVATAR_URL,
    homePersonaAssetId: null,
    bio: "旅途同行",
    livingCity: "",
    hometown: "",
    age: "",
    tags: ["摄影", "靠窗党"],
    memberTripId: FIXED_TRIP_IDS.trip1,
    currentTripId: FIXED_TRIP_IDS.trip1,
    isAuthorized: false,
    boardingRecordsByTripId: {}
  },
  {
    id: "user-2",
    nickname: "阿山",
    avatarUrl: DEFAULT_AVATAR_URL,
    homePersonaAssetId: null,
    bio: "旅途同行",
    livingCity: "",
    hometown: "",
    age: "",
    tags: ["徒步", "社牛"],
    memberTripId: FIXED_TRIP_IDS.trip1,
    currentTripId: FIXED_TRIP_IDS.trip1,
    isAuthorized: false,
    boardingRecordsByTripId: {}
  },
  {
    id: "user-3",
    nickname: "Miya",
    avatarUrl: DEFAULT_AVATAR_URL,
    homePersonaAssetId: null,
    bio: "旅途同行",
    livingCity: "",
    hometown: "",
    age: "",
    tags: ["轻装", "周末玩家"],
    memberTripId: FIXED_TRIP_IDS.trip2,
    currentTripId: FIXED_TRIP_IDS.trip2,
    isAuthorized: false,
    boardingRecordsByTripId: {}
  },
  {
    id: "user-4",
    nickname: "老周",
    avatarUrl: DEFAULT_AVATAR_URL,
    homePersonaAssetId: null,
    bio: "旅途同行",
    livingCity: "",
    hometown: "",
    age: "",
    tags: ["老司机"],
    memberTripId: FIXED_TRIP_IDS.trip2,
    currentTripId: FIXED_TRIP_IDS.trip2,
    isAuthorized: false,
    boardingRecordsByTripId: {}
  }
];

export const DEMO_SWITCHABLE_USER_IDS = DEMO_USERS.map((user) => user.id);

export const TOOL_TYPES: ToolType[] = ["seat-draw", "vote", "wheel", "lottery"];

export function createDefaultRuntimeConfig(): RuntimeConfig {
  return {
    homeTitle: DEFAULT_HOME_TITLE,
    tripAdminUserIds: {
      [FIXED_TRIP_IDS.trip1]: null,
      [FIXED_TRIP_IDS.trip2]: null
    }
  };
}

export const TOOL_META: Record<
  ToolType,
  {
    title: string;
    description: string;
    iconGlyph: string;
    iconClassName: string;
  }
> = {
  "seat-draw": {
    title: "随机抽",
    description: "公平随机抽号",
    iconGlyph: "抽",
    iconClassName: "tool-icon is-seat-draw"
  },
  vote: {
    title: "做选择",
    description: "选出最佳方案",
    iconGlyph: "票",
    iconClassName: "tool-icon is-vote"
  },
  wheel: {
    title: "大转盘",
    description: "大风车转啊转",
    iconGlyph: "盘",
    iconClassName: "tool-icon is-wheel"
  },
  lottery: {
    title: "幸运签",
    description: "抽好签配好运",
    iconGlyph: "阄",
    iconClassName: "tool-icon is-lottery"
  }
};

const SEAT_LETTERS = ["A", "B", "C", "D", "E"];
const BASE_CREATED_AT = 1713571200000;
const SEEDED_USER_COUNT_BY_TRIP = {
  [FIXED_TRIP_IDS.trip1]: 12,
  [FIXED_TRIP_IDS.trip2]: 10
} as const;

export function createEmptyTripTools(): TripToolsState {
  return TOOL_TYPES.reduce<TripToolsState>((accumulator, toolType) => {
    accumulator[toolType] = null;
    return accumulator;
  }, {
    "seat-draw": null,
    vote: null,
    wheel: null,
    lottery: null
  });
}

function getTemplateConfig(templateId: TemplateId) {
  const template = TRIP_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }
  return template;
}

function generateSeatCodes(templateId: TemplateId): string[] {
  return getTemplateConfig(templateId).rowSeatCounts.flatMap((seatCount, rowIndex) =>
    SEAT_LETTERS.slice(0, seatCount).map((letter) => `${rowIndex + 1}${letter}`)
  );
}

function createSeatMap(seatCodes: string[]): Record<string, string | null> {
  return seatCodes.reduce<Record<string, string | null>>((accumulator, seatCode) => {
    accumulator[seatCode] = null;
    return accumulator;
  }, {});
}

function buildBaseTrips(): Trip[] {
  const trips: Trip[] = [
    {
      id: FIXED_TRIP_IDS.trip1,
      tripName: FIXED_TRIP_LABELS[FIXED_TRIP_IDS.trip1],
      departureTime: "2025-04-25 02:00",
      password: "110001",
      templateId: "template-49",
      creatorUserId: "user-1",
      status: "active",
      seatCodes: generateSeatCodes("template-49"),
      seatMap: {},
      tools: createEmptyTripTools(),
      createdAt: BASE_CREATED_AT
    },
    {
      id: FIXED_TRIP_IDS.trip2,
      tripName: FIXED_TRIP_LABELS[FIXED_TRIP_IDS.trip2],
      departureTime: "2025-04-25 02:30",
      password: "220002",
      templateId: "template-49",
      creatorUserId: "user-3",
      status: "active",
      seatCodes: generateSeatCodes("template-49"),
      seatMap: {},
      tools: createEmptyTripTools(),
      createdAt: BASE_CREATED_AT + 1
    }
  ];

  return trips.map((trip) => ({
    ...trip,
    seatMap: createSeatMap(trip.seatCodes)
  }));
}

function buildBaseTripMembers(): TripMember[] {
  return [FIXED_TRIP_IDS.trip1, FIXED_TRIP_IDS.trip2].flatMap((tripId, tripIndex) =>
    DEMO_USERS.map((user, userIndex) => ({
      tripId,
      userId: user.id,
      role: "member" as const,
      joinedAt: BASE_CREATED_AT + tripIndex * 10 + userIndex
    }))
  );
}

function buildBaseState(): AppState {
  const trips = buildBaseTrips();
  trips.find((trip) => trip.id === FIXED_TRIP_IDS.trip1)!.seatMap["1A"] = "user-1";
  trips.find((trip) => trip.id === FIXED_TRIP_IDS.trip2)!.seatMap["1A"] = "user-3";

  return {
    version: APP_STATE_VERSION,
    users: DEMO_USERS.reduce<Record<string, User>>((accumulator, user) => {
      accumulator[user.id] = { ...user };
      return accumulator;
    }, {}),
    trips: trips.reduce<Record<string, Trip>>((accumulator, trip) => {
      accumulator[trip.id] = trip;
      return accumulator;
    }, {}),
    tripMembers: buildBaseTripMembers(),
    tripFavorites: [],
    runtimeConfig: createDefaultRuntimeConfig(),
    activeUserId: "user-1"
  };
}

function createSeedPassengers(
  tripId: string,
  count: number,
  createdAt: number
): { users: User[]; members: TripMember[]; seatedUserIds: string[] } {
  const prefix = tripId === FIXED_TRIP_IDS.trip1 ? "1车" : "2车";
  const users: User[] = [];
  const members: TripMember[] = [];

  for (let index = 0; index < count; index += 1) {
    const userId = `${tripId}-seed-user-${index + 1}`;
    users.push({
      id: userId,
      nickname: `${prefix}成员${String(index + 1).padStart(2, "0")}`,
      avatarUrl: DEFAULT_AVATAR_URL,
      homePersonaAssetId: null,
      bio: "",
      livingCity: "",
      hometown: "",
      age: "",
      tags: [prefix, `乘客${index + 1}`],
      memberTripId: tripId,
      currentTripId: tripId,
      isAuthorized: false,
      boardingRecordsByTripId: {}
    });
    members.push({
      tripId,
      userId,
      role: "member",
      joinedAt: createdAt + index
    });
  }

  return {
    users,
    members,
    seatedUserIds: users.map((user) => user.id)
  };
}

function fillSeedSeats(trip: Trip, userIds: string[]): void {
  const seatCodes = trip.seatCodes.slice(0, userIds.length);
  seatCodes.forEach((seatCode, index) => {
    trip.seatMap[seatCode] = userIds[index];
  });
}

function createSeedTripTools(tripId: string, participantUserIds: string[]): TripToolsState {
  if (tripId === FIXED_TRIP_IDS.trip1) {
    return {
      "seat-draw": {
        type: "seat-draw",
        publishedAt: BASE_CREATED_AT,
        publishedByUserId: "user-1",
        phase: "ready",
        topic: "前排互动",
        config: {
          drawCount: 2,
          excludePreviouslyDrawn: false,
          excludeAdmin: false
        },
        rollingDisplayEntries: [],
        pendingResult: [],
        drawnEntries: [],
        resultRounds: [],
        rollingStartedAt: null,
        rollingEndsAt: null,
        lastResult: []
      },
      vote: {
        type: "vote",
        publishedAt: BASE_CREATED_AT + 10,
        publishedByUserId: "user-1",
        phase: "active",
        topic: "中途停靠吃什么",
        excludeAdmin: false,
        selectionMode: "single",
        maxSelections: 1,
        options: [
          { id: "trip-1-vote-1", label: "咖啡" },
          { id: "trip-1-vote-2", label: "奶茶" },
          { id: "trip-1-vote-3", label: "便利店" }
        ],
        participantUserIds,
        submissions: {}
      },
      wheel: {
        type: "wheel",
        publishedAt: BASE_CREATED_AT + 20,
        publishedByUserId: "user-1",
        phase: "draft",
        topic: "破冰小游戏",
        items: DEFAULT_WHEEL_ITEMS,
        allowAssignedUser: false,
        assignedUserId: null,
        resultIndex: null,
        resultHistoryLabels: [],
        spunAt: null
      },
      lottery: {
        type: "lottery",
        publishedAt: BASE_CREATED_AT + 30,
        publishedByUserId: "user-1",
        phase: "active",
        topic: "幸运签",
        answers: ["唱歌", "讲笑话", "请喝水"],
        cards: ["唱歌", "讲笑话", "请喝水"].map((answer, index) => ({
          id: `trip-1-lottery-${index + 1}`,
          order: index + 1,
          answer,
          claimedByUserId: null,
          claimedAt: null
        })),
        allowAssignedUser: false,
        assignedUserId: "user-1",
        drawLimitPerUser: 1,
        claimsByUserId: {}
      }
    };
  }

  return {
    "seat-draw": {
      type: "seat-draw",
      publishedAt: BASE_CREATED_AT + 100,
      publishedByUserId: "user-3",
      phase: "result",
      topic: "小游戏抽签",
      config: {
        drawCount: 1,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
      },
      rollingDisplayEntries: [],
      pendingResult: [],
      drawnEntries: [
        {
          userId: participantUserIds[0] ?? "user-3",
          seatCode: "1A"
        }
      ],
      resultRounds: [
        [
          {
            userId: participantUserIds[0] ?? "user-3",
            seatCode: "1A"
          }
        ]
      ],
      rollingStartedAt: null,
      rollingEndsAt: null,
      lastResult: [
        {
          userId: participantUserIds[0] ?? "user-3",
          seatCode: "1A"
        }
      ]
    },
    vote: null,
    wheel: {
      type: "wheel",
      publishedAt: BASE_CREATED_AT + 120,
      publishedByUserId: "user-3",
      phase: "result",
      topic: "2车转盘",
      items: ["发零食", "唱首歌", "回答问题"],
      allowAssignedUser: false,
      assignedUserId: null,
      resultIndex: 1,
      resultHistoryLabels: ["唱首歌"],
      spunAt: BASE_CREATED_AT + 121
    },
    lottery: null
  };
}

export function createInitialAppState(): AppState {
  return buildBaseState();
}

export function createSeededDemoAppState(): AppState {
  const baseState = buildBaseState();
  const nextUsers = { ...baseState.users };
  const nextTrips = { ...baseState.trips };
  const nextTripMembers = [...baseState.tripMembers];

  const trip1Seed = createSeedPassengers(
    FIXED_TRIP_IDS.trip1,
    SEEDED_USER_COUNT_BY_TRIP[FIXED_TRIP_IDS.trip1],
    BASE_CREATED_AT + 1000
  );
  const trip2Seed = createSeedPassengers(
    FIXED_TRIP_IDS.trip2,
    SEEDED_USER_COUNT_BY_TRIP[FIXED_TRIP_IDS.trip2],
    BASE_CREATED_AT + 2000
  );

  [...trip1Seed.users, ...trip2Seed.users].forEach((user) => {
    nextUsers[user.id] = user;
  });
  nextTripMembers.push(...trip1Seed.members, ...trip2Seed.members);

  const trip1 = {
    ...nextTrips[FIXED_TRIP_IDS.trip1],
    seatMap: { ...nextTrips[FIXED_TRIP_IDS.trip1].seatMap }
  };
  const trip2 = {
    ...nextTrips[FIXED_TRIP_IDS.trip2],
    seatMap: { ...nextTrips[FIXED_TRIP_IDS.trip2].seatMap }
  };

  fillSeedSeats(trip1, ["user-1", "user-2", ...trip1Seed.seatedUserIds]);
  fillSeedSeats(trip2, ["user-3", "user-4", ...trip2Seed.seatedUserIds]);

  trip1.tools = createSeedTripTools(
    FIXED_TRIP_IDS.trip1,
    nextTripMembers.filter((member) => member.tripId === FIXED_TRIP_IDS.trip1).map((member) => member.userId)
  );
  trip2.tools = createSeedTripTools(
    FIXED_TRIP_IDS.trip2,
    nextTripMembers.filter((member) => member.tripId === FIXED_TRIP_IDS.trip2).map((member) => member.userId)
  );

  return {
    ...baseState,
    users: nextUsers,
    trips: {
      ...nextTrips,
      [FIXED_TRIP_IDS.trip1]: trip1,
      [FIXED_TRIP_IDS.trip2]: trip2
    },
    tripMembers: nextTripMembers,
    runtimeConfig: {
      homeTitle: DEFAULT_HOME_TITLE,
      tripAdminUserIds: {
        [FIXED_TRIP_IDS.trip1]: "user-1",
        [FIXED_TRIP_IDS.trip2]: "user-3"
      }
    }
  };
}

export function isSeededDemoAppState(state: AppState | null): boolean {
  if (!state) {
    return false;
  }

  return Object.keys(state.users).some((userId) => userId.startsWith(`${FIXED_TRIP_IDS.trip1}-seed-user-`));
}

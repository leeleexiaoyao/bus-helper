import type {
  AppState,
  HomePersonaOption,
  TemplateId,
  ToolType,
  Trip,
  TripMember,
  TripToolsState,
  User
} from "./types";

export const APP_STATE_VERSION = 10;
export const APP_STATE_STORAGE_KEY = "bus-seat-buddy-state";
export const MAX_MEMBER_FAVORITES_PER_TRIP = 2;

export const DEFAULT_TRIP_NAME = "未命名车次";
export const DEFAULT_DEPARTURE_TIME = "待定";
export const DEFAULT_AVATAR_URL = "";
export const HOME_PERSONA_IMAGE_URL = "/assets/personas/home-persona.png";
export const WHEEL_MAX_ITEMS = 10;
export const DEFAULT_WHEEL_ITEMS = ["免单", "零食礼包", "饮料一杯", "神秘福袋", "再来一次", "感谢参与"];
export const HOME_PERSONA_OPTIONS: HomePersonaOption[] = Array.from({ length: 9 }, (_, index) => ({
  id: `home-persona-${index + 1}`,
  imageUrl: HOME_PERSONA_IMAGE_URL
}));

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
    bio: "",
    livingCity: "",
    hometown: "",
    age: "",
    tags: ["摄影", "靠窗党"],
    currentTripId: null,
    isAuthorized: false
  },
  {
    id: "user-2",
    nickname: "阿山",
    avatarUrl: DEFAULT_AVATAR_URL,
    homePersonaAssetId: null,
    bio: "",
    livingCity: "",
    hometown: "",
    age: "",
    tags: ["徒步", "社牛"],
    currentTripId: null,
    isAuthorized: false
  },
  {
    id: "user-3",
    nickname: "Miya",
    avatarUrl: DEFAULT_AVATAR_URL,
    homePersonaAssetId: null,
    bio: "",
    livingCity: "",
    hometown: "",
    age: "",
    tags: ["轻装", "周末玩家"],
    currentTripId: null,
    isAuthorized: false
  },
  {
    id: "user-4",
    nickname: "老周",
    avatarUrl: DEFAULT_AVATAR_URL,
    homePersonaAssetId: null,
    bio: "",
    livingCity: "",
    hometown: "",
    age: "",
    tags: ["老司机"],
    currentTripId: null,
    isAuthorized: false
  }
];

export const DEMO_SWITCHABLE_USER_IDS = DEMO_USERS.slice(0, 2).map((user) => user.id);

export const TOOL_TYPES: ToolType[] = ["seat-draw", "vote", "wheel", "lottery"];

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

export function createInitialAppState(): AppState {
  return {
    version: APP_STATE_VERSION,
    users: DEMO_USERS.reduce<Record<string, User>>((accumulator, user) => {
      accumulator[user.id] = { ...user };
      return accumulator;
    }, {}),
    trips: {},
    tripMembers: [],
    tripFavorites: [],
    activeUserId: DEMO_USERS[0].id
  };
}

const SEED_TRIP_ID = "trip-demo-default";
const SEED_TRIP_PASSWORD = "204900";
const SEED_ACTIVE_USER_ID = "user-2";
const SEED_OCCUPIED_USER_COUNT = 40;
const SEED_CREATED_AT = 1712803200000;
const SEAT_LETTERS = ["A", "B", "C", "D", "E"];

function buildSeedSeatCodes(templateId: TemplateId): string[] {
  const template = TRIP_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  return template.rowSeatCounts.flatMap((seatCount, rowIndex) =>
    SEAT_LETTERS.slice(0, seatCount).map((letter) => `${rowIndex + 1}${letter}`)
  );
}

function createSeedSeatMap(seatCodes: string[]): Record<string, string | null> {
  return seatCodes.reduce<Record<string, string | null>>((accumulator, seatCode) => {
    accumulator[seatCode] = null;
    return accumulator;
  }, {});
}

function buildSeedPassengerUsers(tripId: string): User[] {
  return Array.from({ length: SEED_OCCUPIED_USER_COUNT - DEMO_USERS.length }, (_, index) => {
    const userNumber = index + DEMO_USERS.length + 1;
    return {
      id: `user-${userNumber}`,
      nickname: `成员${String(userNumber).padStart(2, "0")}`,
      avatarUrl: DEFAULT_AVATAR_URL,
      homePersonaAssetId: null,
      bio: "",
      livingCity: "",
      hometown: "",
      age: "",
      tags: [`乘客${String(userNumber).padStart(2, "0")}`],
      currentTripId: tripId,
      isAuthorized: false
    };
  });
}

function buildSeedTripMembers(users: User[], tripId: string, joinedAt: number): TripMember[] {
  return users.map((user, index) => ({
    tripId,
    userId: user.id,
    role: index === 0 ? "admin" : "member",
    joinedAt: joinedAt + index
  }));
}

function buildSeedTrip(users: User[], seatCodes: string[]): Trip {
  const seatMap = createSeedSeatMap(seatCodes);
  const occupiedUsers = users.slice(0, SEED_OCCUPIED_USER_COUNT);
  occupiedUsers.forEach((user, index) => {
    seatMap[seatCodes[index]] = user.id;
  });

  return {
    id: SEED_TRIP_ID,
    tripName: "快乐出发之旅",
    departureTime: "4/20 07:30",
    password: SEED_TRIP_PASSWORD,
    templateId: "template-49",
    creatorUserId: "user-1",
    status: "active",
    seatCodes,
    seatMap,
    tools: buildSeedTripTools(occupiedUsers),
    createdAt: SEED_CREATED_AT
  };
}

function buildSeedTripTools(occupiedUsers: User[]): TripToolsState {
  const participantUserIds = occupiedUsers.map((user) => user.id);
  const wheelItems = DEFAULT_WHEEL_ITEMS;

  return {
    "seat-draw": {
      type: "seat-draw",
      publishedAt: SEED_CREATED_AT,
      publishedByUserId: "user-1",
      phase: "ready",
      topic: "上台表演节目",
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
      lastResult: [],
    },
    vote: {
      type: "vote",
      publishedAt: SEED_CREATED_AT,
      publishedByUserId: "user-1",
      phase: "active",
      topic: "今晚晚餐吃什么",
      excludeAdmin: false,
      selectionMode: "multiple",
      maxSelections: 4,
      options: [
        { id: "seed-vote-option-1", label: "火锅" },
        { id: "seed-vote-option-2", label: "烧烤" },
        { id: "seed-vote-option-3", label: "炒菜" },
        { id: "seed-vote-option-4", label: "面食" }
      ],
      participantUserIds,
      submissions: {}
    },
    wheel: {
      type: "wheel",
      publishedAt: SEED_CREATED_AT,
      publishedByUserId: "user-1",
      phase: "draft",
      topic: "大转盘",
      items: wheelItems,
      allowAssignedUser: false,
      assignedUserId: null,
      resultIndex: null,
      resultHistoryLabels: [],
      spunAt: null
    },
    lottery: {
      type: "lottery",
      publishedAt: SEED_CREATED_AT,
      publishedByUserId: "user-1",
      phase: "active",
      topic: "幸运签",
      answers: ["去前排", "唱首歌", "请大家喝饮料"],
      cards: ["请大家喝饮料", "去前排", "唱首歌"].map((answer, index) => ({
        id: `seed-lottery-card-${index + 1}`,
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

export function createSeededDemoAppState(): AppState {
  const seatCodes = buildSeedSeatCodes("template-49");
  const switchableUsers = DEMO_USERS.map((user) => ({
    ...user,
    currentTripId: SEED_TRIP_ID,
    isAuthorized: true
  }));
  const passengerUsers = buildSeedPassengerUsers(SEED_TRIP_ID);
  const seededUsers = [...switchableUsers, ...passengerUsers];
  const seededTrip = buildSeedTrip(seededUsers, seatCodes);
  const seededTripMembers = buildSeedTripMembers(
    seededUsers.slice(0, SEED_OCCUPIED_USER_COUNT),
    SEED_TRIP_ID,
    seededTrip.createdAt
  );

  return {
    version: APP_STATE_VERSION,
    users: seededUsers.reduce<Record<string, User>>((accumulator, user) => {
      accumulator[user.id] = { ...user };
      return accumulator;
    }, {}),
    trips: {
      [seededTrip.id]: seededTrip
    },
    tripMembers: seededTripMembers,
    tripFavorites: [],
    activeUserId: SEED_ACTIVE_USER_ID
  };
}

export function isSeededDemoAppState(state: AppState | null): boolean {
  if (!state) {
    return false;
  }

  const trip = state.trips[SEED_TRIP_ID];
  return Boolean(trip && trip.status === "active");
}

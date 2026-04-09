import type { AppState, TemplateId, User } from "./types";

export const APP_STATE_VERSION = 2;
export const APP_STATE_STORAGE_KEY = "bus-seat-buddy-state";

export const DEFAULT_TRIP_NAME = "未命名车次";
export const DEFAULT_DEPARTURE_TIME = "待定";
export const DEFAULT_AVATAR_URL = "";

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
    tags: ["摄影", "靠窗党"],
    currentTripId: null,
    isAuthorized: false
  },
  {
    id: "user-2",
    nickname: "阿山",
    avatarUrl: DEFAULT_AVATAR_URL,
    tags: ["徒步", "社牛"],
    currentTripId: null,
    isAuthorized: false
  },
  {
    id: "user-3",
    nickname: "Miya",
    avatarUrl: DEFAULT_AVATAR_URL,
    tags: ["轻装", "周末玩家"],
    currentTripId: null,
    isAuthorized: false
  },
  {
    id: "user-4",
    nickname: "老周",
    avatarUrl: DEFAULT_AVATAR_URL,
    tags: ["老司机"],
    currentTripId: null,
    isAuthorized: false
  }
];

export function createInitialAppState(): AppState {
  return {
    version: APP_STATE_VERSION,
    users: DEMO_USERS.reduce<Record<string, User>>((accumulator, user) => {
      accumulator[user.id] = { ...user };
      return accumulator;
    }, {}),
    trips: {},
    tripMembers: [],
    activeUserId: DEMO_USERS[0].id
  };
}

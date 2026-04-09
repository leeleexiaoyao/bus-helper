"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEMO_USERS = exports.TRIP_TEMPLATES = exports.DEFAULT_AVATAR_URL = exports.DEFAULT_DEPARTURE_TIME = exports.DEFAULT_TRIP_NAME = exports.APP_STATE_STORAGE_KEY = exports.APP_STATE_VERSION = void 0;
exports.createInitialAppState = createInitialAppState;
exports.APP_STATE_VERSION = 2;
exports.APP_STATE_STORAGE_KEY = "bus-seat-buddy-state";
exports.DEFAULT_TRIP_NAME = "未命名车次";
exports.DEFAULT_DEPARTURE_TIME = "待定";
exports.DEFAULT_AVATAR_URL = "";
exports.TRIP_TEMPLATES = [
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
exports.DEMO_USERS = [
    {
        id: "user-1",
        nickname: "小雨",
        avatarUrl: exports.DEFAULT_AVATAR_URL,
        tags: ["摄影", "靠窗党"],
        currentTripId: null,
        isAuthorized: false
    },
    {
        id: "user-2",
        nickname: "阿山",
        avatarUrl: exports.DEFAULT_AVATAR_URL,
        tags: ["徒步", "社牛"],
        currentTripId: null,
        isAuthorized: false
    },
    {
        id: "user-3",
        nickname: "Miya",
        avatarUrl: exports.DEFAULT_AVATAR_URL,
        tags: ["轻装", "周末玩家"],
        currentTripId: null,
        isAuthorized: false
    },
    {
        id: "user-4",
        nickname: "老周",
        avatarUrl: exports.DEFAULT_AVATAR_URL,
        tags: ["老司机"],
        currentTripId: null,
        isAuthorized: false
    }
];
function createInitialAppState() {
    return {
        version: exports.APP_STATE_VERSION,
        users: exports.DEMO_USERS.reduce((accumulator, user) => {
            accumulator[user.id] = Object.assign({}, user);
            return accumulator;
        }, {}),
        trips: {},
        tripMembers: [],
        activeUserId: exports.DEMO_USERS[0].id
    };
}

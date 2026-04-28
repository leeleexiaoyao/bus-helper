import { DEFAULT_AVATAR_URL } from "../shared/constants";
import type { User } from "../shared/types";

const LOCAL_CLEARED_USER_IDS_STORAGE_KEY = "bus-seat-buddy-cleared-user-ids";

let memoryClearedUserIds: string[] = [];

function canUseWxStorage(): boolean {
  return (
    typeof wx !== "undefined" &&
    typeof wx.getStorageSync === "function" &&
    typeof wx.setStorageSync === "function"
  );
}

function normalizeUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function readClearedUserIds(): string[] {
  if (canUseWxStorage()) {
    const storedValue = wx.getStorageSync(LOCAL_CLEARED_USER_IDS_STORAGE_KEY) as unknown;
    memoryClearedUserIds = normalizeUserIds(storedValue);
    return [...memoryClearedUserIds];
  }

  return [...memoryClearedUserIds];
}

function writeClearedUserIds(userIds: string[]): void {
  const nextUserIds = normalizeUserIds(userIds);
  memoryClearedUserIds = nextUserIds;
  if (canUseWxStorage()) {
    wx.setStorageSync(LOCAL_CLEARED_USER_IDS_STORAGE_KEY, nextUserIds);
  }
}

export function isLocallyClearedUser(userId: string): boolean {
  const normalizedUserId = userId.trim();
  return Boolean(normalizedUserId) && readClearedUserIds().includes(normalizedUserId);
}

export function markUserAsLocallyCleared(userId: string): void {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return;
  }

  writeClearedUserIds([...readClearedUserIds(), normalizedUserId]);
}

export function clearLocallyClearedUserMark(userId: string): void {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return;
  }

  writeClearedUserIds(readClearedUserIds().filter((entry) => entry !== normalizedUserId));
}

export function buildLocallyClearedUser(userId: string): User {
  return {
    id: userId,
    nickname: "",
    avatarUrl: DEFAULT_AVATAR_URL,
    homePersonaAssetId: null,
    bio: "",
    livingCity: "",
    hometown: "",
    age: "",
    tags: [],
    memberTripId: null,
    currentTripId: null,
    isAuthorized: false,
    boardingRecordsByTripId: {}
  };
}

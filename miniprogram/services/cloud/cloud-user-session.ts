import { DEFAULT_AVATAR_URL, DEMO_SWITCHABLE_USER_IDS } from "../../shared/constants";
import type { User } from "../../shared/types";
import { AppStateRepository } from "../../repositories/app-state-repository";
import { wxStorageAdapter } from "../../repositories/storage-adapter";
import { hasConfiguredCloudEnv } from "../../config/cloud";
import { fetchCloudIdentity, getCloudDatabase } from "./cloud-service";

const CLOUD_USER_COLLECTION = "bus_buddy_users";

type CloudUserDocument = User & {
  _id: string;
  createdAt: number;
  updatedAt: number;
};

let userWriteQueue: Promise<void> = Promise.resolve();

function canUseCloudRuntime(): boolean {
  return typeof wx !== "undefined" && Boolean(wx.cloud) && hasConfiguredCloudEnv();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function getLocalSeedUser(): User | null {
  const repository = new AppStateRepository(wxStorageAdapter);
  const state = repository.read();
  const currentUser = state.users[state.activeUserId] ?? null;

  if (!currentUser || DEMO_SWITCHABLE_USER_IDS.includes(currentUser.id)) {
    return null;
  }

  return currentUser;
}

function buildDefaultCloudUser(openid: string, localSeedUser: User | null): CloudUserDocument {
  const timestamp = Date.now();

  return {
    _id: openid,
    id: openid,
    nickname: localSeedUser?.nickname ?? "",
    avatarUrl: localSeedUser?.avatarUrl ?? DEFAULT_AVATAR_URL,
    homePersonaAssetId: localSeedUser?.homePersonaAssetId ?? null,
    bio: localSeedUser?.bio ?? "",
    livingCity: localSeedUser?.livingCity ?? "",
    hometown: localSeedUser?.hometown ?? "",
    age: localSeedUser?.age ?? "",
    tags: localSeedUser?.tags ?? [],
    currentTripId: localSeedUser?.id === openid ? localSeedUser.currentTripId : null,
    isAuthorized: localSeedUser?.isAuthorized ?? false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function normalizeCloudUserDocument(
  openid: string,
  rawDocument: unknown,
  fallbackUser: User | null
): CloudUserDocument {
  const fallbackDocument = buildDefaultCloudUser(openid, fallbackUser);
  if (!isPlainObject(rawDocument)) {
    return fallbackDocument;
  }

  return {
    _id: openid,
    id: openid,
    nickname: normalizeString(rawDocument.nickname, fallbackDocument.nickname),
    avatarUrl: normalizeString(rawDocument.avatarUrl, fallbackDocument.avatarUrl),
    homePersonaAssetId:
      typeof rawDocument.homePersonaAssetId === "string" && rawDocument.homePersonaAssetId.trim()
        ? rawDocument.homePersonaAssetId
        : null,
    bio: normalizeString(rawDocument.bio, fallbackDocument.bio),
    livingCity: normalizeString(rawDocument.livingCity, fallbackDocument.livingCity),
    hometown: normalizeString(rawDocument.hometown, fallbackDocument.hometown),
    age: normalizeString(rawDocument.age, fallbackDocument.age),
    tags: normalizeStringArray(rawDocument.tags),
    currentTripId:
      typeof rawDocument.currentTripId === "string" && rawDocument.currentTripId.trim()
        ? rawDocument.currentTripId
        : null,
    isAuthorized: Boolean(rawDocument.isAuthorized),
    createdAt:
      typeof rawDocument.createdAt === "number" ? rawDocument.createdAt : fallbackDocument.createdAt,
    updatedAt:
      typeof rawDocument.updatedAt === "number" ? rawDocument.updatedAt : fallbackDocument.updatedAt
  };
}

function toLocalUser(document: CloudUserDocument): User {
  return {
    id: document._id,
    nickname: document.nickname,
    avatarUrl: document.avatarUrl,
    homePersonaAssetId: document.homePersonaAssetId,
    bio: document.bio,
    livingCity: document.livingCity,
    hometown: document.hometown,
    age: document.age,
    tags: document.tags,
    currentTripId: document.currentTripId,
    isAuthorized: document.isAuthorized
  };
}

function toCloudUserDocument(user: User): CloudUserDocument {
  const timestamp = Date.now();

  return {
    _id: user.id,
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    homePersonaAssetId: user.homePersonaAssetId,
    bio: user.bio,
    livingCity: user.livingCity,
    hometown: user.hometown,
    age: user.age,
    tags: user.tags,
    currentTripId: user.currentTripId,
    isAuthorized: user.isAuthorized,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

async function readCloudUser(openid: string): Promise<CloudUserDocument | null> {
  const database = getCloudDatabase();

  try {
    const response = await database.collection(CLOUD_USER_COLLECTION).doc(openid).get();
    return normalizeCloudUserDocument(openid, response.data, getLocalSeedUser());
  } catch (_error) {
    return null;
  }
}

async function writeCloudUser(document: CloudUserDocument): Promise<void> {
  const database = getCloudDatabase();
  const { _id, ...payload } = document;
  const safePayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "_id")
  ) as Omit<CloudUserDocument, "_id">;

  console.info("[cloud] 写入用户文档", {
    docId: _id,
    payloadKeys: Object.keys(safePayload)
  });

  await database.collection(CLOUD_USER_COLLECTION).doc(_id).set({
    data: safePayload
  });
}

export async function syncCloudUserToLocalState(): Promise<void> {
  if (!canUseCloudRuntime()) {
    return;
  }

  const identity = await fetchCloudIdentity();
  const repository = new AppStateRepository(wxStorageAdapter);
  const seedUser = getLocalSeedUser();
  let cloudUser = await readCloudUser(identity.openid);

  if (!cloudUser) {
    cloudUser = buildDefaultCloudUser(identity.openid, seedUser);
    await writeCloudUser(cloudUser);
  }

  repository.update((state) => {
    state.users[identity.openid] = toLocalUser(cloudUser as CloudUserDocument);
    state.activeUserId = identity.openid;
  });
}

export function scheduleUserCloudSync(user: User): void {
  if (!canUseCloudRuntime() || !user.id || DEMO_SWITCHABLE_USER_IDS.includes(user.id)) {
    return;
  }

  const nextDocument = toCloudUserDocument(user);

  userWriteQueue = userWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await writeCloudUser(nextDocument);
    })
    .catch((error) => {
      console.error("[cloud] 用户资料同步失败", error);
    });
}

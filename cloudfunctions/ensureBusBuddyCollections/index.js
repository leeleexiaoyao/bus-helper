const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const COLLECTIONS = {
  users: "bus_buddy_users",
  runtimeConfig: "bus_buddy_runtime_config"
};
const DEFAULT_HOME_TITLE = "麒麟之旅";
const FIXED_TRIP_IDS = {
  trip1: "trip-fixed-1",
  trip2: "trip-fixed-2"
};

async function ensureUsersCollection() {
  const bootstrapDocId = "__bootstrap__";

  try {
    await db.collection(COLLECTIONS.users).doc(bootstrapDocId).set({
      data: {
        id: bootstrapDocId,
        nickname: "bootstrap",
        avatarUrl: "",
        homePersonaAssetId: null,
        bio: "",
        livingCity: "",
        hometown: "",
        age: "",
        tags: [],
        memberTripId: FIXED_TRIP_IDS.trip1,
        currentTripId: FIXED_TRIP_IDS.trip1,
        isAuthorized: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    });
  } catch (error) {
    if (String(error && error.errMsg).includes("already exists")) {
      return;
    }
    throw error;
  }

  await db.collection(COLLECTIONS.users).doc(bootstrapDocId).remove();
}

async function ensureRuntimeConfigCollection() {
  try {
    await db.collection(COLLECTIONS.runtimeConfig).doc("singleton").get();
  } catch (_error) {
    await db.collection(COLLECTIONS.runtimeConfig).doc("singleton").set({
      data: {
        homeTitle: DEFAULT_HOME_TITLE,
        tripAdminUserIds: {
          [FIXED_TRIP_IDS.trip1]: null,
          [FIXED_TRIP_IDS.trip2]: null
        },
        updatedAt: Date.now()
      }
    });
  }
}

exports.main = async () => {
  await ensureUsersCollection();
  await ensureRuntimeConfigCollection();

  return {
    ok: true,
    collections: Object.values(COLLECTIONS)
  };
};

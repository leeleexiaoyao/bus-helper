import { createDefaultRuntimeConfig } from "../../shared/constants";
import type { RuntimeConfig } from "../../shared/types";
import { AppStateRepository } from "../../repositories/app-state-repository";
import { wxStorageAdapter } from "../../repositories/storage-adapter";
import { hasConfiguredCloudEnv } from "../../config/cloud";
import { getCloudDatabase } from "./cloud-service";

const CLOUD_RUNTIME_CONFIG_COLLECTION = "bus_buddy_runtime_config";
const CLOUD_RUNTIME_CONFIG_DOC_ID = "singleton";

type CloudRuntimeConfigDocument = RuntimeConfig & {
  _id: string;
  updatedAt: number;
};

function canUseCloudRuntime(): boolean {
  return typeof wx !== "undefined" && Boolean(wx.cloud) && hasConfiguredCloudEnv();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRuntimeConfig(rawDocument: unknown): RuntimeConfig {
  const fallback = createDefaultRuntimeConfig();
  if (!isPlainObject(rawDocument)) {
    return fallback;
  }

  const rawTripAdminUserIds = isPlainObject(rawDocument.tripAdminUserIds)
    ? rawDocument.tripAdminUserIds
    : {};

  return {
    homeTitle:
      typeof rawDocument.homeTitle === "string" && rawDocument.homeTitle.trim()
        ? rawDocument.homeTitle.trim()
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

function toCloudRuntimeConfigDocument(runtimeConfig: RuntimeConfig): CloudRuntimeConfigDocument {
  return {
    _id: CLOUD_RUNTIME_CONFIG_DOC_ID,
    ...runtimeConfig,
    updatedAt: Date.now()
  };
}

async function readCloudRuntimeConfig(): Promise<RuntimeConfig | null> {
  const database = getCloudDatabase();

  try {
    const response = await database
      .collection(CLOUD_RUNTIME_CONFIG_COLLECTION)
      .doc(CLOUD_RUNTIME_CONFIG_DOC_ID)
      .get();
    return normalizeRuntimeConfig(response.data);
  } catch (_error) {
    return null;
  }
}

export async function writeCloudRuntimeConfig(runtimeConfig: RuntimeConfig): Promise<void> {
  if (!canUseCloudRuntime()) {
    return;
  }

  const database = getCloudDatabase();
  const { _id, ...payload } = toCloudRuntimeConfigDocument(runtimeConfig);

  await database.collection(CLOUD_RUNTIME_CONFIG_COLLECTION).doc(_id).set({
    data: payload
  });
}

export async function syncCloudRuntimeConfigToLocalState(): Promise<void> {
  if (!canUseCloudRuntime()) {
    return;
  }

  const repository = new AppStateRepository(wxStorageAdapter);
  let runtimeConfig = await readCloudRuntimeConfig();

  if (!runtimeConfig) {
    runtimeConfig = createDefaultRuntimeConfig();
    try {
      await writeCloudRuntimeConfig(runtimeConfig);
    } catch (error) {
      console.warn("[cloud] 运行配置集合不可用，继续使用本地默认配置", error);
    }
  }

  repository.update((state) => {
    state.runtimeConfig = runtimeConfig as RuntimeConfig;
  });
}

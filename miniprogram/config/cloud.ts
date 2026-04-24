export type CloudBackendMode = "local" | "cloud";

export interface CloudRuntimeConfig {
  backendMode: CloudBackendMode;
  envId: string;
  traceUser: boolean;
}

export interface CloudInitState {
  backendMode: CloudBackendMode;
  enabled: boolean;
  envId: string | null;
  reason: string | null;
}

export const CLOUD_ENV_ID_PLACEHOLDER = "replace-with-your-cloud-env-id";

export const cloudRuntimeConfig: CloudRuntimeConfig = {
  backendMode: "cloud",
  envId: "cloud1-3gjxwr4baf653a7d",
  traceUser: true
};

export function hasConfiguredCloudEnv(envId: string = cloudRuntimeConfig.envId): boolean {
  return Boolean(envId && envId !== CLOUD_ENV_ID_PLACEHOLDER);
}

export function initializeCloudRuntime(): CloudInitState {
  if (!wx.cloud) {
    return {
      backendMode: cloudRuntimeConfig.backendMode,
      enabled: false,
      envId: null,
      reason: "当前基础库未提供云开发能力。请在开发者工具中升级基础库。"
    };
  }

  if (cloudRuntimeConfig.backendMode !== "cloud") {
    return {
      backendMode: cloudRuntimeConfig.backendMode,
      enabled: false,
      envId: null,
      reason: "当前项目仍在本地数据模式运行。"
    };
  }

  if (!hasConfiguredCloudEnv()) {
    return {
      backendMode: cloudRuntimeConfig.backendMode,
      enabled: false,
      envId: null,
      reason: "请先在 miniprogram/config/cloud.ts 中填写真实云环境 ID。"
    };
  }

  wx.cloud.init({
    env: cloudRuntimeConfig.envId,
    traceUser: cloudRuntimeConfig.traceUser
  });

  return {
    backendMode: cloudRuntimeConfig.backendMode,
    enabled: true,
    envId: cloudRuntimeConfig.envId,
    reason: null
  };
}

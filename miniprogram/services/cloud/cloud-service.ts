import { hasConfiguredCloudEnv } from "../../config/cloud";

export interface CloudIdentityResult {
  openid: string;
  appid: string;
  unionid: string | null;
  env: string | null;
  serverTime: number;
}

function assertCloudReady(): void {
  if (!wx.cloud) {
    throw new Error("当前基础库未提供云开发能力。");
  }

  if (!hasConfiguredCloudEnv()) {
    throw new Error("请先在 miniprogram/config/cloud.ts 中填写真实云环境 ID。");
  }
}

export function getCloudDatabase(): ReturnType<typeof wx.cloud.database> {
  assertCloudReady();
  return wx.cloud.database();
}

export async function callCloudFunction<TResult>(
  name: string,
  data: Record<string, unknown> = {}
): Promise<TResult> {
  assertCloudReady();

  const response = await wx.cloud.callFunction({
    name,
    data
  });

  return response.result as TResult;
}

export function fetchCloudIdentity(): Promise<CloudIdentityResult> {
  return callCloudFunction<CloudIdentityResult>("getOpenid");
}

export async function waitForCloudReady(): Promise<void> {
  const app = getApp<IAppOption>();
  const cloudReadyPromise = app?.globalData?.cloudReadyPromise ?? null;

  if (!cloudReadyPromise) {
    return;
  }

  await cloudReadyPromise;
}

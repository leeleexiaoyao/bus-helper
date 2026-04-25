interface IAppOption {
  globalData: {
    version: string;
    cloud: {
      backendMode: "local" | "cloud";
      enabled: boolean;
      envId: string | null;
      reason: string | null;
    };
    cloudReadyPromise?: Promise<void>;
  };
}

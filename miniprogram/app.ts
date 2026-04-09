import { initializeAppState } from "./repositories/app-state-repository";
import { wxStorageAdapter } from "./repositories/storage-adapter";

App<IAppOption>({
  globalData: {
    version: "1.0.0"
  },
  onLaunch() {
    initializeAppState(wxStorageAdapter);
  }
});

import type { AppState } from "./shared/types";
import { initializeAppState } from "./repositories/app-state-repository";
import { wxStorageAdapter } from "./repositories/storage-adapter";
import { DEMO_SWITCHABLE_USER_IDS, createSeededDemoAppState } from "./shared/constants";

function shouldSeedDemoState(state: AppState | null): boolean {
  if (!state) {
    return true;
  }

  const tripCount = Object.keys(state.trips ?? {}).length;
  const tripMemberCount = Array.isArray(state.tripMembers) ? state.tripMembers.length : 0;
  const userIds = Object.keys(state.users ?? {});
  const onlySwitchableUsers =
    userIds.length > 0 && userIds.every((userId) => DEMO_SWITCHABLE_USER_IDS.includes(userId));

  if (tripCount === 0 && tripMemberCount === 0) {
    return true;
  }

  if (onlySwitchableUsers) {
    return true;
  }

  if (tripCount === 1 && tripMemberCount > 0 && tripMemberCount <= DEMO_SWITCHABLE_USER_IDS.length) {
    return true;
  }

  return false;
}

App<IAppOption>({
  globalData: {
    version: "1.0.0"
  },
  onLaunch() {
    const existingState = wxStorageAdapter.getState();
    if (shouldSeedDemoState(existingState)) {
      wxStorageAdapter.setState(createSeededDemoAppState());
    }
    initializeAppState(wxStorageAdapter);
  }
});

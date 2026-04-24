import { BusinessError } from "../shared/errors";
import type { User } from "../shared/types";
import { scheduleUserCloudSync } from "../services/cloud/cloud-user-session";
import { AppStateRepository } from "./app-state-repository";

export class UserRepository {
  constructor(private readonly appStateRepository: AppStateRepository) {}

  listUsers(): User[] {
    return Object.values(this.appStateRepository.read().users);
  }

  getUser(userId: string): User {
    const user = this.appStateRepository.read().users[userId];
    if (!user) {
      throw new BusinessError("USER_NOT_FOUND", "未找到当前用户。");
    }
    return user;
  }

  updateUser(userId: string, updater: (user: User) => void): User {
    const nextUser = this.appStateRepository.update((state) => {
      const user = state.users[userId];
      if (!user) {
        throw new BusinessError("USER_NOT_FOUND", "未找到当前用户。");
      }
      updater(user);
      return user;
    });

    scheduleUserCloudSync(nextUser);
    return nextUser;
  }

  setCurrentTripId(userId: string, tripId: string | null): User {
    return this.updateUser(userId, (user) => {
      user.currentTripId = tripId;
    });
  }
}

import { AppStateRepository } from "./app-state-repository";

export class SessionRepository {
  constructor(private readonly appStateRepository: AppStateRepository) {}

  getActiveUserId(): string {
    return this.appStateRepository.read().activeUserId;
  }

  setActiveUserId(userId: string): void {
    this.appStateRepository.update((state) => {
      state.activeUserId = userId;
    });
  }
}

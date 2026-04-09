"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionRepository = void 0;
class SessionRepository {
    constructor(appStateRepository) {
        this.appStateRepository = appStateRepository;
    }
    getActiveUserId() {
        return this.appStateRepository.read().activeUserId;
    }
    setActiveUserId(userId) {
        this.appStateRepository.update((state) => {
            state.activeUserId = userId;
        });
    }
}
exports.SessionRepository = SessionRepository;

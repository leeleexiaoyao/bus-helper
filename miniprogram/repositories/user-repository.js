"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const errors_1 = require("../shared/errors");
class UserRepository {
    constructor(appStateRepository) {
        this.appStateRepository = appStateRepository;
    }
    listUsers() {
        return Object.values(this.appStateRepository.read().users);
    }
    getUser(userId) {
        const user = this.appStateRepository.read().users[userId];
        if (!user) {
            throw new errors_1.BusinessError("USER_NOT_FOUND", "未找到当前用户。");
        }
        return user;
    }
    updateUser(userId, updater) {
        return this.appStateRepository.update((state) => {
            const user = state.users[userId];
            if (!user) {
                throw new errors_1.BusinessError("USER_NOT_FOUND", "未找到当前用户。");
            }
            updater(user);
            return user;
        });
    }
    setCurrentTripId(userId, tripId) {
        return this.updateUser(userId, (user) => {
            user.currentTripId = tripId;
        });
    }
}
exports.UserRepository = UserRepository;

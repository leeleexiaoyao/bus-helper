"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppStateRepository = void 0;
exports.initializeAppState = initializeAppState;
const constants_1 = require("../shared/constants");
function normalizeState(state) {
    if (!state || state.version !== constants_1.APP_STATE_VERSION) {
        return (0, constants_1.createInitialAppState)();
    }
    return state;
}
class AppStateRepository {
    constructor(storageAdapter) {
        this.storageAdapter = storageAdapter;
    }
    read() {
        return normalizeState(this.storageAdapter.getState());
    }
    write(state) {
        this.storageAdapter.setState(state);
    }
    update(updater) {
        const state = this.read();
        const result = updater(state);
        this.write(state);
        return result;
    }
}
exports.AppStateRepository = AppStateRepository;
function initializeAppState(storageAdapter) {
    const repository = new AppStateRepository(storageAdapter);
    const state = repository.read();
    repository.write(state);
    return state;
}

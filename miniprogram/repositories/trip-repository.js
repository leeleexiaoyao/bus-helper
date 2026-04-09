"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripRepository = void 0;
const errors_1 = require("../shared/errors");
class TripRepository {
    constructor(appStateRepository) {
        this.appStateRepository = appStateRepository;
    }
    listTrips() {
        return Object.values(this.appStateRepository.read().trips);
    }
    getTrip(tripId) {
        const trip = this.appStateRepository.read().trips[tripId];
        if (!trip) {
            throw new errors_1.BusinessError("TRIP_NOT_FOUND", "未找到对应车次。");
        }
        return trip;
    }
    updateTrip(tripId, updater) {
        return this.appStateRepository.update((state) => {
            const trip = state.trips[tripId];
            if (!trip) {
                throw new errors_1.BusinessError("TRIP_NOT_FOUND", "未找到对应车次。");
            }
            updater(trip);
            return trip;
        });
    }
    saveTrip(trip) {
        return this.appStateRepository.update((state) => {
            state.trips[trip.id] = trip;
            return trip;
        });
    }
    findActiveTripByPassword(password) {
        var _a;
        return ((_a = this.listTrips().find((trip) => trip.password === password && trip.status === "active")) !== null && _a !== void 0 ? _a : null);
    }
    ensurePasswordAvailable(password) {
        const existing = this.findActiveTripByPassword(password);
        if (existing) {
            throw new errors_1.BusinessError("PASSWORD_CONFLICT", "这个 6 位密码已经被其他车次占用。");
        }
    }
    listTripMembers(tripId) {
        return this.appStateRepository.read().tripMembers.filter((member) => member.tripId === tripId);
    }
    getTripMember(tripId, userId) {
        var _a;
        return (_a = this.listTripMembers(tripId).find((member) => member.userId === userId)) !== null && _a !== void 0 ? _a : null;
    }
    addTripMember(tripId, userId, role, joinedAt) {
        return this.appStateRepository.update((state) => {
            const exists = state.tripMembers.find((member) => member.tripId === tripId && member.userId === userId);
            if (exists) {
                return exists;
            }
            const nextMember = {
                tripId,
                userId,
                role,
                joinedAt
            };
            state.tripMembers.push(nextMember);
            return nextMember;
        });
    }
    removeTripMember(tripId, userId) {
        this.appStateRepository.update((state) => {
            state.tripMembers = state.tripMembers.filter((member) => !(member.tripId === tripId && member.userId === userId));
        });
    }
    removeAllTripMembers(tripId) {
        this.appStateRepository.update((state) => {
            state.tripMembers = state.tripMembers.filter((member) => member.tripId !== tripId);
        });
    }
}
exports.TripRepository = TripRepository;

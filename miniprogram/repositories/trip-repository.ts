import { BusinessError } from "../shared/errors";
import type { MemberRole, Trip, TripMember } from "../shared/types";
import { AppStateRepository } from "./app-state-repository";

export class TripRepository {
  constructor(private readonly appStateRepository: AppStateRepository) {}

  listTrips(): Trip[] {
    return Object.values(this.appStateRepository.read().trips);
  }

  getTrip(tripId: string): Trip {
    const trip = this.appStateRepository.read().trips[tripId];
    if (!trip) {
      throw new BusinessError("TRIP_NOT_FOUND", "未找到对应车次。");
    }
    return trip;
  }

  updateTrip(tripId: string, updater: (trip: Trip) => void): Trip {
    return this.appStateRepository.update((state) => {
      const trip = state.trips[tripId];
      if (!trip) {
        throw new BusinessError("TRIP_NOT_FOUND", "未找到对应车次。");
      }
      updater(trip);
      return trip;
    });
  }

  saveTrip(trip: Trip): Trip {
    return this.appStateRepository.update((state) => {
      state.trips[trip.id] = trip;
      return trip;
    });
  }

  findActiveTripByPassword(password: string): Trip | null {
    return (
      this.listTrips().find((trip) => trip.password === password && trip.status === "active") ?? null
    );
  }

  ensurePasswordAvailable(password: string): void {
    const existing = this.findActiveTripByPassword(password);
    if (existing) {
      throw new BusinessError("PASSWORD_CONFLICT", "这个 6 位密码已经被其他车次占用。");
    }
  }

  listTripMembers(tripId: string): TripMember[] {
    return this.appStateRepository.read().tripMembers.filter((member) => member.tripId === tripId);
  }

  getTripMember(tripId: string, userId: string): TripMember | null {
    return this.listTripMembers(tripId).find((member) => member.userId === userId) ?? null;
  }

  addTripMember(tripId: string, userId: string, role: MemberRole, joinedAt: number): TripMember {
    return this.appStateRepository.update((state) => {
      const exists = state.tripMembers.find(
        (member) => member.tripId === tripId && member.userId === userId
      );
      if (exists) {
        return exists;
      }

      const nextMember: TripMember = {
        tripId,
        userId,
        role,
        joinedAt
      };
      state.tripMembers.push(nextMember);
      return nextMember;
    });
  }

  removeTripMember(tripId: string, userId: string): void {
    this.appStateRepository.update((state) => {
      state.tripMembers = state.tripMembers.filter(
        (member) => !(member.tripId === tripId && member.userId === userId)
      );
    });
  }

  removeAllTripMembers(tripId: string): void {
    this.appStateRepository.update((state) => {
      state.tripMembers = state.tripMembers.filter((member) => member.tripId !== tripId);
    });
  }
}

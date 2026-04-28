import { BusinessError } from "../shared/errors";
import type { MemberRole, Trip, TripFavoriteRelation, TripMember } from "../shared/types";
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
      throw new BusinessError("PASSWORD_CONFLICT", "这个 6 位口令已经被其他车次占用。");
    }
  }

  listTripMembers(tripId: string): TripMember[] {
    return this.appStateRepository.read().tripMembers.filter((member) => member.tripId === tripId);
  }

  listTripFavorites(tripId: string): TripFavoriteRelation[] {
    return this.appStateRepository.read().tripFavorites.filter((favorite) => favorite.tripId === tripId);
  }

  listAllTripFavorites(): TripFavoriteRelation[] {
    return this.appStateRepository.read().tripFavorites.slice();
  }

  getTripMember(tripId: string, userId: string): TripMember | null {
    return this.listTripMembers(tripId).find((member) => member.userId === userId) ?? null;
  }

  hasTripFavorite(tripId: string, sourceUserId: string, targetUserId: string): boolean {
    return this.listTripFavorites(tripId).some(
      (favorite) =>
        favorite.sourceUserId === sourceUserId && favorite.targetUserId === targetUserId
    );
  }

  hasFavorite(sourceUserId: string, targetUserId: string): boolean {
    return this.listAllTripFavorites().some(
      (favorite) =>
        favorite.sourceUserId === sourceUserId && favorite.targetUserId === targetUserId
    );
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

  addTripFavorite(
    tripId: string,
    sourceUserId: string,
    targetUserId: string,
    createdAt: number
  ): TripFavoriteRelation {
    return this.appStateRepository.update((state) => {
      const exists = state.tripFavorites.find(
        (favorite) => favorite.sourceUserId === sourceUserId && favorite.targetUserId === targetUserId
      );
      if (exists) {
        return exists;
      }

      const nextFavorite: TripFavoriteRelation = {
        tripId,
        sourceUserId,
        targetUserId,
        createdAt
      };
      state.tripFavorites.push(nextFavorite);
      return nextFavorite;
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

  removeTripFavorite(tripId: string, sourceUserId: string, targetUserId: string): void {
    this.appStateRepository.update((state) => {
      state.tripFavorites = state.tripFavorites.filter(
        (favorite) =>
          !(
            favorite.tripId === tripId &&
            favorite.sourceUserId === sourceUserId &&
            favorite.targetUserId === targetUserId
          )
      );
    });
  }

  removeFavorite(sourceUserId: string, targetUserId: string): void {
    this.appStateRepository.update((state) => {
      state.tripFavorites = state.tripFavorites.filter(
        (favorite) =>
          !(favorite.sourceUserId === sourceUserId && favorite.targetUserId === targetUserId)
      );
    });
  }

  removeTripFavoritesByTrip(tripId: string): void {
    this.appStateRepository.update((state) => {
      state.tripFavorites = state.tripFavorites.filter((favorite) => favorite.tripId !== tripId);
    });
  }

  removeTripFavoritesByUserInTrip(tripId: string, userId: string): void {
    this.appStateRepository.update((state) => {
      state.tripFavorites = state.tripFavorites.filter(
        (favorite) =>
          favorite.tripId !== tripId ||
          (favorite.sourceUserId !== userId && favorite.targetUserId !== userId)
      );
    });
  }
}

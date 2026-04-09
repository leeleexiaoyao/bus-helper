import { DEFAULT_DEPARTURE_TIME, DEFAULT_TRIP_NAME } from "../shared/constants";

export function displayTripName(tripName: string): string {
  return tripName.trim() || DEFAULT_TRIP_NAME;
}

export function displayDepartureTime(departureTime: string): string {
  return departureTime.trim() || DEFAULT_DEPARTURE_TIME;
}

export function parseTags(tagsInput: string): string[] {
  const uniqueTags = Array.from(
    new Set(
      tagsInput
        .split(/[，,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
  return uniqueTags.slice(0, 3);
}

export function getInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

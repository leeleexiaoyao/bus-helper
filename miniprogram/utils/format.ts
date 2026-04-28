import { DEFAULT_DEPARTURE_TIME, DEFAULT_TRIP_NAME } from "../shared/constants";
import type { LocationDisplay } from "../shared/types";

export function displayTripName(tripName: string): string {
  return tripName.trim() || DEFAULT_TRIP_NAME;
}

export function displayDepartureTime(departureTime: string): string {
  const trimmed = departureTime.trim();
  if (!trimmed) {
    return DEFAULT_DEPARTURE_TIME;
  }

  const standardMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (standardMatch) {
    const [, , month, day, hour, minute] = standardMatch;
    return `${month}月${day}日 ${hour}:${minute}`;
  }

  const legacyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2}) (\d{2}):(\d{2})$/);
  if (legacyMatch) {
    const [, monthText, dayText, hour, minute] = legacyMatch;
    const month = monthText.padStart(2, "0");
    const day = dayText.padStart(2, "0");
    return `${month}月${day}日 ${hour}:${minute}`;
  }

  return trimmed;
}

function padTimeUnit(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatBoardingRecordTime(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = padTimeUnit(date.getMonth() + 1);
  const day = padTimeUnit(date.getDate());
  const hour = padTimeUnit(date.getHours());
  const minute = padTimeUnit(date.getMinutes());
  return `${year}年${month}月${day}日 ${hour}:${minute}`;
}

export function parseTags(tagsInput: string): string[] {
  const uniqueTags = Array.from(
    new Set(
      tagsInput
        .split(/\r?\n/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
  return uniqueTags;
}

export function getInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function splitRegionValue(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const provinceMatch = trimmed.match(/^(.*?(?:特别行政区|自治区|省|市))/);
  if (!provinceMatch) {
    return [trimmed];
  }

  const province = provinceMatch[1];
  const remainder = trimmed.slice(province.length);
  if (!remainder) {
    return [province];
  }

  const cityMatch = remainder.match(/^(.*?(?:自治州|地区|盟|市))/);
  if (!cityMatch) {
    return [province, remainder];
  }

  const city = cityMatch[1];
  const district = remainder.slice(city.length);
  return district ? [province, city, district] : [province, city];
}

export function regionValueToArray(value: string, level: "district" | "city"): string[] {
  const parts = splitRegionValue(value);
  if (level === "city") {
    return parts.slice(0, 2);
  }
  return parts.slice(0, 3);
}

function trimLocationSuffix(value: string): string {
  return value.replace(/(特别行政区|自治区|自治州|自治县|地区|盟|省|市|区|县|镇|乡|苏木|街道)$/, "");
}

export function formatLivingLocationDisplay(value: string): LocationDisplay {
  const full = value.trim();
  if (!full) {
    return {
      primary: "未填写",
      secondary: "",
      full: "",
      isPlaceholder: true
    };
  }

  const parts = splitRegionValue(full);
  if (parts.length >= 3) {
    return {
      primary: parts[2],
      secondary: parts[1],
      full,
      isPlaceholder: false
    };
  }

  if (parts.length >= 2) {
    return {
      primary: parts[1],
      secondary: parts[0],
      full,
      isPlaceholder: false
    };
  }

  return {
    primary: full,
    secondary: "",
    full,
    isPlaceholder: false
  };
}

export function formatHometownLocationDisplay(value: string): LocationDisplay {
  const full = value.trim();
  if (!full) {
    return {
      primary: "未填写",
      secondary: "",
      full: "",
      isPlaceholder: true
    };
  }

  const parts = splitRegionValue(full);
  if (parts.length >= 2) {
    return {
      primary: parts[1],
      secondary: parts[0],
      full,
      isPlaceholder: false
    };
  }

  return {
    primary: full,
    secondary: "",
    full,
    isPlaceholder: false
  };
}

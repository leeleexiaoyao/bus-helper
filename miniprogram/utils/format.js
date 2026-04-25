"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayTripName = displayTripName;
exports.displayDepartureTime = displayDepartureTime;
exports.parseTags = parseTags;
exports.getInitial = getInitial;
exports.splitRegionValue = splitRegionValue;
exports.regionValueToArray = regionValueToArray;
exports.formatLivingLocationDisplay = formatLivingLocationDisplay;
exports.formatHometownLocationDisplay = formatHometownLocationDisplay;
const constants_1 = require("../shared/constants");
function displayTripName(tripName) {
    return tripName.trim() || constants_1.DEFAULT_TRIP_NAME;
}
function displayDepartureTime(departureTime) {
    const trimmed = departureTime.trim();
    if (!trimmed) {
        return constants_1.DEFAULT_DEPARTURE_TIME;
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
function parseTags(tagsInput) {
    const uniqueTags = Array.from(new Set(tagsInput
        .split(/\r?\n/)
        .map((tag) => tag.trim())
        .filter(Boolean)));
    return uniqueTags;
}
function getInitial(name) {
    return name.trim().slice(0, 1).toUpperCase() || "?";
}
function splitRegionValue(value) {
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
function regionValueToArray(value, level) {
    const parts = splitRegionValue(value);
    if (level === "city") {
        return parts.slice(0, 2);
    }
    return parts.slice(0, 3);
}
function trimLocationSuffix(value) {
    return value.replace(/(特别行政区|自治区|自治州|自治县|地区|盟|省|市|区|县|镇|乡|苏木|街道)$/, "");
}
function formatLivingLocationDisplay(value) {
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
function formatHometownLocationDisplay(value) {
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

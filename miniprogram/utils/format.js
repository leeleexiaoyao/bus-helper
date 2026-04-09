"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayTripName = displayTripName;
exports.displayDepartureTime = displayDepartureTime;
exports.parseTags = parseTags;
exports.getInitial = getInitial;
const constants_1 = require("../shared/constants");
function displayTripName(tripName) {
    return tripName.trim() || constants_1.DEFAULT_TRIP_NAME;
}
function displayDepartureTime(departureTime) {
    return departureTime.trim() || constants_1.DEFAULT_DEPARTURE_TIME;
}
function parseTags(tagsInput) {
    const uniqueTags = Array.from(new Set(tagsInput
        .split(/[，,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)));
    return uniqueTags.slice(0, 3);
}
function getInitial(name) {
    return name.trim().slice(0, 1).toUpperCase() || "?";
}

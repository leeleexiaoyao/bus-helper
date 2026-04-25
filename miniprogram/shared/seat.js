"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTemplateConfig = getTemplateConfig;
exports.generateSeatCodes = generateSeatCodes;
exports.createSeatMap = createSeatMap;
exports.findSeatCodeByUserId = findSeatCodeByUserId;
exports.buildSeatRows = buildSeatRows;
exports.buildSeatOccupantMap = buildSeatOccupantMap;
exports.sortMembers = sortMembers;
const constants_1 = require("./constants");
const LETTERS = ["A", "B", "C", "D", "E"];
function getTemplateConfig(templateId) {
    const template = constants_1.TRIP_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
        throw new Error(`Unknown template: ${templateId}`);
    }
    return template;
}
function generateSeatCodes(templateId) {
    return getTemplateConfig(templateId).rowSeatCounts.flatMap((seatCount, rowIndex) => LETTERS.slice(0, seatCount).map((letter) => `${rowIndex + 1}${letter}`));
}
function createSeatMap(seatCodes) {
    return seatCodes.reduce((accumulator, seatCode) => {
        accumulator[seatCode] = null;
        return accumulator;
    }, {});
}
function findSeatCodeByUserId(seatMap, userId) {
    var _a, _b;
    return ((_b = (_a = Object.entries(seatMap).find(([, occupiedUserId]) => occupiedUserId === userId)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : null);
}
function buildSeatRows(seatCodes, seatMap, viewerId) {
    const grouped = seatCodes.reduce((accumulator, seatCode) => {
        const rowNumber = Number.parseInt(seatCode, 10);
        if (!accumulator[rowNumber]) {
            accumulator[rowNumber] = [];
        }
        accumulator[rowNumber].push(seatCode);
        return accumulator;
    }, {});
    return Object.entries(grouped)
        .map(([rowNumber, rowSeats]) => {
        const slots = [];
        const orderedRowSeats = reorderRowSeats(rowSeats);
        const seatCount = orderedRowSeats.length;
        orderedRowSeats.forEach((seatCode, index) => {
            if (seatCount === 4 && index === 2) {
                slots.push(null);
            }
            const occupant = seatMap[seatCode];
            const isMine = (occupant === null || occupant === void 0 ? void 0 : occupant.userId) === viewerId;
            const isAdmin = (occupant === null || occupant === void 0 ? void 0 : occupant.role) === "admin";
            slots.push({
                code: seatCode,
                label: seatCode,
                isEmpty: occupant === null,
                isMine,
                isAdmin: Boolean(isAdmin),
                className: [
                    occupant === null ? "is-empty" : "is-occupied",
                    isMine ? "is-mine" : "",
                    isAdmin ? "is-admin" : ""
                ]
                    .filter(Boolean)
                    .join(" "),
                showMineBadge: isMine,
                showAdminBadge: Boolean(isAdmin),
                occupant
            });
        });
        return {
            rowNumber: Number(rowNumber),
            slots
        };
    })
        .sort((left, right) => left.rowNumber - right.rowNumber);
}
function buildSeatOccupantMap(seatMap, members) {
    const memberMap = members.reduce((accumulator, member) => {
        accumulator[member.userId] = member;
        return accumulator;
    }, {});
    return Object.entries(seatMap).reduce((accumulator, [seatCode, userId]) => {
        if (!userId) {
            accumulator[seatCode] = null;
            return accumulator;
        }
        const member = memberMap[userId];
        accumulator[seatCode] = member
            ? {
                userId: member.userId,
                nickname: member.nickname,
                avatarUrl: member.avatarUrl,
                initial: member.initial,
                role: member.role,
                isSelf: member.isSelf
            }
            : null;
        return accumulator;
    }, {});
}
function sortMembers(left, right) {
    const leftRoleScore = roleScore(left.role);
    const rightRoleScore = roleScore(right.role);
    if (leftRoleScore !== rightRoleScore) {
        return rightRoleScore - leftRoleScore;
    }
    if (Boolean(left.seatCode) !== Boolean(right.seatCode)) {
        return Number(Boolean(right.seatCode)) - Number(Boolean(left.seatCode));
    }
    return left.nickname.localeCompare(right.nickname, "zh-Hans-CN");
}
function roleScore(role) {
    return role === "admin" ? 2 : 1;
}
function reorderRowSeats(rowSeats) {
    if (rowSeats.length !== 5) {
        return rowSeats;
    }
    const findSeat = (letter) => rowSeats.find((seatCode) => seatCode.endsWith(letter));
    const orderedSeats = ["A", "B", "E", "C", "D"]
        .map((letter) => findSeat(letter))
        .filter((seatCode) => Boolean(seatCode));
    return orderedSeats.length === rowSeats.length ? orderedSeats : rowSeats;
}

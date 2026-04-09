"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createId = createId;
function createId(prefix) {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${timestamp}-${randomPart}`;
}

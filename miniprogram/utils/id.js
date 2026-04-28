"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createId = createId;
function createId(prefix = "id") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessError = void 0;
class BusinessError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "BusinessError";
        this.code = code;
    }
}
exports.BusinessError = BusinessError;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessError = void 0;
class BusinessError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "BusinessError";
    }
}
exports.BusinessError = BusinessError;

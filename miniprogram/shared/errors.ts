export class BusinessError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BusinessError";
    this.code = code;
  }
}

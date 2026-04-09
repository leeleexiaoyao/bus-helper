import { BusinessError } from "../shared/errors";

export function getErrorMessage(error: unknown, fallback = "操作失败，请稍后再试。"): string {
  if (error instanceof BusinessError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

export function showErrorToast(error: unknown, fallback?: string): void {
  wx.showToast({
    title: getErrorMessage(error, fallback),
    icon: "none"
  });
}

export function showSuccessToast(title: string): void {
  wx.showToast({
    title,
    icon: "success"
  });
}

function resolveErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return "操作失败，请稍后重试";
}

export function showErrorToast(error: unknown): void {
  wx.showToast({
    title: resolveErrorMessage(error),
    icon: "none"
  });
}

export function showSuccessToast(title: string): void {
  wx.showToast({
    title,
    icon: "success"
  });
}

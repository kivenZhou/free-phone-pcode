const DAY_MS = 24 * 60 * 60 * 1000;

/** Format SMS received time: relative within 24h, date otherwise. */
export function formatMessageTime(timestamp: number, now = Date.now()): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "";

  const diff = Math.max(0, now - timestamp);

  if (diff >= DAY_MS) {
    return new Date(timestamp).toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) {
    if (seconds <= 0) return "刚刚";
    return `${seconds}秒前`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;

  const hours = Math.floor(minutes / 60);
  return `${hours}小时前`;
}

export function isWithinDay(timestamp: number, now = Date.now()): boolean {
  return Number.isFinite(timestamp) && now - timestamp < DAY_MS;
}

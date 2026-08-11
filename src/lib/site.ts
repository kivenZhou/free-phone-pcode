export const REPO_URL = "https://github.com/kivenZhou/free-phone-pcode";
export const LIVE_SITE_URL = "https://phone.fastx.ink/";

export function isStaticExport(): boolean {
  return process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";
}

export function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

export function staticAssetUrl(path: string): string {
  const prefix = basePath().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${normalized}`;
}

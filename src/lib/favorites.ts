export interface FavoriteNumber {
  id: string;
  e164: string;
  countryName: string;
  flag?: string;
  dialCode?: string;
  nationalNumber?: string;
  providerId: string;
  countryIso?: string;
  savedAt: number;
}

const STORAGE_KEY = "free-pcode-favorites";

export function getFavorites(): FavoriteNumber[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteNumber[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(items: FavoriteNumber[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function isFavorite(id: string): boolean {
  return getFavorites().some((f) => f.id === id);
}

export function addFavorite(item: FavoriteNumber) {
  const items = getFavorites().filter((f) => f.id !== item.id);
  items.unshift({ ...item, savedAt: Date.now() });
  saveFavorites(items);
}

export function removeFavorite(id: string) {
  saveFavorites(getFavorites().filter((f) => f.id !== id));
}

export function toggleFavorite(item: FavoriteNumber): boolean {
  if (isFavorite(item.id)) {
    removeFavorite(item.id);
    return false;
  }
  addFavorite(item);
  return true;
}

export const FAVORITES_CHANGED = "free-pcode-favorites-changed";

export function notifyFavoritesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FAVORITES_CHANGED));
  }
}

export function buildNumberDetailHref(
  id: string,
  ctx?: { country?: string; q?: string; from?: string },
): string {
  const p = new URLSearchParams();
  if (ctx?.from === "favorites") {
    p.set("from", "favorites");
  } else if (ctx?.country) {
    p.set("country", ctx.country);
  } else if (ctx?.q?.trim()) {
    p.set("from", "search");
    p.set("q", ctx.q.trim());
  }
  const qs = p.toString();
  return qs ? `/number/${id}?${qs}` : `/number/${id}`;
}

export function favoriteFromNumberRow(n: {
  id: string;
  e164: string;
  country?: string;
  countryNameZh?: string;
  flag?: string;
  dialCode?: string;
  nationalNumber?: string;
  providerId: string;
  countryIso?: string;
}): FavoriteNumber {
  return {
    id: n.id,
    e164: n.e164,
    countryName: n.countryNameZh || n.country || "未知地区",
    flag: n.flag,
    dialCode: n.dialCode,
    nationalNumber: n.nationalNumber,
    providerId: n.providerId,
    countryIso: n.countryIso,
    savedAt: Date.now(),
  };
}

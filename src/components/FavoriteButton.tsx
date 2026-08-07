"use client";

import { useFavorites } from "@/hooks/useFavorites";
import {
  favoriteFromNumberRow,
  notifyFavoritesChanged,
  toggleFavorite,
  type FavoriteNumber,
} from "@/lib/favorites";

export function FavoriteButton({
  item,
  size = "md",
}: {
  item: FavoriteNumber;
  size?: "sm" | "md";
}) {
  const { isFavorite } = useFavorites();
  const active = isFavorite(item.id);

  function onToggle() {
    toggleFavorite(item);
    notifyFavoritesChanged();
  }

  const cls =
    size === "sm"
      ? "h-9 w-9 text-lg"
      : "h-10 w-10 text-xl";

  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? "取消收藏" : "收藏此号码"}
      aria-label={active ? "取消收藏" : "收藏此号码"}
      aria-pressed={active}
      className={`inline-flex cursor-pointer items-center justify-center rounded-xl border transition ${cls} ${
        active
          ? "border-amber-300 bg-amber-50 text-amber-500 hover:bg-amber-100"
          : "border-[var(--line)] bg-white/80 text-[var(--muted)] hover:border-amber-300 hover:text-amber-500"
      }`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}

export function FavoriteButtonFromRow({
  number,
  size = "md",
}: {
  number: Parameters<typeof favoriteFromNumberRow>[0];
  size?: "sm" | "md";
}) {
  return <FavoriteButton item={favoriteFromNumberRow(number)} size={size} />;
}

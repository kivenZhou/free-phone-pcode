"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FAVORITES_CHANGED,
  getFavorites,
  notifyFavoritesChanged,
  toggleFavorite,
  type FavoriteNumber,
} from "@/lib/favorites";

export function useFavorites() {
  // 服务端与首屏客户端必须一致，localStorage 仅在 mount 后读取
  const [favorites, setFavorites] = useState<FavoriteNumber[]>([]);

  const refresh = useCallback(() => {
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(FAVORITES_CHANGED, onChange);
    return () => window.removeEventListener(FAVORITES_CHANGED, onChange);
  }, [refresh]);

  const toggle = useCallback((item: FavoriteNumber) => {
    toggleFavorite(item);
    notifyFavoritesChanged();
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites],
  );

  return { favorites, toggle, isFavorite, refresh };
}

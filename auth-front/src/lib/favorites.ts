export interface FavoriteEntry {
  id: string;
  type: "barcode" | "photo";
  productName: string;
  ingredients: string;
  date: string;
}

const STORAGE_KEY = "auraskin_favorites";

export function saveFavorite(entry: Omit<FavoriteEntry, "id" | "date">): void {
  const favs = getFavorites();
  const newEntry: FavoriteEntry = {
    ...entry,
    id: Date.now().toString(),
    date: new Date().toISOString(),
  };
  favs.unshift(newEntry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

export function getFavorites(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isFavorite(productName: string): boolean {
  return getFavorites().some((f) => f.productName === productName);
}

export function removeFavorite(id: string): void {
  const favs = getFavorites().filter((f) => f.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}
// src/lib/history.ts

const API = "http://localhost:8083";

export interface HistoryEntry {
  id: string;
  type: "barcode" | "photo";
  productName: string;
  ingredients: string;
  date: string;
}

// Récupère l'ID de l'utilisateur connecté depuis localStorage
function getUserId(): string | null {
  try {
    const raw = localStorage.getItem("app_state");
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state?.state?.user?.id ?? null;
  } catch (error) {
    return null;
  }
}

// 1. Sauvegarde un scan
export async function saveToHistory(
  entry: Omit<HistoryEntry, "id" | "date">
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await fetch(`${API}/api/v1/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        type: entry.type,
        product_name: entry.productName,
        ingredients: entry.ingredients,
      }),
    });
  } catch (error) {
    console.error("Erreur sauvegarde historique:", error);
  }
}

// 2. Récupère l'historique
export async function getHistory(): Promise<HistoryEntry[]> {
  const userId = getUserId();
  if (!userId) return [];
  
  try {
    const res = await fetch(`${API}/api/v1/history?userId=${userId}`);
    if (!res.ok) return [];
    const data = await res.json();
    
    return data.map((row: any) => ({
      id: String(row.id),
      type: row.type,
      productName: row.product_name,
      ingredients: row.ingredients,
      date: row.created_at,
    }));
  } catch (error) {
    console.error("Erreur récupération historique:", error);
    return [];
  }
}

// 3. Supprime une entrée unique
export async function deleteEntry(id: string): Promise<void> {
  try {
    await fetch(`${API}/api/v1/history/${id}`, { method: "DELETE" });
  } catch (error) {
    console.error("Erreur suppression:", error);
  }
}

// 4. Efface tout l'historique (Celle qui manquait !)
export async function clearHistory(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await fetch(`${API}/api/v1/history`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
  } catch (error) {
    console.error("Erreur suppression totale:", error);
  }
}
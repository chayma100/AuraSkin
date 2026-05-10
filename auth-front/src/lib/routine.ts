// ============================================================
// src/lib/routine.ts
// ============================================================

const API = "http://localhost:8083";

// ── TYPES ──

export type Step = {
  id: number;
  name: string;
  done: boolean;
  texture?: string;
  waitTime?: number;
  position?: number;
  note?: string;
};

export type ShelfProduct = {
  id: number;
  brand: string;
  product_name: string;
  opened_at?: string;
  expiry_date?: string;
  pao_months?: number;
};

export type SkinLog = {
  id: number;
  status: string;
  date: string;
  routine_completed: boolean;
};

// ── DONNÉES DE RÉFÉRENCE ET CONSEILS ──

export const skinAdvice: Record<string, { tips: string; Recommended: string[]; avoid: string[] }> = {
  dry: {
    tips: "Privilégiez des textures riches et évitez les nettoyants trop moussants.",
    Recommended: ["Acide Hyaluronique", "Glycérine", "Céramides"],
    avoid: ["Alcool dénaturé", "Parfum fort", "Argile kaolin"]
  },
  irritated: {
    tips: "Restez sur une routine minimaliste. Évitez les actifs puissants aujourd'hui.",
    Recommended: ["Centella Asiatica (Cica)", "Panthénol", "Aloe Vera"],
    avoid: ["Rétinol", "Acide Glycolique", "Gommages à grains"]
  },
  radiant: {
    tips: "Votre peau est au top ! Maintenez cet éclat avec des antioxydants.",
    Recommended: ["Vitamine C", "Niacinamide", "Vitamine E"],
    avoid: ["Négliger le SPF", "Sur-nettoyage"]
  },
  oily: {
    tips: "Utilisez un nettoyant purifiant et des textures gel légères.",
    Recommended: ["Acide Salicylique (BHA)", "Zinc", "Argile"],
    avoid: ["Huile de Coco", "Beurre de Karité", "Textures trop grasses"]
  }
};

export const skinOptions = [
  { label: "Sèche",    emoji: "🌵", value: "dry" },
  { label: "Irritée",  emoji: "🔴", value: "irritated" },
  { label: "Radieuse", emoji: "✨", value: "radiant" },
  { label: "Grasse",   emoji: "💧", value: "oily" },
];

export const morningDefault: Step[] = [
  { id: 1,   name: "Nettoyant",          done: false, texture: "light" },
  { id: 2,   name: "Sérum",              done: false, texture: "light" },
  { id: 3,   name: "Crème hydratante",   done: false, texture: "medium" },
  { id: 4,   name: "Protection solaire", done: false, texture: "heavy" },
];

export const nightDefault: Step[] = [
  { id: 101, name: "Démaquillant", done: false, texture: "light" },
  { id: 102, name: "Nettoyant",    done: false, texture: "light" },
  { id: 103, name: "Traitement",   done: false, texture: "medium" },
  { id: 104, name: "Crème nuit",   done: false, texture: "heavy" },
];

// ── GESTION DE L'IDENTITÉ ──

export function getUserId(): string | null {
  try {
    const raw = localStorage.getItem("app_state");
    if (!raw) return null;
    return JSON.parse(raw)?.state?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ── HELPERS ──

export const toggleStep = (steps: Step[], id: number): Step[] =>
  steps.map((step) => (step.id === id ? { ...step, done: !step.done } : step));

export const getProgress = (steps: Step[]): string => {
  if (!steps || steps.length === 0) return "0/0";
  const done = steps.filter((s) => s.done).length;
  return `${done}/${steps.length}`;
};

export const checkProductStatus = (product: ShelfProduct) => {
  if (!product.opened_at || !product.pao_months) return "ok";
  const openDate = new Date(product.opened_at);
  const expiryDate = new Date(openDate);
  expiryDate.setMonth(expiryDate.getMonth() + product.pao_months);
  const today = new Date();
  if (today > expiryDate) return "expired";
  if (today > new Date(expiryDate.getTime() - 30 * 24 * 60 * 60 * 1000)) return "warning";
  return "ok";
};

// ── LOCALSTORAGE (Persistance Invités) ──

export const saveSteps = (key: string, steps: Step[]) => {
  localStorage.setItem(key, JSON.stringify(steps));
};

export const loadSteps = (key: string, defaultSteps: Step[]): Step[] => {
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored) as Step[]; }
    catch { return defaultSteps; }
  }
  return defaultSteps;
};

// ── STREAK COUNTER (localStorage pour tous) ──

export function getStreak(): number {
  try {
    const raw = localStorage.getItem("routine_streak");
    if (!raw) return 0;
    const { streak, lastDate } = JSON.parse(raw);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastDate === today) return streak;
    if (lastDate === yesterday) return streak;
    return 0; // streak cassé
  } catch { return 0; }
}

export function updateStreak(): number {
  try {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const raw = localStorage.getItem("routine_streak");
    let streak = 1;
    if (raw) {
      const { streak: s, lastDate } = JSON.parse(raw);
      if (lastDate === today) return s; // déjà mis à jour aujourd'hui
      if (lastDate === yesterday) streak = s + 1; // continuation
      else streak = 1; // nouvelle série
    }
    localStorage.setItem("routine_streak", JSON.stringify({ streak, lastDate: today }));
    return streak;
  } catch { return 1; }
}

// ── API : ROUTINE ──

export async function loadStepsFromAPI(type: "morning" | "night"): Promise<Step[]> {
  const userId = getUserId();
  if (!userId) return [];
  try {
    const res = await fetch(`${API}/api/v1/routine?userId=${userId}&type=${type}`);
    const data = await res.json();
    return data.map((row: any) => ({
      id: row.id, name: row.name, done: row.done,
      texture: row.texture || "medium", waitTime: row.wait_time || undefined,
    }));
  } catch { return []; }
}

export async function addStepToAPI(step: Omit<Step, "id">, type: "morning" | "night"): Promise<Step | null> {
  const userId = getUserId();
  if (!userId) return null;
  try {
    const res = await fetch(`${API}/api/v1/routine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name: step.name, texture: step.texture || "medium", waitTime: step.waitTime, type }),
    });
    const row = await res.json();
    return { id: row.id, name: row.name, done: row.done, texture: row.texture, waitTime: row.wait_time };
  } catch { return null; }
}

export async function deleteStepFromAPI(id: number): Promise<void> {
  try {
    await fetch(`${API}/api/v1/routine/${id}`, { method: "DELETE" });
  } catch { console.error("Erreur suppression étape"); }
}

export async function toggleStepInAPI(id: number, done: boolean): Promise<void> {
  try {
    await fetch(`${API}/api/v1/routine/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
  } catch { console.error("Erreur toggle étape"); }
}

// ── API : SKIN LOG (Mood Tracker) ──

export async function saveSkinLog(status: string, routineCompleted: boolean): Promise<boolean> {
  const userId = getUserId();
  if (!userId) return false;
  try {
    const res = await fetch(`${API}/api/v1/skin-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status, routineCompleted }),
    });
    return res.ok;
  } catch { return false; }
}

export async function getSkinLogs(): Promise<SkinLog[]> {
  const userId = getUserId();
  if (!userId) return [];
  try {
    const res = await fetch(`${API}/api/v1/skin-log?userId=${userId}`);
    return await res.json();
  } catch { return []; }
}

// ── API : SHELF ──

export async function loadShelfFromAPI(): Promise<ShelfProduct[]> {
  const userId = getUserId();
  if (!userId) return [];
  try {
    const res = await fetch(`${API}/api/v1/shelf?userId=${userId}`);
    return await res.json();
  } catch {
    return [];
  }
}

export async function addToShelfAPI(product: Omit<ShelfProduct, "id">): Promise<ShelfProduct | null> {
  const userId = getUserId();
  if (!userId) return null;
  try {
    const res = await fetch(`${API}/api/v1/shelf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, userId }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

// Alias pour compatibilité
export const saveSkinStatus = (status: string) => saveSkinLog(status, false);

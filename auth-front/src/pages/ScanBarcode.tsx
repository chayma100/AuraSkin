import { useEffect, useRef, useState } from "react";
import * as Quagga from "@ericblade/quagga2";
import "./CosmoScan.css";
import { saveToHistory } from "../lib/history";
import { saveFavorite, isFavorite, removeFavorite, getFavorites } from "../lib/favorites";
import produitsRaw from "../data/products.csv?raw";

// ── URL du backend FastAPI direct (port 8083) ────────────────────────────
const API_URL = "http://localhost:8083";

// ── Types ─────────────────────────────────────────────────────────────────
interface Product {
  name: string;
  ingredients: string;
  imageUrl?: string;
  barcode?: string;
}

interface IngredientResult {
  name:        string;
  danger:      "LOW" | "MODERATE" | "HIGH";
  score:       number;
  source:      string;
  description: string[];
}

interface AnalysisResult {
  score:            number;
  explanation:      string;
  highRiskList:     IngredientResult[];
  moderateRiskList: IngredientResult[];
  safeRiskList:     IngredientResult[];
  totalAnalyzed:    number;
}

type Screen = "home" | "scanning" | "result";

// ── Helpers ───────────────────────────────────────────────────────────────
const criteriaColor = (val: string) => {
  if (val === "HIGH")     return { color: "#ef4444", fontWeight: "700" };
  if (val === "MODERATE") return { color: "#f59e0b", fontWeight: "700" };
  return { color: "#94a3b8", fontWeight: "400" };
};

const getIngredientRole = (ing: string) => {
  const lower = ing.toLowerCase();
  if (lower.includes("phenoxyethanol") || lower.includes("paraben") || lower.includes("methylisothiazolinone")) return "Preservative";
  if (lower.includes("bht") || lower.includes("bha"))                         return "Antioxidant";
  if (lower.includes("parfum") || lower.includes("fragrance"))                return "Fragrance Agent";
  if (lower.includes("titanium dioxide") || lower.includes("octocrylene"))    return "UV Filter";
  if (lower.includes("aqua") || lower.includes("water"))                      return "Solvent";
  if (lower.includes("glycerin") || lower.includes("hyaluronic acid"))        return "Humectant";
  if (lower.includes("peg") || lower.includes("ceteareth") || lower.includes("steareth")) return "Emulsifier";
  if (lower.includes("dimethicone") || lower.includes("silicone"))            return "Emollient";
  if (lower.includes("sulfate") || lower.includes("sls") || lower.includes("sles")) return "Surfactant";
  return "Cosmetic Ingredient";
};

// ── Carte ingrédient ──────────────────────────────────────────────────────
const IngredientCard = ({ item, accentColor }: { item: IngredientResult; accentColor: string }) => {
  const criteria = [
    { label: "Cancer",            icon: "🔬", val: "LOW" },
    { label: "Allergies",         icon: "🤧", val: "LOW" },
    { label: "Tox. Reproduction", icon: "🧪", val: "LOW" },
    { label: "Restrictions",      icon: "⚠️",  val: "LOW" },
  ];

  if (Array.isArray(item.description)) {
    item.description.forEach((d: string) => {
      const idx = d.indexOf(":");
      if (idx === -1) return;
      const label = d.slice(0, idx).trim();
      const val   = d.slice(idx + 1).trim();
      const found = criteria.find((c) => c.label === label);
      if (found) found.val = val;
    });
  }

  const scoreText  = typeof item.score === "number" ? item.score.toFixed(1) : "—";
  const sourceText = item.source === "database" ? "📁 Dataset" : "🤖 NLP Model";
  const role       = getIngredientRole(item.name ?? "");

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", borderLeft: `4px solid ${accentColor}`, padding: "14px 16px", marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
        <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: accentColor, flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: "700", fontSize: "0.88rem", color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {item.name}
        </span>
        <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "700", color: "#fff", backgroundColor: accentColor, whiteSpace: "nowrap" }}>
          {item.danger} — Score : {scoreText}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", color: "#64748b", marginBottom: "10px" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#cbd5e1", flexShrink: 0 }} />
        {role}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
        {criteria.map(({ label, icon, val }) => {
          const s = criteriaColor(val);
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.82rem" }}>
              <span style={{ fontSize: "13px", flexShrink: 0 }}>{icon}</span>
              <span style={{ color: "#475569" }}>{label} :</span>
              <span style={{ color: s.color, fontWeight: s.fontWeight }}>{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Accordéon ─────────────────────────────────────────────────────────────
const RiskSection = ({ title, items, color, defaultOpen = false }: {
  title: string; items: IngredientResult[]; color: string; defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  if (items.length === 0) return null;
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "16px", marginBottom: "12px", overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ display: "flex", padding: "16px", alignItems: "center", cursor: "pointer" }}>
        <span style={{ width: "14px", height: "14px", borderRadius: "50%", backgroundColor: color, marginRight: "16px", flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: "600", fontSize: "1rem", color: "#334155" }}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", color: "#64748b", fontSize: "0.9rem" }}>
          <span style={{ marginRight: "10px" }}>{items.length} ingredient{items.length > 1 ? "s" : ""}</span>
          <span style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }}>▼</span>
        </div>
      </div>
      {isOpen && (
        <div style={{ padding: "4px 12px 12px" }}>
          {items.map((item, i) => <IngredientCard key={i} item={item} accentColor={color} />)}
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════
export default function ScanBarcode() {
  const [screen, setScreen]               = useState<Screen>("home");
  const [status, setStatus]               = useState("");
  const [product, setProduct]             = useState<Product | null>(null);
  const [liked, setLiked]                 = useState(false);
  const [favoriteId, setFavoriteId]       = useState<string | null>(null);
  const [debugInfo, setDebugInfo]         = useState<string>("");
  const [manualBarcode, setManualBarcode] = useState<string>("");
  const [showManual, setShowManual]       = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing]           = useState(false);
  const [analysisError, setAnalysisError]   = useState<string>("");

  const scannerDivRef  = useRef<HTMLDivElement>(null);
  const detectedRef    = useRef(false);
  const detectionVotes = useRef<Map<string, number>>(new Map());

  useEffect(() => { return () => { stopQuagga(); }; }, []);

  function stopQuagga() {
    try { Quagga.offDetected(); Quagga.stop(); } catch {}
    detectedRef.current = false;
    detectionVotes.current.clear();
  }

  function parseCSVLine(line: string): string[] {
    const cols: string[] = [];
    let current = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if (char === "," && !inQuotes) { cols.push(current.trim()); current = ""; }
      else { current += char; }
    }
    cols.push(current.trim()); return cols;
  }

  function normalizeBarcode(code: string): string {
    return code.replace(/"/g, "").replace(/\s/g, "").trim().replace(/^0+/, "");
  }

  function searchInLocalDB(barcode: string): Product | null {
    const lines = produitsRaw.split("\n");
    const scannedNorm = normalizeBarcode(barcode);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim(); if (!line) continue;
      const cols = parseCSVLine(line); if (cols.length < 2) continue;
      if (normalizeBarcode(cols[0]) === scannedNorm) {
        return { barcode: cols[0]?.replace(/"/g, "").trim(), name: cols[1]?.replace(/"/g, "").trim() || "Unknown product", ingredients: cols[2]?.replace(/"/g, "").trim() || "Ingredients not available", imageUrl: cols[3]?.replace(/"/g, "").trim() || undefined };
      }
    }
    return null;
  }

  async function startScanner() {
    setScreen("scanning"); setStatus("Point the camera at the barcode...");
    setDebugInfo(""); setAnalysisResult(null); setAnalysisError("");
    detectedRef.current = false; detectionVotes.current.clear();
    await new Promise((r) => setTimeout(r, 500));
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    Quagga.init({
      inputStream: { name: "Live", type: "LiveStream", target: scannerDivRef.current!, constraints: { ...(isMobile ? { facingMode: "environment" } : {}), width: { min: 320, ideal: 640, max: 1280 }, height: { min: 240, ideal: 480, max: 720 } } },
      locator: { patchSize: "medium", halfSample: false },
      numOfWorkers: 2,
      decoder: { readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_128_reader"], multiple: false },
      frequency: 20, locate: true,
    }, (err) => {
      if (err) { setStatus("❌ Camera error — try manual entry"); setShowManual(true); setScreen("home"); return; }
      Quagga.start(); setStatus("📷 Hold barcode FLAT and close to camera");
    });
    Quagga.onDetected(async (data) => {
      if (detectedRef.current) return;
      const code = data.codeResult.code;
      if (!code || code.length < 8) return;
      const votes = detectionVotes.current;
      const current = votes.get(code) || 0;
      votes.set(code, current + 1);
      setDebugInfo(`Reading: ${code} (${current + 1}/2)`);
      if (current + 1 >= 2) { detectedRef.current = true; stopQuagga(); setStatus(`📦 ${code} — Searching...`); await fetchProduct(code); }
    });
  }

  async function fetchProduct(barcode: string) {
    const local = searchInLocalDB(barcode);
    if (local) {
      setProduct(local); setScreen("result"); setStatus("✅ Product found!"); setDebugInfo("Source: Local CSV");
      await saveToHistory({ type: "barcode", productName: local.name, ingredients: local.ingredients });
      const alreadyLiked = await isFavorite(local.name); setLiked(alreadyLiked);
      if (alreadyLiked) { const favs = await getFavorites(); const fav = favs.find((f) => f.productName === local.name); if (fav) setFavoriteId(fav.id); }
      return;
    }
    setStatus("🌐 Searching online...");
    try {
      const res = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const found: Product = { barcode, name: p.product_name || p.product_name_fr || "Unknown product", ingredients: p.ingredients_text || p.ingredients_text_fr || "Ingredients not available", imageUrl: p.image_url || p.image_front_url || undefined };
        setProduct(found); setScreen("result"); setStatus("✅ Product found online!"); setDebugInfo("Source: Open Beauty Facts");
        await saveToHistory({ type: "barcode", productName: found.name, ingredients: found.ingredients });
        const alreadyLiked = await isFavorite(found.name); setLiked(alreadyLiked);
        if (alreadyLiked) { const favs = await getFavorites(); const fav = favs.find((f) => f.productName === found.name); if (fav) setFavoriteId(fav.id); }
      } else { setStatus("⚠️ Product not found."); setShowManual(true); setScreen("home"); }
    } catch { setStatus("❌ Connection error."); setShowManual(true); setScreen("home"); }
  }

  // ── ANALYSE INGRÉDIENTS ───────────────────────────────────────────────
  async function analyzeIngredients() {
    if (!product?.ingredients) return;
    setAnalyzing(true); setAnalysisError(""); setAnalysisResult(null);
    try {
      const ingredientsArray = product.ingredients.split(",").map((i) => i.trim()).filter((i) => i.length > 1);
      if (ingredientsArray.length === 0) { setAnalysisError("No ingredients to analyze."); return; }
      const response = await fetch(`${API_URL}/analyze/ingredients`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingredientsArray }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      const high: IngredientResult[] = []; const mod: IngredientResult[] = []; const safe: IngredientResult[] = [];
      data.ingredients.forEach((ing: any) => {
        const formatted: IngredientResult = { name: ing.name, danger: ing.danger, score: ing.score, source: ing.source, description: ing.description ?? [] };
        if (ing.danger === "HIGH") high.push(formatted);
        else if (ing.danger === "MODERATE") mod.push(formatted);
        else safe.push(formatted);
      });
      let explanation = "Excellent";
      if (data.danger_produit === "MODERATE") explanation = "Mediocre";
      if (data.danger_produit === "HIGH")     explanation = "Dangerous";
      setAnalysisResult({ score: data.score_global, explanation, highRiskList: high, moderateRiskList: mod, safeRiskList: safe, totalAnalyzed: data.nb_ingredients });
    } catch { setAnalysisError("❌ Could not connect to the analysis server. Make sure the backend is running."); }
    finally { setAnalyzing(false); }
  }

  // ── ANALYSE VIA NER (texte brut → NER SciBERT → fuzzy → scoring) ────
  async function analyzeWithNER() {
    if (!product?.ingredients || product.ingredients === "Ingredients not available") return;
    setAnalyzing(true); setAnalysisError(""); setAnalysisResult(null);
    try {
      const response = await fetch(`${API_URL}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: product.ingredients }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      const high: IngredientResult[] = [];
      const mod:  IngredientResult[] = [];
      const safe: IngredientResult[] = [];
      data.ingredients.forEach((ing: any) => {
        const formatted: IngredientResult = { name: ing.name, danger: ing.danger, score: ing.score, source: ing.source, description: ing.description ?? [] };
        if (ing.danger === "HIGH")          high.push(formatted);
        else if (ing.danger === "MODERATE") mod.push(formatted);
        else                                safe.push(formatted);
      });
      let explanation = "Excellent";
      if (data.danger_produit === "MODERATE") explanation = "Moderate Risk";
      if (data.danger_produit === "HIGH")     explanation = "Dangerous";
      setAnalysisResult({ score: data.score_global, explanation, highRiskList: high, moderateRiskList: mod, safeRiskList: safe, totalAnalyzed: data.nb_ingredients });
    } catch {
      setAnalysisError("❌ Could not connect to the analysis server. Make sure the backend is running.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleManualSearch() {
    if (!manualBarcode.trim()) return;
    setShowManual(false); setStatus(`🔍 Searching: ${manualBarcode}...`);
    await fetchProduct(manualBarcode.trim());
  }

  async function handleFavorite() {
    if (!product) return;
    if (liked && favoriteId) { await removeFavorite(favoriteId); setLiked(false); setFavoriteId(null); }
    else {
      await saveFavorite({ type: "barcode", productName: product.name, ingredients: product.ingredients });
      setLiked(true);
      const favs = await getFavorites(); const fav = favs.find((f) => f.productName === product.name); if (fav) setFavoriteId(fav.id);
    }
  }

  function handleReset() {
    stopQuagga(); setProduct(null); setLiked(false); setFavoriteId(null);
    setStatus(""); setDebugInfo(""); setManualBarcode(""); setShowManual(false);
    setAnalysisResult(null); setAnalysisError(""); setAnalyzing(false); setScreen("home");
  }

  const gradientText: React.CSSProperties = {
    textAlign: "center", fontSize: "0.82rem", marginTop: "14px", cursor: "pointer",
    background: "linear-gradient(90deg, #ec4899, #a855f7)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    fontStyle: "italic", opacity: 0.85, userSelect: "none",
  };

  const getScoreColor = (score: number) => {
    if (score <= 3) return "#10b981";   // vert  = bon produit
    if (score <= 6) return "#f59e0b";   // orange = risque modéré
    return "#ef4444";                    // rouge  = dangereux
  };

  return (
    <div className="cosmo-page">
      <div className="cosmo-container">
        <header className="cosmo-header">
          <h1>🔍 Scan Barcode</h1>
          <p>Scan a cosmetic product barcode</p>
        </header>

        {/* HOME */}
        {screen === "home" && (
          <>
            <div className="cosmo-mode-selector">
              <button className="cosmo-mode-btn" onClick={startScanner}>📷 Start Scanner</button>
            </div>
            {status && <div className="cosmo-status">{status}</div>}
            {showManual && (
              <div style={{ marginTop: "20px", background: "rgba(255,255,255,0.6)", borderRadius: "16px", padding: "16px", border: "1px solid rgba(168,85,247,0.2)" }}>
                <p style={{ fontSize: "0.82rem", color: "#7e3fa8", fontWeight: 700, marginBottom: "10px" }}>Enter barcode manually:</p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="text" value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && handleManualSearch()} placeholder="e.g. 3600551154961" inputMode="numeric"
                    style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid rgba(168,85,247,0.3)", background: "rgba(255,255,255,0.8)", fontSize: "0.9rem", color: "#1a1a1a", outline: "none", fontFamily: "monospace" }} />
                  <button onClick={handleManualSearch} style={{ background: "linear-gradient(90deg, #ec4899, #a855f7)", border: "none", borderRadius: "10px", padding: "10px 18px", color: "white", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}>Search</button>
                </div>
              </div>
            )}
            {debugInfo && <p style={{ fontSize: "0.7rem", color: "#9c6db0", textAlign: "center", marginTop: "8px", fontFamily: "monospace", opacity: 0.7 }}>{debugInfo}</p>}
          </>
        )}

        {/* SCANNING */}
        {screen === "scanning" && (
          <>
            <div ref={scannerDivRef} style={{ width: "100%", borderRadius: "20px", overflow: "hidden", border: "2px solid rgba(236,72,153,0.4)", boxShadow: "0 8px 30px rgba(168,85,247,0.2)", position: "relative", background: "transparent", aspectRatio: "4/3" }} />
            <div style={{ textAlign: "center", marginTop: "8px", fontSize: "0.78rem", color: "#9c6db0" }}>Hold the barcode flat and well-lit inside the frame</div>
            <div className="cosmo-status">{status}</div>
            {debugInfo && <p style={{ fontSize: "0.7rem", color: "#a855f7", textAlign: "center", fontFamily: "monospace", marginTop: "4px" }}>{debugInfo}</p>}
            <p onClick={handleReset} style={gradientText}>✦ Cancel</p>
          </>
        )}

        {/* RESULT */}
        {screen === "result" && product && (
          <>
            <div className="cosmo-status">{status}</div>

            {/* Carte produit */}
            <div style={{ background: "rgba(255,255,255,0.55)", borderRadius: "18px", padding: "20px", marginTop: "12px", border: "1px solid rgba(168,85,247,0.2)", backdropFilter: "blur(10px)" }}>
              {product.imageUrl && (
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <img src={product.imageUrl} alt={product.name} style={{ maxHeight: "160px", objectFit: "contain", borderRadius: "12px" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{ background: "linear-gradient(90deg, #ec4899, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 800, fontSize: "1.2rem", margin: 0, flex: 1 }}>{product.name}</h3>
                <button onClick={handleFavorite} style={{ background: "none", border: "none", fontSize: "1.6rem", cursor: "pointer", outline: "none", transform: liked ? "scale(1.2)" : "scale(1)", transition: "transform 0.2s" }}>
                  {liked ? "❤️" : "🤍"}
                </button>
              </div>
              {product.barcode && <p style={{ fontSize: "0.72rem", color: "#9ca3af", fontFamily: "monospace", marginTop: "4px" }}>Barcode: {product.barcode}</p>}
              <p style={{ fontSize: "0.82rem", color: "#7e3fa8", fontWeight: 700, margin: "14px 0 10px" }}>Ingredients:</p>
              <div className="cosmo-ingredients-display">
                {product.ingredients && product.ingredients !== "Ingredients not available"
                  ? product.ingredients.split(",").map((ing) => ing.trim()).filter(Boolean).map((ing, i) => <span className="cosmo-ing-badge" key={i}>{ing}</span>)
                  : <p style={{ color: "#9ca3af", fontStyle: "italic", fontSize: "0.82rem" }}>No ingredients available</p>}
              </div>
              {debugInfo && <p style={{ fontSize: "0.68rem", color: "#c4b5d4", marginTop: "12px", fontFamily: "monospace", textAlign: "right" }}>{debugInfo}</p>}
            </div>

         {/* BOUTON ANALYSER */}
{!analysisResult && product.ingredients && product.ingredients !== "Ingredients not available" && (
  <button onClick={analyzeWithNER} disabled={analyzing}
    style={{
      marginTop: "16px", width: "100%", padding: "16px", fontSize: "1.05rem", fontWeight: 700,
      background: analyzing ? "#94a3b8" : "linear-gradient(90deg, #ec4899, #a855f7)",
      color: "white", border: "none", borderRadius: "16px",
      cursor: analyzing ? "not-allowed" : "pointer",
      boxShadow: analyzing ? "none" : "0 4px 15px rgba(168,85,247,0.4)",
    }}>
    {analyzing ? "⏳ Analysing..." : "🧪 Product Analysis"}
  </button>
)}

            {/* Erreur */}
            {analysisError && (
              <div style={{ marginTop: "12px", padding: "14px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", fontSize: "0.85rem", color: "#dc2626" }}>
                {analysisError}
              </div>
            )}

            {/* RÉSULTATS ANALYSE */}
            {analysisResult && (
              <div style={{ marginTop: "20px" }}>

                {/* Score global */}
                <div style={{ backgroundColor: "#ffffff", padding: "24px 20px", borderRadius: "20px", boxShadow: "0 8px 20px rgba(0,0,0,0.06)", textAlign: "center", marginBottom: "16px" }}>
                  <div style={{ width: "72px", height: "72px", backgroundColor: "#f8fafc", borderRadius: "14px", margin: "0 auto 12px auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🧴</div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "1.2rem", color: "#1e293b" }}>{product.name}</h2>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: "12px" }}>
                    <span style={{ width: "14px", height: "14px", borderRadius: "50%", backgroundColor: getScoreColor(analysisResult.score), marginRight: "10px" }} />
                    <span style={{ fontSize: "1.4rem", fontWeight: "bold", color: getScoreColor(analysisResult.score) }}>
                      {analysisResult.score} / 10
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.95rem", color: "#64748b", fontWeight: 500 }}>{analysisResult.explanation}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>{analysisResult.totalAnalyzed} ingredients analyzed</p>
                </div>

                {/* Sections risque */}
                <RiskSection title="High Risk"     items={analysisResult.highRiskList}     color="#ef4444" defaultOpen={analysisResult.highRiskList.length > 0} />
                <RiskSection title="Moderate Risk" items={analysisResult.moderateRiskList}  color="#f59e0b" defaultOpen={analysisResult.highRiskList.length === 0 && analysisResult.moderateRiskList.length > 0} />
                <RiskSection title="Safe"          items={analysisResult.safeRiskList}      color="#10b981" defaultOpen={analysisResult.highRiskList.length === 0 && analysisResult.moderateRiskList.length === 0} />

                <button onClick={() => setAnalysisResult(null)}
                  style={{ marginTop: "8px", width: "100%", padding: "12px", backgroundColor: "#f8fafc", color: "#a855f7", border: "1px solid #e2e8f0", borderRadius: "14px", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem" }}>
                  ↩ Hide analysis
                </button>
              </div>
            )}

            <p onClick={handleReset} style={{ ...gradientText, marginTop: "20px" }}>✦ Scan another product</p>
          </>
        )}

      </div>
    </div>
  );
}

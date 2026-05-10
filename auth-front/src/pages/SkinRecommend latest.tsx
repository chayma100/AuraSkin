import React, { useState, useRef } from "react";

const FASTAPI_URL = "http://localhost:8083";

type SkinType = "dry" | "oily" | "normal" | "combination" | "sensitive" | null;
type Step = "photo" | "product_type" | "results";

interface SkinResult {
  skin_type: SkinType;
  confidence: number;
  skin_profile: Record<string, number>;
  recommendation_tip: string;
}

interface Product {
  name: string;
  brand: string;
  price: number;
  rank: number;
  safety_score: number;
  danger_level: "LOW" | "MODERATE" | "HIGH";
  ingredients_preview: string[];
  high_risk_ingredients: string[];
  moderate_risk_ingredients: string[];
}

const PRODUCT_TYPES = [
  { label: "Hydratant",    value: "Moisturizer",  icon: "💧" },
  { label: "Nettoyant",    value: "Cleanser",      icon: "🫧" },
  { label: "Soin",         value: "Treatment",     icon: "✨" },
  { label: "Masque",       value: "Face Mask",     icon: "🌿" },
  { label: "Contour yeux", value: "Eye cream",     icon: "👁️" },
  { label: "Solaire",      value: "Sun protect",   icon: "☀️" },
];

const SKIN_LABELS: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  dry:    { label: "Sèche",   icon: "🏜️", color: "#f59e0b", desc: "Manque d'hydratation, tiraillements fréquents" },
  oily:   { label: "Grasse",  icon: "💦", color: "#3b82f6", desc: "Excès de sébum, pores dilatés, brillance" },
  normal: { label: "Normale", icon: "⚖️", color: "#10b981", desc: "Équilibrée, peu de problèmes cutanés" },
};

const dangerColor = (level: string) => {
  if (level === "HIGH")     return "#ef4444";
  if (level === "MODERATE") return "#f59e0b";
  return "#10b981";
};

const dangerLabel = (level: string) => {
  if (level === "HIGH")     return "⚠️ Risqué";
  if (level === "MODERATE") return "⚡ Modéré";
  return "✅ Sûr";
};

export default function SkinRecommend() {
  const [step, setStep]                       = useState<Step>("photo");
  const [loading, setLoading]                 = useState(false);
  const [status, setStatus]                   = useState("Analysez votre peau pour commencer");
  const [skinResult, setSkinResult]           = useState<SkinResult | null>(null);
  const [manualSkin, setManualSkin]           = useState<SkinType>(null);
  const [useManual, setUseManual]             = useState(false);
  const [photoPreview, setPhotoPreview]       = useState<string>("");
  const fileInputRef                          = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType]       = useState<string>("");
  const [maxPrice, setMaxPrice]               = useState<number>(999);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [expandedCard, setExpandedCard]       = useState<number | null>(null);

  const effectiveSkin: SkinType =
    useManual ? manualSkin : (skinResult?.skin_type ?? null);

  // ── Analyse peau ──────────────────────────────────────────────────────
  const analyzeSkin = async (file: File) => {
    setLoading(true);
    setStatus("🔬 Analyse de votre peau en cours...");
    setPhotoPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${FASTAPI_URL}/analyze/skin`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Erreur serveur : ${res.status}`);
      const data: SkinResult = await res.json();
      setSkinResult(data);
      setStatus(`✅ Peau détectée : ${SKIN_LABELS[data.skin_type!]?.label ?? data.skin_type}`);
      // ✅ FIX : on reste sur "photo" pour montrer le résultat d'abord
      // L'utilisateur clique "Continuer" pour aller à l'étape 2
      setStep("photo");
    } catch (err) {
      console.error(err);
      setStatus("❌ Erreur lors de l'analyse — vérifiez que les serveurs tournent");
    } finally {
      setLoading(false);
    }
  };

  // ── Recommandations ───────────────────────────────────────────────────
  const fetchRecommendations = async () => {
    if (!effectiveSkin || !selectedType) return;
    setLoading(true);
    setStatus("🧠 Recherche des meilleurs produits...");

    try {
      const res = await fetch(`${FASTAPI_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skin_type:    effectiveSkin,
          product_type: selectedType,
          top_n:        3,
          max_price:    maxPrice,
        }),
      });
      if (!res.ok) throw new Error(`Erreur : ${res.status}`);
      const data = await res.json();
      setRecommendations(data.recommendations);
      setStep("results");
      setStatus(`✅ ${data.total_found} produits analysés`);
    } catch (err) {
      console.error(err);
      setStatus("❌ Erreur lors de la recherche de produits");
    } finally {
      setLoading(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep("photo");
    setSkinResult(null);
    setManualSkin(null);
    setUseManual(false);
    setPhotoPreview("");
    setSelectedType("");
    setMaxPrice(999);
    setRecommendations([]);
    setExpandedCard(null);
    setStatus("Analysez votre peau pour commencer");
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      backgroundColor: "#f8fafc",
      minHeight: "100vh",
      paddingBottom: "40px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "0 16px" }}>

        {/* HEADER */}
        <header style={{ textAlign: "center", paddingTop: "24px", paddingBottom: "8px" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: "800", color: "#1e293b", margin: 0 }}>
            🌿 SkinMatch
          </h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "0.95rem" }}>
            Analyse ta peau · Trouve tes produits sûrs
          </p>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "20px" }}>
            {(["photo", "product_type", "results"] as Step[]).map((s, i) => {
              const labels   = ["Analyse", "Produit", "Résultats"];
              const isActive = step === s;
              const isDone   = (["photo", "product_type", "results"] as Step[]).indexOf(step) > i;
              return (
                <React.Fragment key={s}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      backgroundColor: isDone ? "#10b981" : isActive ? "#3b82f6" : "#e2e8f0",
                      color: isDone || isActive ? "#fff" : "#94a3b8",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: "700", fontSize: "0.85rem", transition: "all 0.3s",
                    }}>
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span style={{ fontSize: "0.7rem", color: isActive ? "#3b82f6" : "#94a3b8", fontWeight: isActive ? "700" : "400" }}>
                      {labels[i]}
                    </span>
                  </div>
                  {i < 2 && (
                    <div style={{
                      height: "2px", width: "40px", marginBottom: "16px",
                      backgroundColor: isDone ? "#10b981" : "#e2e8f0",
                      transition: "all 0.3s",
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div style={{
            marginTop: "12px", padding: "8px 16px",
            backgroundColor: "#f1f5f9", borderRadius: "20px",
            fontSize: "0.85rem", color: "#475569",
          }}>
            {status}
          </div>
        </header>

        {/* ═══ ÉTAPE 1 — ANALYSE PEAU ═══════════════════════════════════ */}
        {step === "photo" && (
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Upload photo */}
            <div style={{
              backgroundColor: "#fff", borderRadius: "20px",
              padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              textAlign: "center",
            }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 8px 0" }}>
                📸 Photo de votre visage
              </h2>
              <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 20px 0" }}>
                Le modèle IA détecte automatiquement votre type de peau
              </p>

              {photoPreview ? (
                <div>
                  <img src={photoPreview} alt="Visage" style={{
                    width: "160px", height: "160px", borderRadius: "50%",
                    objectFit: "cover", border: "4px solid #3b82f6", marginBottom: "12px",
                  }} />
                  <div>
                    <button onClick={() => { setPhotoPreview(""); setSkinResult(null); setStatus("Analysez votre peau pour commencer"); }}
                      style={{
                        background: "none", border: "1px solid #e2e8f0", borderRadius: "8px",
                        padding: "6px 14px", fontSize: "0.85rem", color: "#64748b", cursor: "pointer",
                      }}>
                      Changer la photo
                    </button>
                  </div>
                </div>
              ) : (
                <label style={{
                  display: "inline-block", padding: "14px 28px",
                  backgroundColor: "#3b82f6", color: "#fff", borderRadius: "14px",
                  fontSize: "1rem", fontWeight: "600", cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
                }}>
                  {loading ? "⏳ Analyse..." : "📷 Prendre une photo"}
                  <input ref={fileInputRef} type="file" accept="image/*" capture="user"
                    style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) analyzeSkin(f); }}
                  />
                </label>
              )}
            </div>

            {/* ✅ Résultat analyse — visible AVANT de passer à l'étape 2 */}
            {skinResult && !useManual && (
              <div style={{
                backgroundColor: "#fff", borderRadius: "20px",
                padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 16px 0" }}>
                  Résultat de l'analyse
                </h3>

                {skinResult.skin_type && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    backgroundColor: "#f0fdf4", borderRadius: "14px",
                    padding: "14px 16px", marginBottom: "14px",
                    border: `2px solid ${SKIN_LABELS[skinResult.skin_type]?.color ?? "#e2e8f0"}30`,
                  }}>
                    <span style={{ fontSize: "2rem" }}>{SKIN_LABELS[skinResult.skin_type]?.icon ?? "🔬"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "700", fontSize: "1.1rem", color: "#1e293b" }}>
                        Peau {SKIN_LABELS[skinResult.skin_type]?.label ?? skinResult.skin_type}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>
                        {SKIN_LABELS[skinResult.skin_type]?.desc}
                      </div>
                    </div>
                    <div style={{
                      backgroundColor: SKIN_LABELS[skinResult.skin_type]?.color ?? "#64748b",
                      color: "#fff", borderRadius: "10px", padding: "4px 10px",
                      fontSize: "0.8rem", fontWeight: "700",
                    }}>
                      {(skinResult.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                )}

                {/* Profil complet */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {Object.entries(skinResult.skin_profile)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cls, prob]) => (
                    <div key={cls} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "70px", fontSize: "0.82rem", color: "#475569" }}>
                        {SKIN_LABELS[cls]?.label ?? cls}
                      </span>
                      <div style={{ flex: 1, height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{
                          width: `${prob * 100}%`, height: "100%",
                          backgroundColor: cls === skinResult.skin_type ? "#3b82f6" : "#cbd5e1",
                          borderRadius: "4px", transition: "width 0.6s ease",
                        }} />
                      </div>
                      <span style={{ width: "38px", fontSize: "0.82rem", color: "#64748b", textAlign: "right" }}>
                        {(prob * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop: "14px", padding: "10px 14px",
                  backgroundColor: "#eff6ff", borderRadius: "10px",
                  fontSize: "0.83rem", color: "#1e40af", lineHeight: "1.5",
                }}>
                  💡 {skinResult.recommendation_tip}
                </div>

                {/* ✅ Bouton "Continuer" — seul moyen de passer à l'étape 2 */}
                <button onClick={() => setStep("product_type")} style={{
                  marginTop: "16px", width: "100%", padding: "14px",
                  backgroundColor: "#3b82f6", color: "#fff", border: "none",
                  borderRadius: "14px", fontSize: "1rem", fontWeight: "700",
                  cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
                }}>
                  Continuer → Choisir un produit
                </button>
              </div>
            )}

            {/* Séparateur */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }} />
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>ou</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }} />
            </div>

            {/* Sélection manuelle */}
            <div style={{
              backgroundColor: "#fff", borderRadius: "20px",
              padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}>
              <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 4px 0" }}>
                Je connais mon type de peau
              </h3>
              <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0 0 14px 0" }}>
                Sélectionne directement sans photo
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {Object.entries(SKIN_LABELS).map(([key, val]) => (
                  <button key={key}
                    onClick={() => { setManualSkin(key as SkinType); setUseManual(true); setStep("product_type"); }}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "12px 14px", borderRadius: "12px",
                      border: `2px solid ${manualSkin === key ? val.color : "#e2e8f0"}`,
                      backgroundColor: manualSkin === key ? `${val.color}15` : "#fff",
                      cursor: "pointer", fontSize: "0.88rem", fontWeight: "600",
                      color: "#334155", transition: "all 0.2s",
                    }}>
                    <span style={{ fontSize: "1.2rem" }}>{val.icon}</span>
                    <span>{val.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ÉTAPE 2 — CHOIX DU PRODUIT ═══════════════════════════════ */}
        {step === "product_type" && effectiveSkin && (
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

            <div style={{
              backgroundColor: "#fff", borderRadius: "20px",
              padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              display: "flex", alignItems: "center", gap: "12px",
            }}>
              <span style={{ fontSize: "1.8rem" }}>{SKIN_LABELS[effectiveSkin]?.icon}</span>
              <div>
                <div style={{ fontWeight: "700", color: "#1e293b" }}>
                  Peau {SKIN_LABELS[effectiveSkin]?.label}
                </div>
                <button onClick={() => { setStep("photo"); setUseManual(false); }}
                  style={{ background: "none", border: "none", color: "#3b82f6",
                    fontSize: "0.8rem", cursor: "pointer", padding: 0 }}>
                  Modifier
                </button>
              </div>
            </div>

            <div style={{
              backgroundColor: "#fff", borderRadius: "20px",
              padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 16px 0" }}>
                Quel type de produit ?
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {PRODUCT_TYPES.map((pt) => (
                  <button key={pt.value}
                    onClick={() => setSelectedType(pt.value)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      gap: "6px", padding: "16px 10px", borderRadius: "14px",
                      border: `2px solid ${selectedType === pt.value ? "#3b82f6" : "#e2e8f0"}`,
                      backgroundColor: selectedType === pt.value ? "#eff6ff" : "#fff",
                      cursor: "pointer", transition: "all 0.2s",
                    }}>
                    <span style={{ fontSize: "1.6rem" }}>{pt.icon}</span>
                    <span style={{
                      fontSize: "0.82rem", fontWeight: "600",
                      color: selectedType === pt.value ? "#2563eb" : "#475569",
                    }}>
                      {pt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              backgroundColor: "#fff", borderRadius: "20px",
              padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}>
              <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 12px 0" }}>
                Budget maximum
              </h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[30, 60, 100, 999].map((p) => (
                  <button key={p} onClick={() => setMaxPrice(p)} style={{
                    padding: "8px 16px", borderRadius: "20px",
                    border: `2px solid ${maxPrice === p ? "#3b82f6" : "#e2e8f0"}`,
                    backgroundColor: maxPrice === p ? "#eff6ff" : "#fff",
                    color: maxPrice === p ? "#2563eb" : "#475569",
                    fontSize: "0.88rem", fontWeight: "600", cursor: "pointer",
                  }}>
                    {p === 999 ? "Tous" : `≤ $${p}`}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={fetchRecommendations} disabled={!selectedType || loading} style={{
              padding: "16px", fontSize: "1.05rem", fontWeight: "700",
              backgroundColor: !selectedType || loading ? "#94a3b8" : "#3b82f6",
              color: "#fff", border: "none", borderRadius: "16px",
              cursor: !selectedType || loading ? "not-allowed" : "pointer",
              boxShadow: selectedType ? "0 4px 12px rgba(59,130,246,0.3)" : "none",
            }}>
              {loading ? "⏳ Recherche en cours..." : "🔍 Trouver mes produits"}
            </button>
          </div>
        )}

        {/* ═══ ÉTAPE 3 — RÉSULTATS ═══════════════════════════════════════ */}
        {step === "results" && (
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>

            <div style={{
              backgroundColor: "#fff", borderRadius: "20px",
              padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontWeight: "700", color: "#1e293b" }}>
                  {SKIN_LABELS[effectiveSkin!]?.icon} Peau {SKIN_LABELS[effectiveSkin!]?.label}
                </div>
                <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  {PRODUCT_TYPES.find(p => p.value === selectedType)?.icon}{" "}
                  {PRODUCT_TYPES.find(p => p.value === selectedType)?.label}
                </div>
              </div>
              <span style={{
                backgroundColor: "#f1f5f9", borderRadius: "10px",
                padding: "4px 10px", fontSize: "0.82rem", color: "#64748b",
              }}>
                Top {recommendations.length}
              </span>
            </div>

            {recommendations.length === 0 ? (
              <div style={{
                backgroundColor: "#fff", borderRadius: "20px", padding: "32px 20px",
                textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>🔍</div>
                <p style={{ color: "#64748b" }}>Aucun produit trouvé pour ces critères.</p>
                <button onClick={() => setStep("product_type")}
                  style={{ marginTop: "12px", color: "#3b82f6", background: "none",
                    border: "none", cursor: "pointer", fontWeight: "600" }}>
                  Modifier les critères
                </button>
              </div>
            ) : (
              recommendations.map((product, i) => {
                const isExpanded = expandedCard === i;
                const dc         = dangerColor(product.danger_level);
                const medal      = ["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`;
                return (
                  <div key={i} style={{
                    backgroundColor: "#fff", borderRadius: "20px",
                    border: `2px solid ${isExpanded ? dc : "#e2e8f0"}`,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    overflow: "hidden", transition: "border-color 0.2s",
                  }}>
                    <div onClick={() => setExpandedCard(isExpanded ? null : i)}
                      style={{ padding: "16px 18px", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <span style={{ fontSize: "1.6rem", flexShrink: 0 }}>{medal}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: "700", fontSize: "0.95rem", color: "#1e293b",
                            marginBottom: "2px", overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {product.name}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                            {product.brand} · ${product.price}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                          <span style={{
                            backgroundColor: `${dc}20`, color: dc,
                            borderRadius: "8px", padding: "3px 10px",
                            fontSize: "0.78rem", fontWeight: "700", whiteSpace: "nowrap",
                          }}>
                            {dangerLabel(product.danger_level)}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>⭐ {product.rank}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                          fontSize: "0.78rem", color: "#64748b", marginBottom: "4px" }}>
                          <span>Score sécurité</span>
                          <span style={{ fontWeight: "700", color: dc }}>
                            {product.safety_score.toFixed(1)}/10
                          </span>
                        </div>
                        <div style={{ height: "6px", backgroundColor: "#f1f5f9", borderRadius: "3px" }}>
                          <div style={{
                            width: `${(product.safety_score / 10) * 100}%`,
                            height: "100%", borderRadius: "3px",
                            backgroundColor: dc, transition: "width 0.5s ease",
                          }} />
                        </div>
                      </div>
                      <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "#94a3b8", textAlign: "right" }}>
                        {isExpanded ? "▲ Réduire" : "▼ Voir les ingrédients"}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px 18px", backgroundColor: "#fafafa" }}>
                        {product.high_risk_ingredients.length > 0 && (
                          <div style={{ marginBottom: "12px" }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#ef4444", marginBottom: "6px" }}>
                              ⚠️ Ingrédients à risque élevé
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {product.high_risk_ingredients.map((ing, j) => (
                                <span key={j} style={{
                                  backgroundColor: "#fef2f2", border: "1px solid #fecaca",
                                  borderRadius: "6px", padding: "3px 8px",
                                  fontSize: "0.78rem", color: "#dc2626",
                                }}>{ing}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {product.moderate_risk_ingredients.length > 0 && (
                          <div style={{ marginBottom: "12px" }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#f59e0b", marginBottom: "6px" }}>
                              ⚡ Ingrédients modérés
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {product.moderate_risk_ingredients.map((ing, j) => (
                                <span key={j} style={{
                                  backgroundColor: "#fffbeb", border: "1px solid #fde68a",
                                  borderRadius: "6px", padding: "3px 8px",
                                  fontSize: "0.78rem", color: "#d97706",
                                }}>{ing}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>
                            📋 Principaux ingrédients
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {product.ingredients_preview.map((ing, j) => (
                              <span key={j} style={{
                                backgroundColor: "#f1f5f9", borderRadius: "6px",
                                padding: "3px 8px", fontSize: "0.78rem", color: "#475569",
                              }}>{ing}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button onClick={() => setStep("product_type")} style={{
                flex: 1, padding: "14px", borderRadius: "14px",
                border: "2px solid #e2e8f0", backgroundColor: "#fff",
                color: "#3b82f6", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem",
              }}>
                ← Changer le produit
              </button>
              <button onClick={handleReset} style={{
                flex: 1, padding: "14px", borderRadius: "14px",
                backgroundColor: "#f1f5f9", border: "none",
                color: "#475569", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem",
              }}>
                🔄 Recommencer
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

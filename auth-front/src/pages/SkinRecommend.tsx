import React, { useState, useRef } from "react";

const FASTAPI_URL = "http://localhost:8083";

type SkinType = "dry" | "oily" | null;
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
  { label: "Moisturizer", value: "Moisturizer", icon: "💧" },
  { label: "Cleanser",    value: "Cleanser",     icon: "🫧" },
  { label: "Treatment",   value: "Treatment",    icon: "✨" },
  { label: "Face Mask",   value: "Face Mask",    icon: "🌿" },
  { label: "Eye Cream",   value: "Eye cream",    icon: "👁️" },
  { label: "Sun Protect", value: "Sun protect",  icon: "☀️" },
];

const SKIN_LABELS: Record<string, { label: string; icon: string; color: string; desc: string; gradient: string }> = {
  dry:  { label: "Dry",  icon: "🏜️", color: "#f59e0b", desc: "Lacks moisture, frequent tightness",  gradient: "linear-gradient(135deg,#fef3c7,#fde68a)" },
  oily: { label: "Oily", icon: "💦", color: "#3b82f6", desc: "Excess sebum, enlarged pores, shine", gradient: "linear-gradient(135deg,#dbeafe,#bfdbfe)" },
};

const dangerColor = (l: string) => l === "HIGH" ? "#ef4444" : l === "MODERATE" ? "#f59e0b" : "#10b981";
const dangerLabel = (l: string) => l === "HIGH" ? "⚠️ Risky" : l === "MODERATE" ? "⚡ Moderate" : "✅ Safe";

export default function SkinRecommend() {
  const [step, setStep]                       = useState<Step>("photo");
  const [loading, setLoading]                 = useState(false);
  const [status, setStatus]                   = useState("Analyze your skin to get started");
  const [skinResult, setSkinResult]           = useState<SkinResult | null>(null);
  const [manualSkin, setManualSkin]           = useState<SkinType>(null);
  const [useManual, setUseManual]             = useState(false);
  const [photoPreview, setPhotoPreview]       = useState<string>("");
  const [showManual, setShowManual]           = useState(true);
  const fileInputRef                          = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType]       = useState<string>("");
  const [maxPrice, setMaxPrice]               = useState<number>(370);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [expandedCard, setExpandedCard]       = useState<number | null>(null);

  const effectiveSkin: SkinType = useManual ? manualSkin : (skinResult?.skin_type ?? null);

  const analyzeSkin = async (file: File) => {
    setLoading(true);
    setShowManual(false);
    setStatus("🔬 Analyzing your skin...");
    setPhotoPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${FASTAPI_URL}/analyze/skin`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: SkinResult = await res.json();
      setSkinResult(data);
      setStatus(`✅ Skin detected: ${SKIN_LABELS[data.skin_type!]?.label ?? data.skin_type} Skin`);
      setStep("photo");
    } catch (err) {
      console.error(err);
      setStatus("❌ Analysis failed — make sure the server is running");
      setShowManual(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    if (!effectiveSkin || !selectedType) return;
    setLoading(true);
    setStatus("🧠 Finding the best products for you...");
    try {
      const res = await fetch(`${FASTAPI_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skin_type: effectiveSkin, product_type: selectedType, top_n: 3, max_price: maxPrice }),
      });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data = await res.json();
      setRecommendations(data.recommendations);
      setStep("results");
      setStatus(`✅ ${data.total_found} products analyzed`);
    } catch (err) {
      console.error(err);
      setStatus("❌ Error fetching product recommendations");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("photo"); setSkinResult(null); setManualSkin(null);
    setUseManual(false); setPhotoPreview(""); setSelectedType("");
    setMaxPrice(370); setRecommendations([]); setExpandedCard(null);
    setShowManual(true); setStatus("Analyze your skin to get started");
  };

  return (
    <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh", paddingBottom: "100px", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "0 16px" }}>

        {/* HEADER */}
        <header style={{ textAlign: "center", paddingTop: "24px", paddingBottom: "8px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "linear-gradient(135deg,#ec4899,#a855f7)",
            borderRadius: "20px", padding: "8px 20px", marginBottom: "6px",
            boxShadow: "0 4px 16px rgba(236,72,153,0.25)",
          }}>
            <span style={{ fontSize: "1.3rem" }}>🌸</span>
            <h1 style={{ fontSize: "1.4rem", fontWeight: "800", color: "#fff", margin: 0 }}>SkinMatch</h1>
          </div>
          <p style={{ color: "#94a3b8", margin: "4px 0 0 0", fontSize: "0.88rem" }}>
            Analyze your skin · Find safe products
          </p>

          {/* Steps indicator */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "20px" }}>
            {(["photo", "product_type", "results"] as Step[]).map((s, i) => {
              const labels = ["Analysis", "Product", "Results"];
              const isActive = step === s;
              const isDone = (["photo", "product_type", "results"] as Step[]).indexOf(step) > i;
              return (
                <React.Fragment key={s}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      backgroundColor: isDone ? "#10b981" : isActive ? "#ec4899" : "#e2e8f0",
                      color: isDone || isActive ? "#fff" : "#94a3b8",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: "700", fontSize: "0.85rem",
                    }}>
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span style={{ fontSize: "0.7rem", color: isActive ? "#ec4899" : "#94a3b8", fontWeight: isActive ? "700" : "400" }}>
                      {labels[i]}
                    </span>
                  </div>
                  {i < 2 && <div style={{ height: "2px", width: "40px", marginBottom: "16px", backgroundColor: isDone ? "#10b981" : "#e2e8f0" }} />}
                </React.Fragment>
              );
            })}
          </div>

          <div style={{ marginTop: "12px", padding: "8px 16px", backgroundColor: "#f1f5f9", borderRadius: "20px", fontSize: "0.85rem", color: "#475569" }}>
            {status}
          </div>
        </header>

        {/* ═══ STEP 1 ═══════════════════════════════════════════════════ */}
        {step === "photo" && (
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* ── AI Photo Card — highlighted ── */}
            <div style={{
              background: "linear-gradient(135deg,#fdf2f8,#f5f3ff)",
              borderRadius: "24px", padding: "28px 24px",
              boxShadow: "0 8px 32px rgba(236,72,153,0.18)",
              border: "2px solid rgba(236,72,153,0.25)",
              textAlign: "center",
            }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                backgroundColor: "rgba(236,72,153,0.12)", borderRadius: "20px",
                padding: "4px 14px", marginBottom: "14px",
              }}>
                <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "#ec4899" }}>🤖 AI-Powered · Instant Results</span>
              </div>

              <h2 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#1e293b", margin: "0 0 8px 0" }}>
                📸 Take a Photo of Your Face
              </h2>
              <p style={{ color: "#64748b", fontSize: "0.88rem", margin: "0 0 24px 0", lineHeight: "1.6" }}>
                Our AI model automatically detects your skin type in seconds.<br />
                <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Use natural lighting for best accuracy.</span>
              </p>

              {photoPreview ? (
                <div>
                  <div style={{ position: "relative", display: "inline-block", marginBottom: "16px" }}>
                    <img src={photoPreview} alt="Face" style={{
                      width: "180px", height: "180px", borderRadius: "50%", objectFit: "cover",
                      border: "5px solid #ec4899", boxShadow: "0 8px 24px rgba(236,72,153,0.35)",
                    }} />
                    {loading && (
                      <div style={{
                        position: "absolute", inset: 0, borderRadius: "50%",
                        backgroundColor: "rgba(0,0,0,0.45)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: "2.2rem" }}>⏳</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <button onClick={() => { setPhotoPreview(""); setSkinResult(null); setShowManual(true); setStatus("Analyze your skin to get started"); }}
                      style={{ background: "none", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "8px 18px", fontSize: "0.85rem", color: "#64748b", cursor: "pointer", fontWeight: "600" }}>
                      📷 Change Photo
                    </button>
                  </div>
                </div>
              ) : (
                <label style={{
                  display: "inline-block", padding: "16px 36px",
                  background: "linear-gradient(135deg,#ec4899,#a855f7)",
                  color: "#fff", borderRadius: "16px", fontSize: "1.05rem", fontWeight: "700",
                  cursor: "pointer", boxShadow: "0 6px 20px rgba(236,72,153,0.4)",
                }}>
                  {loading ? "⏳ Analyzing..." : "📷 Upload / Take Photo"}
                  <input ref={fileInputRef} type="file" accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) analyzeSkin(f); }}
                  />
                </label>
              )}
            </div>

            {/* ── Analysis result ── */}
            {skinResult && !useManual && (
              <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: "2px solid #f0fdf4" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 16px 0" }}>🧬 Analysis Result</h3>

                {skinResult.skin_type && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    background: SKIN_LABELS[skinResult.skin_type]?.gradient ?? "#f8fafc",
                    borderRadius: "14px", padding: "14px 16px", marginBottom: "14px",
                    border: `2px solid ${SKIN_LABELS[skinResult.skin_type]?.color ?? "#e2e8f0"}40`,
                  }}>
                    <span style={{ fontSize: "2.2rem" }}>{SKIN_LABELS[skinResult.skin_type]?.icon ?? "🔬"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "800", fontSize: "1.15rem", color: "#1e293b" }}>
                        {SKIN_LABELS[skinResult.skin_type]?.label ?? skinResult.skin_type} Skin
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>
                        {SKIN_LABELS[skinResult.skin_type]?.desc}
                      </div>
                    </div>
                    <div style={{ backgroundColor: SKIN_LABELS[skinResult.skin_type]?.color ?? "#64748b", color: "#fff", borderRadius: "10px", padding: "6px 12px", fontSize: "0.85rem", fontWeight: "800" }}>
                      {(skinResult.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                  {Object.entries(skinResult.skin_profile).sort(([, a], [, b]) => b - a).map(([cls, prob]) => (
                    <div key={cls} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "60px", fontSize: "0.82rem", color: "#475569", fontWeight: "600" }}>
                        {SKIN_LABELS[cls]?.label ?? cls}
                      </span>
                      <div style={{ flex: 1, height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{
                          width: `${prob * 100}%`, height: "100%",
                          backgroundColor: cls === skinResult.skin_type ? (SKIN_LABELS[cls]?.color ?? "#ec4899") : "#cbd5e1",
                          borderRadius: "4px", transition: "width 0.8s ease",
                        }} />
                      </div>
                      <span style={{ width: "38px", fontSize: "0.82rem", color: "#64748b", textAlign: "right", fontWeight: "600" }}>
                        {(prob * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ padding: "12px 14px", backgroundColor: "#eff6ff", borderRadius: "12px", fontSize: "0.83rem", color: "#1e40af", lineHeight: "1.6" }}>
                  💡 {skinResult.recommendation_tip}
                </div>

                <button onClick={() => setStep("product_type")} style={{
                  marginTop: "16px", width: "100%", padding: "15px",
                  background: "linear-gradient(135deg,#ec4899,#a855f7)",
                  color: "#fff", border: "none", borderRadius: "14px",
                  fontSize: "1rem", fontWeight: "700", cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(236,72,153,0.3)",
                }}>
                  Continue → Choose a Product
                </button>
              </div>
            )}

            {/* ── Manual selection — hidden while analyzing or after result ── */}
            {showManual && !skinResult && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }} />
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: "600" }}>or</span>
                  <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }} />
                </div>

                <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 4px 0" }}>
                    I already know my skin type
                  </h3>
                  <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0 0 14px 0" }}>
                    Skip the photo and select directly
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {Object.entries(SKIN_LABELS).map(([key, val]) => (
                      <button key={key}
                        onClick={() => { setManualSkin(key as SkinType); setUseManual(true); setStep("product_type"); }}
                        style={{
                          display: "flex", alignItems: "center", gap: "8px",
                          padding: "14px 16px", borderRadius: "12px",
                          border: `2px solid ${manualSkin === key ? val.color : "#e2e8f0"}`,
                          backgroundColor: manualSkin === key ? `${val.color}15` : "#fff",
                          cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", color: "#334155",
                        }}>
                        <span style={{ fontSize: "1.4rem" }}>{val.icon}</span>
                        <span>{val.label} Skin</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ STEP 2 ═══════════════════════════════════════════════════ */}
        {step === "product_type" && effectiveSkin && (
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

            <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "2rem" }}>{SKIN_LABELS[effectiveSkin]?.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "700", color: "#1e293b" }}>{SKIN_LABELS[effectiveSkin]?.label} Skin</div>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{SKIN_LABELS[effectiveSkin]?.desc}</div>
              </div>
              <button onClick={() => { setStep("photo"); setUseManual(false); }}
                style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#64748b", fontSize: "0.78rem", cursor: "pointer", padding: "4px 10px", fontWeight: "600" }}>
                ✏️ Edit
              </button>
            </div>

            <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 16px 0" }}>
                What type of product are you looking for?
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {PRODUCT_TYPES.map((pt) => (
                  <button key={pt.value} onClick={() => setSelectedType(pt.value)} style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: "6px", padding: "16px 10px", borderRadius: "14px",
                    border: `2px solid ${selectedType === pt.value ? "#ec4899" : "#e2e8f0"}`,
                    backgroundColor: selectedType === pt.value ? "#fdf2f8" : "#fff",
                    cursor: "pointer", transition: "all 0.2s",
                  }}>
                    <span style={{ fontSize: "1.6rem" }}>{pt.icon}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: "600", color: selectedType === pt.value ? "#ec4899" : "#475569" }}>
                      {pt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 12px 0" }}>💰 Maximum Budget</h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[{ label: "≤ $30", value: 30 }, { label: "≤ $60", value: 60 }, { label: "≤ $100", value: 100 }, { label: "≤ $200", value: 200 }, { label: "All", value: 370 }].map((p) => (
                  <button key={p.value} onClick={() => setMaxPrice(p.value)} style={{
                    padding: "8px 16px", borderRadius: "20px",
                    border: `2px solid ${maxPrice === p.value ? "#ec4899" : "#e2e8f0"}`,
                    backgroundColor: maxPrice === p.value ? "#fdf2f8" : "#fff",
                    color: maxPrice === p.value ? "#ec4899" : "#475569",
                    fontSize: "0.88rem", fontWeight: "600", cursor: "pointer",
                  }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={fetchRecommendations} disabled={!selectedType || loading} style={{
              padding: "16px", fontSize: "1.05rem", fontWeight: "700",
              background: !selectedType || loading ? "#94a3b8" : "linear-gradient(135deg,#ec4899,#a855f7)",
              color: "#fff", border: "none", borderRadius: "16px",
              cursor: !selectedType || loading ? "not-allowed" : "pointer",
              boxShadow: selectedType && !loading ? "0 4px 16px rgba(236,72,153,0.35)" : "none",
            }}>
              {loading ? "⏳ Searching..." : "🔍 Find My Products"}
            </button>
          </div>
        )}

        {/* ═══ STEP 3 ═══════════════════════════════════════════════════ */}
        {step === "results" && (
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>

            <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: "700", color: "#1e293b" }}>
                  {SKIN_LABELS[effectiveSkin!]?.icon} {SKIN_LABELS[effectiveSkin!]?.label} Skin
                </div>
                <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  {PRODUCT_TYPES.find(p => p.value === selectedType)?.icon}{" "}
                  {PRODUCT_TYPES.find(p => p.value === selectedType)?.label}
                </div>
              </div>
              <span style={{ backgroundColor: "#f1f5f9", borderRadius: "10px", padding: "4px 10px", fontSize: "0.82rem", color: "#64748b", fontWeight: "600" }}>
                Top {recommendations.length}
              </span>
            </div>

            {recommendations.length === 0 ? (
              <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "32px 20px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>🔍</div>
                <p style={{ color: "#64748b" }}>No products found for these criteria.</p>
                <button onClick={() => setStep("product_type")} style={{ marginTop: "12px", color: "#ec4899", background: "none", border: "none", cursor: "pointer", fontWeight: "600" }}>
                  Change criteria
                </button>
              </div>
            ) : (
              recommendations.map((product, i) => {
                const isExpanded = expandedCard === i;
                const dc = dangerColor(product.danger_level);
                const medal = ["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`;
                return (
                  <div key={i} style={{ backgroundColor: "#fff", borderRadius: "20px", border: `2px solid ${isExpanded ? dc : "#e2e8f0"}`, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                    <div onClick={() => setExpandedCard(isExpanded ? null : i)} style={{ padding: "16px 18px", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <span style={{ fontSize: "1.6rem", flexShrink: 0 }}>{medal}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "#1e293b", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {product.name}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>{product.brand} · ${product.price}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                          <span style={{ backgroundColor: `${dc}20`, color: dc, borderRadius: "8px", padding: "3px 10px", fontSize: "0.78rem", fontWeight: "700", whiteSpace: "nowrap" }}>
                            {dangerLabel(product.danger_level)}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>⭐ {product.rank}</span>
                        </div>
                      </div>
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#64748b", marginBottom: "4px" }}>
                          <span>danger Score</span>
                          <span style={{ fontWeight: "700", color: dc }}>{product.safety_score.toFixed(1)}/10</span>
                        </div>
                        <div style={{ height: "6px", backgroundColor: "#f1f5f9", borderRadius: "3px" }}>
                          <div style={{ width: `${(product.safety_score / 10) * 100}%`, height: "100%", borderRadius: "3px", backgroundColor: dc, transition: "width 0.5s ease" }} />
                        </div>
                      </div>
                      <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "#94a3b8", textAlign: "right" }}>
                        {isExpanded ? "▲ Collapse" : "▼ View ingredients"}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px 18px", backgroundColor: "#fafafa" }}>
                        {product.high_risk_ingredients.length > 0 && (
                          <div style={{ marginBottom: "12px" }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#ef4444", marginBottom: "6px" }}>⚠️ High Risk Ingredients</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {product.high_risk_ingredients.map((ing, j) => (
                                <span key={j} style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "3px 8px", fontSize: "0.78rem", color: "#dc2626" }}>{ing}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {product.moderate_risk_ingredients.length > 0 && (
                          <div style={{ marginBottom: "12px" }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#f59e0b", marginBottom: "6px" }}>⚡ Moderate Risk Ingredients</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {product.moderate_risk_ingredients.map((ing, j) => (
                                <span key={j} style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "3px 8px", fontSize: "0.78rem", color: "#d97706" }}>{ing}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>📋 Main Ingredients</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {product.ingredients_preview.map((ing, j) => (
                              <span key={j} style={{ backgroundColor: "#f1f5f9", borderRadius: "6px", padding: "3px 8px", fontSize: "0.78rem", color: "#475569" }}>{ing}</span>
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
              <button onClick={() => setStep("product_type")} style={{ flex: 1, padding: "14px", borderRadius: "14px", border: "2px solid #e2e8f0", backgroundColor: "#fff", color: "#ec4899", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem" }}>
                ← Change Product
              </button>
              <button onClick={handleReset} style={{ flex: 1, padding: "14px", borderRadius: "14px", backgroundColor: "#f1f5f9", border: "none", color: "#475569", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem" }}>
                🔄 Start Over
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

import React, { useState, useRef } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import "./CosmoScan.css";
import { saveToHistory } from "../lib/history";
import { saveFavorite, isFavorite, getFavorites, removeFavorite } from "../lib/favorites";

// ============================================================
// HELPERS
// ============================================================

const riskColor = (danger: string) => {
  if (danger === "HIGH")     return "#ef4444";
  if (danger === "MODERATE") return "#f59e0b";
  return "#10b981";
};

const criteriaColor = (val: string) => {
  if (val === "HIGH")     return { color: "#ef4444", fontWeight: "700" };
  if (val === "MODERATE") return { color: "#f59e0b", fontWeight: "700" };
  return { color: "#94a3b8", fontWeight: "400" };
};

const getIngredientRole = (ing: string) => {
  const lower = ing.toLowerCase();
  if (lower.includes("phenoxyethanol") || lower.includes("paraben") || lower.includes("methylisothiazolinone")) return "Preservative";
  if (lower.includes("bht") || lower.includes("bha")) return "Antioxidant";
  if (lower.includes("parfum") || lower.includes("fragrance")) return "Fragrance Agent";
  if (lower.includes("titanium dioxide") || lower.includes("octocrylene")) return "UV Filter";
  if (lower.includes("aqua") || lower.includes("water")) return "Solvent";
  if (lower.includes("glycerin") || lower.includes("hyaluronic acid")) return "Humectant";
  if (lower.includes("peg") || lower.includes("ceteareth") || lower.includes("steareth") || lower.includes("cetearyl alcohol")) return "Emulsifier";
  if (lower.includes("dimethicone") || lower.includes("silicone") || lower.includes("cyclopentasiloxane")) return "Emollient";
  if (lower.includes("sulfate") || lower.includes("sls") || lower.includes("sles")) return "Surfactant";
  return "Cosmetic Ingredient";
};

// ============================================================
// CARTE INGRÉDIENT
// ============================================================

const IngredientCard = ({ item, accentColor }: { item: any; accentColor: string }) => {
  const criteria = [
    { label: "Cancer",            icon: "🚀", val: "LOW" },
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

  const scoreText  = typeof item.score === "number" ? item.score.toFixed(1) : String(item.score ?? "—");
  const riskLabel  = item.danger === "HIGH" ? "HIGH" : item.danger === "MODERATE" ? "MODERATE" : "LOW";
  return (
    <div style={{
      backgroundColor: "#fff",
      borderRadius: "12px",
      border: "1px solid #e2e8f0",
      borderLeft: `4px solid ${accentColor}`,
      padding: "14px 16px",
      marginBottom: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
        <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: accentColor, flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: "700", fontSize: "0.88rem", color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {item.name}
        </span>
        <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "700", color: "#fff", backgroundColor: accentColor, whiteSpace: "nowrap" }}>
          {riskLabel} — Score : {scoreText}
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

// ============================================================
// ACCORDÉON PAR NIVEAU DE RISQUE
// ============================================================

const RiskSection = ({ title, items, color, defaultOpen = false }: {
  title: string; items: any[]; color: string; defaultOpen?: boolean;
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

// ============================================================
// PAGE PRINCIPALE
// ============================================================

export default function CosmoScan() {
  const [status, setStatus]                   = useState("Ready to scan!");
  const [ingredients, setIngredients]         = useState<string[]>([]);
  const [analysisResult, setAnalysisResult]   = useState<any>(null);
  const [liked, setLiked]                     = useState(false);
  const [loading, setLoading]                 = useState(false);

  const [imgSrc, setImgSrc]                   = useState("");
  const imgRef                                = useRef<HTMLImageElement>(null);
  const [crop, setCrop]                       = useState<Crop>({ unit: "%", width: 80, height: 30, x: 10, y: 35 });
  const [completedCrop, setCompletedCrop]     = useState<PixelCrop | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string>("");
  const [isCropping, setIsCropping]           = useState(false);

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setImgSrc(reader.result?.toString() || "");
      setIsCropping(true);
      setCroppedImageUrl("");
      setIngredients([]);
      setAnalysisResult(null);
      setStatus("Frame only the ingredients list");
    });
    reader.readAsDataURL(file);
  };

  const getCroppedImg = () => {
    const image = imgRef.current;
    if (!image || !completedCrop) return;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width  = completedCrop.width  * scaleX;
    canvas.height = completedCrop.height * scaleY;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image,
      completedCrop.x * scaleX, completedCrop.y * scaleY,
      completedCrop.width * scaleX, completedCrop.height * scaleY,
      0, 0, completedCrop.width * scaleX, completedCrop.height * scaleY
    );
    setCroppedImageUrl(canvas.toDataURL("image/jpeg"));
    setIsCropping(false);
    setStatus("Perfect crop! Ready to read.");
  };

  const base64ToBlob = (base64: string) => {
    const byteString = atob(base64.split(",")[1]);
    const mimeString = base64.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new Blob([ab], { type: mimeString });
  };

  const extractIngredientsFromImage = async () => {
    if (!croppedImageUrl) return;
    setLoading(true);
    setStatus("📸 Reading label...");
    try {
      const formData = new FormData();
      formData.append("file", base64ToBlob(croppedImageUrl), "capture.jpg");
      const response = await fetch("http://localhost:8083/analyze/image", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Server error");
      const data = await response.json();
      if (data.ingredients && data.ingredients.length > 0) {
        setIngredients(data.ingredients);
        setStatus(`✅ ${data.count} ingredients found! Launch analysis.`);
      } else {
        setStatus("⚠️ No readable ingredients. Try cropping closer.");
      }
    } catch (error) {
      console.error(error);
      setStatus("❌ Connection error with AI (Reading).");
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = async () => {
    if (!ingredients.length) return;
    setLoading(true);
    setStatus("🧠 AI is calculating danger level... Please wait.");
    const ingredientsArray = ingredients;

    try {
      const response = await fetch("http://localhost:8083/analyze/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingredientsArray }),
      });
      if (!response.ok) throw new Error("Server error during analysis");
      const data = await response.json();

      let explication = "Excellent";
      if (data.danger_produit === "MODERATE") explication = "Moderate Risk";
      if (data.danger_produit === "HIGH")     explication = "High Risk";

      const high: any[] = [];
      const mod:  any[] = [];
      const safe: any[] = [];

      data.ingredients.forEach((ingObj: any) => {
        const formattedIng = {
          name:        ingObj.name,
          danger:      ingObj.danger,
          score:       ingObj.score,
          source:      ingObj.source,
          description: ingObj.description ?? [],
        };
        if (ingObj.danger === "HIGH")          high.push(formattedIng);
        else if (ingObj.danger === "MODERATE") mod.push(formattedIng);
        else                                   safe.push(formattedIng);
      });

      setAnalysisResult({
        score:            data.score_global,
        explanation:      explication,
        highRiskList:     high,
        moderateRiskList: mod,
        safeRiskList:     safe,
        totalAnalyzed:    data.nb_ingredients,
      });

      setStatus("✅ Analysis complete!");
      setLiked(isFavorite("Scanned Product"));
      saveToHistory({ type: "photo", productName: "Scanned Product", ingredients: ingredients.join(", ") });

    } catch (error) {
      console.error(error);
      setStatus("❌ Connection error with AI.");
    } finally {
      setLoading(false);
    }
  };

  function handleReset() {
    setImgSrc(""); setCroppedImageUrl(""); setIsCropping(false);
    setIngredients([]); setAnalysisResult(null);
    setLiked(false); setLoading(false);
    setStatus("Ready to scan!");
  }

  function handleFavorite() {
    if (liked) {
      const id = getFavorites().find((f) => f.productName === "Scanned Product")?.id;
      if (id) removeFavorite(id);
      setLiked(false);
    } else {
      saveFavorite({ type: "photo", productName: "Scanned Product", ingredients: ingredients.join(", ") });
      setLiked(true);
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 7) return "#10b981";
    if (score >= 4) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="cosmo-page" style={{ backgroundColor: "#f8fafc", minHeight: "100vh", paddingBottom: "80px" }}>
      <div className="cosmo-container" style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: "transparent", boxShadow: "none" }}>

        {!analysisResult && (
          <header className="cosmo-header" style={{ paddingTop: "20px" }}>
            <h1>CosmoScan</h1>
            <p>Intelligent Ingredient Analyzer</p>
            <div className="cosmo-status">{status}</div>
          </header>
        )}

        {/* UPLOAD BUTTON */}
        {!imgSrc && !croppedImageUrl && (
          <div className="cosmo-mode-selector" style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            <label className="cosmo-capture-btn cursor-pointer" style={{ padding: "15px 30px", display: "inline-block", backgroundColor: "#3b82f6", color: "white", borderRadius: "12px", cursor: "pointer" }}>
              📁 Upload Photo
              {/* ✅ Removed capture="environment" → allows file picker instead of camera */}
              <input type="file" accept="image/*" onChange={handlePhotoCapture} style={{ display: "none" }} />
            </label>
          </div>
        )}

        {/* CROP */}
        {isCropping && imgSrc && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "15px", marginTop: "20px" }}>
            <div style={{ border: "2px dashed #3b82f6", borderRadius: "8px", overflow: "hidden", maxWidth: "100%", backgroundColor: "#fff" }}>
              <ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={(c) => setCompletedCrop(c)}>
                <img ref={imgRef} src={imgSrc} alt="Preview" style={{ maxHeight: "60vh", width: "100%" }} />
              </ReactCrop>
            </div>
            <button onClick={getCroppedImg} className="cosmo-capture-btn" style={{ padding: "12px 24px", width: "100%", backgroundColor: "#3b82f6" }}>
              ✂️ Confirm Crop
            </button>
            <p onClick={handleReset} style={{ cursor: "pointer", color: "gray", fontSize: "0.9rem", textDecoration: "underline" }}>Cancel</p>
          </div>
        )}

        {/* CROPPED IMAGE → READ — ✅ FIX: buttons in a separate row, no overlap */}
        {!isCropping && croppedImageUrl && ingredients.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
            <img src={croppedImageUrl} alt="Crop" style={{ width: "100%", borderRadius: "12px", border: "2px solid #3b82f6" }} />
            {/* ✅ Buttons below image — never overlapping */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setIsCropping(true)}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#fff", cursor: "pointer", fontWeight: "600" }}>
                ✏️ Adjust
              </button>
              <button
                onClick={extractIngredientsFromImage}
                disabled={loading}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", backgroundColor: loading ? "#94a3b8" : "#3b82f6", color: "white", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "⏳ Reading..." : "🔍 Read Label"}
              </button>
            </div>
          </div>
        )}

        {/* INCI LIST + ANALYZE BUTTON */}
        {ingredients.length > 0 && !analysisResult && (
          <div style={{
            marginTop: "20px",
            backgroundColor: "#fff",
            padding: "20px",
            borderRadius: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "20px"
          }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#334155", fontWeight: "700" }}>
              Detected INCI List:
            </h3>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              maxHeight: "300px",
              overflowY: "auto",
              padding: "4px"
            }}>
              {ingredients.map((ing, i) => (
                <span key={i} style={{
                  backgroundColor: "#f1f5f9",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "0.85rem",
                  color: "#475569",
                  border: "1px solid #e2e8f0"
                }}>
                  {ing}
                </span>
              ))}
            </div>
            <button
              onClick={calculateScore}
              disabled={loading}
              style={{
                width: "100%",
                padding: "16px",
                fontSize: "1.1rem",
                backgroundColor: loading ? "#94a3b8" : "#3b82f6",
                borderRadius: "16px",
                color: "white",
                fontWeight: "bold",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
              }}
            >
              {loading ? "⏳ Analyzing..." : "🚀 Analyze Product"}
            </button>
          </div>
        )}

        {/* RESULTS */}
        {analysisResult && (
          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "15px" }}>
            <div style={{ backgroundColor: "#ffffff", padding: "30px 20px", borderRadius: "24px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", textAlign: "center", position: "relative" }}>
              <button onClick={handleFavorite} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", fontSize: "1.8rem", cursor: "pointer" }}>
                {liked ? "❤️" : "🤍"}
              </button>
              <div style={{ width: "80px", height: "80px", backgroundColor: "#f1f5f9", borderRadius: "16px", margin: "0 auto 15px auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
                🧴
              </div>
              <h2 style={{ margin: "0 0 5px 0", fontSize: "1.4rem", color: "#1e293b" }}>Scanned Product</h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: "15px" }}>
                <span style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: getScoreColor(analysisResult.score), marginRight: "10px" }} />
                <span style={{ fontSize: "1.4rem", fontWeight: "bold", color: getScoreColor(analysisResult.score) }}>
                  {analysisResult.score} / 10
                </span>
              </div>
              <p style={{ margin: "5px 0 0 0", fontSize: "1rem", color: "#64748b", fontWeight: "500" }}>{analysisResult.explanation}</p>
              <p style={{ margin: "6px 0 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>{analysisResult.totalAnalyzed} ingredients analyzed</p>
            </div>

            <div>
              <RiskSection title="High Risk"     items={analysisResult.highRiskList}     color="#ef4444" defaultOpen={analysisResult.highRiskList.length > 0} />
              <RiskSection title="Moderate Risk" items={analysisResult.moderateRiskList}  color="#f59e0b" defaultOpen={analysisResult.highRiskList.length === 0 && analysisResult.moderateRiskList.length > 0} />
              <RiskSection title="Safe"          items={analysisResult.safeRiskList}      color="#10b981" defaultOpen={analysisResult.highRiskList.length === 0 && analysisResult.moderateRiskList.length === 0} />
            </div>

            <button onClick={handleReset}
              style={{ padding: "16px", fontSize: "1rem", width: "100%", marginTop: "10px", backgroundColor: "#f1f5f9", color: "#3b82f6", border: "none", borderRadius: "16px", fontWeight: "bold", cursor: "pointer" }}>
              Scan Another Product
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
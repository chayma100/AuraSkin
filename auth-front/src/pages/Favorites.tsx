import { useState, useEffect } from "react";
import type { FavoriteEntry } from "../lib/favorites";
import { getFavorites, removeFavorite } from "../lib/favorites";
import "./CosmoScan.css";

export default function Favorites() {
  const [entries, setEntries] = useState<FavoriteEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setEntries(getFavorites());
  }, []);

  function handleRemove(id: string) {
    removeFavorite(id);
    setEntries(getFavorites());
  }

  const gradientText: React.CSSProperties = {
    background: "linear-gradient(90deg, #ec4899, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };

  return (
    <div className="cosmo-page">
      <div className="cosmo-container" style={{ maxWidth: 600 }}>
        <header className="cosmo-header">
          <h1>Favorites</h1>
          <p>Your saved products</p>
        </header>

        {entries.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9c6db0" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🤍</div>
            <p>No favorites yet.</p>
            <p style={{ fontSize: "0.82rem", marginTop: 6, opacity: 0.7 }}>
              Click ❤️ after a scan to save a product.
            </p>
          </div>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              background: "rgba(255,255,255,0.5)",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "12px",
              border: "1px solid rgba(168,85,247,0.15)",
              backdropFilter: "blur(10px)",
              cursor: "pointer",
            }}
            onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px",
                  borderRadius: "50px", color: "white", marginBottom: 8,
                  display: "inline-block",
                  background: entry.type === "barcode"
                    ? "linear-gradient(90deg, #ec4899, #a855f7)"
                    : "linear-gradient(90deg, #a855f7, #6366f1)",
                }}>
                  {entry.type === "barcode" ? "📷 Barcode" : "🖼️ Photo OCR"}
                </span>
                <h3 style={{ ...gradientText, fontWeight: 800, fontSize: "1rem", margin: "6px 0 4px" }}>
                  {entry.productName}
                </h3>
                <p style={{ fontSize: "0.75rem", color: "#9c6db0", margin: 0 }}>
                  {new Date(entry.date).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "short", year: "numeric"
                  })}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(entry.id); }}
                style={{
                  background: "none", border: "none",
                  fontSize: "1.2rem", cursor: "pointer", outline: "none",
                }}
              >
                ❤️
              </button>
            </div>

            {expanded === entry.id && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: "0.78rem", color: "#7e3fa8", fontWeight: 700, marginBottom: 8 }}>
                  Ingredients:
                </p>
                <div className="cosmo-ingredients-display">
                  {entry.ingredients.split(",").map((ing) => ing.trim()).filter(Boolean).map((ing, i) => (
                    <span className="cosmo-ing-badge" key={i}>{ing}</span>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: "0.75rem", textAlign: "right", color: "#b083d0", margin: "8px 0 0", opacity: 0.7 }}>
              {expanded === entry.id ? "▲ hide" : "▼ view ingredients"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
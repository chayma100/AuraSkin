import { useState, useEffect } from "react";
import type { HistoryEntry } from "../lib/history";
import { getHistory, clearHistory, deleteEntry } from "../lib/history";
import "./CosmoScan.css";

export default function History() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: string) {
    await deleteEntry(id);
    getHistory().then(setEntries);
  }

  async function handleClear() {
    if (confirm("Clear all history?")) {
      await clearHistory();
      setEntries([]);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const gradientText: React.CSSProperties = {
    background: "linear-gradient(90deg, #ec4899, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  };

  return (
    <div className="cosmo-page">
      <div className="cosmo-container" style={{ maxWidth: 600 }}>

        <header className="cosmo-header">
          <h1>History</h1>
          <p>All your scans and analyses</p>
        </header>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9c6db0" }}>
            <p>Loading...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            color: "#9c6db0", fontSize: "0.95rem",
          }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🔍</div>
            <p>No scans recorded yet.</p>
            <p style={{ fontSize: "0.82rem", marginTop: 6, opacity: 0.7 }}>
              Log in and scan a product to get started.
            </p>
          </div>
        )}

        {/* List */}
        {!loading && entries.length > 0 && (
          <>
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
                    {/* Type badge */}
                    <span style={{
                      fontSize: "0.7rem", fontWeight: 700,
                      padding: "3px 10px", borderRadius: "50px",
                      background: entry.type === "barcode"
                        ? "linear-gradient(90deg, #ec4899, #a855f7)"
                        : "linear-gradient(90deg, #a855f7, #6366f1)",
                      color: "white", marginBottom: 8, display: "inline-block",
                    }}>
                      {entry.type === "barcode" ? "📷 Barcode" : "🖼️ Photo OCR"}
                    </span>

                    {/* Product name */}
                    <h3 style={{ ...gradientText, fontWeight: 800, fontSize: "1rem", margin: "6px 0 4px" }}>
                      {entry.productName}
                    </h3>

                    {/* Date */}
                    <p style={{ fontSize: "0.75rem", color: "#9c6db0", margin: 0 }}>
                      {formatDate(entry.date)}
                    </p>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                    style={{
                      background: "transparent", border: "none",
                      color: "#e879a0", cursor: "pointer",
                      fontSize: "1.1rem", padding: "4px 8px", outline: "none",
                    }}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>

                {/* Expandable ingredients */}
                {expanded === entry.id && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: "0.78rem", color: "#7e3fa8", fontWeight: 700, marginBottom: 8 }}>
                      Ingredients:
                    </p>
                    <div className="cosmo-ingredients-display">
                      {entry.ingredients
                        .split(",")
                        .map((ing) => ing.trim())
                        .filter(Boolean)
                        .map((ing, i) => (
                          <span className="cosmo-ing-badge" key={i}>{ing}</span>
                        ))}
                    </div>
                  </div>
                )}

                <p style={{
                  fontSize: "0.75rem", textAlign: "right",
                  color: "#b083d0", margin: "8px 0 0", opacity: 0.7,
                }}>
                  {expanded === entry.id ? "▲ hide" : "▼ view ingredients"}
                </p>
              </div>
            ))}

            {/* Clear all */}
            <p
              onClick={handleClear}
              style={{
                ...gradientText,
                textAlign: "center", fontSize: "0.82rem",
                marginTop: "16px", cursor: "pointer",
                fontStyle: "italic", opacity: 0.8, userSelect: "none",
              }}
            >
              ✦ clear all history
            </p>
          </>
        )}
      </div>
    </div>
  );
}

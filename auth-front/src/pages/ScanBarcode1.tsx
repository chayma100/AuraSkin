import { useEffect, useRef, useState } from "react";
import * as Quagga from "@ericblade/quagga2";
import "./CosmoScan.css";
import { saveToHistory } from "../lib/history";
import { saveFavorite, isFavorite, removeFavorite, getFavorites } from "../lib/favorites";
import produitsRaw from "../data/products.csv?raw";

interface Product {
  name: string;
  ingredients: string;
  imageUrl?: string;
  barcode?: string;
}

type Screen = "home" | "scanning" | "result";

export default function ScanBarcode() {
  const [screen, setScreen]           = useState<Screen>("home");
  const [status, setStatus]           = useState("");
  const [product, setProduct]         = useState<Product | null>(null);
  const [liked, setLiked]             = useState(false);
  const [favoriteId, setFavoriteId]   = useState<string | null>(null);
  const [debugInfo, setDebugInfo]     = useState<string>("");
  const [manualBarcode, setManualBarcode] = useState<string>("");
  const [showManual, setShowManual]   = useState<boolean>(false);
  const scannerDivRef                 = useRef<HTMLDivElement>(null);
  const detectedRef                   = useRef(false);
  const detectionVotes                = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    return () => { stopQuagga(); };
  }, []);

  function stopQuagga() {
    try {
      Quagga.offDetected();
      Quagga.stop();
    } catch {}
    detectedRef.current = false;
    detectionVotes.current.clear();
  }

  // ── Parser CSV robuste ──
  function parseCSVLine(line: string): string[] {
    const cols: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === "," && !inQuotes) {
        cols.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cols.push(current.trim());
    return cols;
  }

  function normalizeBarcode(code: string): string {
    return code.replace(/"/g, "").replace(/\s/g, "").trim().replace(/^0+/, "");
  }

  function searchInLocalDB(barcode: string): Product | null {
    const lines = produitsRaw.split("\n");
    const scannedNorm = normalizeBarcode(barcode);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCSVLine(line);
      if (cols.length < 2) continue;
      const csvNorm = normalizeBarcode(cols[0]);
      if (csvNorm === scannedNorm) {
        return {
          barcode:     cols[0]?.replace(/"/g, "").trim(),
          name:        cols[1]?.replace(/"/g, "").trim() || "Unknown product",
          ingredients: cols[2]?.replace(/"/g, "").trim() || "Ingredients not available",
          imageUrl:    cols[3]?.replace(/"/g, "").trim() || undefined,
        };
      }
    }
    return null;
  }

  // ── Scanner avec les 4 bugs corrigés ──
  async function startScanner() {
    setScreen("scanning");
    setStatus("Point the camera at the barcode...");
    setDebugInfo("");
    detectedRef.current = false;
    detectionVotes.current.clear();
    await new Promise((r) => setTimeout(r, 500));

    Quagga.init(
      {
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: scannerDivRef.current!,
          constraints: {
            // ✅ FIX 1 : "environment" = rear/back camera (was "user" = front/selfie)
            facingMode: "environment",
            // ✅ FIX 2 : lower ideal resolution → sharper focus on mobile
            width:  { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720,  max: 1080 },
            advanced: [{ focusMode: "continuous" }] as any,
          },
        },
        locator: {
          // ✅ FIX 3 : "medium" instead of "large" → better for standard barcodes
          patchSize:  "medium",
          halfSample: true,   // faster on mobile
        },
        numOfWorkers: navigator.hardwareConcurrency
          ? Math.min(navigator.hardwareConcurrency, 4)
          : 2,
        decoder: {
          // ✅ FIX 4 : multiple formats → covers EAN-13, EAN-8, UPC-A, UPC-E
          readers: [
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "upc_e_reader",
          ],
          multiple: false,
        },
        frequency: 15,  // increased from 10 → faster detection
        locate:    true,
      },
      (err) => {
        if (err) {
          console.error("Quagga init error:", err);
          setStatus("❌ Camera error — try manual entry");
          setShowManual(true);
          setScreen("home");
          return;
        }
        Quagga.start();
        setStatus("📷 Camera active — hold barcode steady");
      }
    );

    // Vote system : confirm after 3 identical reads
    Quagga.onDetected(async (data) => {
      if (detectedRef.current) return;
      const code = data.codeResult.code;
      if (!code || code.length < 8) return;

      const votes   = detectionVotes.current;
      const current = votes.get(code) || 0;
      votes.set(code, current + 1);

      setDebugInfo(`Reading: ${code} (${current + 1}/3 confirmations)`);

      if (current + 1 >= 3) {
        detectedRef.current = true;
        stopQuagga();
        setDebugInfo(`Confirmed: ${code}`);
        setStatus(`📦 Barcode: ${code} — Searching...`);
        await fetchProduct(code);
      }
    });
  }

  async function fetchProduct(barcode: string) {
    // 1. Local CSV
    const local = searchInLocalDB(barcode);
    if (local) {
      setProduct(local);
      setScreen("result");
      setStatus("✅ Product found!");
      setDebugInfo("Source: Local CSV");
      await saveToHistory({ type: "barcode", productName: local.name, ingredients: local.ingredients });
      const alreadyLiked = await isFavorite(local.name);
      setLiked(alreadyLiked);
      if (alreadyLiked) {
        const favs = await getFavorites();
        const fav = favs.find((f) => f.productName === local.name);
        if (fav) setFavoriteId(fav.id);
      }
      return;
    }

    // 2. Open Beauty Facts API
    setStatus("🌐 Searching online...");
    try {
      const res  = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();

      if (data.status === 1 && data.product) {
        const p = data.product;
        const found: Product = {
          barcode,
          name:        p.product_name || p.product_name_fr || "Unknown product",
          ingredients: p.ingredients_text || p.ingredients_text_fr || "Ingredients not available",
          imageUrl:    p.image_url || p.image_front_url || undefined,
        };
        setProduct(found);
        setScreen("result");
        setStatus("✅ Product found online!");
        setDebugInfo("Source: Open Beauty Facts");
        await saveToHistory({ type: "barcode", productName: found.name, ingredients: found.ingredients });
        const alreadyLiked = await isFavorite(found.name);
        setLiked(alreadyLiked);
        if (alreadyLiked) {
          const favs = await getFavorites();
          const fav = favs.find((f) => f.productName === found.name);
          if (fav) setFavoriteId(fav.id);
        }
      } else {
        setStatus("⚠️ Product not found. Try again or enter manually.");
        setDebugInfo(`Scanned: ${barcode}`);
        setShowManual(true);
        setScreen("home");
      }
    } catch {
      setStatus("❌ Connection error.");
      setShowManual(true);
      setScreen("home");
    }
  }

  // ── Manual barcode entry ──
  async function handleManualSearch() {
    if (!manualBarcode.trim()) return;
    setShowManual(false);
    setStatus(`🔍 Searching: ${manualBarcode}...`);
    setDebugInfo(`Manual entry: ${manualBarcode}`);
    await fetchProduct(manualBarcode.trim());
  }

  async function handleFavorite() {
    if (!product) return;
    if (liked && favoriteId) {
      await removeFavorite(favoriteId);
      setLiked(false);
      setFavoriteId(null);
    } else {
      await saveFavorite({ type: "barcode", productName: product.name, ingredients: product.ingredients });
      setLiked(true);
      const favs = await getFavorites();
      const fav = favs.find((f) => f.productName === product.name);
      if (fav) setFavoriteId(fav.id);
    }
  }

  function handleReset() {
    stopQuagga();
    setProduct(null);
    setLiked(false);
    setFavoriteId(null);
    setStatus("");
    setDebugInfo("");
    setManualBarcode("");
    setShowManual(false);
    setScreen("home");
  }

  const gradientText: React.CSSProperties = {
    textAlign:             "center",
    fontSize:              "0.82rem",
    marginTop:             "14px",
    cursor:                "pointer",
    background:            "linear-gradient(90deg, #ec4899, #a855f7)",
    WebkitBackgroundClip:  "text",
    WebkitTextFillColor:   "transparent",
    fontStyle:             "italic",
    opacity:               0.85,
    userSelect:            "none",
  };

  const renderIngredients = (ingredientsStr: string) => {
    if (!ingredientsStr || ingredientsStr === "Ingredients not available") {
      return (
        <p style={{ color: "#9ca3af", fontStyle: "italic", fontSize: "0.82rem" }}>
          No ingredients available
        </p>
      );
    }
    return (
      <div className="cosmo-ingredients-display">
        {ingredientsStr
          .split(",")
          .map((ing) => ing.trim())
          .filter(Boolean)
          .map((ing, i) => (
            <span className="cosmo-ing-badge" key={i}>{ing}</span>
          ))}
      </div>
    );
  };

  return (
    <div className="cosmo-page">
      <div className="cosmo-container">
        <header className="cosmo-header">
          <h1>🔍 Scan Barcode</h1>
          <p>Scan a cosmetic product barcode</p>
        </header>

        {/* ── HOME ── */}
        {screen === "home" && (
          <>
            <div className="cosmo-mode-selector">
              <button className="cosmo-mode-btn" onClick={startScanner}>
                📷 Start Scanner
              </button>
            </div>

            {status && <div className="cosmo-status">{status}</div>}

            {/* Manual entry fallback */}
            {showManual && (
              <div style={{
                marginTop:    "20px",
                background:   "rgba(255,255,255,0.6)",
                borderRadius: "16px",
                padding:      "16px",
                border:       "1px solid rgba(168,85,247,0.2)",
              }}>
                <p style={{
                  fontSize:     "0.82rem",
                  color:        "#7e3fa8",
                  fontWeight:   700,
                  marginBottom: "10px",
                }}>
                  Enter barcode manually:
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                    placeholder="e.g. 3600551154961"
                    inputMode="numeric"
                    style={{
                      flex:         1,
                      padding:      "10px 14px",
                      borderRadius: "10px",
                      border:       "1px solid rgba(168,85,247,0.3)",
                      background:   "rgba(255,255,255,0.8)",
                      fontSize:     "0.9rem",
                      color:        "#1a1a1a",
                      outline:      "none",
                      fontFamily:   "monospace",
                    }}
                  />
                  <button
                    onClick={handleManualSearch}
                    style={{
                      background:   "linear-gradient(90deg, #ec4899, #a855f7)",
                      border:       "none",
                      borderRadius: "10px",
                      padding:      "10px 18px",
                      color:        "white",
                      fontWeight:   700,
                      cursor:       "pointer",
                      fontSize:     "0.9rem",
                    }}
                  >
                    Search
                  </button>
                </div>
              </div>
            )}

            {debugInfo && (
              <p style={{
                fontSize:   "0.7rem",
                color:      "#9c6db0",
                textAlign:  "center",
                marginTop:  "8px",
                fontFamily: "monospace",
                opacity:    0.7,
              }}>
                {debugInfo}
              </p>
            )}
          </>
        )}

        {/* ── SCANNING ── */}
        {screen === "scanning" && (
          <>
            <div
              ref={scannerDivRef}
              style={{
                width:        "100%",
                borderRadius: "20px",
                overflow:     "hidden",
                border:       "2px solid rgba(236,72,153,0.4)",
                boxShadow:    "0 8px 30px rgba(168,85,247,0.2)",
                position:     "relative",
                minHeight:    "280px",
                background:   "#000",
              }}
            />

            <div style={{
              position:  "relative",
              textAlign: "center",
              marginTop: "8px",
              fontSize:  "0.78rem",
              color:     "#9c6db0",
            }}>
              Hold the barcode flat and well-lit inside the frame
            </div>

            <div className="cosmo-status">{status}</div>

            {debugInfo && (
              <p style={{
                fontSize:   "0.7rem",
                color:      "#a855f7",
                textAlign:  "center",
                fontFamily: "monospace",
                marginTop:  "4px",
              }}>
                {debugInfo}
              </p>
            )}

            <p onClick={handleReset} style={gradientText}>✦ Cancel</p>
          </>
        )}

        {/* ── RESULT ── */}
        {screen === "result" && product && (
          <>
            <div className="cosmo-status">{status}</div>
            <div style={{
              background:    "rgba(255,255,255,0.55)",
              borderRadius:  "18px",
              padding:       "20px",
              marginTop:     "12px",
              border:        "1px solid rgba(168,85,247,0.2)",
              backdropFilter:"blur(10px)",
            }}>
              {product.imageUrl && (
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    style={{ maxHeight: "160px", objectFit: "contain", borderRadius: "12px" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{
                  background:            "linear-gradient(90deg, #ec4899, #a855f7)",
                  WebkitBackgroundClip:  "text",
                  WebkitTextFillColor:   "transparent",
                  fontWeight:            800,
                  fontSize:              "1.2rem",
                  margin:                0,
                  flex:                  1,
                }}>
                  {product.name}
                </h3>
                <button
                  onClick={handleFavorite}
                  style={{
                    background:  "none",
                    border:      "none",
                    fontSize:    "1.6rem",
                    cursor:      "pointer",
                    outline:     "none",
                    transform:   liked ? "scale(1.2)" : "scale(1)",
                    transition:  "transform 0.2s",
                  }}
                >
                  {liked ? "❤️" : "🤍"}
                </button>
              </div>

              {product.barcode && (
                <p style={{
                  fontSize:   "0.72rem",
                  color:      "#9ca3af",
                  fontFamily: "monospace",
                  marginTop:  "4px",
                }}>
                  Barcode: {product.barcode}
                </p>
              )}

              <p style={{
                fontSize:   "0.82rem",
                color:      "#7e3fa8",
                fontWeight: 700,
                margin:     "14px 0 10px",
              }}>
                Ingredients:
              </p>
              {renderIngredients(product.ingredients)}

              {debugInfo && (
                <p style={{
                  fontSize:   "0.68rem",
                  color:      "#c4b5d4",
                  marginTop:  "12px",
                  fontFamily: "monospace",
                  textAlign:  "right",
                }}>
                  {debugInfo}
                </p>
              )}
            </div>

            <p onClick={handleReset} style={gradientText}>✦ Scan another product</p>
          </>
        )}

      </div>
    </div>
  );
}

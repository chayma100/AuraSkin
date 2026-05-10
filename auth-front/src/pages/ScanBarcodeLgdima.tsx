import { useEffect, useRef, useState } from "react";
import * as Quagga from "@ericblade/quagga2";
import "./CosmoScan.css";
import { saveToHistory } from "../lib/history";
import { saveFavorite, isFavorite, removeFavorite, getFavorites } from "../lib/favorites";
import produitsRaw from "../data/produitss.csv?raw";

interface Product {
  name: string;
  ingredients: string;
}

type Screen = "home" | "scanning" | "result";

export default function ScanBarcode() {
  const [screen, setScreen] = useState<Screen>("home");
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [liked, setLiked] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    return () => { stopQuagga(); };
  }, []);

  function stopQuagga() {
    try {
      Quagga.offDetected();
      Quagga.stop();
    } catch {}
    detectedRef.current = false;
  }

  function searchInLocalDB(barcode: string): Product | null {
    const lines = produitsRaw.split("\n").slice(1);
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === "," && !inQuotes) { cols.push(current.trim()); current = ""; }
        else { current += char; }
      }
      cols.push(current.trim());
      const code = cols[0]?.replace(/"/g, "").trim();
      if (code === barcode) {
        return {
          name: cols[1]?.replace(/"/g, "").trim() || "Nom inconnu",
          ingredients: cols[2]?.replace(/"/g, "").trim() || "Ingrédients non disponibles",
        };
      }
    }
    return null;
  }

  async function startScanner() {
    setScreen("scanning");
    setStatus("Pointez vers le code-barres...");
    detectedRef.current = false;
    await new Promise((r) => setTimeout(r, 500));

    Quagga.init(
      {
        inputStream: {
          name: "Live", type: "LiveStream",
          target: scannerDivRef.current!,
          constraints: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        },
        locator: { patchSize: "medium", halfSample: true },
        numOfWorkers: 2,
        decoder: { readers: ["ean_reader", "ean_8_reader", "code_128_reader", "upc_reader"] },
        locate: true,
      },
      (err) => {
        if (err) { setStatus("❌ Erreur caméra"); setScreen("home"); return; }
        Quagga.start();
        setStatus("📷 Caméra active — pointez vers le code-barres");
      }
    );

    Quagga.onDetected(async (data) => {
      if (detectedRef.current) return;
      const code = data.codeResult.code;
      if (!code) return;
      detectedRef.current = true;
      stopQuagga();
      setStatus(`📦 Code : ${code} — Recherche...`);
      await fetchProduct(code);
    });
  }

  async function fetchProduct(barcode: string) {
    // 1. Cherche dans la base locale
    const local = searchInLocalDB(barcode);
    if (local) {
      setProduct(local);
      setScreen("result");
      setStatus("✅ Produit trouvé !");
      await saveToHistory({ type: "barcode", productName: local.name, ingredients: local.ingredients });
      // Vérifie si déjà en favori (async)
      const alreadyLiked = await isFavorite(local.name);
      setLiked(alreadyLiked);
      if (alreadyLiked) {
        const favs = await getFavorites();
        const fav = favs.find((f) => f.productName === local.name);
        if (fav) setFavoriteId(fav.id);
      }
      return;
    }

    // 2. Sinon cherche sur Open Beauty Facts
    setStatus("🌐 Recherche en ligne...");
    try {
      const res = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const found: Product = {
          name: p.product_name || p.product_name_fr || "Nom inconnu",
          ingredients: p.ingredients_text || p.ingredients_text_fr || "Ingrédients non disponibles",
        };
        setProduct(found);
        setScreen("result");
        setStatus("✅ Produit trouvé !");
        await saveToHistory({ type: "barcode", productName: found.name, ingredients: found.ingredients });
        // Vérifie si déjà en favori (async)
        const alreadyLiked = await isFavorite(found.name);
        setLiked(alreadyLiked);
        if (alreadyLiked) {
          const favs = await getFavorites();
          const fav = favs.find((f) => f.productName === found.name);
          if (fav) setFavoriteId(fav.id);
        }
      } else {
        setStatus("⚠️ Produit non trouvé dans la base.");
        setScreen("home");
      }
    } catch {
      setStatus("❌ Erreur de connexion.");
      setScreen("home");
    }
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
    setScreen("home");
  }

  const gradientText: React.CSSProperties = {
    textAlign: "center", fontSize: "0.82rem", marginTop: "14px", cursor: "pointer",
    background: "linear-gradient(90deg, #ec4899, #a855f7)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    fontStyle: "italic", opacity: 0.85, userSelect: "none",
  };

  return (
    <div className="cosmo-page">
      <div className="cosmo-container">
        <header className="cosmo-header">
          <h1>ScanBarcode</h1>
          <p>Scanner un produit cosmétique</p>
        </header>

        {screen === "home" && (
          <>
            <div className="cosmo-mode-selector">
              <button className="cosmo-mode-btn" onClick={startScanner}>
                📷 Scanner le code-barres
              </button>
            </div>
            {status && <div className="cosmo-status">{status}</div>}
          </>
        )}

        {screen === "scanning" && (
          <>
            <div ref={scannerDivRef} style={{
              width: "100%", borderRadius: "20px", overflow: "hidden",
              border: "2px solid rgba(236,72,153,0.4)",
              boxShadow: "0 8px 30px rgba(168,85,247,0.2)",
              position: "relative", minHeight: "250px", background: "#000",
            }} />
            <div className="cosmo-status">{status}</div>
            <p onClick={handleReset} style={gradientText}>✦ annuler</p>
          </>
        )}

        {screen === "result" && product && (
          <>
            <div className="cosmo-status">{status}</div>
            <div style={{
              background: "rgba(255,255,255,0.55)", borderRadius: "18px",
              padding: "20px", marginTop: "12px",
              border: "1px solid rgba(168,85,247,0.2)", backdropFilter: "blur(10px)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{
                  background: "linear-gradient(90deg, #ec4899, #a855f7)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  fontWeight: 800, fontSize: "1.2rem", margin: 0, flex: 1,
                }}>
                  {product.name}
                </h3>
                <button
                  onClick={handleFavorite}
                  style={{
                    background: "none", border: "none", fontSize: "1.6rem",
                    cursor: "pointer", outline: "none",
                    transform: liked ? "scale(1.2)" : "scale(1)",
                    transition: "transform 0.2s",
                  }}
                  title={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
                >
                  {liked ? "❤️" : "🤍"}
                </button>
              </div>

              <p style={{ fontSize: "0.82rem", color: "#7e3fa8", fontWeight: 700, margin: "14px 0 10px" }}>
                Ingrédients :
              </p>
              <div className="cosmo-ingredients-display">
                {product.ingredients.split(",").map((ing) => ing.trim()).filter(Boolean).map((ing, i) => (
                  <span className="cosmo-ing-badge" key={i}>{ing}</span>
                ))}
              </div>
            </div>

            <p onClick={handleReset} style={gradientText}>✦ scanner un autre produit</p>
          </>
        )}
      </div>
    </div>
  );
}

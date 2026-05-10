import { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import "./CosmoScan.css";
import { saveToHistory } from "../lib/history";
import { saveFavorite, isFavorite, removeFavorite } from "../lib/favorites";

type Mode = "camera" | "upload";

export default function CosmoScan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);

  const [ingredients, setIngredients] = useState<string>("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [liked, setLiked] = useState(false);
  const [status, setStatus] = useState("");
  const [favoriteId, setFavoriteId] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "camera") startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [mode]);

  async function startCamera() {
    setStatus("Initialisation de la caméra...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 } },
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        const overlay = overlayRef.current!;
        overlay.width = video.clientWidth;
        overlay.height = video.clientHeight;
        drawScanArea();
        setCameraReady(true);
        setStatus("Prêt à scanner — cadrez la liste d'ingrédients");
      };
    } catch {
      setStatus("❌ Caméra inaccessible");
    }
  }

  function drawScanArea() {
    if (!overlayRef.current) return;
    const overlay = overlayRef.current;
    const ctx = overlay.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    const w = overlay.width * 0.8;
    const h = overlay.height * 0.3;
    const x = (overlay.width - w) / 2;
    const y = (overlay.height - h) / 2;
    ctx.clearRect(x, y, w, h);
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }

  async function handleCapture() {
    setStatus("Analyse de l'image...");
    const video = videoRef.current!;
    const cropCanvas = cropCanvasRef.current!;
    const ctx = cropCanvas.getContext("2d")!;
    const factor = video.videoWidth / video.clientWidth;
    const w = video.clientWidth * 0.8 * factor;
    const h = video.clientHeight * 0.3 * factor;
    const x = ((video.clientWidth - video.clientWidth * 0.8) / 2) * factor;
    const y = ((video.clientHeight - video.clientHeight * 0.3) / 2) * factor;
    cropCanvas.width = w * 2;
    cropCanvas.height = h * 2;
    ctx.drawImage(video, x, y, w, h, 0, 0, w * 2, h * 2);
    const imageData = ctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const binary = gray > 130 ? 255 : 0;
      data[i] = binary; data[i + 1] = binary; data[i + 2] = binary;
    }
    ctx.putImageData(imageData, 0, 0);
    await processOCR(cropCanvas.toDataURL("image/png"));
  }

  async function processOCR(img: string) {
    try {
      setStatus("OCR en cours... ⏳");
      const worker = await Tesseract.createWorker("fra+eng");
      const { data: { text } } = await worker.recognize(img);
      await worker.terminate();
      const cleaned = text.replace(/[^A-Z, ]/gi, "").trim();
      setIngredients(cleaned);

      // Vérifie si déjà en favori (async)
      const alreadyLiked = await isFavorite("Scan OCR");
      setLiked(alreadyLiked);

      if (cleaned.length > 5) {
        setStatus("✅ Ingrédients détectés !");
        await saveToHistory({ type: "photo", productName: "Scan OCR", ingredients: cleaned });
      } else {
        setStatus("⚠️ Aucun ingrédient détecté, réessayez.");
      }
    } catch {
      setStatus("❌ Erreur OCR");
    }
  }

  async function handleFavorite() {
    if (liked && favoriteId) {
      // Retire des favoris
      await removeFavorite(favoriteId);
      setLiked(false);
      setFavoriteId(null);
    } else {
      // Ajoute aux favoris
      await saveFavorite({ type: "photo", productName: "Scan OCR", ingredients });
      setLiked(true);
      // Récupère l'ID du favori créé
      const { getFavorites } = await import("../lib/favorites");
      const favs = await getFavorites();
      const fav = favs.find((f) => f.productName === "Scan OCR");
      if (fav) setFavoriteId(fav.id);
    }
  }

  function handleReset() {
    setMode(null);
    setIngredients("");
    setLiked(false);
    setFavoriteId(null);
    setCameraReady(false);
    setStatus("");
  }

  return (
    <div className="cosmo-page">
      <div className="cosmo-container">
        <header className="cosmo-header">
          <h1>CosmoScan</h1>
          <p>Analyseur d'ingrédients intelligent</p>
        </header>

        {!mode && (
          <div className="cosmo-mode-selector">
            <button className="cosmo-mode-btn" onClick={() => setMode("camera")}>
              📷 Utiliser la caméra
            </button>
          </div>
        )}

        {mode === "camera" && (
          <div className="cosmo-camera-wrapper">
            <video ref={videoRef} autoPlay playsInline />
            <canvas ref={overlayRef} />
            {cameraReady && (
              <button className="cosmo-capture-btn" onClick={handleCapture}>
                SCANNER LA LISTE
              </button>
            )}
          </div>
        )}

        {mode && (
          <p onClick={handleReset} style={{
            textAlign: "center", fontSize: "0.82rem", marginTop: "14px",
            cursor: "pointer",
            background: "linear-gradient(90deg, #ec4899, #a855f7)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontStyle: "italic", letterSpacing: "0.03em", opacity: 0.85, userSelect: "none",
          }}>
            ✦ changer de mode
          </p>
        )}

        {status && <div className="cosmo-status">{status}</div>}

        {ingredients && (
          <div className="cosmo-results-box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Liste INCI normalisée :</h3>
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
            <div className="cosmo-ingredients-display">
              {ingredients.split(",").map((ing) => ing.trim()).filter(Boolean).map((ing, i) => (
                <span className="cosmo-ing-badge" key={i}>{ing}</span>
              ))}
            </div>
          </div>
        )}

        <canvas ref={cropCanvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}

"""
CosmoScan — Backend Python (FastAPI)
=====================================
Pipeline : Image → OCR (EasyOCR) → NER (SciBERT) → Fuzzy Correction → Scoring
VERSION 2.2 : Fix 422 content_type + preprocessing amélioré + fallbacks robustes
"""

import cv2
import numpy as np
import re
import torch
import pandas as pd
from rapidfuzz import process, fuzz
from transformers import (
    AutoTokenizer,
    AutoModelForTokenClassification,
    AutoModelForSequenceClassification,
)
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import easyocr

# ============================================================
# 1. CONFIGURATION
# ============================================================

NER_MODEL_PATH = "./modele_ner_scibert"
CLF_MODEL_PATH = "./modele_cosmetiques"
DATASET_PATH   = "./dataset_v2_clean.csv"
MAPPING_PATH   = "./mapping_combine_final.csv"

MAX_LEN            = 256
DEVICE             = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CLF_THRESHOLDS     = [0.4, 0.55, 0.35, 0.55]
OCR_CONF_THRESHOLD = 0.1   # ✅ abaissé : accepte plus de mots sur fonds texturés

# ============================================================
# 2. CHARGEMENT DES MODÈLES ET DICTIONNAIRES
# ============================================================

print("⏳ Chargement des modèles...")

ocr_reader = easyocr.Reader(
    ['fr', 'en'],
    gpu=torch.cuda.is_available(),
    detect_network='craft',
    recog_network='standard',
    verbose=False,
)
print("✅ EasyOCR chargé")

try:
    ner_tokenizer = AutoTokenizer.from_pretrained(NER_MODEL_PATH)
    ner_model     = AutoModelForTokenClassification.from_pretrained(NER_MODEL_PATH).to(DEVICE)
    id2label      = ner_model.config.id2label
    ner_model.eval()
    print("✅ NER SciBERT chargé")
except Exception as e:
    print(f"❌ NER : {e}")
    ner_model = None

try:
    clf_tokenizer = AutoTokenizer.from_pretrained(CLF_MODEL_PATH)
    clf_model     = AutoModelForSequenceClassification.from_pretrained(CLF_MODEL_PATH).to(DEVICE)
    clf_model.eval()
    print("✅ Classification DistilBERT chargé")
except Exception as e:
    print(f"⚠️  Classification non disponible : {e}")
    clf_model = None

try:
    df_dataset = pd.read_csv(DATASET_PATH)
    df_dataset["ingredient_canonical"] = (
        df_dataset["ingredient_canonical"]
        .str.upper().str.strip().str.replace("_", " ", regex=False)
    )
    print(f"✅ Dataset chargé ({len(df_dataset)} ingrédients)")
except Exception as e:
    print(f"❌ Dataset : {e}")
    df_dataset = pd.DataFrame()

try:
    df_mapping = pd.read_csv(MAPPING_PATH)
    df_mapping['ingredient_clean']     = df_mapping['ingredient_clean'].astype(str).str.lower().str.strip()
    df_mapping['ingredient_canonical'] = df_mapping['ingredient_canonical'].astype(str).str.upper().str.strip()

    INVALID_CANONICAL = {"NO", "NOO", "ELIMINATED", "A ELIMINER", "NAN", ""}
    df_mapping = df_mapping[~df_mapping['ingredient_canonical'].isin(INVALID_CANONICAL)]

    SYNONYM_DICT     = dict(zip(df_mapping['ingredient_clean'], df_mapping['ingredient_canonical']))
    CLEAN_NAMES_LIST = list(SYNONYM_DICT.keys())
    print(f"✅ Dictionnaire Fuzzy chargé ({len(SYNONYM_DICT)} entrées)\n")
except Exception as e:
    print(f"⚠️  Mapping : {e}")
    SYNONYM_DICT     = {}
    CLEAN_NAMES_LIST = []

# ============================================================
# 3. APPLICATION FASTAPI
# ============================================================

app = FastAPI(title="CosmoScan API", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 4. OCR — PREPROCESSING (VERSION CORRIGÉE)
# ============================================================

def correct_rotation(img: np.ndarray) -> np.ndarray:
    """Corrige l'inclinaison UNIQUEMENT si angle significatif et fiable."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Utiliser Canny pour détecter les bords du texte, pas le fond
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100,
                             minLineLength=100, maxLineGap=10)
    if lines is None or len(lines) < 5:
        return img  # Pas assez de lignes → ne pas tourner
    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x2 != x1:
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            if abs(angle) < 30:  # ignorer les lignes verticales
                angles.append(angle)
    if not angles:
        return img
    median_angle = np.median(angles)
    if abs(median_angle) < 1.0:
        return img  # angle négligeable
    (h, w) = img.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), median_angle, 1.0)
    return cv2.warpAffine(img, M, (w, h),
                          flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_REPLICATE)


def preprocess_gentle(img: np.ndarray) -> np.ndarray:
    """
    Preprocessing doux : resize + CLAHE léger uniquement.
    Préserve les niveaux de gris → meilleur pour EasyOCR sur fonds texturés.
    """
    h, w = img.shape[:2]
    max_side = max(h, w)
    if max_side > 1600:
        scale = 1600 / max_side
        img = cv2.resize(img, None, fx=scale, fy=scale,
                         interpolation=cv2.INTER_AREA)
    elif max_side < 800:
        img = cv2.resize(img, None, fx=2.0, fy=2.0,
                         interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # CLAHE très léger — juste pour améliorer le contraste local
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    # Léger flou pour réduire le bruit du fond kraft
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    return gray


def preprocess_strong(img: np.ndarray) -> np.ndarray:
    """
    Preprocessing fort : uniquement pour images très sombres ou floues.
    À utiliser EN DERNIER car détruit les images normales.
    """
    h, w = img.shape[:2]
    max_side = max(h, w)
    if max_side > 1600:
        scale = 1600 / max_side
        img = cv2.resize(img, None, fx=scale, fy=scale,
                         interpolation=cv2.INTER_AREA)
    elif max_side < 800:
        img = cv2.resize(img, None, fx=2.0, fy=2.0,
                         interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    gray = cv2.fastNlMeansDenoising(gray, h=10,
                                     templateWindowSize=7,
                                     searchWindowSize=21)
    # Binarisation DOUCE (pas adaptative) — moins agressive
    _, gray = cv2.threshold(gray, 0, 255,
                             cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return gray


def _run_easyocr(img: np.ndarray,
                 paragraph: bool = True) -> tuple[list[str], list[float]]:
    """Lance EasyOCR et retourne textes + confiances filtrés."""
    results = ocr_reader.readtext(
        img, width_ths=0.8, batch_size=8, paragraph=paragraph
    )
    results = sorted(results, key=lambda x: x[0][0][1])
    texts, confs = [], []
    for item in results:
        if len(item) == 3:
            _, text, conf = item
        elif len(item) == 2:
            _, text = item
            conf = 1.0
        else:
            continue
        if conf > OCR_CONF_THRESHOLD and text.strip():
            texts.append(text.strip())
            confs.append(conf)
    return texts, confs
def _extract_inci_section(text: str) -> str:
    """Extrait la section ingrédients depuis le texte brut OCR."""
    patterns = [
        r'ingr[ée]dients?\s*[:\-]?\s*',
        r'ingredientes\s*[:\-]?\s*',
        r'zusammensetzung\s*[:\-]?\s*',
        r'inci\s*[:\-]?\s*',
        r'composition\s*[:\-]?\s*',
        r'contains?\s*[:\-]?\s*',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return text[match.end():].strip()

    # Fallback : lignes avec virgules
    lines = text.split("\n")
    candidates = [l for l in lines if len(l) > 10 and ("," in l or ";" in l)]
    if candidates:
        return " ".join(candidates)

    return text.strip()


def run_ocr(image_bytes: bytes) -> dict:
    """
    OCR avec 3 tentatives dans le bon ordre :
    1. Image brute (couleur) — meilleure pour EasyOCR sur fond texturé
    2. Preprocessing doux (niveaux de gris + CLAHE léger)
    3. Preprocessing fort (OTSU) — dernier recours images très dégradées
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError("Image illisible — format non supporté")

    # Resize si nécessaire (sans changer le format couleur)
    h, w = img_bgr.shape[:2]
    max_side = max(h, w)
    if max_side > 1600:
        scale = 1600 / max_side
        img_bgr = cv2.resize(img_bgr, None, fx=scale, fy=scale,
                              interpolation=cv2.INTER_AREA)
    elif max_side < 800:
        img_bgr = cv2.resize(img_bgr, None, fx=2.0, fy=2.0,
                              interpolation=cv2.INTER_CUBIC)

    # Correction de rotation (version fiable)
    img_rot = correct_rotation(img_bgr)

    best_texts, best_confs = [], []

    # ── Tentative 1 : image couleur brute (PRIORITÉ) ──────────────
    print("🔍 OCR T1 : image couleur brute...")
    t1, c1 = _run_easyocr(img_rot, paragraph=True)
    print(f"   → {len(t1)} segments | texte: {' '.join(t1)[:100]}")
    if len(t1) >= 2:
        best_texts, best_confs = t1, c1

    # ── Tentative 2 : preprocessing doux ──────────────────────────
    if len(best_texts) < 2:
        print("⚠️ T1 insuffisant → preprocessing doux")
        t2, c2 = _run_easyocr(preprocess_gentle(img_rot), paragraph=True)
        print(f"   → {len(t2)} segments | texte: {' '.join(t2)[:100]}")
        if len(t2) > len(best_texts):
            best_texts, best_confs = t2, c2

    # ── Tentative 3 : preprocessing fort (dernier recours) ────────
    if len(best_texts) < 2:
        print("⚠️ T2 insuffisant → preprocessing fort (OTSU)")
        t3, c3 = _run_easyocr(preprocess_strong(img_rot), paragraph=False)
        print(f"   → {len(t3)} segments | texte: {' '.join(t3)[:100]}")
        if len(t3) > len(best_texts):
            best_texts, best_confs = t3, c3

    full_text = "\n".join(best_texts)
    avg_conf = float(np.mean(best_confs)) if best_confs else 0.0
    inci_text = _extract_inci_section(full_text)

    print(f"📄 OCR final : {len(best_texts)} segments | conf={avg_conf:.2f}")
    print(f"📄 Texte : {full_text[:300]}")

    return {
        "full_text":    full_text,
        "inci_text":    inci_text,
        "avg_conf":     round(avg_conf, 4),
        "conf_warning": avg_conf < 0.65,
    }
# ============================================================
# 5. NER
# ============================================================

def _comma_split_fallback(text: str) -> list[str]:
    """Fallback : split par virgule/point-virgule si NER échoue."""
    parts = re.split(r"[,;\n\t\.•]|(?:\s{2,})", text)
    BLACKLIST = {
        "INGREDIENTS", "INGREDIENTES", "CONTAINS", "INCI",
        "CONTIENT", "COMPOSITION", "FR", "EN", "EU", "WITH", "AND",
    }
    result = []
    for p in parts:
        clean = re.sub(r"[^a-zA-Z0-9\s\-/]", "", p).strip().upper()
        if len(clean) > 2 and clean not in BLACKLIST:
            result.append(clean)
    return list(dict.fromkeys(result))


def run_ner(ocr_text: str) -> list[str]:
    """Extraction NER SciBERT avec fallback comma-split automatique."""
    if ner_model is None:
        return _comma_split_fallback(ocr_text)

    text = re.sub(r"\([^)]{0,40}\)", " ", ocr_text)
    text = re.sub(r"[Ii]ngredients?\s*[:\-]?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"[•†‡*_+«»><|]", " , ", text)
    text = re.sub(r"\n", " , ", text)
    text = re.sub(r"([,;])", r" \1 ", text)
    text = re.sub(r"\s+", " ", text).strip()

    words = text.split()
    if not words:
        return []

    all_ingredients = []
    for chunk in [words[i:i + 200] for i in range(0, len(words), 200)]:
        inputs = ner_tokenizer(
            chunk, is_split_into_words=True,
            return_tensors="pt", truncation=True, padding=True, max_length=MAX_LEN,
        )
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        with torch.no_grad():
            preds = torch.argmax(ner_model(**inputs).logits, dim=2)[0]

        encoding  = ner_tokenizer(chunk, is_split_into_words=True, truncation=True, max_length=MAX_LEN)
        word_ids  = encoding.word_ids()
        current, prev_word = [], None

        for idx, word_id in enumerate(word_ids):
            if word_id is None or word_id == prev_word:
                continue
            label = id2label[preds[idx].item()]
            word  = chunk[word_id]
            if label == "B-ING":
                if current:
                    all_ingredients.append(" ".join(current))
                current = [word]
            elif label == "I-ING":
                current.append(word)
            else:
                if current:
                    all_ingredients.append(" ".join(current))
                    current = []
            prev_word = word_id
        if current:
            all_ingredients.append(" ".join(current))

    BLACKLIST = {"INGREDIENTS", "INGREDIENTES", "ENRICHI", "CONTIENT", "WITH", "AND", "CONTAINS", "INCI", "FR", "EU"}
    result = []
    for ing in all_ingredients:
        clean = re.sub(r"[^a-zA-Z0-9\s\-/]", "", ing).strip().upper()
        if len(clean) > 2 and clean not in BLACKLIST:
            result.append(clean)
    result = list(dict.fromkeys(result))

    if not result:
        print("⚠️ NER : 0 résultat → fallback comma-split")
        result = _comma_split_fallback(ocr_text)

    return result

# ============================================================
# 6. FUZZY CORRECTION
# ============================================================

def fuzzy_correct_ingredients(raw_ingredients: list[str], threshold: int = 80) -> list[dict]:
    """Correction floue des noms d'ingrédients via dictionnaire de mapping."""
    if not SYNONYM_DICT:
        return [{"raw_ner": ing, "canonical": ing, "match_score": 0, "corrected": False} for ing in raw_ingredients]

    corrected_list = []
    for raw in raw_ingredients:
        raw_lower = raw.lower().strip()
        if raw_lower in SYNONYM_DICT:
            canonical = SYNONYM_DICT[raw_lower]
            corrected_list.append({"raw_ner": raw, "canonical": canonical, "match_score": 100, "corrected": canonical.upper() != raw.upper()})
            continue
        match_result = process.extractOne(raw_lower, CLEAN_NAMES_LIST, scorer=fuzz.token_sort_ratio)
        if match_result and match_result[1] >= threshold:
            canonical = SYNONYM_DICT[match_result[0]]
            corrected_list.append({"raw_ner": raw, "canonical": canonical, "match_score": match_result[1], "corrected": canonical.upper() != raw.upper()})
        else:
            corrected_list.append({"raw_ner": raw, "canonical": raw.upper(), "match_score": match_result[1] if match_result else 0, "corrected": False})

    return corrected_list

# ============================================================
# 7. SCORING
# ============================================================

def classify_with_distilbert(name: str) -> dict:
    """Classification dangerosité via DistilBERT fine-tuné."""
    if clf_model is None:
        return {"Final_Score": 1, "Danger_Level": "LOW", "source": "default"}
    try:
        enc = clf_tokenizer(name, return_tensors="pt", truncation=True, padding=True, max_length=64).to(DEVICE)
        with torch.no_grad():
            logits = clf_model(**enc).logits[0]
            if len(logits) >= 4:
                probs      = torch.sigmoid(logits).cpu().numpy()
                flags      = [int(p > t) for p, t in zip(probs, CLF_THRESHOLDS)]
                score_brut = flags[0] * 8 + flags[2] * 8 + flags[1] * 4 + flags[3] * 4
                if score_brut >= 16:   final, danger = 8, "HIGH"
                elif score_brut >= 8:  final, danger = 6, "MODERATE"
                elif score_brut >= 4:  final, danger = 4, "MODERATE"
                else:                  final, danger = 2, "LOW"
            else:
                probs         = torch.softmax(logits, dim=0)
                predicted_idx = torch.argmax(probs).item()
                danger        = clf_model.config.id2label.get(predicted_idx, "LOW").upper()
                if "LABEL" in danger:
                    danger = {0: "LOW", 1: "MODERATE", 2: "HIGH"}.get(predicted_idx, "LOW")
                final = {"HIGH": 8, "MODERATE": 5}.get(danger, 2)
        return {"Final_Score": final, "Danger_Level": danger, "source": "model"}
    except Exception as e:
        print(f"⚠️ Erreur IA sur '{name}' : {e}")
        return {"Final_Score": 1, "Danger_Level": "LOW", "source": "error"}


def build_descriptions(row) -> list[str]:
    descs = []
    for col, label in [("Cancer", "Cancer"), ("Allergies", "Allergies"),
                        ("Toxicite_Reproduction", "Toxicité reproductive"),
                        ("Restrictions_Usage", "Restrictions d'usage")]:
        val = str(row.get(col, "LOW")).upper()
        if val in ("MODERATE", "HIGH"):
            descs.append(f"{val} — {label}")
    return descs


def score_one_ingredient(fuzzy_item: dict) -> dict:
    """Score un ingrédient : dataset en priorité, sinon modèle NLP."""
    canonical = fuzzy_item["canonical"]
    if not df_dataset.empty:
        row = df_dataset[df_dataset["ingredient_canonical"] == canonical]
        if not row.empty:
            r = row.iloc[0]
            return {
                "name": canonical, "raw_ner": fuzzy_item["raw_ner"],
                "match_score": fuzzy_item["match_score"], "corrected": fuzzy_item["corrected"],
                "score": int(r.get("Final_Score", 1)), "danger": str(r.get("Danger_Level", "LOW")),
                "source": "database", "description": build_descriptions(r),
            }
    clf = classify_with_distilbert(canonical)
    return {
        "name": canonical, "raw_ner": fuzzy_item["raw_ner"],
        "match_score": fuzzy_item["match_score"], "corrected": fuzzy_item["corrected"],
        "score": clf["Final_Score"], "danger": clf["Danger_Level"],
        "source": clf["source"], "description": [],
    }


def compute_global_score(ingredients: list[dict]) -> tuple[float, str]:
    if not ingredients:
        return 1.0, "LOW"
    scores  = [i["score"] for i in ingredients]
    global_ = round(sum(scores) / len(scores) * 0.6 + max(scores) * 0.4, 1)
    if global_ >= 7:   return global_, "HIGH"
    elif global_ >= 4: return global_, "MODERATE"
    return global_, "LOW"

# ============================================================
# 8. ENDPOINTS
# ============================================================

@app.get("/health")
def health():
    return {
        "status" : "ok",
        "device" : str(DEVICE),
        "dataset": len(df_dataset) if not df_dataset.empty else 0,
        "mapping": len(SYNONYM_DICT),
    }


@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    """
    ✅ FIX 422 : validation content_type assouplie.
    Accepte image/*, application/octet-stream, et None (cas React FormData).
    """
    # ✅ CORRIGÉ : ne rejette que si c'est clairement pas une image
    ct = file.content_type or ""
    if ct and not ct.startswith("image/") and ct not in ("application/octet-stream", ""):
        raise HTTPException(400, f"Type de fichier non supporté : {ct}")

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(400, "Fichier vide reçu")

    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image trop lourde (max 10 MB)")

    # OCR
    try:
        ocr_result = run_ocr(image_bytes)
    except ValueError as e:
        raise HTTPException(422, f"Erreur OCR : {e}")

    # NER
    raw_ingredients = run_ner(ocr_result["inci_text"])

    # Fallback si NER insuffisant
    if not raw_ingredients or len(raw_ingredients) < 2:
        print("⚠️ NER insuffisant → fallback texte complet")
        raw_ingredients = _comma_split_fallback(ocr_result["full_text"])

    # Réponse debug si toujours vide
    if not raw_ingredients:
        return {
            "ocr_text"           : ocr_result["full_text"],
            "inci_section"       : ocr_result["inci_text"],
            "avg_confidence"     : ocr_result["avg_conf"],
            "conf_warning"       : True,
            "ingredients"        : [],
            "ingredients_raw"    : [],
            "corrections_applied": [],
            "count"              : 0,
            "debug"              : "OCR n'a pas pu extraire de texte. Essayez une image plus nette.",
        }

    # Fuzzy correction
    corrected = fuzzy_correct_ingredients(raw_ingredients)
    valid     = [i for i in corrected if i["canonical"] not in {"", "NAN"}]

    return {
        "ocr_text"           : ocr_result["full_text"],
        "inci_section"       : ocr_result["inci_text"],
        "avg_confidence"     : ocr_result["avg_conf"],
        "conf_warning"       : ocr_result["conf_warning"],
        "ingredients"        : [i["canonical"] for i in valid],
        "ingredients_raw"    : raw_ingredients,
        "corrections_applied": [
            {"from": i["raw_ner"], "to": i["canonical"], "score": i["match_score"]}
            for i in valid if i["corrected"]
        ],
        "count": len(valid),
    }


class IngredientsPayload(BaseModel):
    ingredients: list[str]


@app.post("/analyze/ingredients")
def analyze_ingredients(payload: IngredientsPayload):
    if not payload.ingredients:
        raise HTTPException(400, "Liste vide")

    corrected = fuzzy_correct_ingredients(payload.ingredients)
    scored    = [score_one_ingredient(item) for item in corrected]

    global_score, danger_produit = compute_global_score(scored)

    return {
        "score_global"   : global_score,
        "danger_produit" : danger_produit,
        "nb_ingredients" : len(scored),
        "high_risk"      : [i["name"] for i in scored if i["danger"] == "HIGH"],
        "moderate_risk"  : [i["name"] for i in scored if i["danger"] == "MODERATE"],
        "stats": {
            "from_database": sum(1 for i in scored if i["source"] == "database"),
            "from_model"   : sum(1 for i in scored if i["source"] == "model"),
            "corrected"    : sum(1 for i in scored if i["corrected"]),
        },
        "ingredients": scored,
    }


class TextPayload(BaseModel):
    text: str


@app.post("/analyze/text")
def analyze_text(payload: TextPayload):
    if not payload.text.strip():
        raise HTTPException(400, "Texte vide")
    raw = run_ner(payload.text)
    if not raw:
        raise HTTPException(422, "Aucun ingrédient détecté")
    corrected = fuzzy_correct_ingredients(raw)
    return analyze_ingredients(IngredientsPayload(ingredients=[i["canonical"] for i in corrected]))
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

# ============================================================
# 9. SKIN ANALYSIS — ResNet Vision Model
# ============================================================

import torchvision.models as tv_models
import torchvision.transforms as T
from PIL import Image
import io as _io

SKIN_MODEL   = None
SKIN_CLASSES = ['dry', 'normal', 'oily']
SKIN_MODEL_PATH = "./best_skin_model_entire.pth"

try:
    _skin_ckpt = torch.load(SKIN_MODEL_PATH, map_location=DEVICE, weights_only=False)

    # Modèle sauvegardé directement (pas de dict)
    if isinstance(_skin_ckpt, torch.nn.Module):
        SKIN_MODEL = _skin_ckpt.to(DEVICE).eval()
        # Détecter le nombre de classes depuis la dernière couche
        _last = list(SKIN_MODEL.children())[-1]
        _n    = _last.out_features if hasattr(_last, 'out_features') else 3
        if _n == 3:
            SKIN_CLASSES = ['dry', 'normal', 'oily']
        elif _n == 2:
            SKIN_CLASSES = ['dry', 'oily']
        else:
            SKIN_CLASSES = [f'class_{i}' for i in range(_n)]

    # Modèle sauvegardé sous forme de dict
    elif isinstance(_skin_ckpt, dict):
        SKIN_CLASSES = _skin_ckpt.get('class_names', ['dry', 'normal', 'oily'])
        _n           = len(SKIN_CLASSES)
        # Détecter architecture : ResNet ou EfficientNet
        if any('layer' in k for k in _skin_ckpt.get('model_state_dict', {}).keys()):
            # ResNet
            _net = tv_models.resnet50(weights=None)
            _net.fc = torch.nn.Linear(_net.fc.in_features, _n)
        else:
            # EfficientNet
            _net = tv_models.efficientnet_b0(weights=None)
            _net.classifier = torch.nn.Sequential(
                torch.nn.Dropout(0.4),
                torch.nn.Linear(1280, 256),
                torch.nn.ReLU(),
                torch.nn.Dropout(0.2),
                torch.nn.Linear(256, _n)
            )
        _net.load_state_dict(_skin_ckpt['model_state_dict'])
        SKIN_MODEL = _net.to(DEVICE).eval()

    print(f"✅ Skin classifier chargé | classes: {SKIN_CLASSES}")
except Exception as e:
    print(f"⚠️  Skin classifier non disponible : {e}")
    SKIN_MODEL = None

# Recommandations dataset
COSMETICS_PATH = "./cosmetics.csv"
df_cosmetics   = pd.DataFrame()

try:
    df_cosmetics = pd.read_csv(COSMETICS_PATH)
    # Normaliser la colonne Label
    df_cosmetics['Label'] = df_cosmetics['Label'].str.strip()
    print(f"✅ Cosmetics dataset chargé ({len(df_cosmetics)} produits)")
    print(f"   Types : {df_cosmetics['Label'].unique().tolist()}")
except Exception as e:
    print(f"⚠️  Cosmetics dataset non disponible : {e}")


def _skin_transform(image_bytes: bytes):
    """Transforme les bytes d'image en tensor normalisé pour le skin model."""
    img = Image.open(_io.BytesIO(image_bytes)).convert('RGB')
    transform = T.Compose([
        T.Resize((224, 224)),
        T.ToTensor(),
        T.Normalize([0.485, 0.456, 0.406],
                    [0.229, 0.224, 0.225])
    ])
    return transform(img).unsqueeze(0), img


@app.post("/analyze/skin")
async def analyze_skin(file: UploadFile = File(...)):
    """
    Analyse le type de peau depuis une photo de visage.
    Retourne : skin_type (dry/normal/oily), confidence, profil complet.
    """
    if SKIN_MODEL is None:
        raise HTTPException(503, "Skin classifier non disponible — vérifiez best_skin_model_entire.pth")

    ct = file.content_type or ""
    if ct and not ct.startswith("image/") and ct not in ("application/octet-stream", ""):
        raise HTTPException(400, f"Type non supporté : {ct}")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(400, "Fichier vide")
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image trop lourde (max 10 MB)")

    try:
        tensor, _ = _skin_transform(image_bytes)
        tensor    = tensor.to(DEVICE)

        with torch.no_grad():
            probs = torch.softmax(SKIN_MODEL(tensor), dim=1)[0].cpu()

        pred_idx   = probs.argmax().item()
        skin_type  = SKIN_CLASSES[pred_idx]
        confidence = float(probs[pred_idx])

        print(f"🔬 Skin analysis : {skin_type} ({confidence:.1%})")

        return {
            "skin_type":    skin_type,
            "confidence":   round(confidence, 4),
            "skin_profile": {
                cls: round(float(p), 4)
                for cls, p in zip(SKIN_CLASSES, probs)
            },
            "recommendation_tip": {
                "dry":    "Privilégiez des crèmes riches en hydratants (glycérine, acide hyaluronique).",
                "oily":   "Optez pour des formules légères, non comédogènes et sans huiles minérales.",
                "normal": "Votre peau est équilibrée — maintenez une routine simple et douce.",
            }.get(skin_type, "Consultez un dermatologue pour une routine personnalisée.")
        }

    except Exception as e:
        print(f"❌ Erreur skin analysis : {e}")
        raise HTTPException(500, f"Erreur analyse peau : {str(e)}")


# ============================================================
# 10. RECOMMANDATION PRODUITS
# ============================================================

# Mapping skin_type ResNet → colonne cosmetics.csv
SKIN_TO_COL = {
    "dry":    "Dry",
    "oily":   "Oily",
    "normal": "Normal",
}

# Types de produits disponibles dans le dataset
PRODUCT_TYPES = ["Moisturizer", "Cleanser", "Treatment", "Face Mask",
                  "Eye cream", "Sun protect"]


class RecommendPayload(BaseModel):
    skin_type:    str
    product_type: str
    top_n:        int = 3    # nombre de recommandations (max 5)
    max_price:    float = 999.0  # filtre budget optionnel


@app.post("/recommend")
def recommend_products(payload: RecommendPayload):
    """
    Recommande des produits cosmétiques selon :
    - Le type de peau (issu de /analyze/skin ou choisi manuellement)
    - Le type de produit voulu (Cleanser, Moisturizer...)
    - Un budget maximum optionnel
    
    Chaque produit est enrichi avec un score de sécurité calculé
    par le pipeline NLP existant (fuzzy + scoring).
    """
    if df_cosmetics.empty:
        raise HTTPException(503, "Dataset cosmétiques non disponible")

    # Valider skin_type
    skin_col = SKIN_TO_COL.get(payload.skin_type.lower())
    if skin_col is None:
        raise HTTPException(400,
            f"skin_type invalide : '{payload.skin_type}'. "
            f"Valeurs acceptées : {list(SKIN_TO_COL.keys())}"
        )

    # Valider product_type
    ptype_match = next(
        (p for p in PRODUCT_TYPES
         if p.lower() == payload.product_type.lower()),
        None
    )
    if ptype_match is None:
        raise HTTPException(400,
            f"product_type invalide : '{payload.product_type}'. "
            f"Valeurs acceptées : {PRODUCT_TYPES}"
        )

    top_n = min(max(payload.top_n, 1), 5)

    # ── Filtrage ─────────────────────────────────────────────
    filtered = df_cosmetics[
        (df_cosmetics[skin_col] == 1) &
        (df_cosmetics['Label'] == ptype_match) &
        (df_cosmetics['Price'] <= payload.max_price)
    ].copy()

    if filtered.empty:
        raise HTTPException(404,
            f"Aucun produit trouvé pour peau '{payload.skin_type}' "
            f"et type '{ptype_match}' (budget ≤ {payload.max_price}$)"
        )

    # Trier par Rank décroissant (meilleure note en premier)
    filtered = filtered.sort_values('Rank', ascending=False).head(20)

    # ── Scoring sécurité pour chaque produit ─────────────────
    results = []
    for _, row in filtered.iterrows():
        # Extraire les 15 premiers ingrédients
        raw_ings = [i.strip() for i in str(row['Ingredients']).split(',')][:15]
        raw_ings = [i for i in raw_ings if len(i) > 2]

        # Pipeline existant : fuzzy correction + scoring NLP
        try:
            corrected = fuzzy_correct_ingredients(raw_ings)
            scored    = [score_one_ingredient(item) for item in corrected]
            g_score, danger = compute_global_score(scored)
        except Exception:
            g_score, danger = 2.0, "LOW"
            scored = []

        high_risk = [s["name"] for s in scored if s["danger"] == "HIGH"][:3]
        mod_risk  = [s["name"] for s in scored if s["danger"] == "MODERATE"][:3]

        results.append({
            "name":             row['Name'],
            "brand":            row['Brand'],
            "price":            float(row['Price']),
            "rank":             float(row['Rank']),
            "safety_score":     round(g_score, 1),
            "danger_level":     danger,
            "ingredients_preview": raw_ings[:5],
            "high_risk_ingredients":    high_risk,
            "moderate_risk_ingredients": mod_risk,
        })

    # ── Re-tri final : sécurité d'abord, puis rank ───────────
    danger_order = {"LOW": 0, "MODERATE": 1, "HIGH": 2}
    results.sort(key=lambda x: (
        danger_order.get(x['danger_level'], 1),
        -x['rank']
    ))

    return {
        "skin_type":       payload.skin_type,
        "product_type":    ptype_match,
        "total_found":     len(results),
        "recommendations": results[:top_n],
        "available_types": PRODUCT_TYPES,
    }


@app.get("/recommend/types")
def get_product_types():
    """Retourne les types de produits et skin types disponibles."""
    return {
        "product_types": PRODUCT_TYPES,
        "skin_types":    list(SKIN_TO_COL.keys()),
    }

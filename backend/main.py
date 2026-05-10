"""
AuraSkin — Backend FastAPI Unifié (Merge Final)
================================================
Fusion de :
  - Backend DB  (auth email/OTP/OAuth, historique, favoris, routine,
                 discussions, skin log, shelf)
  - Backend ML  (OCR, NER SciBERT, fuzzy, scoring, skin analysis,
                 recommandations)
"""

# ============================================================
# IMPORTS
# ============================================================

import cv2
import numpy as np
import re
import torch
import pandas as pd
import os
import random
import time
import smtplib
import io as _io
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from rapidfuzz import process, fuzz
from transformers import (
    AutoTokenizer,
    AutoModelForTokenClassification,
    AutoModelForSequenceClassification,
)
import torchvision.models as tv_models
import torchvision.transforms as T
from PIL import Image
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
from twilio.rest import Client as TwilioClient
import httpx

# ============================================================
# CONFIGURATION GÉNÉRALE
# ============================================================

load_dotenv()
print("🔍 DATABASE_URL =", os.getenv("DATABASE_URL"))

# ── Chemins ML ──
NER_MODEL_PATH  = "./modele_ner_scibert"
CLF_MODEL_PATH  = "./modele_cosmetiques"
DATASET_PATH    = "./dataset_v2_clean.csv"
MAPPING_PATH    = "./mapping_combine_final.csv"
SKIN_MODEL_PATH = "./best_skin_model_entire.pth"
COSMETICS_PATH  = "./cosmetics.csv"

MAX_LEN            = 256
DEVICE             = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CLF_THRESHOLDS     = [0.4, 0.55, 0.35, 0.55]
OCR_CONF_THRESHOLD = 0.1

# ── OAuth Config ──
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GITHUB_CLIENT_ID     = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL          = os.getenv("BACKEND_URL", "http://localhost:8083")

# ============================================================
# APPLICATION FASTAPI
# ============================================================

app = FastAPI(title="AuraSkin API", version="2.0.0")

@app.get("/favicon.ico")
async def favicon():
    return FileResponse("favicon.ico")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# BASE DE DONNÉES
# ============================================================

def get_db():
    try:
        conn = psycopg2.connect(
            os.getenv("DATABASE_URL"),
            cursor_factory=psycopg2.extras.RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"❌ Erreur connexion DB : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur connexion DB : {str(e)}")

# ============================================================
# OTP STORE (en mémoire)
# ============================================================

otp_store: dict[str, dict] = {}

# ============================================================
# TWILIO
# ============================================================

twilio_client = TwilioClient(
    os.getenv("TWILIO_ACCOUNT_SID"),
    os.getenv("TWILIO_AUTH_TOKEN")
)

# ============================================================
# EMAIL
# ============================================================

def send_welcome_email(to_email: str, name: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Bienvenue sur AuraSkin ! 🌸"
        msg["From"]    = f"AuraSkin 🌸 <{os.getenv('EMAIL_USER')}>"
        msg["To"]      = to_email

        html_content = f"""
<div style="margin:0;padding:0;background-color:#f9f9f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f9f9f9;">
    <tr>
      <td align="center" style="padding:20px 0;">
        <div style="max-width:500px;background:linear-gradient(180deg,#fce4ec 0%,#f3e5f5 100%);border-radius:25px;padding:40px 20px;text-align:center;box-shadow:0 10px 20px rgba(0,0,0,0.05);">
          <div style="margin-bottom:20px;">
            <span style="font-size:40px;vertical-align:middle;">🌸</span>
            <h1 style="display:inline-block;color:#d81b60;font-size:42px;font-weight:bold;margin:0;vertical-align:middle;letter-spacing:-1px;">AuraSkin</h1>
          </div>
          <h2 style="color:#6a1b9a;font-size:28px;margin-bottom:30px;font-weight:bold;">
            Bienvenue, {name} !
          </h2>
          <div style="color:#4e342e;font-size:18px;line-height:1.6;margin-bottom:20px;">
            <p style="margin:10px 0;">Analysez vos cosmétiques et découvrez votre routine personnalisée.</p>
          </div>
        </div>
        <p style="color:#9e9e9e;font-size:12px;margin-top:20px;">© 2026 AuraSkin 🌸</p>
      </td>
    </tr>
  </table>
</div>
"""
        msg.attach(MIMEText(html_content, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(os.getenv("EMAIL_USER"), os.getenv("EMAIL_PASS"))
            server.sendmail(os.getenv("EMAIL_USER"), to_email, msg.as_string())
        print(f"✅ Email envoyé à {to_email}")
    except Exception as e:
        print(f"❌ Erreur envoi email : {e}")

# ============================================================
# HELPER — upsert OAuth user
# ============================================================

def upsert_oauth_user(email: str, name: str, provider: str) -> dict:
    """Finds an existing user by email or creates a new one. Returns the user dict."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, username, email FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        if user:
            return dict(user)

        cur.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s) RETURNING id, username, email",
            (name, email, f"oauth_{provider}")
        )
        user = dict(cur.fetchone())
        conn.commit()
        send_welcome_email(email, name)
        return user
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# ============================================================
# CHARGEMENT DES MODÈLES ML
# ============================================================

print("⏳ Chargement des modèles ML...")

# Tesseract OCR
try:
    pytesseract.get_tesseract_version()
    print("✅ Tesseract OCR chargé")
except Exception as e:
    print(f"⚠️  Tesseract non disponible : {e}")

# NER SciBERT
try:
    ner_tokenizer = AutoTokenizer.from_pretrained(NER_MODEL_PATH)
    ner_model     = AutoModelForTokenClassification.from_pretrained(NER_MODEL_PATH).to(DEVICE)
    id2label      = ner_model.config.id2label
    ner_model.eval()
    print("✅ NER SciBERT chargé")
except Exception as e:
    print(f"❌ NER : {e}")
    ner_model = None

# DistilBERT classification
try:
    clf_tokenizer = AutoTokenizer.from_pretrained(CLF_MODEL_PATH)
    clf_model     = AutoModelForSequenceClassification.from_pretrained(CLF_MODEL_PATH).to(DEVICE)
    clf_model.eval()
    print("✅ Classification DistilBERT chargé")
except Exception as e:
    print(f"⚠️  Classification non disponible : {e}")
    clf_model = None

# Dataset ingrédients
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

# Mapping fuzzy
try:
    df_mapping = pd.read_csv(MAPPING_PATH)
    df_mapping['ingredient_clean']     = df_mapping['ingredient_clean'].astype(str).str.lower().str.strip()
    df_mapping['ingredient_canonical'] = df_mapping['ingredient_canonical'].astype(str).str.upper().str.strip()
    INVALID_CANONICAL = {"NO", "NOO", "ELIMINATED", "A ELIMINER", "NAN", ""}
    df_mapping       = df_mapping[~df_mapping['ingredient_canonical'].isin(INVALID_CANONICAL)]
    SYNONYM_DICT     = dict(zip(df_mapping['ingredient_clean'], df_mapping['ingredient_canonical']))
    CLEAN_NAMES_LIST = list(SYNONYM_DICT.keys())
    print(f"✅ Dictionnaire Fuzzy chargé ({len(SYNONYM_DICT)} entrées)")
except Exception as e:
    print(f"⚠️  Mapping : {e}")
    SYNONYM_DICT     = {}
    CLEAN_NAMES_LIST = []

# ResNet50 / EfficientNet skin classifier
SKIN_MODEL   = None
SKIN_CLASSES = ['dry', 'normal', 'oily']

try:
    _skin_ckpt = torch.load(SKIN_MODEL_PATH, map_location=DEVICE, weights_only=False)
    if isinstance(_skin_ckpt, torch.nn.Module):
        SKIN_MODEL = _skin_ckpt.to(DEVICE).eval()
        _last = list(SKIN_MODEL.children())[-1]
        _n    = _last.out_features if hasattr(_last, 'out_features') else 3
        SKIN_CLASSES = ['dry', 'oily'] if _n == 2 else ['dry', 'normal', 'oily']
    elif isinstance(_skin_ckpt, dict):
        SKIN_CLASSES = _skin_ckpt.get('class_names', ['dry', 'normal', 'oily'])
        _n           = len(SKIN_CLASSES)
        if any('layer' in k for k in _skin_ckpt.get('model_state_dict', {}).keys()):
            _net = tv_models.resnet50(weights=None)
            _net.fc = torch.nn.Linear(_net.fc.in_features, _n)
        else:
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

# Dataset cosmétiques
df_cosmetics = pd.DataFrame()
try:
    df_cosmetics = pd.read_csv(COSMETICS_PATH)
    df_cosmetics['Label'] = df_cosmetics['Label'].str.strip()
    print(f"✅ Cosmetics dataset chargé ({len(df_cosmetics)} produits)")
except Exception as e:
    print(f"⚠️  Cosmetics dataset non disponible : {e}")

# ============================================================
# MODÈLES PYDANTIC
# ============================================================

class SendOtpRequest(BaseModel):
    phone: str

class VerifyOtpRequest(BaseModel):
    phone: str
    code: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class HistoryCreateRequest(BaseModel):
    user_id: int
    type: Optional[str] = None
    product_name: Optional[str] = None
    ingredients: Optional[str] = None

class HistoryDeleteAllRequest(BaseModel):
    user_id: int

class FavoriteCreateRequest(BaseModel):
    user_id: int
    type: Optional[str] = None
    product_name: Optional[str] = None
    ingredients: Optional[str] = None

class RoutineCreateRequest(BaseModel):
    userId: int
    name: str
    texture: Optional[str] = "medium"
    waitTime: Optional[int] = None
    type: str

class RoutineUpdateRequest(BaseModel):
    done: bool

class DiscussionCreateRequest(BaseModel):
    title: str
    content: str
    author_name: str
    category: Optional[str] = None
    user_id: Optional[int] = None
    product_id: Optional[int] = None
    rating: Optional[float] = None

class DiscussionDeleteRequest(BaseModel):
    userId: int

class LikeRequest(BaseModel):
    userId: int

class CommentCreateRequest(BaseModel):
    content: str
    username: str

class CommentDeleteRequest(BaseModel):
    userId: Optional[int] = None

class SkinLogCreateRequest(BaseModel):
    userId: int
    status: str
    routineCompleted: Optional[bool] = False

class IngredientsPayload(BaseModel):
    ingredients: list[str]

class TextPayload(BaseModel):
    text: str

class RecommendPayload(BaseModel):
    skin_type: str
    product_type: str
    top_n: int = 3
    max_price: float = 999.0

# ============================================================
# FONCTIONS ML — OCR
# ============================================================

def correct_rotation(img: np.ndarray) -> np.ndarray:
    gray   = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) == 0:
        return img
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    (h, w) = img.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def preprocess(img: np.ndarray) -> np.ndarray:
    img  = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    gray  = clahe.apply(gray)
    gray  = cv2.bilateralFilter(gray, 9, 75, 75)
    return gray


def _extract_inci_section(text: str) -> str:
    patterns = [
        r'ingr[ée]dients?\s*[:\-]?\s*',
        r'inci\s*[:\-]?\s*',
        r'composition\s*[:\-]?\s*',
        r'contains?\s*[:\-]?\s*',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return text[match.end():].strip()
    lines      = text.split("\n")
    candidates = [l for l in lines if len(l) > 10 and "," in l]
    return " ".join(candidates) if candidates else text.strip()


def run_ocr(image_bytes: bytes) -> dict:
    nparr   = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError("Image illisible")

    # Stratégie 1 : preprocessing standard
    img_prep1 = preprocess(img_bgr)
    text1_p6  = pytesseract.image_to_string(img_prep1, config="--oem 3 --psm 6", lang="eng").strip()
    text1_p4  = pytesseract.image_to_string(img_prep1, config="--oem 3 --psm 4", lang="eng").strip()
    text1     = text1_p6 if len(text1_p6) >= len(text1_p4) else text1_p4

    # Stratégie 2 : niveaux de gris simple
    gray2    = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray2_x2 = cv2.resize(gray2, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    text2_p6 = pytesseract.image_to_string(gray2_x2, config="--oem 3 --psm 6", lang="eng").strip()
    text2_p4 = pytesseract.image_to_string(gray2_x2, config="--oem 3 --psm 4", lang="eng").strip()
    text2    = text2_p6 if len(text2_p6) >= len(text2_p4) else text2_p4

    # Stratégie 3 : binarisation adaptative
    gray3    = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray3_x2 = cv2.resize(gray3, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    binary3  = cv2.adaptiveThreshold(
        gray3_x2, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10
    )
    text3_p6 = pytesseract.image_to_string(binary3, config="--oem 3 --psm 6", lang="eng").strip()
    text3_p4 = pytesseract.image_to_string(binary3, config="--oem 3 --psm 4", lang="eng").strip()
    text3    = text3_p6 if len(text3_p6) >= len(text3_p4) else text3_p4

    candidates = [text1, text2, text3]
    full_text  = max(candidates, key=lambda t: len(t)).strip()

    print(f"  Stratégie 1 ({len(text1)} chars) | 2 ({len(text2)} chars) | 3 ({len(text3)} chars)")
    print(f"  → Meilleur résultat : {len(full_text)} chars")

    inci_text = _extract_inci_section(full_text)

    try:
        data     = pytesseract.image_to_data(
            gray2_x2, config="--oem 3 --psm 6",
            lang="eng", output_type=pytesseract.Output.DICT
        )
        confs    = [int(c) for c in data["conf"] if str(c).lstrip("-").isdigit() and int(c) >= 0]
        avg_conf = float(np.mean(confs)) / 100.0 if confs else 0.8
    except Exception:
        avg_conf = 0.8

    return {
        "full_text":    full_text,
        "inci_text":    inci_text,
        "avg_conf":     round(avg_conf, 4),
        "conf_warning": avg_conf < 0.65,
    }

# ============================================================
# FONCTIONS ML — NER
# ============================================================

def _comma_split_fallback(text: str) -> list[str]:
    parts     = re.split(r"[,;\n\t\.•]|(?:\s{2,})", text)
    BLACKLIST = {"INGREDIENTS", "INGREDIENTES", "CONTAINS", "INCI",
                 "CONTIENT", "COMPOSITION", "FR", "EN", "EU", "WITH", "AND"}
    result = []
    for p in parts:
        clean = re.sub(r"[^a-zA-Z0-9\s\-/]", "", p).strip().upper()
        if len(clean) > 2 and clean not in BLACKLIST:
            result.append(clean)
    return list(dict.fromkeys(result))


def run_ner(ocr_text: str) -> list[str]:
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

        encoding = ner_tokenizer(chunk, is_split_into_words=True, truncation=True, max_length=MAX_LEN)
        word_ids = encoding.word_ids()
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

    BLACKLIST = {"INGREDIENTS", "INGREDIENTES", "ENRICHI", "CONTIENT",
                 "WITH", "AND", "CONTAINS", "INCI", "FR", "EU"}
    result = []
    for ing in all_ingredients:
        clean = re.sub(r"[^a-zA-Z0-9\s\-/]", "", ing).strip().upper()
        if len(clean) > 2 and clean not in BLACKLIST:
            result.append(clean)
    result = list(dict.fromkeys(result))

    if not result:
        result = _comma_split_fallback(ocr_text)
    return result

# ============================================================
# FONCTIONS ML — FUZZY + SCORING
# ============================================================

def fuzzy_correct_ingredients(raw_ingredients: list[str], threshold: int = 80) -> list[dict]:
    if not SYNONYM_DICT:
        return [{"raw_ner": ing, "canonical": ing, "match_score": 0, "corrected": False}
                for ing in raw_ingredients]
    corrected_list = []
    for raw in raw_ingredients:
        raw_lower = raw.lower().strip()
        if raw_lower in SYNONYM_DICT:
            canonical = SYNONYM_DICT[raw_lower]
            corrected_list.append({"raw_ner": raw, "canonical": canonical,
                                    "match_score": 100, "corrected": canonical.upper() != raw.upper()})
            continue
        match_result = process.extractOne(raw_lower, CLEAN_NAMES_LIST, scorer=fuzz.token_sort_ratio)
        if match_result and match_result[1] >= threshold:
            canonical = SYNONYM_DICT[match_result[0]]
            corrected_list.append({"raw_ner": raw, "canonical": canonical,
                                    "match_score": match_result[1],
                                    "corrected": canonical.upper() != raw.upper()})
        else:
            corrected_list.append({"raw_ner": raw, "canonical": raw.upper(),
                                    "match_score": match_result[1] if match_result else 0,
                                    "corrected": False})
    return corrected_list


def classify_with_distilbert(name: str) -> dict:
    if clf_model is None:
        return {"Final_Score": 1, "Danger_Level": "LOW", "source": "default"}
    try:
        enc = clf_tokenizer(name, return_tensors="pt", truncation=True,
                            padding=True, max_length=64).to(DEVICE)
        with torch.no_grad():
            logits = clf_model(**enc).logits[0]
            if len(logits) >= 4:
                probs      = torch.sigmoid(logits).cpu().numpy()
                flags      = [int(p > t) for p, t in zip(probs, CLF_THRESHOLDS)]
                score_brut = flags[0]*8 + flags[2]*8 + flags[1]*4 + flags[3]*4
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
    global_ = round(sum(scores)/len(scores)*0.6 + max(scores)*0.4, 1)
    if global_ >= 7:   return global_, "HIGH"
    elif global_ >= 4: return global_, "MODERATE"
    return global_, "LOW"


def _skin_transform(image_bytes: bytes):
    img = Image.open(_io.BytesIO(image_bytes)).convert('RGB')
    transform = T.Compose([
        T.Resize((224, 224)),
        T.ToTensor(),
        T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    return transform(img).unsqueeze(0), img

# ============================================================
# ENDPOINTS — SANTÉ
# ============================================================

@app.get("/health")
def health():
    return {
        "status":  "ok",
        "device":  str(DEVICE),
        "dataset": len(df_dataset) if not df_dataset.empty else 0,
        "mapping": len(SYNONYM_DICT),
    }

# ============================================================
# ENDPOINTS — AUTHENTIFICATION (email / OTP)
# ============================================================

@app.post("/api/v1/auth/send-otp")
def send_otp(body: SendOtpRequest):
    code       = str(random.randint(100000, 999999))
    expires_at = time.time() + 10 * 60
    otp_store[body.phone] = {"code": code, "expires_at": expires_at}
    try:
        twilio_client.messages.create(
            body=f"🌸 AuraSkin — Code : {code} (expire dans 10 min)",
            from_=os.getenv("TWILIO_PHONE"),
            to=body.phone,
        )
        return {"message": "Code envoyé avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur envoi SMS : {str(e)}")


@app.post("/api/v1/auth/verify-otp")
def verify_otp(body: VerifyOtpRequest):
    stored = otp_store.get(body.phone)
    if not stored:
        raise HTTPException(status_code=400, detail="Aucun code trouvé")
    if time.time() > stored["expires_at"]:
        otp_store.pop(body.phone, None)
        raise HTTPException(status_code=400, detail="Code expiré")
    if stored["code"] != body.code:
        raise HTTPException(status_code=400, detail="Code incorrect")
    otp_store.pop(body.phone, None)
    return {"message": "Code vérifié avec succès"}


@app.post("/api/v1/auth/register", status_code=201)
def register(body: RegisterRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (body.email,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Cet email est déjà utilisé")
        # BUG FIX from doc 1: was using bare `name`/`email` variables instead of body.*
        cur.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s) RETURNING id, username, email",
            (body.name, body.email, body.password)
        )
        user = dict(cur.fetchone())
        conn.commit()
        send_welcome_email(body.email, body.name)
        return {"message": "Compte créé", "user": user}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post("/api/v1/auth/login")
def login(body: LoginRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, username, email FROM users WHERE email = %s AND password = %s",
            (body.email, body.password)
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Identifiants incorrects")
        return {"accessToken": "fake-jwt", "user": dict(user)}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur serveur")
    finally:
        conn.close()

# ============================================================
# ENDPOINTS — OAUTH GOOGLE
# ============================================================

@app.get("/api/v1/auth/google")
def google_login():
    redirect_uri = f"{BACKEND_URL}/api/v1/auth/google/callback"
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=select_account"
    )
    return RedirectResponse(url)


@app.get("/api/v1/auth/google/callback")
async def google_callback(code: str = Query(...)):
    redirect_uri = f"{BACKEND_URL}/api/v1/auth/google/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_data = token_res.json()
        if "error" in token_data:
            raise HTTPException(status_code=400, detail=f"Google token error: {token_data['error']}")

        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        info = userinfo_res.json()

    email = info.get("email")
    name  = info.get("name", email)
    if not email:
        raise HTTPException(status_code=400, detail="Google n'a pas retourné d'email")

    user = upsert_oauth_user(email, name, "google")
    return RedirectResponse(
        f"{FRONTEND_URL}/oauth-callback"
        f"?accessToken=fake-jwt"
        f"&userId={user['id']}"
        f"&username={user['username']}"
        f"&email={user['email']}"
    )

# ============================================================
# ENDPOINTS — OAUTH GITHUB
# ============================================================

@app.get("/api/v1/auth/github")
def github_login():
    redirect_uri = f"{BACKEND_URL}/api/v1/auth/github/callback"
    url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        "&scope=user:email"
    )
    return RedirectResponse(url)


@app.get("/api/v1/auth/github/callback")
async def github_callback(code: str = Query(...)):
    redirect_uri = f"{BACKEND_URL}/api/v1/auth/github/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        token_data = token_res.json()
        if "error" in token_data:
            raise HTTPException(status_code=400, detail=f"GitHub token error: {token_data['error']}")

        access_token = token_data["access_token"]
        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        gh_user = user_res.json()

        email = gh_user.get("email")
        if not email:
            emails_res = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            emails  = emails_res.json()
            primary = next((e for e in emails if e.get("primary") and e.get("verified")), None)
            if primary:
                email = primary["email"]
            else:
                verified = next((e for e in emails if e.get("verified")), None)
                email = verified["email"] if verified else None

    if not email:
        raise HTTPException(status_code=400, detail="GitHub n'a pas retourné d'email vérifié")

    name = gh_user.get("name") or gh_user.get("login") or email
    user = upsert_oauth_user(email, name, "github")
    return RedirectResponse(
        f"{FRONTEND_URL}/oauth-callback"
        f"?accessToken=fake-jwt"
        f"&userId={user['id']}"
        f"&username={user['username']}"
        f"&email={user['email']}"
    )

# ============================================================
# ENDPOINTS — HISTORIQUE
# ============================================================

@app.get("/api/v1/history")
def get_history(userId: int = Query(...)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM scan_history WHERE user_id = %s ORDER BY created_at DESC", (userId,))
        return [dict(row) for row in cur.fetchall()]
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur chargement historique")
    finally:
        conn.close()


@app.post("/api/v1/history", status_code=201)
def create_history(body: HistoryCreateRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO scan_history (user_id, type, product_name, ingredients) VALUES (%s, %s, %s, %s) RETURNING *",
            (body.user_id, body.type, body.product_name, body.ingredients)
        )
        row = dict(cur.fetchone())
        conn.commit()
        return row
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.delete("/api/v1/history/{item_id}")
def delete_history_item(item_id: int):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM scan_history WHERE id = %s", (item_id,))
        conn.commit()
        return {"success": True}
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur suppression")
    finally:
        conn.close()


@app.delete("/api/v1/history")
def delete_all_history(body: HistoryDeleteAllRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM scan_history WHERE user_id = %s", (body.user_id,))
        conn.commit()
        return {"success": True}
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur suppression totale")
    finally:
        conn.close()

# ============================================================
# ENDPOINTS — FAVORIS
# ============================================================

@app.get("/api/v1/favorites")
def get_favorites(userId: int = Query(...)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM favorites WHERE user_id = %s ORDER BY created_at DESC", (userId,))
        return [dict(row) for row in cur.fetchall()]
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur chargement favoris")
    finally:
        conn.close()


@app.post("/api/v1/favorites", status_code=201)
def create_favorite(body: FavoriteCreateRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM favorites WHERE user_id = %s AND product_name = %s",
                    (body.user_id, body.product_name))
        if cur.fetchone():
            return {"message": "Déjà en favori"}
        cur.execute(
            "INSERT INTO favorites (user_id, type, product_name, ingredients) VALUES (%s, %s, %s, %s) RETURNING *",
            (body.user_id, body.type, body.product_name, body.ingredients)
        )
        row = dict(cur.fetchone())
        conn.commit()
        return row
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# ============================================================
# ENDPOINTS — ROUTINE
# ============================================================

@app.get("/api/v1/routine")
def get_routine(userId: int = Query(...), type: str = Query(...)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM routine_steps WHERE user_id = %s AND type = %s ORDER BY created_at ASC",
            (userId, type)
        )
        return [dict(row) for row in cur.fetchall()]
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur chargement routine")
    finally:
        conn.close()


@app.post("/api/v1/routine", status_code=201)
def create_routine_step(body: RoutineCreateRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO routine_steps (user_id, name, done, texture, wait_time, type) VALUES (%s, %s, false, %s, %s, %s) RETURNING *",
            (body.userId, body.name, body.texture or "medium", body.waitTime, body.type)
        )
        row = dict(cur.fetchone())
        conn.commit()
        return row
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.put("/api/v1/routine/{step_id}")
def update_routine_step(step_id: int, body: RoutineUpdateRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE routine_steps SET done = %s WHERE id = %s RETURNING *",
                    (body.done, step_id))
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur mise à jour étape")
    finally:
        conn.close()


@app.delete("/api/v1/routine/{step_id}")
def delete_routine_step(step_id: int):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM routine_steps WHERE id = %s", (step_id,))
        conn.commit()
        return {"success": True}
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur suppression étape")
    finally:
        conn.close()

# ============================================================
# ENDPOINTS — DISCUSSIONS
# ============================================================

@app.get("/api/v1/discussions")
def get_discussions(productId: Optional[int] = Query(None)):
    conn = get_db()
    try:
        cur = conn.cursor()
        if productId:
            cur.execute("SELECT * FROM discussions WHERE product_id = %s ORDER BY created_at DESC", (productId,))
        else:
            cur.execute("SELECT * FROM discussions ORDER BY created_at DESC")
        return [dict(row) for row in cur.fetchall()]
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur chargement discussions")
    finally:
        conn.close()


@app.post("/api/v1/discussions", status_code=201)
def create_discussion(body: DiscussionCreateRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO discussions (title, content, author_name, category, user_id, likes, product_id, rating)
               VALUES (%s, %s, %s, %s, %s, 0, %s, %s) RETURNING *""",
            (body.title, body.content, body.author_name, body.category,
             body.user_id, body.product_id, body.rating)
        )
        row = dict(cur.fetchone())
        conn.commit()
        return row
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.delete("/api/v1/discussions/{discussion_id}")
def delete_discussion(discussion_id: int, body: DiscussionDeleteRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM discussions WHERE id = %s AND user_id = %s",
                    (discussion_id, body.userId))
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="Non autorisé à supprimer ce post")
        cur.execute("DELETE FROM comments WHERE discussion_id = %s", (discussion_id,))
        cur.execute("DELETE FROM discussion_likes WHERE discussion_id = %s", (discussion_id,))
        cur.execute("DELETE FROM discussions WHERE id = %s", (discussion_id,))
        conn.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Erreur suppression discussion")
    finally:
        conn.close()

# ============================================================
# ENDPOINTS — LIKES
# ============================================================

@app.post("/api/v1/discussions/{discussion_id}/like")
def toggle_like(discussion_id: int, body: LikeRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM discussion_likes WHERE user_id = %s AND discussion_id = %s",
                    (body.userId, discussion_id))
        existing = cur.fetchone()
        if existing:
            cur.execute("DELETE FROM discussion_likes WHERE user_id = %s AND discussion_id = %s",
                        (body.userId, discussion_id))
            cur.execute(
                "UPDATE discussions SET likes = GREATEST(0, COALESCE(likes, 0) - 1) WHERE id = %s RETURNING *",
                (discussion_id,)
            )
            row = dict(cur.fetchone())
            conn.commit()
            return {**row, "liked": False}
        else:
            cur.execute("INSERT INTO discussion_likes (user_id, discussion_id) VALUES (%s, %s)",
                        (body.userId, discussion_id))
            cur.execute(
                "UPDATE discussions SET likes = COALESCE(likes, 0) + 1 WHERE id = %s RETURNING *",
                (discussion_id,)
            )
            row = dict(cur.fetchone())
            conn.commit()
            return {**row, "liked": True}
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Erreur like")
    finally:
        conn.close()

# ============================================================
# ENDPOINTS — COMMENTAIRES
# ============================================================

@app.get("/api/v1/discussions/{discussion_id}/comments")
def get_comments(discussion_id: int):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM comments WHERE discussion_id = %s ORDER BY created_at ASC", (discussion_id,))
        return [dict(row) for row in cur.fetchall()]
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur commentaires")
    finally:
        conn.close()


@app.post("/api/v1/discussions/{discussion_id}/comments", status_code=201)
def create_comment(discussion_id: int, body: CommentCreateRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO comments (discussion_id, username, content) VALUES (%s, %s, %s) RETURNING *",
            (discussion_id, body.username, body.content)
        )
        row = dict(cur.fetchone())
        conn.commit()
        return row
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Erreur ajout commentaire")
    finally:
        conn.close()


@app.delete("/api/v1/discussions/{discussion_id}/comments/{comment_id}")
def delete_comment(discussion_id: int, comment_id: int, body: CommentDeleteRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM comments WHERE id = %s", (comment_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Commentaire introuvable")
        cur.execute("DELETE FROM comments WHERE id = %s", (comment_id,))
        conn.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Erreur suppression commentaire")
    finally:
        conn.close()

# ============================================================
# ENDPOINTS — SKIN LOG
# ============================================================

@app.get("/api/v1/skin-log")
def get_skin_logs(userId: int = Query(...)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, status, routine_completed, date FROM skin_logs
               WHERE user_id = %s AND date >= NOW() - INTERVAL '30 days'
               ORDER BY date DESC""",
            (userId,)
        )
        return [dict(row) for row in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post("/api/v1/skin-log", status_code=201)
def create_or_update_skin_log(body: SkinLogCreateRequest):
    conn = get_db()
    try:
        cur   = conn.cursor()
        today = date.today().isoformat()
        cur.execute("SELECT id FROM skin_logs WHERE user_id = %s AND DATE(date) = %s",
                    (body.userId, today))
        existing = cur.fetchone()
        if existing:
            cur.execute(
                "UPDATE skin_logs SET status = %s, routine_completed = %s WHERE user_id = %s AND DATE(date) = %s RETURNING *",
                (body.status, body.routineCompleted or False, body.userId, today)
            )
        else:
            cur.execute(
                "INSERT INTO skin_logs (user_id, status, routine_completed) VALUES (%s, %s, %s) RETURNING *",
                (body.userId, body.status, body.routineCompleted or False)
            )
        row = dict(cur.fetchone())
        conn.commit()
        return row
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# ============================================================
# ENDPOINTS — SHELF
# ============================================================

@app.get("/api/v1/shelf")
def get_shelf(userId: int = Query(...)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM shelf WHERE user_id = %s ORDER BY created_at DESC", (userId,))
        return [dict(row) for row in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# ============================================================
# ENDPOINTS — ML : ANALYSE IMAGE (OCR → NER)
# ============================================================

@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    ct = file.content_type or ""
    if ct and not ct.startswith("image/") and ct not in ("application/octet-stream", ""):
        raise HTTPException(400, f"Type non supporté : {ct}")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(400, "Fichier vide")
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image trop lourde (max 10 MB)")

    try:
        ocr_result = run_ocr(image_bytes)
    except ValueError as e:
        raise HTTPException(422, f"Erreur OCR : {e}")

    print("\n" + "="*60)
    print("OCR BRUT (full_text) :")
    print(ocr_result["full_text"])
    print("─"*60)
    print("INCI SECTION :")
    print(ocr_result.get("inci_text", "—"))
    print("="*60)

    ocr_section = ocr_result.get("inci_text") or ocr_result["full_text"]
    ingredients = run_ner(ocr_section)
    print(f"NER OUTPUT ({len(ingredients)}) : {ingredients}")

    if not ingredients or len(ingredients) < 2:
        ingredients = _comma_split_fallback(ocr_result["full_text"])
        print(f"FALLBACK comma-split ({len(ingredients)}) : {ingredients}")

    print("="*60)

    return {
        "ocr_text":       ocr_result["full_text"],
        "avg_confidence": ocr_result["avg_conf"],
        "conf_warning":   ocr_result["conf_warning"],
        "ingredients":    ingredients,
        "count":          len(ingredients),
    }

# ============================================================
# ENDPOINTS — ML : ANALYSE INGRÉDIENTS
# ============================================================

@app.post("/analyze/ingredients")
def analyze_ingredients(payload: IngredientsPayload):
    if not payload.ingredients:
        raise HTTPException(400, "Liste vide")

    corrected = fuzzy_correct_ingredients(payload.ingredients)
    scored    = [score_one_ingredient(item) for item in corrected]
    global_score, danger_produit = compute_global_score(scored)

    return {
        "score_global":   global_score,
        "danger_produit": danger_produit,
        "nb_ingredients": len(scored),
        "high_risk":      [i["name"] for i in scored if i["danger"] == "HIGH"],
        "moderate_risk":  [i["name"] for i in scored if i["danger"] == "MODERATE"],
        "stats": {
            "from_database": sum(1 for i in scored if i["source"] == "database"),
            "from_model":    sum(1 for i in scored if i["source"] == "model"),
            "corrected":     sum(1 for i in scored if i["corrected"]),
        },
        "ingredients": scored,
    }


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
# ENDPOINTS — ML : ANALYSE PEAU
# ============================================================

@app.post("/analyze/skin")
async def analyze_skin(file: UploadFile = File(...)):
    if SKIN_MODEL is None:
        raise HTTPException(503, "Skin classifier non disponible")

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

        return {
            "skin_type":  skin_type,
            "confidence": round(confidence, 4),
            "skin_profile": {cls: round(float(p), 4) for cls, p in zip(SKIN_CLASSES, probs)},
            "recommendation_tip": {
                "dry":    "Privilégiez des crèmes riches en hydratants (glycérine, acide hyaluronique).",
                "oily":   "Optez pour des formules légères, non comédogènes et sans huiles minérales.",
                "normal": "Votre peau est équilibrée — maintenez une routine simple et douce.",
            }.get(skin_type, "Consultez un dermatologue pour une routine personnalisée.")
        }
    except Exception as e:
        raise HTTPException(500, f"Erreur analyse peau : {str(e)}")

# ============================================================
# ENDPOINTS — RECOMMANDATIONS
# ============================================================

SKIN_TO_COL   = {"dry": "Dry", "oily": "Oily", "normal": "Normal"}
PRODUCT_TYPES = ["Moisturizer", "Cleanser", "Treatment", "Face Mask", "Eye cream", "Sun protect"]


@app.post("/recommend")
def recommend_products(payload: RecommendPayload):
    if df_cosmetics.empty:
        raise HTTPException(503, "Dataset cosmétiques non disponible")

    skin_col = SKIN_TO_COL.get(payload.skin_type.lower())
    if skin_col is None:
        raise HTTPException(400, f"skin_type invalide. Valeurs : {list(SKIN_TO_COL.keys())}")

    ptype_match = next((p for p in PRODUCT_TYPES if p.lower() == payload.product_type.lower()), None)
    if ptype_match is None:
        raise HTTPException(400, f"product_type invalide. Valeurs : {PRODUCT_TYPES}")

    top_n    = min(max(payload.top_n, 1), 5)
    filtered = df_cosmetics[
        (df_cosmetics[skin_col] == 1) &
        (df_cosmetics['Label'] == ptype_match) &
        (df_cosmetics['Price'] <= payload.max_price)
    ].copy()

    if filtered.empty:
        raise HTTPException(404, "Aucun produit trouvé")

    # Take top 30 by rank as candidate pool — re-sorted by toxicity below
    filtered = filtered.sort_values('Rank', ascending=False).head(30)
    results  = []

    for _, row in filtered.iterrows():
        raw_ings = [i.strip() for i in str(row['Ingredients']).split(',')][:15]
        raw_ings = [i for i in raw_ings if len(i) > 2]
        try:
            corrected       = fuzzy_correct_ingredients(raw_ings)
            scored          = [score_one_ingredient(item) for item in corrected]
            g_score, danger = compute_global_score(scored)
        except Exception:
            g_score, danger, scored = 2.0, "LOW", []

        results.append({
            "name":                      row['Name'],
            "brand":                     row['Brand'],
            "price":                     float(row['Price']),
            "rank":                      float(row['Rank']),
            "safety_score":              round(g_score, 1),
            "danger_level":              danger,
            "ingredients_preview":       raw_ings[:5],
            "high_risk_ingredients":     [s["name"] for s in scored if s["danger"] == "HIGH"][:3],
            "moderate_risk_ingredients": [s["name"] for s in scored if s["danger"] == "MODERATE"][:3],
        })

    # ✅ Sort by toxicity score ASC (safest first), rank DESC as tiebreaker
    # safety_score is a danger score: LOWER = safer product
    results.sort(key=lambda x: (x['safety_score'], -x['rank']))

    return {
        "skin_type":       payload.skin_type,
        "product_type":    ptype_match,
        "total_found":     len(results),
        "recommendations": results[:top_n],
        "available_types": PRODUCT_TYPES,
    }


@app.get("/recommend/types")
def get_product_types():
    return {"product_types": PRODUCT_TYPES, "skin_types": list(SKIN_TO_COL.keys())}

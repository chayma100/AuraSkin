# 🌿 AuraSkin — AI-Powered Cosmetic Ingredient Analyzer

> Scan, analyze, and understand what you put on your skin.

AuraSkin is a full-stack mobile-first web application that combines **OCR**, **NLP**, and **Computer Vision** to help users make safer cosmetic choices. It analyzes product ingredients for toxicity, detects skin type from a selfie, and recommends safe products tailored to your profile.

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| 📸 **Ingredient Scanner** | Scan a product label via camera — OCR extracts the INCI ingredient list automatically |
| 🔍 **Barcode Scanner** | Scan a product barcode to retrieve its ingredients from a local database or Open Beauty Facts |
| 🧪 **Toxicity Analysis** | Each ingredient is analyzed for Cancer, Allergy, Reproductive Toxicity, and Usage Restrictions |
| 🤳 **Skin Type Detection** | Take a selfie — a fine-tuned ResNet50 predicts your skin type (Dry / Oily / Normal) |
| 🌿 **Product Recommendation** | Get safe product recommendations matched to your skin type and product preference |
| ❤️ **Favorites & History** | Save products and access your scan history |
| 💬 **Community Discussions** | Share reviews and read experiences from other users |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         Frontend — React + TypeScript        │
│   (Vite · Tailwind · Framer Motion)         │
└──────────────────┬──────────────────────────┘
                   │ HTTP REST
┌──────────────────▼──────────────────────────┐
│         API Gateway — Node.js / Express      │
│              proxy + auth + routes           │
└──────────────────┬──────────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────────┐
│         AI Backend — FastAPI (Python)        │
│  OCR (EasyOCR) · NER (SciBERT)             │
│  NLP (TF-IDF + LR) · Vision (ResNet50)     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              Data Layer                      │
│  dataset_v2_clean.csv · cosmetics.csv       │
│  mapping_combine_final.csv                  │
└─────────────────────────────────────────────┘
```

---

## 🤖 AI Models

### Sprint 2 — Ingredient Toxicity Classifier
- **Model** : TF-IDF + Logistic Regression + Optuna
- **Task** : Multi-label binary classification (4 risk dimensions)
- **F1-Macro** : 0.707 (after per-class threshold tuning)
- **Classes** : Cancer · Allergies · Reproductive Toxicity · Usage Restrictions

### Sprint 3 — Skin Type Classifier
- **Model** : ResNet50 fine-tuned (Transfer Learning)
- **Task** : Binary image classification (Dry / Oily)
- **Accuracy** : 92.77% on test set
- **XAI** : Grad-CAM · LIME · Occlusion Sensitivity

> ⚠️ Model files (`.safetensors`, `.pth`) are not included in this repository due to size constraints.
> Download them separately and place them in the `backend/` folder.

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- Python >= 3.10
- pip

### 1. Clone the repository
```bash
git clone https://github.com/your-username/AuraSkin.git
cd AuraSkin
```

### 2. Start the AI Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### 3. Start the API Gateway (Node.js)
```bash
cd backend
npm install
node index.js
# runs on http://localhost:3000
```

### 4. Start the Frontend (React)
```bash
cd auth-front
npm install
npm run dev
# runs on http://localhost:5173
```

---

## 📁 Project Structure

```
AuraSkin/
├── auth-front/              # React + TypeScript frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── pages/           # Route pages
│   │   └── lib/             # Utilities (history, favorites)
├── backend/                 # Node.js proxy + FastAPI
│   ├── main.py              # FastAPI — OCR, NLP, Vision, Recommendation
│   ├── index.ts             # Node.js — API Gateway
│   ├── dataset_v2_clean.csv # Ingredient toxicity dataset
│   ├── cosmetics.csv        # Product recommendation dataset
│   └── mapping_combine_final.csv
└── README.md
```

---

## 🛠️ Tech Stack

**Frontend**
- React 18 · TypeScript · Vite
- Tailwind CSS · Framer Motion
- Quagga2 (barcode scanning)

**Backend — Node.js**
- Express · Multer · node-fetch

**Backend — Python (FastAPI)**
- EasyOCR · SciBERT (NER)
- scikit-learn · Optuna (TF-IDF + LR)
- PyTorch · torchvision (ResNet50)
- RapidFuzz (fuzzy matching)

---

## 👥 Team

Developed as a 2nd year Engineering project.

---

## 📄 License

This project is for academic purposes only.

"""
AuraSkin — Backend FastAPI
Équivalent complet du backend Node.js/Express
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import random
import time
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
from twilio.rest import Client as TwilioClient
# ── Chargement des variables d'environnement ──
load_dotenv()
print("🔍 DATABASE_URL =", os.getenv("DATABASE_URL")) 
app = FastAPI(title="AuraSkin API", version="1.0.0")

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # autorise tout pendant le dev
    allow_credentials=False,    # doit être False si allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# BASE DE DONNÉES (psycopg2 — synchrone, compatible Supabase)
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
# OTP STORE (en mémoire — comme dans Node.js)
# ============================================================

otp_store: dict[str, dict] = {}
# Structure : { phone: { "code": "123456", "expires_at": timestamp } }

# ============================================================
# TWILIO
# ============================================================

twilio_client = TwilioClient(
    os.getenv("TWILIO_ACCOUNT_SID"),
    os.getenv("TWILIO_AUTH_TOKEN")
)

# ============================================================
# EMAIL (smtplib — équivalent Nodemailer)
# ============================================================

def send_welcome_email(to_email: str, name: str):
    """Envoie un email de bienvenue via Gmail SMTP."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Bienvenue sur AuraSkin ! 🌸"
        msg["From"] = f"AuraSkin 🌸 <{os.getenv('EMAIL_USER')}>"
        msg["To"] = to_email

        html_content = f"""
<div style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9f9f9;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <div style="max-width: 500px; background: linear-gradient(180deg, #fce4ec 0%, #f3e5f5 100%); border-radius: 25px; padding: 40px 20px; text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.05);">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 40px; vertical-align: middle;">🌸</span>
            <h1 style="display: inline-block; color: #d81b60; font-size: 42px; font-weight: bold; margin: 0; vertical-align: middle; letter-spacing: -1px;">AuraSkin</h1>
          </div>
          <h2 style="color: #6a1b9a; font-size: 28px; margin-bottom: 30px; font-weight: bold;">
            Bienvenue, {name} !
          </h2>
          <div style="color: #4e342e; font-size: 18px; line-height: 1.6; margin-bottom: 20px;">
            <p style="margin: 10px 0;">Nous sommes ravis de vous accueillir dans notre</p>
            <p style="margin: 10px 0; font-weight: 500;">communauté beauté intelligente.</p>
            <p style="margin: 25px 0 10px 0;">Vous pouvez désormais scanner vos produits cosmétiques,</p>
            <p style="margin: 10px 0;">analyser leurs ingrédients et rejoindre nos discussions.</p>
          </div>
        </div>
        <p style="color: #9e9e9e; font-size: 12px; margin-top: 20px;">
          © 2026 AuraSkin 🌸 — Tous droits réservés.
        </p>
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
# MODÈLES PYDANTIC (équivalent des req.body dans Express)
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

# ============================================================
# AUTHENTIFICATION
# ============================================================

@app.post("/api/v1/auth/send-otp")
def send_otp(body: SendOtpRequest):
    """Génère et envoie un code OTP par SMS via Twilio."""
    code = str(random.randint(100000, 999999))
    expires_at = time.time() + 10 * 60  # 10 minutes

    otp_store[body.phone] = {"code": code, "expires_at": expires_at}

    try:
        twilio_client.messages.create(
            body=f"🌸 AuraSkin — Votre code de vérification est : {code}\nIl expire dans 10 minutes.",
            from_=os.getenv("TWILIO_PHONE"),
            to=body.phone,
        )
        print(f"✅ OTP envoyé à {body.phone} : {code}")
        return {"message": "Code envoyé avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur envoi SMS : {str(e)}")


@app.post("/api/v1/auth/verify-otp")
def verify_otp(body: VerifyOtpRequest):
    """Vérifie le code OTP reçu."""
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
    """Crée un nouveau compte utilisateur."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (body.email,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Cet email est déjà utilisé")

        cur.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s) RETURNING id, username, email",
            (body.name, body.email, body.password)
        )
        user = dict(cur.fetchone())
        conn.commit()

        # Envoi email de bienvenue (non bloquant — erreur ignorée)
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
    """Connexion utilisateur (vérification email + mot de passe)."""
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
# HISTORIQUE
# ============================================================

@app.get("/api/v1/history")
def get_history(userId: int = Query(...)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM scan_history WHERE user_id = %s ORDER BY created_at DESC",
            (userId,)
        )
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
# FAVORIS
# ============================================================

@app.get("/api/v1/favorites")
def get_favorites(userId: int = Query(...)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM favorites WHERE user_id = %s ORDER BY created_at DESC",
            (userId,)
        )
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
        cur.execute(
            "SELECT id FROM favorites WHERE user_id = %s AND product_name = %s",
            (body.user_id, body.product_name)
        )
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
# ROUTINE
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
        cur.execute(
            "UPDATE routine_steps SET done = %s WHERE id = %s RETURNING *",
            (body.done, step_id)
        )
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
# DISCUSSIONS
# ============================================================

@app.get("/api/v1/discussions")
def get_discussions(productId: Optional[int] = Query(None)):
    conn = get_db()
    try:
        cur = conn.cursor()
        if productId:
            cur.execute(
                "SELECT * FROM discussions WHERE product_id = %s ORDER BY created_at DESC",
                (productId,)
            )
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
            """INSERT INTO discussions 
               (title, content, author_name, category, user_id, likes, product_id, rating)
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
        cur.execute(
            "SELECT * FROM discussions WHERE id = %s AND user_id = %s",
            (discussion_id, body.userId)
        )
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
# LIKES
# ============================================================

@app.post("/api/v1/discussions/{discussion_id}/like")
def toggle_like(discussion_id: int, body: LikeRequest):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM discussion_likes WHERE user_id = %s AND discussion_id = %s",
            (body.userId, discussion_id)
        )
        existing = cur.fetchone()

        if existing:
            cur.execute(
                "DELETE FROM discussion_likes WHERE user_id = %s AND discussion_id = %s",
                (body.userId, discussion_id)
            )
            cur.execute(
                "UPDATE discussions SET likes = GREATEST(0, COALESCE(likes, 0) - 1) WHERE id = %s RETURNING *",
                (discussion_id,)
            )
            row = dict(cur.fetchone())
            conn.commit()
            return {**row, "liked": False}
        else:
            cur.execute(
                "INSERT INTO discussion_likes (user_id, discussion_id) VALUES (%s, %s)",
                (body.userId, discussion_id)
            )
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
# COMMENTAIRES
# ============================================================

@app.get("/api/v1/discussions/{discussion_id}/comments")
def get_comments(discussion_id: int):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM comments WHERE discussion_id = %s ORDER BY created_at ASC",
            (discussion_id,)
        )
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
# SKIN LOG
# ============================================================

@app.get("/api/v1/skin-log")
def get_skin_logs(userId: int = Query(...)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, status, routine_completed, date 
               FROM skin_logs 
               WHERE user_id = %s 
               AND date >= NOW() - INTERVAL '30 days'
               ORDER BY date DESC""",
            (userId,)
        )
        return [dict(row) for row in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ============================================================
# SHELF (Étagère de produits)
# ============================================================

@app.get("/api/v1/shelf")
def get_shelf(userId: int = Query(...)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM shelf WHERE user_id = %s ORDER BY created_at DESC",
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
        cur = conn.cursor()
        from datetime import date
        today = date.today().isoformat()

        cur.execute(
            "SELECT id FROM skin_logs WHERE user_id = %s AND DATE(date) = %s",
            (body.userId, today)
        )
        existing = cur.fetchone()

        if existing:
            cur.execute(
                """UPDATE skin_logs 
                   SET status = %s, routine_completed = %s 
                   WHERE user_id = %s AND DATE(date) = %s 
                   RETURNING *""",
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
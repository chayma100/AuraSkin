import express from 'express';
import cors from 'cors';
import { Client } from 'pg';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

dotenv.config();

const app = express();

app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

app.use(express.json());

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => console.log("✅ Connecté à Supabase"))
  .catch((err) => console.error("❌ Erreur SQL :", err));

// ── Nodemailer ──
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Twilio ──
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const otpStore = new Map<string, { code: string; expiresAt: number }>();

// ============================================================
// AUTHENTIFICATION
// ============================================================

app.post('/api/v1/auth/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Numéro de téléphone requis" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  otpStore.set(phone, { code, expiresAt });

  try {
    await twilioClient.messages.create({
      body: `🌸 AuraSkin — Votre code de vérification est : ${code}\nIl expire dans 10 minutes.`,
      from: process.env.TWILIO_PHONE,
      to: phone,
    });
    console.log(`✅ OTP envoyé à ${phone} : ${code}`);
    res.status(200).json({ message: "Code envoyé avec succès" });
  } catch (err: any) {
    console.error("❌ Erreur Twilio :", err.message);
    res.status(500).json({ error: "Erreur envoi SMS : " + err.message });
  }
});

app.post('/api/v1/auth/verify-otp', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: "Téléphone et code requis" });

  const stored = otpStore.get(phone);
  if (!stored) return res.status(400).json({ error: "Aucun code trouvé" });
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return res.status(400).json({ error: "Code expiré" });
  }
  if (stored.code !== code) return res.status(400).json({ error: "Code incorrect" });

  otpStore.delete(phone);
  res.status(200).json({ message: "Code vérifié avec succès" });
});

app.post('/api/v1/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Tous les champs sont requis" });

  try {
    const check = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) return res.status(409).json({ error: "Cet email est déjà utilisé" });

    const result = await client.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [name, email, password]
    );

    try {
      await transporter.sendMail({
        from: `"AuraSkin 🌸" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Bienvenue sur AuraSkin ! 🌸",
        html: `
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
            Bienvenue, ${name} !
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
`
      });
    } catch (e) { 
      console.error("❌ Erreur lors de l'envoi de l'email :", e); 
    }

    res.status(201).json({ message: "Compte créé", user: result.rows[0] });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await client.query(
      'SELECT id, username, email FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    if (result.rows.length > 0) {
      res.status(200).json({ accessToken: "fake-jwt", user: result.rows[0] });
    } else {
      res.status(401).json({ error: "Identifiants incorrects" });
    }
  } catch { res.status(500).json({ error: "Erreur serveur" }); }
});

// ============================================================
// HISTORIQUE
// ============================================================

app.get('/api/v1/history', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(401).json({ error: "Non connecté" });
  try {
    const result = await client.query(
      'SELECT * FROM scan_history WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: "Erreur chargement historique" }); }
});

app.post('/api/v1/history', async (req, res) => {
  const { user_id, type, product_name, ingredients } = req.body;
  if (!user_id) return res.status(401).json({ error: "ID Utilisateur manquant" });

  try {
    const result = await client.query(
      'INSERT INTO scan_history (user_id, type, product_name, ingredients) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, type, product_name, ingredients]
    );
    res.status(201).json(result.rows[0]);
  } catch (e: any) { 
    res.status(500).json({ error: e.message }); 
  }
});

app.delete('/api/v1/history/:id', async (req, res) => {
  try {
    await client.query('DELETE FROM scan_history WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Erreur suppression" }); }
});

app.delete('/api/v1/history', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(401).json({ error: "Non connecté" });
  try {
    await client.query('DELETE FROM scan_history WHERE user_id = $1', [user_id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Erreur suppression totale" }); }
});

// ============================================================
// FAVORIS
// ============================================================

app.get('/api/v1/favorites', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(401).json({ error: "Non connecté" });
  try {
    const result = await client.query(
      'SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: "Erreur chargement favoris" }); }
});

app.post('/api/v1/favorites', async (req, res) => {
  const { user_id, type, product_name, ingredients } = req.body;
  if (!user_id) return res.status(401).json({ error: "Non connecté" });

  try {
    const check = await client.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND product_name = $2',
      [user_id, product_name]
    );
    if (check.rows.length > 0) return res.status(200).json({ message: "Déjà en favori" });

    const result = await client.query(
      'INSERT INTO favorites (user_id, type, product_name, ingredients) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, type, product_name, ingredients]
    );
    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ROUTINE
// ============================================================

app.get('/api/v1/routine', async (req, res) => {
  const { userId, type } = req.query;
  if (!userId) return res.status(401).json({ error: "Non connecté" });
  try {
    const result = await client.query(
      'SELECT * FROM routine_steps WHERE user_id = $1 AND type = $2 ORDER BY created_at ASC',
      [userId, type]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: "Erreur chargement routine" }); }
});

app.post('/api/v1/routine', async (req, res) => {
  const { userId, name, texture, waitTime, type } = req.body;
  if (!userId) return res.status(401).json({ error: "Non connecté" });
  try {
    const result = await client.query(
      'INSERT INTO routine_steps (user_id, name, done, texture, wait_time, type) VALUES ($1, $2, false, $3, $4, $5) RETURNING *',
      [userId, name, texture || 'medium', waitTime || null, type]
    );
    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/v1/routine/:id', async (req, res) => {
  const { done } = req.body;
  try {
    const result = await client.query(
      'UPDATE routine_steps SET done = $1 WHERE id = $2 RETURNING *',
      [done, req.params.id]
    );
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: "Erreur mise à jour étape" }); }
});

app.delete('/api/v1/routine/:id', async (req, res) => {
  try {
    await client.query('DELETE FROM routine_steps WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Erreur suppression étape" }); }
});

// ============================================================
// DISCUSSIONS
// ============================================================

app.get('/api/v1/discussions', async (req, res) => {
  const { productId } = req.query;
  try {
    let result;
    if (productId) {
      result = await client.query(
        'SELECT * FROM discussions WHERE product_id = $1 ORDER BY created_at DESC',
        [productId]
      );
    } else {
      result = await client.query(
        'SELECT * FROM discussions ORDER BY created_at DESC'
      );
    }
    res.json(result.rows);
  } catch { res.status(500).json({ error: "Erreur chargement" }); }
});

// POST discussions — supporte product_id et rating
app.post('/api/v1/discussions', async (req, res) => {
  const { title, content, author_name, category, user_id, product_id, rating } = req.body;
  try {
    const result = await client.query(
      `INSERT INTO discussions 
       (title, content, author_name, category, user_id, likes, product_id, rating) 
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7) RETURNING *`,
      [title, content, author_name, category, user_id, product_id || null, rating || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


app.delete('/api/v1/discussions/:id', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(401).json({ error: "Non connecté" });
  try {
    // Vérification de propriété
    const check = await client.query(
      'SELECT * FROM discussions WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (check.rows.length === 0) return res.status(403).json({ error: "Non autorisé à supprimer ce post" });
    
    // Nettoyage des dépendances
    await client.query('DELETE FROM comments WHERE discussion_id = $1', [req.params.id]);
    await client.query('DELETE FROM discussion_likes WHERE discussion_id = $1', [req.params.id]);
    await client.query('DELETE FROM discussions WHERE id = $1', [req.params.id]);
    
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Erreur suppression discussion" }); }
});

// ============================================================
// LIKES & COMMENTAIRES
// ============================================================

app.post('/api/v1/discussions/:id/like', async (req, res) => {
  const discussionId = req.params.id;
  const { userId } = req.body;
  if (!userId) return res.status(401).json({ error: "Vous devez être connecté" });
  try {
    const check = await client.query(
      'SELECT * FROM discussion_likes WHERE user_id = $1 AND discussion_id = $2',
      [userId, discussionId]
    );
    if (check.rows.length > 0) {
      await client.query('DELETE FROM discussion_likes WHERE user_id = $1 AND discussion_id = $2', [userId, discussionId]);
      const result = await client.query(
        'UPDATE discussions SET likes = GREATEST(0, COALESCE(likes, 0) - 1) WHERE id = $1 RETURNING *',
        [discussionId]
      );
      return res.json({ ...result.rows[0], liked: false });
    } else {
      await client.query('INSERT INTO discussion_likes (user_id, discussion_id) VALUES ($1, $2)', [userId, discussionId]);
      const result = await client.query(
        'UPDATE discussions SET likes = COALESCE(likes, 0) + 1 WHERE id = $1 RETURNING *',
        [discussionId]
      );
      return res.json({ ...result.rows[0], liked: true });
    }
  } catch { res.status(500).json({ error: "Erreur like" }); }
});

app.get('/api/v1/discussions/:id/comments', async (req, res) => {
  try {
    const result = await client.query(
      'SELECT * FROM comments WHERE discussion_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: "Erreur commentaires" }); }
});

app.post('/api/v1/discussions/:id/comments', async (req, res) => {
  const { content, username } = req.body;
  try {
    const result = await client.query(
      'INSERT INTO comments (discussion_id, username, content) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, username, content]
    );
    res.status(201).json(result.rows[0]);
  } catch { res.status(500).json({ error: "Erreur ajout commentaire" }); }
});

app.delete('/api/v1/discussions/:discussionId/comments/:commentId', async (req, res) => {
  const { commentId } = req.params;
  const { userId } = req.body; // Récupéré depuis le frontend pour vérification

  try {
    const check = await client.query('SELECT * FROM comments WHERE id = $1', [commentId]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Commentaire introuvable" });

    // Note: Dans votre schéma actuel, "comments" utilise username et non user_id.
    // La vérification se fait donc par username côté frontend, mais nous supprimons ici par ID.
    await client.query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Erreur suppression commentaire" }); }
});

// ============================================================
// DÉMARRAGE
// ============================================================
  
// ── AJOUTER CES ROUTES DANS index.ts (avant le démarrage) ──

// GET — récupère les skin logs de l'utilisateur (30 derniers jours)
app.get('/api/v1/skin-log', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(401).json({ error: "Non connecté" });
  try {
    const result = await client.query(
      `SELECT id, status, routine_completed, date 
       FROM skin_logs 
       WHERE user_id = $1 
       AND date >= NOW() - INTERVAL '30 days'
       ORDER BY date DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST — sauvegarde un skin log
app.post('/api/v1/skin-log', async (req, res) => {
  const { userId, status, routineCompleted } = req.body;
  if (!userId || !status) return res.status(400).json({ error: "Données manquantes" });
  try {
    // Vérifie si un log existe déjà aujourd'hui
    const today = new Date().toISOString().split("T")[0];
    const existing = await client.query(
      `SELECT id FROM skin_logs 
       WHERE user_id = $1 AND DATE(date) = $2`,
      [userId, today]
    );

    if (existing.rows.length > 0) {
      // Met à jour le log existant
      const result = await client.query(
        `UPDATE skin_logs 
         SET status = $1, routine_completed = $2 
         WHERE user_id = $3 AND DATE(date) = $4 
         RETURNING *`,
        [status, routineCompleted || false, userId, today]
      );
      return res.json(result.rows[0]);
    }

    // Crée un nouveau log
    const result = await client.query(
      `INSERT INTO skin_logs (user_id, status, routine_completed) 
       VALUES ($1, $2, $3) RETURNING *`,
      [userId, status, routineCompleted || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});




const PORT = 8083;

app.listen(PORT, () => console.log(`🚀 Serveur AuraSkin sur http://localhost:${PORT}`));
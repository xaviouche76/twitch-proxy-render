const express = require('express');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
dotenv.config();

// 👇 Correction pour fetch en CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// parser JSON et form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// sessions stockées en Postgres
app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'user_sessions'
  }),
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 jours
}));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// --- Twitch API routes ---

// /users?users=login1,login2
app.get('/users', async (req, res) => {
  const { users } = req.query;
  if (!users) return res.status(400).json({ error: 'users parameter missing' });

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: 'POST' }
    );
    const { access_token } = await tokenRes.json();

    const query = users.split(',').map(u => `login=${u}`).join('&');
    const userRes = await fetch(`https://api.twitch.tv/helix/users?${query}`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${access_token}`
      }
    });
    const userData = await userRes.json();

    res.status(200).json(userData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// /live?users=login1,login2
app.get('/live', async (req, res) => {
  const streamers = (req.query.users || '').split(',');
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: 'POST' }
    );
    const { access_token } = await tokenRes.json();

    const query = streamers.map(s => `user_login=${s}`).join('&');
    const streamRes = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${access_token}`
      }
    });
    const streamData = await streamRes.json();

    res.status(200).json(streamData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// /clips?user_id=12345
app.get('/clips', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id parameter missing' });

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: 'POST' }
    );
    const { access_token } = await tokenRes.json();

    const clipRes = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${user_id}`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${access_token}`
      }
    });
    const clipData = await clipRes.json();

    res.status(200).json(clipData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// /videos?user_id=12345
app.get('/videos', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id parameter missing' });

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: 'POST' }
    );
    const { access_token } = await tokenRes.json();

    const videoRes = await fetch(`https://api.twitch.tv/helix/videos?user_id=${user_id}`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${access_token}`
      }
    });
    const videoData = await videoRes.json();

    res.status(200).json(videoData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// --- Auth & user management ---

// POST /register { username, email, password, confirm_password }
app.post('/register', async (req, res) => {
  const { username, email, password, confirm_password } = req.body;
  if (password !== confirm_password) {
    return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1,$2,$3) RETURNING id, username',
      [username, email, hashed]
    );
    res.status(200).json({ message: 'Inscription réussie', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'inscription', details: err.message });
  }
});

// POST /login { username, password }
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: 'Mot de passe incorrect' });
    }

    req.session.userId = user.id;
    res.status(200).json({ message: 'Connexion réussie' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la connexion', details: err.message });
  }
});

// POST /register-streamer { twitch_id, display_name, profile_image_url }
app.post('/register-streamer', async (req, res) => {
  const { twitch_id, display_name, profile_image_url } = req.body;
  if (!twitch_id) return res.status(400).json({ error: 'twitch_id is required' });

  try {
    await pool.query(
      `INSERT INTO streamers (twitch_id, display_name, profile_image_url)
       VALUES ($1,$2,$3)
       ON CONFLICT (twitch_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             profile_image_url = EXCLUDED.profile_image_url`,
      [twitch_id, display_name, profile_image_url]
    );
    res.status(200).json({ message: 'Streamer enregistré avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement', details: err.message });
  }
});

// GET /init-db — crée les tables users, streamers, user_sessions
app.get('/init-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(200),
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS streamers (
        id SERIAL PRIMARY KEY,
        twitch_id VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        profile_image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS user_sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
    `);
    res.status(200).send('✅ Tables users, streamers et user_sessions créées (ou déjà existantes).');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur init-db', details: err.message });
  }
});

// Démarrage
app.listen(PORT, () => {
  console.log(`Serveur proxy Twitch & auth lancé sur le port ${PORT}`);
});

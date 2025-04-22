const express = require('express');
const dotenv = require('dotenv');
const { Pool } = require('pg');
// 👇 Correction pour fetch en CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Pool PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// Route Twitch: récupérer infos utilisateurs
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

    const queryParams = users.split(',').map(u => `login=${u}`).join('&');
    const userRes = await fetch(`https://api.twitch.tv/helix/users?${queryParams}`, {
      headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${access_token}` }
    });
    const userData = await userRes.json();
    res.json(userData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Route Twitch: récupérer flux live
app.get('/live', async (req, res) => {
  const { users } = req.query;
  const streamers = users ? users.split(',') : [];
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  try {
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: 'POST' }
    );
    const { access_token } = await tokenRes.json();

    const queryParams = streamers.map(s => `user_login=${s}`).join('&');
    const streamRes = await fetch(`https://api.twitch.tv/helix/streams?${queryParams}`, {
      headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${access_token}` }
    });
    const streamData = await streamRes.json();
    res.json(streamData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Route d'enregistrement d'un streamer en base
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
    res.json({ message: 'Streamer enregistré avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement', details: err.message });
  }
});

// Init DB: création table streamers
app.get('/init-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streamers (
        id SERIAL PRIMARY KEY,
        twitch_id VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        profile_image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    res.send('✅ Table streamers créée (ou déjà existante).');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur init-db', details: err.message });
  }
});

// lancement du serveur
app.listen(PORT, () => console.log(`Serveur proxy Twitch lancé sur le port ${PORT}`));

const express = require('express');
const dotenv = require('dotenv');
const { Pool } = require('pg');
dotenv.config();

// 👇 Correction ici pour fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

app.get('/live', async (req, res) => {
  const streamers = req.query.users?.split(',') || [];
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
      method: 'POST'
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const query = streamers.map(s => `user_login=${s}`).join('&');
    const streamRes = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const streamData = await streamRes.json();
    res.json(streamData);

  } catch (error) {
    console.error('Erreur côté serveur :', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

app.get('/users', async (req, res) => {
  const { users } = req.query;
  if (!users) return res.status(400).json({ error: 'users parameter missing' });

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
      method: 'POST'
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const query = users.split(',').map(u => `login=${u}`).join('&');
    const userRes = await fetch(`https://api.twitch.tv/helix/users?${query}`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const userData = await userRes.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(userData);

  } catch (error) {
    console.error('Erreur côté serveur :', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

app.post('/register-streamer', async (req, res) => {
  const { twitch_id, display_name, description, profile_image_url } = req.body;
  if (!twitch_id) return res.status(400).json({ error: 'twitch_id is required' });

  try {
    await pool.query(
      `INSERT INTO streamers (twitch_id, display_name, description, profile_image_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (twitch_id) DO UPDATE SET display_name = EXCLUDED.display_name,
                                              description = EXCLUDED.description,
                                              profile_image_url = EXCLUDED.profile_image_url`,
      [twitch_id, display_name, description, profile_image_url]
    );

    res.status(200).json({ message: 'Streamer enregistre avec succes' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement', details: err.message });
  }
});

// 🔧 Init de la table streamers si elle n'existe pas (utilisable une seule fois)
app.get('/init-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streamers (
        id SERIAL PRIMARY KEY,
        twitch_id VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        description TEXT,
        profile_image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    res.status(200).send('✅ Table streamers créée (ou déjà existante).');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de la table', details: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
  console.log(`Serveur proxy Twitch lance sur le port ${PORT}`);
});

const express = require('express');
const path = require('path'); // Pour gérer les chemins des fichiers
const dotenv = require('dotenv');
const { Pool } = require('pg');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connexion à la base de données
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

// Servir le fichier index.html et autres fichiers statiques
app.use(express.static(path.join(__dirname, '../stream-team')));  // Dossier 'stream-team' contenant 'index.html', CSS, JS

// Route pour afficher index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../stream-team', 'index.html'));  // Chemin vers ton index.html
});

// ** API pour récupérer les streamers en live **
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

// ** API pour récupérer les informations des utilisateurs (streamers) **
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

// ** Inscription d'un streamer via formulaire POST **
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

    res.status(200).json({ message: 'Streamer enregistré avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement', details: err.message });
  }
});

// ** Initialisation de la table streamers (si elle n'existe pas) **
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

app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});

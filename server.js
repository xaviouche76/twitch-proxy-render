const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');
dotenv.config();

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Sert les fichiers statiques

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// Route pour servir le fichier index.html depuis la racine du serveur
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Remplace par le chemin correct
});

// Route pour récupérer les informations en live
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

// Autres routes pour gérer l'enregistrement des streamers, etc.

app.listen(PORT, () => {
  console.log(`Serveur proxy Twitch lancé sur le port ${PORT}`);
});

const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

// 👇 fetch compatible ES module
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// 🟢 STREAMS ACTUELS
app.get('/live', async (req, res) => {
  const streamers = req.query.users?.split(',') || [];
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
      method: 'POST'
    });
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
  } catch (error) {
    console.error('Erreur /live :', error);
    res.status(500).json({ error: 'Erreur Twitch live', details: error.message });
  }
});

// 👤 INFOS UTILISATEURS
app.get('/users', async (req, res) => {
  const { users } = req.query;
  if (!users) return res.status(400).json({ error: 'users parameter missing' });

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
      method: 'POST'
    });
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
  } catch (error) {
    console.error('Erreur /users :', error);
    res.status(500).json({ error: 'Erreur Twitch users', details: error.message });
  }
});

// 👥 FOLLOWERS
app.get('/followers', async (req, res) => {
  const { to_id } = req.query;
  if (!to_id) return res.status(400).json({ error: 'to_id is required' });

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
      method: 'POST'
    });
    const { access_token } = await tokenRes.json();

    const twitchRes = await fetch(`https://api.twitch.tv/helix/users/follows?to_id=${to_id}`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${access_token}`
      }
    });

    const twitchData = await twitchRes.json();
    res.status(200).json(twitchData);
  } catch (err) {
    console.error('Erreur /followers :', err);
    res.status(500).json({ error: 'Erreur Twitch followers', details: err.message });
  }
});

// 📺 CLIPS
app.get('/clips', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
      method: 'POST'
    });
    const { access_token } = await tokenRes.json();

    const clipRes = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${user_id}&first=1`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${access_token}`
      }
    });

    const clipData = await clipRes.json();
    res.status(200).json(clipData);
  } catch (err) {
    console.error('Erreur /clips :', err);
    res.status(500).json({ error: 'Erreur Twitch clips', details: err.message });
  }
});

// 🎬 VODS (vidéos récentes)
app.get('/vods', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
      method: 'POST'
    });
    const { access_token } = await tokenRes.json();

    const vodRes = await fetch(`https://api.twitch.tv/helix/videos?user_id=${user_id}&first=1&type=archive`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${access_token}`
      }
    });

    const vodData = await vodRes.json();
    res.status(200).json(vodData);
  } catch (err) {
    console.error('Erreur /vods :', err);
    res.status(500).json({ error: 'Erreur Twitch VODs', details: err.message });
  }
});

// 🚀 DÉMARRAGE
app.listen(PORT, () => {
  console.log(`Serveur proxy Twitch lancé sur le port ${PORT}`);
});

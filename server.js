const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS Header
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // autoriser tous les domaines
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/live', async (req, res) => {
  const streamers = req.query.users?.split(',') || [];
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  try {
    // Get access token
    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
      method: 'POST'
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get stream info
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

app.listen(PORT, () => {
  console.log(`Serveur proxy Twitch lancé sur le port ${PORT}`);
});

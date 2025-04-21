import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/live', async (req, res) => {
  const users = req.query.users?.split(',') || [];
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  const tokenRes = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: 'POST' }
  );

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return res.status(401).json({ error: 'Failed to get token', details: tokenData });
  }

  const accessToken = tokenData.access_token;
  const query = users.map(u => `user_login=${u}`).join('&');

  const streamsRes = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`
    }
  });

  const data = await streamsRes.json();
  res.json(data);
});

app.listen(PORT, () => console.log(`Proxy Twitch en ligne sur http://localhost:${PORT}`));
